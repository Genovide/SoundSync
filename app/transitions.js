/* Плавные переходы между треками.
   1. Кроссфейд: за несколько секунд до конца хвост текущего трека продолжает играть во
      временном плеере и затихает, а основной плеер уже переключён на следующий трек и
      плавно набирает громкость. Всё состояние приложения переключается как при обычном
      переходе, второй <audio> живёт только эти секунды.
   2. Выравнивание громкости: громкость каждого трека один раз меряется (LUFS) и
      подтягивается к общему уровню, чтобы тихий трек после громкого не приходилось
      подкручивать. */
(() => {
  'use strict';
  const KEY = 'transitions-v1',
    TARGET_LUFS = -14,
    PEAK_CEILING_DB = -1,
    MAX_BOOST_DB = 12,
    MAX_CUT_DB = -12;
  let settings = { crossfade: 4, normalize: true };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object')
      settings = {
        crossfade: Math.max(0, Math.min(12, Number(saved.crossfade) || 0)),
        normalize: saved.normalize !== false,
      };
  } catch {}
  const listeners = new Set();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {}
    for (const fn of listeners) fn({ ...settings });
  };
  const EQ = () => window.SoundSyncEQ;
  const ready = () => typeof ctx !== 'undefined' && ctx && EQ()?.fade?.();

  // Любое новое изменение громкости сначала обрезает идущую кривую в текущей точке:
  // иначе браузер не даст наложить плавное изменение поверх незаконченного перехода.
  function hold(param) {
    const now = ctx.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      const value = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
    }
    return now;
  }
  function glide(param, value, smooth) {
    param.setTargetAtTime(value, hold(param), smooth);
  }

  // ——— Выравнивание громкости ———
  const measured = new Map();
  function lufsOf(t) {
    if (!t?.id || !window.lumen?.loudness) return Promise.resolve(null);
    const url = media(t);
    if (!measured.has(url)) {
      const job = window.lumen.loudness(url).catch(() => null);
      measured.set(url, job);
      job.then((value) => measured.set(url, value));
      while (measured.size > 400) measured.delete(measured.keys().next().value);
    }
    return Promise.resolve(measured.get(url));
  }
  // Тихий трек подтягиваем к общему уровню, но не выше, чем позволяет его пик: иначе
  // громкие места захрипят. Громкий трек просто приглушаем.
  const levelFor = (m) => {
    if (!settings.normalize || typeof m?.lufs !== 'number') return 1;
    let db = TARGET_LUFS - m.lufs;
    if (db > 0) db = Math.min(db, typeof m.peak === 'number' ? PEAK_CEILING_DB - m.peak : 6);
    return Math.pow(10, Math.max(MAX_CUT_DB, Math.min(MAX_BOOST_DB, db)) / 20);
  };
  let currentLevel = 1,
    levelTrack = '';
  function applyLevel(t, smooth = 0.6) {
    levelTrack = t?.id || '';
    lufsOf(t).then((m) => {
      if (!t || current?.id !== t.id || levelTrack !== t.id) return;
      currentLevel = levelFor(m);
      if (!ready()) return;
      glide(EQ().level().gain, currentLevel, smooth);
    });
  }

  // ——— Кроссфейд ———
  // Кривые равной мощности: сумма двух треков в середине перехода не проседает по громкости.
  const curve = (from, to, up) => {
    const points = new Float32Array(64);
    for (let i = 0; i < points.length; i++) {
      const x = i / (points.length - 1),
        k = up ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
      points[i] = Math.max(0.0001, from + (to - from) * (up ? k : 1 - k));
    }
    return points;
  };
  let tail = null,
    handing = false;
  const position = () =>
    (current?.remote ? window.remoteSeekOffset || 0 : 0) + (audio.currentTime || 0);
  const trackLength = () =>
    Number.isFinite(current?.duration) && current.duration > 0
      ? current.duration
      : Number.isFinite(audio.duration)
        ? audio.duration
        : 0;
  const nextExists = () =>
    !repeat &&
    ((typeof upNext !== 'undefined' && upNext.length > 0) ||
      (typeof waveMode !== 'undefined' && waveMode) ||
      (shuffle && queue.length > 1) ||
      qi < queue.length - 1);

  function stopTail(quick = true) {
    const t = tail;
    if (!t) return;
    tail = null;
    clearTimeout(t.timer);
    try {
      if (quick && ready()) glide(t.gain.gain, 0, 0.05);
    } catch {}
    setTimeout(
      () => {
        t.el.pause();
        t.el.removeAttribute('src');
        t.el.load();
        try {
          t.node.disconnect();
          t.gain.disconnect();
        } catch {}
      },
      quick ? 200 : 0
    );
  }

  function waitPlaying(el, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('timeout')), ms);
      el.addEventListener(
        'playing',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      el.addEventListener(
        'error',
        () => {
          clearTimeout(timer);
          reject(Error('error'));
        },
        { once: true }
      );
    });
  }

  async function crossfade(seconds) {
    const t = current,
      el = new Audio();
    handing = true;
    try {
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.volume = audio.volume;
      el.muted = audio.muted;
      // Поток SoundCloud нельзя перемотать: просим его сразу с нужного места (с небольшим
      // запасом на запуск). Локальный файл открываем и выставляем позицию точно.
      if (t.remote) el.src = media(t) + '?start=' + (position() + 0.15).toFixed(2);
      else el.src = audio.currentSrc;
      const node = ctx.createMediaElementSource(el),
        gain = ctx.createGain();
      gain.gain.value = 0;
      node.connect(gain);
      gain.connect(EQ().input());
      tail = { el, node, gain, timer: 0 };
      if (!t.remote) {
        await new Promise((resolve, reject) => {
          el.addEventListener('loadedmetadata', resolve, { once: true });
          el.addEventListener('error', reject, { once: true });
          setTimeout(() => reject(Error('timeout')), 2000);
        });
        el.currentTime = position();
      }
      const playing = waitPlaying(el, 2500);
      await el.play();
      await playing;
      if (current?.id !== t.id || audio.paused) throw Error('changed');
      if (!t.remote) el.currentTime = position();
      // Передача: хвост звучит с уровнем прошлого трека и затихает, основной плеер с нуля
      // набирает громкость уже на следующем треке.
      const now = ctx.currentTime,
        fade = EQ().fade().gain;
      hold(gain.gain);
      gain.gain.setValueCurveAtTime(curve(currentLevel, 0, false), now, seconds);
      hold(fade);
      fade.setValueAtTime(0, now);
      tail.fadeIn = seconds;
      tail.timer = setTimeout(() => stopTail(false), seconds * 1000 + 250);
      await advance(1, true);
    } catch {
      stopTail();
      if (ready()) glide(EQ().fade().gain, 1, 0.05);
    } finally {
      handing = false;
    }
  }

  audio.addEventListener('timeupdate', () => {
    const seconds = settings.crossfade;
    if (!seconds || tail || handing || audio.paused || !current || !ready()) return;
    const length = trackLength(),
      left = length - position();
    // Короткие треки и самый конец очереди играют как есть.
    if (length < seconds * 3 || left > seconds || left < 0.4 || !nextExists()) return;
    crossfade(Math.min(seconds, left));
  });

  // Новый трек: набираем громкость после кроссфейда или сразу, если переход обычный.
  audio.addEventListener('playing', () => {
    if (!ready()) return;
    const fade = EQ().fade().gain,
      now = ctx.currentTime;
    if (tail?.fadeIn) {
      hold(fade);
      fade.setValueCurveAtTime(curve(0, 1, true), now, tail.fadeIn);
      tail.fadeIn = 0;
    } else if (!tail) glide(fade, 1, 0.03);
    prepareNext();
  });
  // Пауза во время перехода — хвост тоже замолкает; ручное переключение его обрывает.
  audio.addEventListener('pause', () => {
    if (tail && !handing) stopTail();
  });
  audio.addEventListener('volumechange', () => {
    if (!tail) return;
    tail.el.volume = audio.volume;
    tail.el.muted = audio.muted;
  });
  const loadBeforeTransitions = load;
  load = function (t) {
    if (tail && !handing) stopTail();
    loadBeforeTransitions(t);
    applyLevel(t, handing ? 0.01 : 0.6);
  };

  // Громкость следующего трека меряем заранее, чтобы он сразу заиграл на нужном уровне.
  function prepareNext() {
    const next =
      (typeof upNext !== 'undefined' && upNext[0]) || (!shuffle && queue[qi + 1]) || null;
    if (settings.normalize && next) lufsOf(next);
  }

  window.SoundSyncTransitions = {
    get: () => ({ ...settings }),
    setCrossfade(seconds) {
      settings.crossfade = Math.max(0, Math.min(12, Math.round(Number(seconds) || 0)));
      save();
    },
    setNormalize(on) {
      settings.normalize = !!on;
      save();
      if (current) applyLevel(current, 0.3);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Для проверок.
    state: () => ({
      level: currentLevel,
      fade: ready() ? +EQ().fade().gain.value.toFixed(3) : null,
      tail: !!tail,
    }),
    lufsOf,
  };
})();
