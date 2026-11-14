'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const FORMAT = 'soundsync-companion',
  VERSION = 1;
const integer = (n, max = 1000000000) => Number.isSafeInteger(n) && n >= 0 && n <= max;
function validate(value) {
  if (value?.format !== FORMAT || value.version !== VERSION)
    throw Error('Формат питомца не поддерживается. Возможно, нужна более новая версия SoundSync.');
  const p = value.pet;
  if (
    !p ||
    typeof p.id !== 'string' ||
    !/^[\w-]{1,80}$/.test(p.id) ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 30 ||
    !integer(p.xp) ||
    !integer(p.coins) ||
    !integer(p.listeningSeconds) ||
    !integer(p.createdAt, 9000000000000) ||
    !integer(p.strokes) ||
    !integer(p.games) ||
    !Array.isArray(p.tracks) ||
    p.tracks.length > 2000 ||
    !p.tracks.every((id) => typeof id === 'string' && id.length <= 240) ||
    !['none', 'headphones', 'star', 'crown'].includes(p.accessory) ||
    !['calm', 'energy', 'dream'].every((k) => integer(p.taste?.[k]))
  )
    throw Error('Файл питомца повреждён или содержит неверные данные.');
  return {
    format: FORMAT,
    version: VERSION,
    pet: {
      id: p.id,
      name: p.name.trim(),
      xp: p.xp,
      coins: p.coins,
      listeningSeconds: p.listeningSeconds,
      createdAt: p.createdAt,
      strokes: p.strokes,
      games: p.games,
      tracks: [...new Set(p.tracks)],
      accessory: p.accessory,
      species: ['cat', 'dog', 'fox', 'wolf', 'bear', 'sync'].includes(p.species) ? p.species : null,
      taste: { calm: p.taste.calm, energy: p.taste.energy, dream: p.taste.dream },
    },
  };
}
module.exports = ({ app, ipcMain, dialog, getWindow, getTrack }) => {
  // Kept in user Data, never in resources/app or a disposable cache. Format version is
  // independent of application versions; future formats must not be silently reset.
  const directory = path.join(app.getPath('userData'), 'companion');
  const file = path.join(directory, 'pet.json');
  let state,
    failure,
    writes = Promise.resolve(),
    timer,
    changed = false,
    lastTick = Date.now(),
    lastStroke = 0,
    game,
    resetPending,
    resetCommit;
  const creator = require('node:fs').existsSync(path.join(directory, 'creator.local'));
  const fresh = () => ({
    format: FORMAT,
    version: VERSION,
    pet: {
      id: crypto.randomUUID(),
      name: 'Синк',
      xp: 0,
      coins: 0,
      listeningSeconds: 0,
      createdAt: Date.now(),
      strokes: 0,
      games: 0,
      tracks: [],
      accessory: 'headphones',
      species: null,
      taste: { calm: 0, energy: 0, dream: 0 },
    },
  });
  const ready = (async () => {
    let raw;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      try {
        state = validate(JSON.parse(await fs.readFile(file + '.bak', 'utf8')));
      } catch (backupError) {
        if (backupError.code !== 'ENOENT') throw backupError;
        state = fresh();
      }
      changed = true;
      await flush();
      return;
    }
    try {
      state = validate(JSON.parse(raw));
    } catch (e) {
      // A future schema is preserved intact. Recover only corrupt current-format saves.
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {}
      if (parsed?.format === FORMAT && parsed.version > VERSION) throw e;
      try {
        state = validate(JSON.parse(await fs.readFile(file + '.bak', 'utf8')));
      } catch {
        throw Error(
          'Не удалось прочитать сохранение питомца. Оно сохранено без изменений; можно импортировать экспортированный файл.'
        );
      }
      await fs.copyFile(file, path.join(directory, 'damaged-' + Date.now() + '.json'));
      changed = true;
      await flush();
    }
  })().catch((e) => {
    failure = e;
  });
  function persist(snapshot) {
    writes = writes
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(file + '.tmp', snapshot);
        await fs.writeFile(file + '.bak.tmp', snapshot);
        await fs.rename(file + '.bak.tmp', file + '.bak');
        await fs.rename(file + '.tmp', file);
      });
    return writes;
  }
  function flush() {
    clearTimeout(timer);
    if (!state || !changed) return writes;
    changed = false;
    return persist(JSON.stringify(state, null, 2)).catch((error) => {
      changed = true;
      throw error;
    });
  }
  function save() {
    changed = true;
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(() => {}), 400);
  }
  function info() {
    const p = state.pet,
      level = Math.min(10, 1 + Math.floor(Math.sqrt(p.xp / 40)));
    return {
      ...p,
      creator,
      tracks: undefined,
      discoveries: p.tracks.length,
      level,
      nextXp: level < 10 ? 40 * level * level : null,
      floorXp: 40 * (level - 1) * (level - 1),
      mood: Object.keys(p.taste).sort((a, b) => p.taste[b] - p.taste[a])[0],
    };
  }
  function handle(channel, fn, allowRecovery = false) {
    ipcMain.handle(channel, async (e, value) => {
      if (e.sender !== getWindow()?.webContents) throw Error('Invalid sender');
      await ready;
      if (resetCommit && channel !== 'companion-reset') await resetCommit;
      if (failure && !allowRecovery) throw failure;
      return fn(value);
    });
  }
  handle('companion-get', () => info());
  handle('companion-reset', () => {
    if (resetPending) return resetPending;
    resetPending = (async () => {
      const selected = state.pet;
      const { response } = await dialog.showMessageBox(getWindow(), {
        type: 'warning',
        title: 'Перевыбрать питомца',
        message: 'ВЕСЬ ПРОГРЕСС ПИТОМЦА БУДЕТ УДАЛЁН',
        detail:
          'Имя, опыт, уровень, ноты, время прослушивания, знакомые треки и аксессуары сбросятся. Ты вернёшься к яйцу и сможешь заново выбрать животное.',
        buttons: ['Отмена', 'Стереть прогресс и начать заново'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (response !== 1) return null;
      if (state.pet !== selected) throw Error('Питомец уже изменился. Открой настройки заново.');
      clearTimeout(timer);
      const replacement = fresh();
      resetCommit = persist(JSON.stringify(replacement, null, 2)).then(() => {
        state = replacement;
        changed = false;
        game = null;
        lastTick = Date.now();
        lastStroke = 0;
        return info();
      });
      try {
        return await resetCommit;
      } finally {
        resetCommit = null;
      }
    })().finally(() => {
      resetPending = null;
    });
    return resetPending;
  });
  handle('companion-tick', (value) => {
    const now = Date.now(),
      elapsed = Math.min(15, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    const track = typeof value?.id === 'string' && getTrack(value.id);
    if (!track || value.playing !== true || !Number.isFinite(value.seconds)) return info();
    const seconds = Math.floor(Math.min(elapsed, Math.max(0, value.seconds)));
    if (!seconds) return info();
    const p = state.pet,
      before = Math.floor(p.listeningSeconds / 30);
    p.listeningSeconds += seconds;
    const gained = Math.floor(p.listeningSeconds / 30) - before;
    p.xp += gained * 4;
    p.coins += gained;
    const genres =
      String(track.genre || '') +
      ' ' +
      (Array.isArray(track.tags) ? track.tags.join(' ') : track.tags || '');
    const mood = /metal|rock|punk|drill|trap|hard|phonk|метал|рок/i.test(genres)
      ? 'energy'
      : /ambient|dream|shoegaze|electronic|synth|электрон/i.test(genres)
        ? 'dream'
        : 'calm';
    p.taste[mood] += seconds;
    if (!p.tracks.includes(track.id)) p.tracks = [...p.tracks, track.id].slice(-2000);
    save();
    return info();
  });
  handle('companion-action', (value) => {
    const p = state.pet;
    if (value?.type === 'stroke') {
      if (Date.now() - lastStroke < 20000)
        return { ...info(), message: 'Мурчит. Он уже доволен ✦' };
      lastStroke = Date.now();
      p.strokes++;
      p.xp += 2;
      save();
      return { ...info(), message: 'Поймал твоё тепло. +2 опыта' };
    }
    if (value?.type === 'species') {
      if (p.species && !creator) throw Error('Вид уже выбран. Он остаётся с тобой навсегда.');
      const names = {
        cat: 'Кот',
        dog: 'Собака',
        fox: 'Лиса',
        wolf: 'Волк',
        bear: 'Медведь',
        sync: 'Синк',
      };
      if (!names[value.id]) throw Error('Неизвестный вид');
      if (creator) {
        p.species = value.id;
        changed = true;
        return flush().then(info);
      }
      return dialog
        .showMessageBox(getWindow(), {
          type: 'question',
          title: 'Выбирай с умом',
          message: 'Твой питомец — ' + names[value.id] + '?',
          detail:
            'Вид можно выбрать только один раз. Обновления и импорт не сбрасывают этот выбор.',
          buttons: ['Ещё подумаю', 'Выбрать навсегда'],
          defaultId: 0,
          cancelId: 0,
        })
        .then(async ({ response }) => {
          if (response !== 1) return info();
          if (p !== state.pet || p.species) throw Error('Выбор уже изменился. Открой меню заново.');
          p.species = value.id;
          changed = true;
          await flush();
          return info();
        });
    }
    if (value?.type === 'treat') {
      if (p.coins < 5)
        throw Error('Нужно 5 нот. Их можно поймать в игре или накопить, слушая музыку.');
      p.coins -= 5;
      p.xp += 3;
      save();
      return { ...info(), message: 'Хрум-хрум. Самая вкусная пентатоника! +3 опыта' };
    }
    if (value?.type === 'rename') {
      if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 30)
        throw Error('Имя: от 1 до 30 символов');
      p.name = value.name.trim();
    } else if (value?.type === 'accessory') {
      const required = { none: 1, headphones: 1, star: 3, crown: 5 }[value.id];
      if (!required || info().level < required) throw Error('Этот аксессуар пока не открыт');
      p.accessory = value.id;
    } else throw Error('Неизвестное действие');
    save();
    return info();
  });
  handle('companion-game-start', () => {
    if (game && Date.now() - game.started < 16000) throw Error('Игра уже идёт');
    game = { token: crypto.randomUUID(), started: Date.now() };
    return { token: game.token };
  });
  handle('companion-game-finish', (value) => {
    if (
      !game ||
      value?.token !== game.token ||
      Date.now() - game.started < 14500 ||
      !integer(value.score, 25)
    )
      throw Error('Игра не завершена');
    game = null;
    state.pet.games++;
    state.pet.xp += value.score * 2;
    state.pet.coins += value.score;
    save();
    return info();
  });
  handle('companion-export', async () => {
    await flush();
    const { canceled, filePath } = await dialog.showSaveDialog(getWindow(), {
      title: 'Экспорт питомца',
      defaultPath: 'SoundSync-питомец.json',
      filters: [{ name: 'Питомец SoundSync', extensions: ['json'] }],
    });
    if (canceled || !filePath) return false;
    // Exports are complete and independent of this computer, the library and app version.
    if (
      path
        .resolve(filePath)
        .toLowerCase()
        .startsWith(path.resolve(directory).toLowerCase() + path.sep)
    )
      throw Error('Выбери папку вне внутреннего хранилища питомца');
    await fs.writeFile(
      filePath,
      JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
    );
    return true;
  });
  handle(
    'companion-import',
    async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog(getWindow(), {
        title: 'Импорт питомца',
        properties: ['openFile'],
        filters: [{ name: 'Питомец SoundSync', extensions: ['json'] }],
      });
      if (canceled || !filePaths[0]) return null;
      if ((await fs.stat(filePaths[0])).size > 1024 * 1024) throw Error('Файл слишком большой');
      const imported = validate(JSON.parse(await fs.readFile(filePaths[0], 'utf8')));
      if (state?.pet.species && imported.pet.species && imported.pet.species !== state.pet.species)
        throw Error('Ты уже выбрал вид питомца. Можно импортировать питомца только этого вида.');
      if (state?.pet.species) imported.pet.species = state.pet.species;
      const { response } = await dialog.showMessageBox(getWindow(), {
        type: 'question',
        title: 'Импорт питомца',
        message: 'Поселить питомца «' + imported.pet.name + '»?',
        detail:
          'Он заменит текущего. Текущий питомец сначала сохранится отдельной резервной копией в папке данных.',
        buttons: ['Отмена', 'Импортировать'],
        defaultId: 0,
        cancelId: 0,
      });
      if (response !== 1) return null;
      await flush();
      await fs.mkdir(directory, { recursive: true });
      if (state)
        await fs.writeFile(
          path.join(
            directory,
            'before-import-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.json'
          ),
          JSON.stringify(state, null, 2)
        );
      else
        await fs
          .copyFile(file, path.join(directory, 'before-import-' + Date.now() + '.json'))
          .catch((e) => {
            if (e.code !== 'ENOENT') throw e;
          });
      state = imported;
      failure = null;
      game = null;
      lastTick = Date.now();
      lastStroke = 0;
      changed = true;
      await flush();
      return info();
    },
    true
  );
  return {
    async getInfo() {
      await ready;
      if (resetCommit) await resetCommit;
      if (failure) throw failure;
      return info();
    },
    async flush() {
      await ready;
      if (resetCommit) await resetCommit;
      return flush();
    },
  };
};
module.exports.validate = validate;
