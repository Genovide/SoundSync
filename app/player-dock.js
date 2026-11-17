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
