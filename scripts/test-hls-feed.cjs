// Быстрый старт SoundCloud: разбор плейлиста, порядок байтов, перемотка и прогрев без повторной загрузки.
const assert = require('node:assert/strict');
const { createHlsFeed, parsePlaylist } = require('../app/hls-feed.cjs');

const base = 'https://cf-hls-media.sndcdn.com/playlist/abc/playlist.m3u8';
const validate = (u) => {
  if (!new URL(u).hostname.endsWith('sndcdn.com')) throw Error('host');
  return u;
};
const playlist = [
  '#EXTM3U',
  '#EXT-X-VERSION:7',
  '#EXT-X-TARGETDURATION:10',
  '#EXT-X-MAP:URI="init.mp4"',
  '#EXTINF:10.0,',
  'seg0.m4s',
  '#EXTINF:10.0,',
  'seg1.m4s',
  '#EXTINF:10.0,',
  'seg2.m4s',
  '#EXTINF:5.0,',
  'seg3.m4s',
  '#EXT-X-ENDLIST',
].join('\n');

(async () => {
  const parsed = parsePlaylist(playlist, base, validate);
  assert.equal(parsed.segments.length, 4);
  assert.equal(parsed.duration, 35);
  assert.equal(parsed.init, 'https://cf-hls-media.sndcdn.com/playlist/abc/init.mp4');
  assert.equal(
    parsePlaylist(playlist.replace('#EXT-X-MAP:URI="init.mp4"\n', ''), base, validate),
    null
  );
  assert.equal(parsePlaylist(playlist.replace('#EXT-X-ENDLIST', ''), base, validate), null);
  assert.throws(() =>
    parsePlaylist(playlist.replace('seg1.m4s', 'https://evil.example/x'), base, validate)
  );

  const hits = [];
  const fetchImpl = async (url) => {
    hits.push(url.split('/').pop());
    const body = url.endsWith('.m3u8') ? playlist : url.split('/').pop();
    return {
      ok: true,
      status: 200,
      text: async () => body,
      arrayBuffer: async () => new TextEncoder().encode('[' + body + ']').buffer,
    };
  };
  const feed = createHlsFeed({ fetchImpl, validate });
  const read = async (stream) => {
    let out = '';
    for await (const chunk of stream) out += Buffer.from(chunk).toString();
    return out;
  };

  assert.equal(await feed.warm(base), true);
  assert.deepEqual(hits.sort(), ['init.mp4', 'playlist.m3u8', 'seg0.m4s', 'seg1.m4s']);
  hits.length = 0;
  const start = await feed.open(base, 0);
  assert.equal(start.offset, 0);
  assert.equal(await read(start.readable), '[init.mp4][seg0.m4s][seg1.m4s][seg2.m4s][seg3.m4s]');
  assert.deepEqual(hits.sort(), ['seg2.m4s', 'seg3.m4s'], 'warmed pieces are not downloaded again');

  const seek = await feed.open(base, 23.5);
  assert.equal(seek.offset, 3.5);
  assert.equal(await read(seek.readable), '[init.mp4][seg2.m4s][seg3.m4s]');

  const end = await feed.open(base, 999);
  assert.equal(await read(end.readable), '[init.mp4][seg3.m4s]');

  const failing = createHlsFeed({
    fetchImpl: async () => ({ ok: false, status: 403 }),
    validate,
  });
  await assert.rejects(failing.open(base, 0), (e) => e.status === 403);
  console.log('HLS fast start: parsing, order, seeking, warm cache and expired links passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
