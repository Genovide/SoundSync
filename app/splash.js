/* Заставка при запуске (со звуком). Видео стартует, только когда окно действительно видно
   (окно создаётся скрытым), приложение под ним успело загрузиться и первые кадры реально
   выводятся на экран. Пропускается кликом или клавишей, при ошибке просто исчезает. */
(() => {
  'use strict';
  const splash = document.getElementById('splash'),
    video = splash?.querySelector('video');
  if (!splash) return;
  const params = new URLSearchParams(location.search);
  let finished = false,
    fallback = 0;
  function finish(fast = false) {
    if (finished) return;
    finished = true;
    clearTimeout(fallback);
    splash.classList.add('leaving');
    // Звук затихает вместе с растворением, а не обрывается.
    if (video && !video.muted) {
      const from = video.volume,
        started = performance.now(),
        span = fast ? 220 : 520;
      const fade = (now) => {
        const k = Math.min(1, (now - started) / span);
        video.volume = from * (1 - k);
        if (k < 1) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    }
    setTimeout(
      () => {
        video?.pause();
        splash.classList.add('gone');
        splash.remove();
      },
      fast ? 260 : 620
    );
  }
  // В тестовых прогонах заставка закрывала бы скриншоты проверок.
  let disabled = false;
  try {
    disabled = localStorage.getItem('splash-enabled') === '0';
  } catch {}
  if (params.has('nosplash') || !video || disabled) {
    splash.remove();
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    setTimeout(() => finish(true), 450);
    return;
  }
  video.muted = false;
  video.volume = 0.8;
  video.addEventListener('ended', () => finish());
  video.addEventListener('error', () => finish(true));
  splash.addEventListener('click', () => finish(true));
  addEventListener('keydown', () => finish(true), { once: true, capture: true });

  const frames = (n) =>
    new Promise((resolve) => {
      const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    });
  const idle = (ms) =>
    new Promise((resolve) =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(() => resolve(), { timeout: ms })
        : setTimeout(resolve, ms)
    );
  // Окно создаётся скрытым, но страница в нём всё равно считается видимой
  // (visibilityState === 'visible'), поэтому спрашиваем главный процесс.
  const visible = () =>
    new Promise((resolve) => {
      const bridge = window.lumen;
      if (!bridge?.windowShown) return resolve();
      bridge.onWindowShown?.(resolve);
      bridge.windowShown().then((shown) => shown && resolve(), resolve);
      // Если сигнал так и не придёт — не держим приложение под заставкой вечно.
      setTimeout(resolve, 5000);
    });
  const loaded = () =>
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((resolve) => addEventListener('load', resolve, { once: true }));
  const buffered = () =>
    video.readyState >= 4
      ? Promise.resolve()
      : new Promise((resolve) => {
          video.addEventListener('canplaythrough', resolve, { once: true });
          setTimeout(resolve, 2500);
        });

  async function start() {
    // Раньше видео запускалось сразу, а окно в это время ещё догружало приложение: сцена
    // проигрывалась «вслепую», и было видно только конец. Теперь ждём, пока окно видно,
    // всё загружено, видео в памяти и главный поток освободился; до этого держим первый кадр.
    await Promise.all([visible(), loaded(), buffered()]);
    await frames(2);
    await idle(500);
    if (finished) return;
    video.currentTime = 0;
    // Запасной таймер считаем от настоящего старта: длина ролика плюс запас.
    fallback = setTimeout(() => finish(true), ((video.duration || 4.5) + 2.5) * 1000);
    // Если первые кадры всё-таки вывелись с опозданием (окно ещё не рисовало), начинаем
    // заново — один раз, чтобы заставку было видно целиком.
    let restarted = false;
    if (typeof video.requestVideoFrameCallback === 'function')
      video.requestVideoFrameCallback((_now, meta) => {
        if (!restarted && meta.mediaTime > 0.3) {
          restarted = true;
          video.currentTime = 0;
        }
      });
    try {
      await video.play();
    } catch {
      // Если звук без нажатия не разрешён — играем без звука, но целиком.
      video.muted = true;
      video.play().catch(() => finish(true));
    }
  }
  start();
})();
