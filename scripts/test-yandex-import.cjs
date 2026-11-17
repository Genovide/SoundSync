const assert = require('node:assert/strict');
const setup = require('../app/yandex-import.cjs');
const T = require('../app/playlist-transfer.js');
const url =
  'https://music.yandex.ru/playlists/lk.d5171e30-ab9d-4ce9-bb8f-2acc47ca941b?utm_source=desktop';
const track = (id, title = 'Song') => ({
  id: String(id),
  title,
  artists: [{ name: 'Artist' }, { name: 'Guest' }],
  albums: [{ title: 'Album' }],
  durationMs: 180500,
});
const response = (result) =>
  new Response(JSON.stringify({ result }), { headers: { 'content-type': 'application/json' } });
async function main() {
  assert.equal(setup.playlistUrl(url).apiPath, '/playlist/lk.d5171e30-ab9d-4ce9-bb8f-2acc47ca941b');
  assert.equal(
    setup.playlistUrl('https://music.yandex.ru/users/user/playlists/3').apiPath,
    '/users/user/playlists/3'
  );
  for (const value of [
    'http://music.yandex.ru/playlists/x',
    'https://music.yandex.ru.evil.test/playlists/x',
    'https://music.yandex.ru@evil.test/playlists/x',
    'file:///C:/Data',
    'https://127.0.0.1/',
    'https://music.yandex.ru/collection',
    'https://music.yandex.ru:1234/playlists/x',
  ])
    assert.throws(() => setup.playlistUrl(value));
  const calls = [];
  const preview = await setup.readPlaylist(url, {
    fetchImpl: async (endpoint, options) => {
      calls.push({ endpoint, options });
      if (endpoint.endsWith('/tracks')) return response([track(2, 'Second')]);
      return response({
        title: 'Collection',
        trackCount: 3,
        tracks: [
          { id: 1, track: { ...track(1, 'First'), version: 'Live' } },
          { id: 2, track: { id: 2 } },
          { id: 3 },
        ],
      });
    },
  });
  assert.equal(preview.total, 3);
  assert.equal(preview.unavailable, 1);
  assert.deepEqual(
    preview.items.map((t) => t.title),
    ['First (Live)', 'Second']
  );
  assert.deepEqual(preview.items[0].artists, ['Artist', 'Guest']);
  assert.equal(preview.items[0].artist, 'Artist, Guest');
  assert.equal(preview.items[0].album, 'Album');
  assert.equal(preview.items[0].duration, 180.5);
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[0].options.redirect, 'error');
  const large = Array.from({ length: 3839 }, (_, id) => ({ id, track: track(id, 'Track ' + id) }));
  const full = await setup.readPlaylist(url, {
    fetchImpl: async () => response({ title: 'All', tracks: large, trackCount: large.length }),
  });
  assert.equal(full.items.length, 3839);
  assert.equal(full.items.at(-1).sourceId, '3838');
  await assert.rejects(
    setup.readPlaylist(url, {
      fetchImpl: async () => response({ tracks: large, trackCount: 4000 }),
    }),
    /неполную/
  );
  await assert.rejects(
    setup.readPlaylist(url, { fetchImpl: async () => response({ tracks: [], trackCount: 10001 }) }),
    /10 000/
  );
  await assert.rejects(
    setup.readPlaylist(url, { fetchImpl: async () => new Response('', { status: 403 }) }),
    /доступ/
  );
  await assert.rejects(
    setup.readPlaylist(url, { fetchImpl: async () => new Response('<html>captcha</html>') }),
    /страницу/
  );
  const handlers = new Map();
  const sender = {};
  setup({
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    getWindow: () => ({ webContents: sender }),
    fetchImpl: async () => response({ title: 'Test', tracks: [], trackCount: 0 }),
  });
  await assert.rejects(handlers.get('yandex-import-read')({ sender: {} }, url), /sender/);
  assert.equal((await handlers.get('yandex-import-read')({ sender }, url)).total, 0);
  const item = { ...preview.items[1] };
  const ranked = T.rank(item, [
    { title: 'Second', artist: 'Wrong Person', album: 'Album', duration: 180.5 },
    { title: 'Second', artist: 'Artist', album: 'Album', duration: 180.5 },
    { title: 'Second (remix)', artist: 'Artist', album: 'Other', duration: 140 },
  ]);
  assert.equal(ranked[0].track.artist, 'Artist');
  assert.equal(ranked[0].track.title, 'Second');
  assert.equal(T.query(item), 'Artist Second');
  assert.notEqual(T.verdict(T.rank(item, [{ ...ranked[0].track, duration: 220 }])[0]), 'sure');
  assert.notEqual(
    T.verdict(
      T.rank(preview.items[0], [
        { title: 'First', artist: 'Artist', album: 'Album', duration: 180.5 },
      ])[0]
    ),
    'sure'
  );
  assert.notEqual(
    T.verdict(T.rank({ ...item, artist: '', artists: [] }, [ranked[0].track])[0]),
    'sure'
  );
  console.log(
    'PASS Yandex links, complete 3839-track collection, hydration, metadata/order, unavailable entries, incomplete/private/error responses, sender checks and matching'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
