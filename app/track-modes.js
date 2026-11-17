/* Экран трека: два режима.
   «Пластинка» — обложка как виниловый диск: круг с обложкой, чёрный центр с отверстием,
   бороздки и неподвижный блик; крутится 33⅓ об/мин, пока играет музыка.
   «Без лишнего» — прячет всё, кроме визуализации, обложки с названием и текста песни.
   Стили — track-modes.css. Клавиши: V — пластинка, H — без лишнего (Esc — вернуть всё). */
(() => {
  if (typeof immersive === 'undefined' || typeof immersiveArt === 'undefined') return;
  const read = (key) => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };
  const write = (key, on) => {
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {}
  };
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn(api.state()));

  // ——— Пластинка ———
  let vinyl = read('cover-vinyl');
  const vinylButton = document.createElement('button');
  vinylButton.type = 'button';
  vinylButton.className = 'vinyl-toggle';
  immersiveArt.append(vinylButton);
  // Обложку при смене трека заменяют целиком — кнопку возвращаем на место.
  new MutationObserver(() => {
    if (!immersiveArt.contains(vinylButton)) immersiveArt.append(vinylButton);
  }).observe(immersiveArt, { childList: true });
  const spin = () =>
    immersive.classList.toggle('vinyl-spinning', vinyl && !audio.paused && !audio.ended);
  function setVinyl(on) {
    vinyl = !!on;
    write('cover-vinyl', vinyl);
    immersive.classList.toggle('vinyl', vinyl);
    vinylButton.textContent = vinyl ? 'Обложка' : 'Пластинка';
    vinylButton.title = vinyl
      ? 'Показать обычную квадратную обложку (V)'
      : 'Показать обложку как крутящуюся пластинку (V)';
    spin();
    notify();
  }
  vinylButton.onclick = (e) => {
    e.stopPropagation();
    setVinyl(!vinyl);
  };
  for (const name of ['play', 'playing', 'pause', 'ended', 'emptied'])
    audio.addEventListener(name, spin);

  // ——— Без лишнего ———
  let clean = false,
    idleTimer = 0;
  const cleanButton = document.createElement('button');
  cleanButton.type = 'button';
  cleanButton.className = 'clean-view-toggle';
  cleanButton.title = 'Убрать всё лишнее: остаются визуализация, обложка и текст (H)';
  cleanButton.setAttribute('aria-label', 'Без лишнего');
  cleanButton.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  listeningControls.append(cleanButton);
  // Кнопка возврата: в режиме «без лишнего» видна, только когда двигаешь мышью.
  const restore = document.createElement('button');
  restore.type = 'button';
  restore.className = 'clean-view-exit';
  restore.textContent = 'Показать управление';
  restore.title = 'Вернуть кнопки и панель плеера (Esc или H)';
  immersive.append(restore);
  const wake = () => {
    if (!clean) return;
    immersive.classList.add('clean-awake');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => immersive.classList.remove('clean-awake'), 2200);
  };
  function setClean(on) {
    clean = !!on;
    immersive.classList.toggle('clean-view', clean);
    document.body.classList.toggle('clean-track-view', clean);
    if (clean) {
      document.querySelector('.visual-settings:not(.hidden)')?.classList.add('hidden');
      wake();
    } else {
      clearTimeout(idleTimer);
      immersive.classList.remove('clean-awake');
    }
    notify();
  }
  cleanButton.onclick = () => setClean(true);
  restore.onclick = () => setClean(false);
  immersive.addEventListener('pointermove', wake);
  immersive.addEventListener('pointerdown', wake);

  // Esc сначала возвращает управление, а не закрывает экран трека.
  addEventListener(
    'keydown',
    (event) => {
      if (immersive.classList.contains('hidden')) return;
      if (event.target.matches?.('input,textarea,select,[contenteditable]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape' && clean) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setClean(false);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'v' || key === 'м') {
        event.preventDefault();
        setVinyl(!vinyl);
      } else if (key === 'h' || key === 'р') {
        event.preventDefault();
        setClean(!clean);
      }
    },
    true
  );
  // Выход с экрана трека — режим «без лишнего» не должен остаться для следующего раза.
  if (typeof exitImmersive === 'function') {
    const exitBeforeModes = exitImmersive;
    // В режиме «без лишнего» первое Esc (или «Назад») только возвращает управление: другие
    // обработчики Esc срабатывают раньше нашего, поэтому решаем здесь, а не в keydown.
    exitImmersive = function () {
      if (clean) {
        setClean(false);
        return;
      }
      exitBeforeModes();
    };
  }

  const api = {
    state: () => ({ vinyl, clean }),
    setVinyl,
    setClean,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  window.SoundSyncTrackModes = api;
  setVinyl(vinyl);
})();
