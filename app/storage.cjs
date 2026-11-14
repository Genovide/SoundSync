const fs = require('node:fs/promises');
const path = require('node:path');
const { session, shell } = require('electron');
module.exports = ({
  app,
  ipcMain,
  dialog,
  getWindow,
  protectedFiles,
  playbackBusy,
  alignmentBusy,
}) => {
  const data = app.getPath('userData');
  const runtime = require('./runtime-paths.cjs').base;
  const install =
    process.platform === 'darwin'
      ? path.resolve(process.resourcesPath, '../..')
      : path.dirname(app.getPath('exe'));
  const roots = [
    ['program', 'Приложение', install, false],
    ['runtime', 'Среда обработки аудио', path.join(runtime, 'runtime'), false],
    ['models', 'Модели синхронизации', path.join(runtime, 'models'), false],
    ['playback', 'Кэш воспроизведения', path.join(data, 'playback-cache'), true],
    ['alignment', 'Кэш синхронизации', path.join(data, 'alignment', 'engine-cache'), true],
    ['backups', 'Резервные копии обновлений', path.join(data, 'update-backups'), true],
    ['browser', 'Кэш интерфейса и рецензий', path.join(data, 'Cache'), true],
    ['reviews', 'Кэш рецензий', path.join(data, 'Partitions', 'rzt-reviews', 'Cache'), false],
    ['data', 'Настройки, медиатека и остальные данные', data, false],
  ].map(([id, name, root, clearable]) => ({
    id,
    name,
    root: path.resolve(root),
    clearable,
    bytes: 0,
  }));
  const inside = (file, root) => file === root || file.startsWith(root + path.sep);
  async function walk(root, visit) {
    let entries;
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const file = path.join(root, entry.name);
      if (entry.isDirectory()) await walk(file, visit);
      else if (entry.isFile()) {
        try {
          await visit(file, await fs.lstat(file));
        } catch {}
      }
    }
  }
  let cached,
    pending,
    updated = 0;
  async function info(force = false) {
    if (pending) return pending;
    if (!force && cached && Date.now() - updated < 120000) return cached;
    pending = (async () => {
      const rows = roots.map((r) => ({ ...r, bytes: 0 }));
      const top = [...new Set(roots.map((r) => r.root))].filter(
        (r, _, all) => !all.some((other) => other !== r && inside(r, other))
      );
      for (const root of top)
        await walk(root, (file, stat) => {
          const bucket = rows
            .filter((r) => inside(file, r.root))
            .sort((a, b) => b.root.length - a.root.length)[0];
          if (bucket) bucket.bytes += stat.size;
        });
      const total = rows.reduce((n, r) => n + r.bytes, 0);
      rows.find((r) => r.id === 'browser').bytes += rows.find((r) => r.id === 'reviews').bytes;
      cached = { rows: rows.filter((r) => r.id !== 'reviews').map(({ root, ...r }) => r), total };
      updated = Date.now();
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }
  const authorize = (event) => {
    if (event.sender !== getWindow()?.webContents) throw Error('Invalid sender');
  };
  ipcMain.handle('storage-info', (event, force) => {
    authorize(event);
    return info(force === true);
  });
  ipcMain.handle('storage-open', (event) => {
    authorize(event);
    return shell.openPath(data);
  });
  ipcMain.handle('storage-clear', async (event, id) => {
    authorize(event);
    const target = roots.find((r) => r.id === id && r.clearable);
    if (!target) throw Error('Этот раздел нельзя очищать');
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'question',
      title: 'Хранилище SoundSync',
      message: 'Очистить: ' + target.name + '?',
      detail:
        id === 'backups'
          ? 'Последняя резервная копия останется. Более старые копии будут удалены.'
          : 'Музыка, любимые треки, плейлисты и свои обложки сохранятся. Кэш создастся заново по мере необходимости.',
      buttons: ['Отмена', 'Очистить'],
      defaultId: 0,
      cancelId: 0,
    });
    if (response !== 1) return info();
    if (id === 'browser') {
      await Promise.all([
        session.defaultSession.clearCache(),
        session.fromPartition('persist:rzt-reviews').clearCache(),
      ]);
    } else {
      if ((id === 'playback' && playbackBusy()) || (id === 'alignment' && alignmentBusy()))
        throw Error('Дождись завершения обработки аудио');
      const safeRoot = path.resolve(target.root);
      if (!inside(safeRoot, path.resolve(data))) throw Error('Недопустимая папка очистки');
      // Do not traverse junctions or delete a cache root redirected outside the profile.
      const realRoot = await fs.realpath(safeRoot).catch(() => null);
      if (realRoot && path.resolve(realRoot).toLowerCase() !== safeRoot.toLowerCase())
        throw Error('Папка перенаправлена: очистка отменена');
      const protectedSet = new Set(protectedFiles().map((f) => path.resolve(f).toLowerCase()));
      let keep;
      if (id === 'backups') {
        const entries = await fs.readdir(safeRoot, { withFileTypes: true }).catch(() => []);
        const dated = await Promise.all(
          entries
            .filter((e) => !e.isSymbolicLink())
            .map(async (e) => ({
              file: path.join(safeRoot, e.name),
              time: (await fs.lstat(path.join(safeRoot, e.name))).mtimeMs,
            }))
        );
        keep = dated.sort((a, b) => b.time - a.time)[0]?.file;
      }
      await walk(safeRoot, async (file) => {
        const absolute = path.resolve(file);
        if (
          !inside(absolute, safeRoot) ||
          (keep && inside(absolute, keep)) ||
          protectedSet.has(absolute.toLowerCase()) ||
          absolute.endsWith('.tmp.flac')
        )
          return;
        await fs.unlink(absolute);
      });
      if (id === 'backups') {
        async function prune(dir) {
          if (keep && inside(dir, keep)) return;
          const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
          for (const e of entries)
            if (e.isDirectory() && !e.isSymbolicLink()) await prune(path.join(dir, e.name));
          if (dir !== safeRoot && inside(path.resolve(dir), safeRoot))
            await fs.rmdir(dir).catch(() => {});
        }
        await prune(safeRoot);
      }
    }
    return info(true);
  });
};
