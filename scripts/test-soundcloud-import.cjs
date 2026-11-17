const assert = require('node:assert/strict'),
  { profileUrl, readLikes } = require('../app/soundcloud-likes-import.cjs'),
  setup = require('../app/soundcloud-import.cjs');
assert.equal(
  profileUrl('https://m.soundcloud.com/person/likes?si=123'),
  'https://soundcloud.com/person'
);
for (const bad of [
  'https://soundcloud.com/you/likes',
  'https://evil.test/person',
  'http://soundcloud.com/person',
  'https://soundcloud.com/a/song',
  'https://user:pass@soundcloud.com/a',
])
  assert.throws(() => profileUrl(bad));
const track = (id) => ({
  id: 'sc-' + id,
  scId: String(id),
  remote: true,
  title: 'Track ' + id,
  artist: 'Artist',
  pageUrl: 'https://soundcloud.com/person/song-' + id,
});
(async () => {
  let page = 0;
  const read = await readLikes('https://soundcloud.com/person', {
    api: async (endpoint) => {
      if (endpoint === 'resolve')
        return {
          kind: 'user',
          id: 123,
          username: 'Profile',
          permalink_url: 'https://soundcloud.com/person',
        };
      page++;
      return page === 1
        ? {
            collection: [
              { track: { kind: 'track', id: 1, permalink_url: 'https://soundcloud.com/a/b' } },
              { playlist: { kind: 'playlist' } },
              { track: { kind: 'track', id: 2, permalink_url: 'https://soundcloud.com/a/c' } },
            ],
            next_href: 'https://api-v2.soundcloud.com/users/123/likes?offset=2',
          }
        : {
            collection: [
              { track: { kind: 'track', id: 1, permalink_url: 'https://soundcloud.com/a/b' } },
              { track: { kind: 'track', id: 3, permalink_url: 'https://soundcloud.com/a/d' } },
            ],
          };
    },
    mapTrack: (raw) => ({ ...track(raw.id), playbackUnavailable: raw.id === 2 }),
  });
  assert.equal(page, 2);
  assert.deepEqual(
    read.tracks.map((t) => t.id),
    ['sc-1', 'sc-3']
  );
  assert.equal(read.stats.playlists, 1);
  assert.equal(read.stats.unavailable, 1);
  await assert.rejects(() =>
    readLikes('https://soundcloud.com/person', {
      api: async (endpoint) =>
        endpoint === 'resolve'
          ? { kind: 'user', id: 123 }
          : { collection: [], next_href: 'https://evil.test/a' },
      mapTrack: (x) => x,
    })
  );
  await assert.rejects(() =>
    readLikes('https://soundcloud.com/person', {
      api: async () => ({ kind: 'user', id: 123 }),
      mapTrack: (x) => x,
      cancelled: () => true,
    })
  );
  const fs = require('node:fs/promises'),
    path = require('node:path'),
    os = require('node:os');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'soundsync-likes-playlist-'));
  try {
    const handlers = new Map(),
      sender = { id: 1, send() {}, isDestroyed: () => false };
    const saved = new Map([['sc-1', track(1)]]),
      remote = new Map();
    const preferences = JSON.stringify({ favoriteIds: ['local-2', 'sc-1'] });
    await fs.writeFile(path.join(root, 'ui-preferences.json'), preferences);
    const options = {
      app: { getPath: () => root },
      ipcMain: { handle: (key, fn) => handlers.set(key, fn) },
      getWindow: () => ({ webContents: sender }),
      getLibrary: () => ({ tracks: [{ id: 'local-2', soundcloudId: '2' }] }),
      getRemoteTrack: (id) => remote.get(id),
      registerRemote: (tracks) =>
        tracks.map((t) => {
          remote.set(t.id, t);
          return t;
        }),
    };
    const playlists = require('../app/playlists.cjs')(options);
    let fail = false;
    setup({
      ...options,
      readLikes: async () => ({
        ...read,
        tracks: [track(1), track(2), track(3), track(4), track(1)],
      }),
      isExcluded: (t) => t.id === 'sc-4',
      createPlaylist: async (...args) => {
        if (fail) throw Error('disk full');
        return playlists.importTracks(...args);
      },
    });
    const call = (key, ...args) => handlers.get(key)({ sender }, ...args);
    await assert.rejects(() => handlers.get('sc-import-preview')({ sender: {} }, 'url'));
    let preview = await call('sc-import-preview', 'url');
    assert.equal(preview.duplicates, 1);
    assert.equal(preview.excluded, 1);
    assert.equal(preview.toAdd, 3, 'Existing local and remote favorites must be included');
    assert.equal((await call('playlists-list')).filter((p) => !p.builtin).length, 0);
    const imported = await call('sc-import-commit', preview.token, 'SoundCloud collection');
    assert.equal(imported.added, 3);
    assert.equal(imported.name, 'SoundCloud collection');
    assert.deepEqual(
      (await call('playlists-get', imported.id)).tracks.map((t) => t.id),
      ['sc-1', 'sc-2', 'sc-3']
    );
    assert.equal(saved.size, 1, 'Import never changes existing favorites');
    assert.equal(await fs.readFile(path.join(root, 'ui-preferences.json'), 'utf8'), preferences);
    await assert.rejects(() => call('sc-import-commit', preview.token), /устарел/);
    preview = await call('sc-import-preview', 'url');
    fail = true;
    await assert.rejects(() => call('sc-import-commit', preview.token), /disk full/);
    assert.equal((await call('playlists-list')).filter((p) => !p.builtin).length, 1);
    fail = false;
    const retry = await call('sc-import-commit', preview.token);
    assert.equal(retry.added, 3, 'Failed save can be retried without losing the preview');
    await playlists.flush();
    const disk = JSON.parse(await fs.readFile(path.join(root, 'playlists.json'), 'utf8'));
    assert.equal(disk.playlists.length, 2);
    assert.equal(disk.playlists[0].tracks.length, 3);
    assert.equal(disk.playlists[0].tracks[0].pageUrl, track(1).pageUrl);
    assert.equal(disk.playlists[0].sourceUrl, read.profile.url);
    console.log(
      'SoundCloud import passed: safe links, pagination, cancellation, separate persisted playlists, complete metadata, existing favorites included and unchanged, duplicate filtering, consumed tokens and failed-save retry'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
