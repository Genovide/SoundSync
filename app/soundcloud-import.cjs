const crypto = require('node:crypto');
module.exports = function ({ ipcMain, getWindow, readLikes, isExcluded, createPlaylist }) {
  const previews = new Map(),
    jobs = new Map();
  function authorized(event) {
    if (event.sender !== getWindow()?.webContents) throw Error('Неизвестное окно');
  }
  function plan(tracks) {
    const known = new Set();
    let duplicates = 0,
      excluded = 0;
    const add = [];
    for (const t of tracks) {
      const key = String(t.scId);
      if (known.has(key)) {
        duplicates++;
        continue;
      }
      known.add(key);
      if (isExcluded(t)) {
        excluded++;
        continue;
      }
      add.push(t);
    }
    return { add, duplicates, excluded };
  }
  ipcMain.handle('sc-import-preview', async (event, url) => {
    authorized(event);
    const sender = event.sender,
      id = sender.id || 0;
    const old = jobs.get(id);
    if (old) old.cancelled = true;
    const job = { cancelled: false };
    jobs.set(id, job);
    try {
      const result = await readLikes(url, {
        cancelled: () => job.cancelled || sender.isDestroyed?.(),
        onProgress: (p) => {
          if (!sender.isDestroyed?.()) sender.send('sc-import-progress', p);
        },
      });
      if (job.cancelled) throw Error('Импорт отменён.');
      const counts = await plan(result.tracks),
        token = crypto.randomBytes(18).toString('hex');
      for (const [k, v] of previews) if (v.until < Date.now()) previews.delete(k);
      while (previews.size >= 3) previews.delete(previews.keys().next().value);
      previews.set(token, { ...result, until: Date.now() + 15 * 60 * 1000 });
      return {
        token,
        profile: result.profile,
        stats: result.stats,
        found: result.tracks.length,
        duplicates: counts.duplicates,
        excluded: counts.excluded,
        toAdd: counts.add.length,
        sample: counts.add.slice(0, 8).map((t) => ({ title: t.title, artist: t.artist })),
      };
    } finally {
      if (jobs.get(id) === job) jobs.delete(id);
    }
  });
  ipcMain.handle('sc-import-cancel', (event) => {
    authorized(event);
    const job = jobs.get(event.sender.id || 0);
    if (job) job.cancelled = true;
    return { cancelled: !!job };
  });
  ipcMain.handle('sc-import-commit', async (event, token, name) => {
    authorized(event);
    const preview = previews.get(token);
    if (!preview || preview.until < Date.now())
      throw Error('Предпросмотр устарел. Загрузи список ещё раз.');
    if (preview.committing) throw Error('Этот плейлист уже сохраняется.');
    preview.committing = true;
    try {
      const counts = plan(preview.tracks);
      if (!counts.add.length) throw Error('Нет доступных треков для импорта.');
      const title =
        name === undefined ? ('SoundCloud · ' + preview.profile.name).slice(0, 100) : name;
      const playlist = await createPlaylist(title, counts.add, preview.profile.url || '');
      previews.delete(token);
      return { ...playlist, excluded: counts.excluded, duplicates: counts.duplicates };
    } finally {
      preview.committing = false;
    }
  });
};
