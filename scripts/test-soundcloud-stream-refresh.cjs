const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const setup = require('../app/soundcloud-fast.cjs');
const json = (value) =>
  new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
async function main() {
  await fs.mkdir('work', { recursive: true });
  for (const status of [401, 403, 404, 410]) {
    const dir = await fs.mkdtemp(path.resolve('work/stream-refresh-'));
    await fs.writeFile(
      path.join(dir, 'public-client.json'),
      JSON.stringify({ id: 'a'.repeat(32) })
    );
    let detailReads = 0;
    const raw = (fresh) => ({
      id: 11,
      kind: 'track',
      title: 'Song',
      policy: 'ALLOW',
      track_authorization: fresh ? 'fresh-auth' : 'expired-auth',
      media: {
        transcodings: [
          {
            url: 'https://api-v2.soundcloud.com/media/' + (fresh ? 'new' : 'old'),
            format: { protocol: 'hls', mime_type: 'audio/mp4' },
          },
        ],
      },
    });
    const cloud = setup({
      dir,
      mapTrack: (t) => ({ id: 'sc-' + t.id, scId: String(t.id) }),
      fetchImpl: async (value) => {
        const url = new URL(value);
        if (url.hostname === 'soundcloud.com')
          return new Response('client_id:"' + 'b'.repeat(32) + '"');
        if (url.pathname === '/search/tracks') return json({ collection: [raw(false)] });
        if (url.pathname === '/tracks/11') {
          detailReads++;
          return json(raw(true));
        }
        if (url.pathname === '/media/old') return new Response('', { status });
        if (url.pathname === '/media/new') {
          assert.equal(url.searchParams.get('track_authorization'), 'fresh-auth');
          return json({
            url: 'https://playback.media-streaming.soundcloud.cloud/current/playlist.m3u8',
          });
        }
        throw Error('Unexpected request ' + url.pathname);
      },
    });
    const [track] = await cloud.search('Artist Song');
    const stream = await cloud.resolve(track);
    assert.equal(stream.protocol, 'hls');
    assert.equal(detailReads, 1, 'Expired search metadata was refreshed');
    await cloud.resolve(track);
    assert.equal(detailReads, 1, 'Valid stream stays cached');
    cloud.clear();
    await cloud.resolve(track);
    assert.equal(detailReads, 2, 'Invalidation also discards stale raw metadata');
  }
  console.log(
    'PASS expired SoundCloud search metadata: 401/403/404/410 refresh authorization and formats; valid streams cache and full invalidation works'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
