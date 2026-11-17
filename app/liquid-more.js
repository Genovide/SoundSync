// Ещё «жидкие» детали (стили — liquid-more.css):
// 1. Громкость — капля, как на перемотке; на нуле «высыхает» в точку.
// 2. Кнопка ▶ на карточках главной вытекает каплей из угла обложки (только стили).
// 3. Меню трека («⋯» или правый клик по строке) вырастает каплей из точки нажатия,
//    пункты всплывают по одному.
// 4. Уведомления вытекают каплей из панели плеера и стекают обратно.
(() => {
  const L = window.SoundSyncLiquid;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // ——— 1. Громкость ———
  const volume = document.getElementById('volume'),
    box = volume?.closest('.volume-control');
  if (L && volume && box) {
    box.classList.add('liquid-volume');
    const drop = document.createElement('div');
    drop.className = 'volume-drop';
    drop.setAttribute('aria-hidden', 'true');
    box.append(drop);
    const X = L.spring(800, 0.7, 1),
      S = L.spring(380, 0.5, 1),
      W = L.spring(520, 0.22, 1);
    let hover = false,
      dragging = false,
      running = false,
      pokedUntil = 0;
    const level = () => (audio.muted ? 0 : Number(volume.value));
    const xGoal = () => {
      const w = volume.clientWidth;
      return volume.offsetLeft + 7 + L.clamp(level(), 0, 1) * Math.max(0, w - 14);
    };
    // На нуле капля «высыхает» до точки.
    const sizeGoal = () => {
      const on =
        hover || dragging || document.activeElement === volume || performance.now() < pokedUntil;
      return on ? (level() === 0 ? 0.45 : 1) : 0;
    };
    function draw() {
      const s = Math.max(0, S.p[0]),
        stretch = reduced.matches ? 0 : Math.min(0.6, Math.abs(X.v[0]) / 900),
        jelly = L.clamp(W.p[0], -1.5, 1.5);
      const sx = s * (1 + stretch + jelly * 0.14),
        sy = s * (1 - stretch * 0.3 - jelly * 0.12);
      drop.style.transform = `translate(${X.p[0]}px, ${volume.offsetTop + volume.offsetHeight / 2}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      box.classList.toggle('volume-dry', level() === 0);
    }
    const mover = (dt) => {
      L.advance(X, [xGoal()], dt);
      L.advance(S, [sizeGoal()], dt);
      L.advance(W, [0], dt);
      draw();
      const alive =
        sizeGoal() > 0 ||
        performance.now() < pokedUntil ||
        !L.resting(S, [0], 0.01) ||
        !L.resting(W, [0], 0.01);
      if (!alive) running = false;
      return alive;
    };
    const wake = () => {
      if (reduced.matches) {
        L.snap(X, [xGoal()]);
        L.snap(S, [sizeGoal()]);
        draw();
        return;
      }
      if (!running) {
        running = true;
        if (S.p[0] < 0.01) L.snap(X, [xGoal()]);
        L.animate(mover);
      }
    };
    box.addEventListener('pointermove', () => {
      if (!hover) ((hover = true), wake());
    });
    box.addEventListener('pointerleave', () => ((hover = false), wake()));
    volume.addEventListener('focus', wake);
    volume.addEventListener('blur', wake);
    // Громкость меняют и колесом, и клавишами — капля показывается ненадолго.
    const poke = () => {
      pokedUntil = performance.now() + 900;
      wake();
    };
    volume.addEventListener('input', poke);
    audio.addEventListener('volumechange', poke);
    volume.addEventListener('pointerdown', () => {
      dragging = true;
      W.v[0] = -18;
      wake();
    });
    addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      W.v[0] = 26;
      wake();
    });
  }

  // ——— 3. Меню трека ———
  if (typeof openTrackMenu === 'function' && typeof trackMenu !== 'undefined') {
    let point = null; // точка правого клика
    const openBeforeLiquid = openTrackMenu;
    openTrackMenu = function (t, anchor) {
      openBeforeLiquid(t, anchor);
      const menu = trackMenu;
      if (point) {
        // Правый клик: меню у курсора, а не у кнопки «⋯».
        const w = menu.offsetWidth,
          h = menu.offsetHeight;
        menu.style.left = Math.max(12, Math.min(innerWidth - w - 12, point.x)) + 'px';
        menu.style.top = Math.max(12, Math.min(innerHeight - h - 12, point.y)) + 'px';
      }
      // Капля растёт из точки нажатия: курсора или центра кнопки «⋯».
      const m = menu.getBoundingClientRect(),
        a = anchor.getBoundingClientRect(),
        ox = point ? point.x : a.left + a.width / 2,
        oy = point ? point.y : a.top + a.height / 2;
      point = null;
      menu.style.setProperty('--drop-x', L ? L.clamp(ox - m.left, 0, m.width) + 'px' : '50%');
      menu.style.setProperty('--drop-y', L ? L.clamp(oy - m.top, 0, m.height) + 'px' : '0px');
      [...menu.children].forEach((b, i) => b.style.setProperty('--i', i));
      menu.classList.remove('menu-drop');
      void menu.offsetWidth;
      menu.classList.add('menu-drop');
    };
    document.addEventListener('contextmenu', (e) => {
      const row = e.target.closest?.('.track-row'),
        button = row?.querySelector('.track-options');
      if (!button || e.target.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      point = { x: e.clientX, y: e.clientY };
      button.click();
      point = null;
    });
  }

  // ——— 4. Уведомления ———
  const toastBox = document.getElementById('toast');
  if (toastBox) {
    // Появление: каждый раз, когда показывают уведомление, — капля из панели плеера.
    let leaving = false,
      leaveTimer = 0;
    // Только toggle(…, force): add/remove перезаписывают атрибут даже без изменений, и
    // наблюдатель вызывал бы сам себя без конца.
    const set = (cls, on) => toastBox.classList.toggle(cls, on);
    new MutationObserver(() => {
      const hidden = toastBox.classList.contains('hidden'),
        dropping = toastBox.classList.contains('toast-drop');
      if (!hidden && toastBox.classList.contains('toast-in') && !dropping) {
        clearTimeout(leaveTimer);
        leaving = false;
        set('toast-drip', false);
        set('toast-drop', true);
      }
      // Скрытие: не пропадаем сразу, а стекаем обратно в плеер.
      if (hidden && dropping && !leaving && !reduced.matches) {
        leaving = true;
        set('toast-drip', true);
        set('hidden', false);
        leaveTimer = setTimeout(() => {
          set('toast-drip', false);
          set('toast-drop', false);
          set('hidden', true);
          leaving = false;
        }, 460);
      } else if (hidden && !leaving) set('toast-drop', false);
    }).observe(toastBox, { attributes: true, attributeFilter: ['class'] });
    // Новое уведомление поверх старого: перезапускаем каплю.
    if (typeof toast === 'function') {
      const toastBeforeLiquid = toast;
      toast = function (text) {
        set('toast-drop', false);
        set('toast-drip', false);
        clearTimeout(leaveTimer);
        leaving = false;
        toastBeforeLiquid(text);
      };
    }
  }
})();
