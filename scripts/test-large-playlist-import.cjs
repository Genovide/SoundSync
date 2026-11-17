const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const setupSoundCloud = require('../app/soundcloud.cjs');
const setupPlaylists = require('../app/playlists.cjs');
const track = (id) => ({
  id: 'sc-' + id,
  scId: String(id),
  remote: true,
  title: 'Track ' + id,
  artist: 'Artist',
  album: 'Album',
  duration: 180,
  pageUrl: 'https://soundcloud.com/artist/track-' + id,
});
async function main() {
  await fs.mkdir('work', { recursive: true });
  const root = await fs.mkdtemp(path.resolve('work/large-import-'));
  const sender = {};
  const app = { getPath: () => root, on() {} };
  function boot() {
    const handlers = new Map();
    const ipcMain = { handle: (key, fn) => handlers.set(key, fn) };
    const cloud = setupSoundCloud({
      app,
      ipcMain,
      getWindow: () => ({ webContents: sender }),
      getLibrary: () => ({ tracks: [] }),
      send() {},
      fetchImpl: async () => {
        throw Error('No network in regression test');
      },
    });
    setupPlaylists({
      app,
      ipcMain,
      getWindow: () => ({ webContents: sender }),
      getLibrary: () => ({ tracks: [] }),
      getRemoteTrack: cloud.getTrack,
      registerRemote: (items) => cloud.register(items, { retain: true }),
    });
    return { cloud, call: (key, ...args) => handlers.get(key)({ sender }, ...args) };
  }
  const selected = Array.from({ length: 2500 }, (_, i) => track(i + 1));
  let { cloud, call } = boot();
  await cloud.status();
  cloud.register(selected);
  cloud.register(Array.from({ length: 3000 }, (_, i) => track(i + 10000)));
  assert.equal(cloud.getTrack('sc-1'), undefined, 'Old search results were evicted');
  const list = await call('playlists-import-list', '2500 selected tracks', selected);
  assert.equal(list.added, 2500);
  assert.equal(list.count, 2500);
  assert.equal(list.skipped, 0);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'playlists.json'), 'utf8'));
  assert.equal(saved.playlists[0].tracks.length, 2500);
  cloud.register(Array.from({ length: 3000 }, (_, i) => track(i + 20000)));
  assert.equal(
    cloud.getTrack('sc-1').title,
    'Track 1',
    'Playlist metadata survives later searches'
  );
  let details = await call('playlists-get', list.id);
  assert.equal(details.tracks.length, 2500);
  assert.ok(details.tracks.every((t) => !t.missing));
  assert.equal(details.tracks[0].id, 'sc-1');
  assert.equal(details.tracks.at(-1).id, 'sc-2500');
  ({ cloud, call } = boot());
  await cloud.status();
  details = await call('playlists-get', list.id);
  assert.equal(details.tracks.length, 2500, 'Restart restores the complete playlist');
  cloud.register(Array.from({ length: 3000 }, (_, i) => track(i + 30000)));
  assert.ok(cloud.getTrack('sc-1'));
  const duplicates = await call('playlists-import-list', 'Duplicates', [
    selected[0],
    selected[0],
    selected[1],
  ]);
  assert.equal(duplicates.added, 2);
  assert.equal(duplicates.duplicates, 1);
  const before = await fs.readFile(path.join(root, 'playlists.json'), 'utf8');
  await assert.rejects(
    call('playlists-import-list', 'Partial failure', [selected[0], 'unknown-local-id']),
    /не сохранён частично/
  );
  await assert.rejects(
    call('playlists-import-list', 'Unsafe', [{ ...track(9), pageUrl: 'https://evil.test/a/b' }]),
    /ссылка/
  );
  await assert.rejects(
    call('playlists-import-list', 'Wrong ID', [{ ...track(9), id: 'sc-10' }]),
    /идентификатор/
  );
  assert.equal(await fs.readFile(path.join(root, 'playlists.json'), 'utf8'), before);
  console.log(
    'PASS 2500 selected = 2500 saved/displayable after eviction and restart; playback metadata retained, duplicates counted, invalid imports rolled back'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
