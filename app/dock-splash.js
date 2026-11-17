// Маленькие «всплески» на панели плеера (стили — dock-splash.css).
// Пауза / воспроизведение: от кнопки расходится кольцо, как от капли на воде, кнопка мягко
// пружинит, стекло панели чуть вздрагивает.
// Смена трека: по стеклу пробегает светлая волна в сторону переключения, новое название
// въезжает с той же стороны, от обложки расходится маленькое кольцо.
(() => {
  const player = document.querySelector('body > footer.player'),
    playButton = document.getElementById('play'),
    cover = document.getElementById('mini-cover'),
    trackText = player?.querySelector('.player-track > div:last-child');
  if (!player || !playButton) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const busy = () =>
    reduced.matches ||
    player.classList.contains('dock-enter') ||
    player.classList.contains('dock-leave') ||
    document.body.classList.contains('dock-idle');

  // Перезапуск CSS-анимации на элементе: снять класс, дать браузеру заметить, вернуть.
  function replay(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el['_' + cls]);
    el['_' + cls] = setTimeout(() => el.classList.remove(cls), ms);
  }
  // Кольцо из центра элемента; живёт до конца своей анимации.
  function ring(from, cls) {
    const p = player.getBoundingClientRect(),
      r = from.getBoundingClientRect(),
      el = document.createElement('span');
    el.className = 'dock-ring ' + cls;
    el.style.left = r.left - p.left + r.width / 2 + 'px';
    el.style.top = r.top - p.top + r.height / 2 + 'px';
    el.style.setProperty('--size', Math.max(r.width, r.height) + 'px');
    player.append(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 1500);
  }

  // ——— Пауза / воспроизведение ———
  let switchedAt = 0;
  function splashPlay(playing) {
    if (busy()) return;
    // Смена трека сама даёт pause/play — там свой эффект.
    if (performance.now() - switchedAt < 700) return;
    ring(playButton, playing ? 'dock-ring-play' : 'dock-ring-pause');
    replay(playButton, 'dock-press', 520);
    replay(player, 'dock-bump', 560);
  }
  audio.addEventListener('play', () => splashPlay(true));
  audio.addEventListener('pause', () => {
    // Пауза в самом конце трека — это переход к следующему, не нажатие.
    if (audio.ended || (audio.duration && audio.duration - audio.currentTime < 0.3)) return;
    splashPlay(false);
  });

  // ——— Смена трека ———
  let direction = 1;
  document.getElementById('next')?.addEventListener('click', () => (direction = 1), true);
  document.getElementById('previous')?.addEventListener('click', () => (direction = -1), true);
  addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'MediaTrackPrevious') direction = -1;
      if (e.key === 'MediaTrackNext') direction = 1;
    },
    true
  );
  let lastId = null;
  function splashSwitch() {
    const id = typeof current !== 'undefined' && current ? current.id : null;
    if (id === lastId) return;
    const first = lastId === null;
    lastId = id;
    if (!id || first || busy()) return;
    switchedAt = performance.now();
    player.style.setProperty('--wave-from', direction > 0 ? '-60%' : '160%');
    player.style.setProperty('--wave-to', direction > 0 ? '160%' : '-60%');
    player.style.setProperty('--text-from', direction > 0 ? '14px' : '-14px');
    replay(player, 'dock-wave', 800);
    replay(trackText, 'dock-text-in', 520);
    if (cover) ring(cover, 'dock-ring-cover');
    direction = 1;
  }
  if (typeof load === 'function') {
    const loadBeforeSplash = load;
    load = function (t) {
      loadBeforeSplash(t);
      splashSwitch();
    };
  }
  lastId = typeof current !== 'undefined' && current ? current.id : null;
})();
