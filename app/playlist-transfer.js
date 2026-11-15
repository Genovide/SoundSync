/* Перенос плейлистов из других сервисов: разбор списка и подбор треков.
   Работает и в окне плеера (window.PlaylistTransfer), и в Node для тестов.

   Что понимаем на входе:
   - CSV из Exportify (Spotify), TuneMyMusic, Soundiiz: колонки названия, исполнителя, длительности;
   - M3U/M3U8: строки #EXTINF:секунды,Исполнитель - Название;
   - текст, скопированный со страницы плейлиста Яндекс Музыки или Spotify: название, исполнитель
     и длительность на отдельных строках;
   - просто список «Исполнитель — Название» (или «Название — Исполнитель», порядок неважен). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlaylistTransfer = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';
  const MAX_ITEMS = 2000;

  // ——— Разбор ———
  const DURATION = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/;
  const seconds = (text) => {
    const m = DURATION.exec(String(text || '').trim());
    return m ? (Number(m[1]) || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
  };
  function csvRows(text) {
    const rows = [];
    let row = [],
      cell = '',
      quoted = false;
    const delimiter =
      (text.split('\n', 1)[0].match(/;/g) || []).length >
      (text.split('\n', 1)[0].match(/,/g) || []).length
        ? ';'
        : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === delimiter) {
        row.push(cell);
        cell = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        cell = '';
      } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim())) rows.push(row);
    return rows;
  }
  function parseCsv(text) {
    const rows = csvRows(text);
    if (rows.length < 2) return null;
    const head = rows[0].map((h) => h.trim().toLowerCase());
    // Шаблоны по приоритету: «Artist Name(s)» важнее «Artist URI(s)», хотя в таблице стоит позже.
    const find = (...patterns) => {
      for (const p of patterns) {
        const at = head.findIndex((h) => p.test(h));
        if (at >= 0) return at;
      }
      return -1;
    };
    const title = find(/^track name$/, /^track$/, /^title$/, /^name$/, /трек|назван/),
      artist = find(/^artist name/, /^artist$/, /^artists?\b(?!.*uri)/, /исполнит|артист/),
      album = find(/^album name$/, /^album$/, /альбом/),
      duration = find(/duration/, /длительн/);
    if (title < 0 || artist < 0) return null;
    return rows.slice(1).map((r) => {
      const ms = duration >= 0 ? Number(r[duration]) : NaN;
      return {
        title: (r[title] || '').trim(),
        // Exportify перечисляет соисполнителей через запятую: для поиска хватает первого.
        artist: (r[artist] || '').split(/\s*[,;]\s*/)[0].trim(),
        album: album >= 0 ? (r[album] || '').trim() : '',
        // Длительность бывает в миллисекундах (Exportify), секундах или как «3:45».
        duration:
          duration < 0
            ? null
            : Number.isFinite(ms) && ms > 0
              ? Math.round(ms > 36000 ? ms / 1000 : ms)
              : seconds(r[duration]),
      };
    });
  }
  function parseM3u(text) {
    if (!/^#EXTM3U/m.test(text) && !/#EXTINF/i.test(text)) return null;
    const items = [];
    let info = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const extinf = /^#EXTINF:(-?\d+)[^,]*,(.*)$/i.exec(line);
      if (extinf) {
        info = { duration: Number(extinf[1]) > 0 ? Number(extinf[1]) : null, text: extinf[2] };
        continue;
      }
      if (line.startsWith('#')) continue;
      const name =
        info?.text ||
        line
          .split(/[\\/]/)
          .pop()
          .replace(/\.[a-z0-9]{2,4}$/i, '');
      items.push({ ...splitLine(name), duration: info?.duration ?? null });
      info = null;
    }
    return items;
  }
  // «Исполнитель — Название»: разделители, которые встречаются в выгрузках и копиях.
  const SEPARATORS = [' — ', ' – ', ' - ', ' · ', '\t', ' | ', ' by '];
  function splitLine(line) {
    let text = String(line)
      .replace(/^\s*(?:\d{1,4}[.)]\s+|\d{1,4}\s+(?=\D))/, '')
      .replace(/\s+\(?(?:\d{1,2}:)?\d{1,2}:\d{2}\)?\s*$/, '')
      .trim();
    for (const sep of SEPARATORS) {
      const at = text.indexOf(sep);
      if (at > 0 && at < text.length - sep.length) {
        const a = text.slice(0, at).trim(),
          b = text.slice(at + sep.length).trim();
        // «Title by Artist» — порядок обратный.
        return sep === ' by ' ? { artist: b, title: a } : { artist: a, title: b };
      }
    }
    return { artist: '', title: text };
  }
  // Копия страницы плейлиста: название, исполнитель и длительность идут отдельными строками.
  function parseBlocks(lines) {
    const durations = lines.filter((l) => DURATION.test(l)).length;
    if (durations < 2 || durations < lines.length / 5) return null;
    const items = [];
    let block = [];
    for (const line of lines) {
      if (DURATION.test(line)) {
        const parts = block.filter((x) => !/^\d{1,4}$/.test(x) && !/^(E|explicit)$/i.test(x));
        if (parts.length >= 2)
          items.push({
            title: parts[parts.length - 2],
            artist: parts[parts.length - 1].split(/\s*,\s*/)[0],
            duration: seconds(line),
          });
        else if (parts.length === 1)
          items.push({ ...splitLine(parts[0]), duration: seconds(line) });
        block = [];
      } else block.push(line);
    }
    return items;
  }
  function parse(text, filename = '') {
    text = String(text || '')
      .replace(/^\uFEFF/, '')
      .slice(0, 2_000_000);
    // Копия из приложения Spotify или ссылки на треки Яндекса — только адреса без названий:
    // по ним песни не найти без входа в сервис. Подсказываем, как выгрузить список.
    const links = text.match(
      /https?:\/\/(?:open\.spotify\.com\/track|music\.yandex\.\w+\/album\/\d+\/track)\/\S+/g
    );
    const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;
    if (links && links.length >= Math.max(1, lineCount * 0.6))
      return {
        name: '',
        items: [],
        hint: /spotify/.test(links[0]) ? 'spotify-links' : 'yandex-links',
      };
    const name = String(filename)
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .trim();
    let items =
      (/\.csv$/i.test(filename) || /^[^\n]*(track name|artist name|title)[^\n]*,/i.test(text)
        ? parseCsv(text)
        : null) || (/\.m3u8?$/i.test(filename) || /#EXTINF/i.test(text) ? parseM3u(text) : null);
    if (!items) {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      items = parseBlocks(lines) || lines.map((l) => ({ ...splitLine(l), duration: null }));
    }
    const seen = new Set();
    items = items
      .map((x) => ({
        title: String(x.title || '').trim(),
        artist: String(x.artist || '').trim(),
        album: String(x.album || '').trim(),
        duration: Number.isFinite(x.duration) && x.duration > 0 ? x.duration : null,
      }))
      .filter((x) => x.title.length > 0 && x.title.length < 300)
      .filter((x) => {
        const key = normalize(x.artist) + '\0' + normalize(x.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_ITEMS);
    return { name, items };
  }

  // ——— Сравнение ———
  const TRANSLIT = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'e',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'sch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya',
  };
  // Версии, которые нельзя принимать за оригинал, если их нет в названии из списка.
  const VARIANT =
    /\b(cover|remix|rmx|mix|sped ?up|speed ?up|slowed|nightcore|reverb|8d|bass ?boost(?:ed)?|karaoke|instrumental|acapella|a cappella|live|mashup|edit|flip|bootleg|vip|remake|rework|phonk|doomer|wave|loop|1 ?hour|tiktok)\b|\s[x×]\s|кавер|ремикс|минус|караоке|ускор|замедл|фонк/i;
  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\((?:feat|ft|prod|with)\.?[^)]*\)|\[(?:feat|ft|prod)\.?[^\]]*\]/g, ' ')
      .replace(/\s(?:feat|ft)\.?\s.*$/g, ' ')
      .replace(
        /\((?:official|music|lyric|audio|video|clip|клип|премьера|official video)[^)]*\)|\[[^\]]*(?:official|video|audio|lyric|клип)[^\]]*\]/g,
        ' '
      )
      .replace(/\s-\s(?:remaster(?:ed)?|\d{4} remaster).*$/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }
  const translit = (text) => text.replace(/[а-яё]/g, (c) => TRANSLIT[c] ?? c);
  const tokens = (text) => text.split(' ').filter((t) => t.length > 0);
  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const one = (x, y) => {
      const ta = tokens(x),
        tb = tokens(y);
      const setB = new Set(tb);
      const common = ta.filter((t) => setB.has(t)).length;
      const dice = (2 * common) / (ta.length + tb.length || 1);
      // Близкие написания («Macan» и «Макан») — по биграммам символов.
      const grams = (s) => {
        const g = new Map(),
          v = ' ' + s + ' ';
        for (let i = 0; i < v.length - 1; i++)
          g.set(v.slice(i, i + 2), (g.get(v.slice(i, i + 2)) || 0) + 1);
        return g;
      };
      const ga = grams(x),
        gb = grams(y);
      let shared = 0,
        total = 0;
      for (const [k, n] of ga) {
        shared += Math.min(n, gb.get(k) || 0);
        total += n;
      }
      for (const n of gb.values()) total += n;
      const bigram = (2 * shared) / (total || 1);
      // Одно название целиком внутри другого — похоже, но чем больше лишних слов
      // («… x Flashing Lights», «… Disco Mix»), тем ниже: это, скорее всего, другая версия.
      const short = Math.min(ta.length, tb.length),
        long = Math.max(ta.length, tb.length);
      const contains =
        x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))
          ? 0.55 + 0.45 * (short / long)
          : 0;
      return Math.max(dice, bigram, contains);
    };
    return Math.max(one(a, b), one(translit(a), translit(b)));
  }
  // Оценка кандидата 0…1. Учитываем, что на SoundCloud исполнитель часто стоит прямо в названии
  // («Artist - Title»), а загрузил трек другой аккаунт; и что порядок в списке мог быть обратным.
  function score(item, candidate) {
    const it = normalize(item.title),
      ia = normalize(item.artist),
      ct = normalize(candidate.title),
      ca = normalize(candidate.artist);
    const direct = (title, artist) => {
      let titleSim = similarity(title, ct);
      // «Artist - Title» внутри названия кандидата.
      const split = ct.split(' ');
      if (artist && titleSim < 0.95) {
        const withoutArtist = normalize(
          String(candidate.title).replace(new RegExp('^.*?\\s[-–—]\\s'), '')
        );
        titleSim = Math.max(titleSim, similarity(title, withoutArtist));
      }
      let artistSim = artist
        ? Math.max(similarity(artist, ca), ct.includes(artist) ? 0.9 : 0)
        : 0.5;
      if (!split.length) artistSim = 0;
      return 0.62 * titleSim + 0.38 * artistSim;
    };
    let value = Math.max(direct(it, ia), ia ? direct(ia, it) - 0.05 : 0);
    const itemVariant = VARIANT.test(item.title),
      candVariant = VARIANT.test(candidate.title);
    if (candVariant && !itemVariant) value -= 0.3;
    if (
      Number.isFinite(item.duration) &&
      Number.isFinite(candidate.duration) &&
      candidate.duration > 0
    ) {
      const delta = Math.abs(item.duration - candidate.duration);
      if (delta <= 3) value += 0.08;
      else if (delta > 25) value -= 0.18;
    }
    return Math.max(0, Math.min(1, value));
  }
  const SURE = 0.82,
    MAYBE = 0.55;
  function rank(item, candidates) {
    return candidates
      .map((c) => ({ track: c, score: score(item, c) }))
      .filter((x) => x.score >= MAYBE - 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
  const verdict = (best) =>
    !best ? 'missing' : best.score >= SURE ? 'sure' : best.score >= MAYBE ? 'maybe' : 'missing';
  const query = (item) => [item.artist, item.title].filter(Boolean).join(' ').slice(0, 200);

  return { parse, normalize, similarity, score, rank, verdict, query, SURE, MAYBE, MAX_ITEMS };
});
