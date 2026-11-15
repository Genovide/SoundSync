// Выравнивание громкости: один раз меряем интегральную громкость трека (EBU R128, LUFS)
// через ffmpeg и запоминаем. Плеер по этому числу подтягивает тихие треки и приглушает
// громкие, чтобы между ними не приходилось крутить ручку.
const fs = require('node:fs/promises'),
  path = require('node:path'),
  { spawn } = require('node:child_process');

// Для SoundCloud хватает начала трека: так не качаем лишнее и меряем за секунды.
const REMOTE_SECONDS = 90;

// Итог ebur128: интегральная громкость (LUFS) и истинный пик (dBFS). Пик нужен, чтобы
// подтягивать тихий трек только до тех пор, пока его пики не начнут клиппировать.
function parseIntegrated(stderr) {
  const block = stderr.lastIndexOf('Integrated loudness:');
  if (block < 0) return null;
  const tail = stderr.slice(block),
    loud = /I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/.exec(tail),
    peak = /Peak:\s*(-?(?:\d+(?:\.\d+)?|inf))\s*dBFS/.exec(tail);
  const lufs = loud ? Number(loud[1]) : NaN;
  // −70 LUFS — тишина: такую «громкость» не используем, иначе тихое вступление станет оглушительным.
  if (!Number.isFinite(lufs) || lufs <= -70) return null;
  const peakDb = peak ? Number(peak[1]) : NaN;
  return { lufs, peak: Number.isFinite(peakDb) ? peakDb : null };
}

function measure(ffmpeg, input, { seconds, timeout = 60000 } = {}) {
  return new Promise((resolve) => {
    const args = ['-hide_banner', '-nostats', '-nostdin'];
    if (seconds) args.push('-t', String(seconds));
    args.push('-i', input, '-vn', '-af', 'ebur128=framelog=quiet:peak=true', '-f', 'null', '-');
    let stderr = '',
      done = false;
    const child = spawn(ffmpeg, args, { windowsHide: true });
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(null);
    }, timeout);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 200000) stderr = stderr.slice(-50000);
    });
    child.on('error', () => finish(null));
    child.on('close', () => finish(parseIntegrated(stderr)));
  });
}

module.exports = function ({ app, ipcMain, resolveInput }) {
  const file = path.join(app.getPath('userData'), 'loudness.json');
  let cache = {},
    writes = Promise.resolve(),
    queue = Promise.resolve();
  const loaded = fs
    .readFile(file, 'utf8')
    .then((text) => {
      const data = JSON.parse(text);
      if (data && typeof data === 'object') cache = data;
    })
    .catch(() => {});
  const pending = new Map();
  const persist = () => {
    // Держим кэш небольшим: последние 3000 треков.
    const keys = Object.keys(cache);
    if (keys.length > 3000)
      for (const key of keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - 3000))
        delete cache[key];
    const text = JSON.stringify(cache);
    writes = writes.then(() => fs.writeFile(file, text).catch(() => {}));
    return writes;
  };

  async function loudness(url) {
    await loaded;
    const source = await resolveInput(url);
    if (!source) return null;
    const hit = cache[source.key];
    if (hit && typeof hit.peak !== 'undefined') return { lufs: hit.lufs, peak: hit.peak };
    if (pending.has(source.key)) return pending.get(source.key);
    // По одному измерению за раз: не мешаем воспроизведению и синхронизации текста.
    const job = (queue = queue.then(async () => {
      const result = await measure(source.ffmpeg, source.input, { seconds: source.seconds });
      if (result) {
        const round = (x) => (x === null ? null : Math.round(x * 10) / 10);
        cache[source.key] = { lufs: round(result.lufs), peak: round(result.peak), at: Date.now() };
        persist();
        return { lufs: round(result.lufs), peak: round(result.peak) };
      }
      return null;
    })).finally(() => pending.delete(source.key));
    pending.set(source.key, job);
    return job;
  }

  ipcMain.handle('loudness-measure', async (_, url) => {
    if (typeof url !== 'string' || url.length > 2000) return null;
    try {
      return await loudness(url);
    } catch {
      return null;
    }
  });
  return { loudness, flush: () => writes, REMOTE_SECONDS };
};
module.exports.parseIntegrated = parseIntegrated;
module.exports.measure = measure;
module.exports.REMOTE_SECONDS = REMOTE_SECONDS;
