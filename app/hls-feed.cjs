// Быстрый старт потоков SoundCloud. Сейчас SoundCloud отдаёт почти всё как HLS из кусков
// fMP4 (AAC). Если отдать ffmpeg адрес плейлиста, он сам по очереди скачивает плейлист,
// заголовок и первый кусок по новым соединениям — это ~1,3 с даже на хорошем канале и
// несколько секунд через VPN. Здесь куски качает сам плеер по постоянным соединениям,
// заранее прогревает начало следующего трека и подаёт байты в ffmpeg через pipe: если
// начало уже в памяти, звук идёт почти сразу.
const { Readable } = require('node:stream');

// Разбирает обычный VOD-плейлист fMP4 с одним #EXT-X-MAP. Всё необычное — null,
// тогда остаётся прежний путь через ffmpeg.
function parsePlaylist(text, base, validate) {
  if (
    !text.startsWith('#EXTM3U') ||
    !text.includes('#EXT-X-ENDLIST') ||
    /#EXT-X-(?:STREAM-INF|BYTERANGE|DISCONTINUITY|KEY):?/.test(text)
  )
    return null;
  let init = '',
    duration = null,
    at = 0;
  const segments = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXT-X-MAP:')) {
      if (init || segments.length || line.includes('BYTERANGE=')) return null;
      const match = /URI="([^"]+)"/.exec(line);
      if (!match) return null;
      init = validate(new URL(match[1], base).href);
    } else if (line.startsWith('#EXTINF:')) {
      duration = Number(line.slice(8).split(',')[0]);
      if (!(duration > 0)) return null;
    } else if (!line.startsWith('#')) {
      if (duration === null) return null;
      segments.push({ url: validate(new URL(line, base).href), start: at, duration });
      at += duration;
      duration = null;
    }
  }
  return init && segments.length ? { init, segments, duration: at } : null;
}

function createHlsFeed({ fetchImpl = fetch, validate, warmSegments = 2, cacheBytes = 24e6 }) {
  const playlists = new Map(),
    pieces = new Map();
  let pieceBytes = 0;

  const remember = (map, key, value, limit) => {
    map.delete(key);
    map.set(key, value);
    while (map.size > limit) map.delete(map.keys().next().value);
  };
  async function playlist(url, signal) {
    const hit = playlists.get(url);
    if (hit && hit.until > Date.now()) return hit.value;
    const job = (async () => {
      const r = await fetchImpl(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)].filter(Boolean)),
      });
      if (!r.ok) throw Object.assign(Error('Playlist HTTP ' + r.status), { status: r.status });
      return parsePlaylist(await r.text(), url, validate);
    })();
    // Ссылки SoundCloud живут несколько минут; держим разбор чуть меньше.
    remember(playlists, url, { value: job, until: Date.now() + 150000 }, 20);
    job.catch(() => playlists.delete(url));
    return job;
  }
  // Кэш кусков: только начало треков (заголовок и первые куски), ограничен по размеру.
  function piece(url, signal) {
    const hit = pieces.get(url);
    if (hit) return hit.job;
    const job = (async () => {
      const r = await fetchImpl(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)),
      });
      if (!r.ok) throw Object.assign(Error('Segment HTTP ' + r.status), { status: r.status });
      return Buffer.from(await r.arrayBuffer());
    })();
    const entry = { job, size: 0 };
    remember(pieces, url, entry, 200);
    job.then(
      (bytes) => {
        if (pieces.get(url) !== entry) return;
        entry.size = bytes.length;
        pieceBytes += bytes.length;
        for (const [key, old] of pieces) {
          if (pieceBytes <= cacheBytes || key === url) break;
          pieces.delete(key);
          pieceBytes -= old.size;
        }
      },
      () => pieces.get(url) === entry && pieces.delete(url)
    );
    return job;
  }
  function forget(url) {
    const entry = pieces.get(url);
    if (!entry) return;
    pieces.delete(url);
    pieceBytes -= entry.size;
  }
  async function fresh(url, signal) {
    const r = await fetchImpl(url, { signal });
    if (!r.ok) throw Object.assign(Error('Segment HTTP ' + r.status), { status: r.status });
    return Buffer.from(await r.arrayBuffer());
  }

  // Прогрев: плейлист, заголовок и первые куски следующего трека — без звука и без плеера.
  async function warm(url) {
    const list = await playlist(url);
    if (!list) return false;
    await Promise.all([
      piece(list.init),
      ...list.segments.slice(0, warmSegments).map((s) => piece(s.url)),
    ]);
    return true;
  }

  // Поток байтов fMP4 с куска, где лежит start; offset — сколько ещё пропустить внутри него.
  async function open(url, start, signal) {
    const list = await playlist(url, signal);
    if (!list) return null;
    let index = 0;
    while (index < list.segments.length - 1 && list.segments[index + 1].start <= start) index++;
    const offset = Math.max(0, start - list.segments[index].start),
      first = index;
    // Заголовок нужен сразу: без него ffmpeg не начнёт, а при ошибке лучше откатиться на старый путь.
    const init = await piece(list.init, signal);
    async function* bytes() {
      yield init;
      // Читаем на кусок вперёд, чтобы сеть и декодирование шли параллельно.
      const get = (i) => {
        const s = list.segments[i];
        if (!s) return null;
        const job = i < first + warmSegments ? piece(s.url, signal) : fresh(s.url, signal);
        job.catch(() => {});
        return job;
      };
      let next = get(index);
      for (let i = index; i < list.segments.length; i++) {
        const current = next;
        next = get(i + 1);
        const data = await current;
        // Середину трека в кэше не держим: он только для быстрого начала.
        if (i >= first + warmSegments) forget(list.segments[i].url);
        yield data;
      }
    }
    return { offset, readable: Readable.from(bytes(), { objectMode: false }) };
  }

  return { warm, open, parsePlaylist, stats: () => ({ pieces: pieces.size, pieceBytes }) };
}

module.exports = { createHlsFeed, parsePlaylist };
