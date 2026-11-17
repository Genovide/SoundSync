// Нижняя панель плеера появляется, только когда есть что играть (стили — player-dock.css).
// Первый трек: панель «падает каплей» из центра; трек убрали — стягивается и исчезает.
(() => {
  const player = document.querySelector('body > footer.player');
  if (!player) return;
  let shown = false,
    timer = 0;
  // Сразу при запуске прячем пустую панель, чтобы она не мигнула до восстановления трека.
  document.body.classList.add('dock-idle');

  function sync() {
    const has = typeof current !== 'undefined' && !!current;
    if (has === shown) return;
    shown = has;
    clearTimeout(timer);
    if (has) {
      document.body.classList.remove('dock-idle');
      player.classList.remove('dock-leave');
      // Перезапуск анимации, если панель снова появляется вскоре после исчезновения.
      player.classList.remove('dock-enter');
      void player.offsetWidth;
      player.classList.add('dock-enter');
      timer = setTimeout(() => player.classList.remove('dock-enter'), 1000);
    } else {
      player.classList.remove('dock-enter');
      player.classList.add('dock-leave');
      timer = setTimeout(() => {
        player.classList.remove('dock-leave');
        if (!shown) document.body.classList.add('dock-idle');
      }, 430);
    }
  }
  // «×» на панели: остановить трек и убрать панель совсем (вместе с сохранённым сеансом).
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'dock-close';
  close.title = 'Закрыть плеер';
  close.setAttribute('aria-label', 'Закрыть плеер');
  close.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  player.append(close);
  function closePlayer() {
    if (typeof exitImmersive === 'function') exitImmersive();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    current = null;
    try {
      localStorage.removeItem('last-track');
    } catch {}
    window.lumen.sessionClear?.();
    // Правая панель и плеер — как при первом запуске, без следов прошлого трека.
    const set = (id, text) => {
      const e = document.getElementById(id);
      if (e) e.textContent = text;
    };
    set('now-title', 'Выбери настроение');
    set('now-artist', 'И нажми play');
    set('mini-title', 'Пока тихо');
    set('mini-artist', 'Твой следующий любимый трек уже здесь');
    set('elapsed', '0:00');
    set('duration', '0:00');
    document.getElementById('now-cover')?.replaceChildren();
    document.getElementById('mini-cover')?.replaceChildren();
    const seek = document.getElementById('seek');
    if (seek) seek.value = 0;
    if (typeof setLyrics === 'function') setLyrics({ lyrics: '' });
    if (typeof render === 'function') render();
    if (typeof renderQueue === 'function') renderQueue();
    sync();
  }
  close.onclick = closePlayer;
  if (typeof load === 'function') {
    const loadBeforeDock = load;
    load = function (t) {
      loadBeforeDock(t);
      sync();
    };
  }
  // Трек могут восстановить при запуске или убрать при удалении — проверяем и по таймеру.
  setInterval(sync, 600);
  sync();
  window.SoundSyncDock = { shown: () => shown };
})();
