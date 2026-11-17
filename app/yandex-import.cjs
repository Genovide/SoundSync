const MAX_ITEMS = 10000;
const MAX_BYTES = 64 * 1024 * 1024;
function playlistUrl(value) {
  if (typeof value !== 'string' || value.length > 2000)
    throw Error('Вставь ссылку на плейлист Яндекс Музыки.');
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error('Некорректная ссылка Яндекс Музыки.');
  }
  if (
    url.protocol !== 'https:' ||
    !/^music\.yandex\.(ru|com|by|kz|uz)$/.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    throw Error('Нужна ссылка с сайта music.yandex.ru.');
  const uuid = /^\/playlists\/((?:lk\.)?[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\/?$/i.exec(
    url.pathname
  );
  if (uuid)
    return {
      sourceUrl: `https://music.yandex.ru/playlists/${uuid[1]}`,
      apiPath: '/playlist/' + uuid[1],
    };
  const legacy = /^\/users\/([\w.@-]{1,100})\/playlists\/(\d{1,12})\/?$/.exec(url.pathname);
  if (legacy)
    return {
      sourceUrl: `https://music.yandex.ru/users/${legacy[1]}/playlists/${legacy[2]}`,
      apiPath: `/users/${encodeURIComponent(legacy[1])}/playlists/${legacy[2]}`,
    };
  throw Error(
    'Открой «Мне нравится» или плейлист в Яндекс Музыке и выбери «Поделиться → Скопировать ссылку».'
  );
}
async function jsonRequest(apiPath, { fetchImpl, signal, method = 'GET', body } = {}) {
  const response = await fetchImpl('https://api.music.yandex.net' + apiPath, {
    method,
    body,
    signal,
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SoundSync-playlist-import',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
  });
  if ([401, 403, 404].includes(response.status))
    throw Error(
      'Яндекс не открыл коллекцию. Проверь ссылку и доступ к плейлисту для других пользователей.'
    );
  if (response.status === 429)
    throw Error('Яндекс просит подождать. Попробуй загрузить коллекцию позже.');
  if (!response.ok)
    throw Error('Не удалось прочитать Яндекс Музыку (HTTP ' + response.status + ').');
  if (Number(response.headers.get('content-length')) > MAX_BYTES)
    throw Error('Ответ Яндекса слишком большой.');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) {
      await response.body.cancel?.().catch(() => {});
      throw Error('Ответ Яндекса слишком большой.');
    }
    chunks.push(Buffer.from(chunk));
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Error('Яндекс вернул страницу вместо списка треков. Попробуй ещё раз позже.');
  }
  if (data.error || !data.result)
    throw Error('Яндекс не предоставил список треков этой коллекции.');
  return data.result;
}
async function readPlaylist(value, { fetchImpl = fetch } = {}) {
  const source = playlistUrl(value);
  const signal = AbortSignal.timeout(60000);
  const request = (p, options) => jsonRequest(p, { fetchImpl, signal, ...options });
  const playlist = await request(source.apiPath);
  if (!Array.isArray(playlist.tracks))
    throw Error('В ссылке нет списка треков. Скопируй ссылку именно на плейлист.');
  const total = Number(playlist.trackCount);
  if (!Number.isInteger(total) || total < 0)
    throw Error('Яндекс не сообщил полный размер коллекции.');
  if (total > MAX_ITEMS)
    throw Error('В коллекции больше 10 000 треков. Перенеси её несколькими плейлистами.');
  if (playlist.tracks.length !== total)
    throw Error('Яндекс вернул неполную коллекцию. Импорт остановлен, чтобы не потерять треки.');
  const rows = playlist.tracks;
  const missing = rows.filter((row) => !row.track?.title && !row.title);
  const hydrated = new Map();
  for (let i = 0; i < missing.length; i += 200) {
    const ids = missing.slice(i, i + 200).map((row) => String(row.id || ''));
    if (ids.some((id) => !/^\d+(?::\d+)?$/.test(id)))
      throw Error('Яндекс вернул трек без корректного идентификатора.');
    const result = await request('/tracks', {
      method: 'POST',
      body: new URLSearchParams({ 'track-ids': ids.join(',') }).toString(),
    });
    if (!Array.isArray(result)) throw Error('Не удалось получить сведения о треках Яндекса.');
    for (const track of result) hydrated.set(String(track.id), track);
  }
  let unavailable = 0;
  const items = [];
  for (const row of rows) {
    const track = row.track?.title
      ? row.track
      : row.title
        ? row
        : hydrated.get(String(row.id).split(':')[0]);
    if (!track?.title) {
      unavailable++;
      continue;
    }
    const artists = (track.artists || [])
      .map((artist) => String(artist.name || '').trim())
      .filter(Boolean);
    const album = track.albums?.[0];
    const title = String(track.title).trim();
    const version = String(track.version || '').trim();
    items.push({
      title:
        version && !title.toLocaleLowerCase().includes(version.toLocaleLowerCase())
          ? `${title} (${version})`
          : title,
      artist: artists.join(', '),
      artists,
      album: String(album?.title || ''),
      duration:
        Number.isFinite(track.durationMs) && track.durationMs > 0 ? track.durationMs / 1000 : null,
      sourceId: String(track.id || row.id),
      source: 'yandex',
    });
  }
  return {
    name: String(playlist.title || 'Из Яндекс Музыки').slice(0, 80),
    sourceUrl: source.sourceUrl,
    total,
    unavailable,
    items,
  };
}
module.exports = ({ ipcMain, getWindow, fetchImpl }) => {
  let busy = false;
  ipcMain.handle('yandex-import-read', async (event, value) => {
    if (event.sender !== getWindow()?.webContents) throw Error('Invalid import sender');
    playlistUrl(value);
    if (busy) throw Error('Коллекция уже загружается. Дождись завершения.');
    busy = true;
    try {
      return await readPlaylist(value, { fetchImpl });
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError')
        throw Error('Яндекс не ответил вовремя. Попробуй ещё раз.');
      throw error;
    } finally {
      busy = false;
    }
  });
};
module.exports.playlistUrl = playlistUrl;
module.exports.readPlaylist = readPlaylist;
