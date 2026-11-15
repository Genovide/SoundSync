const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = ({
  app,
  ipcMain,
  getWindow,
  getLibrary,
  getRemote,
  register,
  remoteReady,
  enabled,
}) => {
  const file = path.join(app.getPath('userData'), 'playback-session.json');
  let state,
    timer,
    writes = Promise.resolve(),
    captured;
  const ready = fs
    .readFile(file, 'utf8')
    .then((s) => {
      state = JSON.parse(s);
    })
    .catch(() => {});
  const valid = (e) => e.sender === getWindow()?.webContents;
  function write() {
    clearTimeout(timer);
    if (!state) return writes;
    const data = JSON.stringify(state);
    writes = writes
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file + '.tmp', data);
        await fs.rename(file + '.tmp', file);
      });
    return writes;
  }
  ipcMain.on('playback-session-state', (e, value) => {
    if (!valid(e) || !enabled() || !value || typeof value.current !== 'string') return;
    const locals = new Map(getLibrary().tracks.map((t) => [t.id, t]));
    const remotes = new Map();
    function resolve(id) {
      if (typeof id !== 'string' || id.length > 240) return null;
      if (locals.has(id)) return id;
      const track = getRemote(id);
      if (!track?.remote) return null;
      const snapshot = {};
      for (const key of [
        'id',
        'scId',
        'title',
        'artist',
        'album',
        'albumartist',
        'duration',
        'cover',
        'pageUrl',
        'genre',
        'tags',
        'originalTitle',
        'uploader',
        'publisherArtist',
        'metadataManual',
        'metadataVersion',
      ]) {
        const item = track[key];
        if (
          (typeof item === 'string' && item.length <= 4000) ||
          (typeof item === 'number' && Number.isFinite(item)) ||
          typeof item === 'boolean'
        )
          snapshot[key] = item;
      }
      snapshot.remote = true;
      remotes.set(id, snapshot);
      return id;
    }
    const current = resolve(value.current);
    if (!current) return;
    const list = (v, limit) =>
      Array.isArray(v) ? v.slice(0, limit).map(resolve).filter(Boolean) : [];
    state = {
      version: 1,
      current,
      queue: list(value.queue, 10000),
      upNext: list(value.upNext, 500),
      manualReturn: list(value.manualReturn, 100),
      position: Number.isFinite(value.position) ? Math.max(0, Math.min(value.position, 86400)) : 0,
      qi: Number.isInteger(value.qi) ? value.qi : 0,
      shuffle: value.shuffle === true,
      repeat: value.repeat === true,
      remotes: [...remotes.values()],
      savedAt: Date.now(),
    };
    captured?.();
    clearTimeout(timer);
    timer = setTimeout(() => write().catch(() => {}), 500);
  });
  ipcMain.handle('playback-session-load', async (e) => {
    if (!valid(e)) throw Error('Invalid sender');
    await ready;
    if (!enabled() || state?.version !== 1) return null;
    await remoteReady();
    register(Array.isArray(state.remotes) ? state.remotes : []);
    const locals = new Map(getLibrary().tracks.map((t) => [t.id, t]));
    const resolve = (id) => locals.get(id) || getRemote(id);
    const current = resolve(state.current);
    const remoteCurrent = state.remotes?.find((t) => t.id === state.current);
    if (remoteCurrent) register([remoteCurrent]);
    if (!current) return null;
    if (!current.remote) {
      try {
        await fs.access(current.path);
      } catch {
        return null;
      }
    }
    const list = (v) => (Array.isArray(v) ? v.map(resolve).filter(Boolean) : []);
    const queue = list(state.queue);
    return {
      ...state,
      remotes: undefined,
      current,
      queue,
      qi:
        queue[state.qi]?.id === current.id
          ? state.qi
          : Math.max(0, Math.min(state.qi || 0, queue.length - 1)),
      upNext: list(state.upNext),
      manualReturn: list(state.manualReturn),
    };
  });
  return {
    async flush() {
      await ready;
      const win = getWindow();
      if (win && !win.isDestroyed() && enabled()) {
        await new Promise((resolve) => {
          captured = resolve;
          const timeout = setTimeout(resolve, 450);
          captured = () => {
            clearTimeout(timeout);
            resolve();
          };
          win.webContents.send('playback-session-capture');
        });
        captured = null;
      }
      await write();
    },
  };
};
