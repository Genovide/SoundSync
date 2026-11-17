// «Жидкие» элементы управления (стили — liquid-controls.css), в пару к капле в меню:
// 1. Вкладки («Текст песни / Очередь», «Личная библиотека / SoundCloud») переключаются
//    каплей: она вытягивается к новой вкладке и, если та далеко, отрывается хвостом.
// 2. Ползунок перемотки — капля: на скорости вытягивается, отпущенная — пружинит.
// 3. Кнопки плеера липнут к курсору и отпружинивают, когда его уводишь.
// Переключатели в настройках тянутся чисто стилями (liquid-controls.css).
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Пружина по нескольким величинам; шаг мелкий, поэтому устойчива при любом dt.
  const spring = (k, zeta, size) => ({
    k,
    c: 2 * Math.sqrt(k) * zeta,
    p: new Array(size).fill(0),
    v: new Array(size).fill(0),
  });
  function advance(s, goal, dt) {
    for (let n = 0; n < 4; n++)
      for (let i = 0; i < s.p.length; i++) {
        s.v[i] += (s.k * (goal[i] - s.p[i]) - s.c * s.v[i]) * (dt / 4);
        s.p[i] += s.v[i] * (dt / 4);
      }
  }
  const resting = (s, goal, eps = 0.25) =>
    s.p.every((p, i) => Math.abs(p - goal[i]) < eps) && s.v.every((v) => Math.abs(v) < 2);
  const snap = (s, goal) => {
    s.p = goal.slice();
    s.v = s.v.map(() => 0);
  };
  // Общий цикл кадров: крутится, только пока кому-то есть что анимировать.
  const movers = new Set();
  let frame = 0,
    last = 0;
  function loop(now) {
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    for (const m of [...movers]) if (!m(dt)) movers.delete(m);
    if (movers.size) frame = requestAnimationFrame(loop);
    else frame = last = 0;
  }
  const animate = (m) => {
    movers.add(m);
    if (!frame) frame = requestAnimationFrame(loop);
  };

  // Пружины и общий цикл кадров — и для liquid-more.js.
  window.SoundSyncLiquid = { spring, advance, resting, snap, animate, clamp };

  // ——— 1. Вкладки ———
  const NS = 'http://www.w3.org/2000/svg',
    defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('class', 'liquid-defs');
  defs.innerHTML =
    '<filter id="liquid-tabs-goo" x="-10%" y="-20%" width="120%" height="140%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>' +
    '<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"/>' +
    '</filter>';
  document.body.append(defs);
  // Блок «Личная библиотека / SoundCloud» перерисовывается при каждом нажатии — помним, где
  // капля была в прошлый раз, и новая начинает путь оттуда.
  const lastSeen = new Map();
  const TABS = '.panel-tabs, .home-random-switch';

  function liquidTabs(host) {
    if (host.liquidTabs) return;
    host.liquidTabs = true;
    const kind = host.matches('.panel-tabs') ? 'panel' : 'random';
    const layer = document.createElement('div'),
      head = document.createElement('i'),
      tail = document.createElement('i');
    layer.className = 'liquid-tabs';
    layer.setAttribute('aria-hidden', 'true');
    layer.append(tail, head);
    host.prepend(layer);
    host.classList.add('liquid-tabs-on');
    const H = spring(420, 0.82, 4),
      T = spring(150, 0.95, 4);
    let goal = null,
      target = null,
      moving = false;

    const rectOf = (el) => {
      const h = host.getBoundingClientRect(),
        r = el.getBoundingClientRect();
      return [r.left - h.left, r.top - h.top, r.width, r.height];
    };
    // Цвета капли и текста берём у самих вкладок: у каждой темы они свои.
    function colors(active) {
      host.classList.add('liquid-probe');
      const a = getComputedStyle(active),
        idle = [...host.children].find((b) => b.tagName === 'BUTTON' && b !== active);
      host.style.setProperty('--liquid-fill', a.backgroundColor);
      if (idle) host.style.setProperty('--liquid-idle-ink', getComputedStyle(idle).color);
      host.classList.remove('liquid-probe');
    }
    function draw() {
      const stretch = Math.min(12, Math.abs(H.v[0]) * 0.016);
      head.style.transform = `translate(${H.p[0] - stretch / 2}px, ${H.p[1]}px)`;
      head.style.width = Math.max(0, H.p[2] + stretch) + 'px';
      head.style.height = Math.max(0, H.p[3]) + 'px';
      const far = goal ? Math.abs(goal[0] - T.p[0]) : 0,
        thin = clamp(1 - far / Math.max(120, (goal?.[2] || 0) * 1.6), 0.45, 1),
        tw = T.p[2] * thin,
        th = T.p[3] * thin;
      tail.style.transform = `translate(${T.p[0] + (T.p[2] - tw) / 2}px, ${T.p[1] + (T.p[3] - th) / 2}px)`;
      tail.style.width = Math.max(0, tw) + 'px';
      tail.style.height = Math.max(0, th) + 'px';
      const here = target && goal && Math.abs(H.p[0] - goal[0]) < goal[2] * 0.4;
      for (const b of host.querySelectorAll('.liquid-here'))
        if (b !== target || !here) b.classList.remove('liquid-here');
      if (here) target.classList.toggle('liquid-here', true);
    }
    const mover = (dt) => {
      advance(H, goal, dt);
      advance(T, goal, dt);
      draw();
      if (resting(H, goal) && resting(T, goal)) {
        snap(H, goal);
        snap(T, goal);
        draw();
        moving = false;
        return false;
      }
      return true;
    };
    function update() {
      if (!host.isConnected) return;
      const next = [...host.children].find(
        (b) => b.tagName === 'BUTTON' && b.classList.contains('active') && b.offsetWidth
      );
      if (!next) {
        layer.classList.remove('shown');
        target = null;
        return;
      }
      const r = rectOf(next);
      if (next === target && goal && r.every((v, i) => Math.abs(v - goal[i]) < 0.5)) return;
      const jump = target && next !== target;
      if (next !== target) colors(next);
      const firstTime = !goal;
      goal = r;
      target = next;
      lastSeen.set(kind, { page: next.getBoundingClientRect(), at: performance.now() });
      layer.classList.add('shown');
      if (firstTime && !reduced.matches) {
        // Новый блок на месте старого (перерисовка) — капля продолжает путь от прошлой вкладки.
        const prev = lastSeen.get(kind + ':prev');
        if (prev && performance.now() - prev.at < 1500) {
          const h = host.getBoundingClientRect(),
            from = [
              prev.page.left - h.left,
              prev.page.top - h.top,
              prev.page.width,
              prev.page.height,
            ];
          if (Math.abs(from[1] - r[1]) < 30 && Math.abs(from[0] - r[0]) > 2) {
            snap(H, from);
            snap(T, from);
            moving = true;
            draw();
            animate(mover);
            return;
          }
        }
      }
      if (!jump || reduced.matches) {
        if (moving) return; // ещё летит — просто ведём к новой точке
        snap(H, r);
        snap(T, r);
        draw();
        return;
      }
      moving = true;
      animate(mover);
    }
    // Нажатие: запоминаем, где капля сейчас, — пригодится, если блок перерисуют.
    host.addEventListener(
      'click',
      () => {
        if (target)
          lastSeen.set(kind + ':prev', {
            page: target.getBoundingClientRect(),
            at: performance.now(),
          });
      },
      true
    );
    let queued = 0;
    const schedule = () => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), update()));
    };
    new MutationObserver((list) => {
      if (
        list.every(
          (m) =>
            layer.contains(m.target) ||
            (m.attributeName === 'class' &&
              m.target.classList.contains('liquid-here') !==
                (m.oldValue || '').split(' ').includes('liquid-here'))
        )
      )
        return;
      schedule();
    }).observe(host, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class'],
    });
    new ResizeObserver(schedule).observe(host);
    update();
  }
  const findTabs = () => document.querySelectorAll(TABS).forEach(liquidTabs);
  let tabsQueued = 0;
  new MutationObserver(() => {
    if (!tabsQueued) tabsQueued = requestAnimationFrame(() => ((tabsQueued = 0), findTabs()));
  }).observe(document.body, { childList: true, subtree: true });
  findTabs();

  // ——— 2. Капля на перемотке ———
  const wrap = document.querySelector('.seek-wrap'),
    seek = document.getElementById('seek');
  if (wrap && seek) {
    wrap.classList.add('liquid-seek');
    // div, а не span: на span-ы в строке времени действуют стили подписей 0:00.
    const drop = document.createElement('div');
    drop.className = 'seek-drop';
    drop.setAttribute('aria-hidden', 'true');
    wrap.append(drop);
    const X = spring(900, 0.7, 1), // положение
      S = spring(380, 0.5, 1), // появление (0…1)
      W = spring(520, 0.22, 1); // «желе» после отпускания
    let hover = false,
      dragging = false,
      running = false;
    const xGoal = () => {
      const w = seek.clientWidth,
        p = Number(seek.value) / (Number(seek.max) || 1);
      return 7 + clamp(p, 0, 1) * Math.max(0, w - 14);
    };
    const shownGoal = () => (hover || dragging || document.activeElement === seek ? 1 : 0);
    function draw() {
      const v = X.v[0],
        s = Math.max(0, S.p[0]),
        stretch = reduced.matches ? 0 : Math.min(0.6, Math.abs(v) / 1100),
        jelly = W.p[0];
      const sx = s * (1 + stretch + clamp(jelly, -1.5, 1.5) * 0.14),
        sy = s * (1 - stretch * 0.3 - clamp(jelly, -1.5, 1.5) * 0.12);
      drop.style.transform = `translateX(${X.p[0]}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    }
    const mover = (dt) => {
      advance(X, [xGoal()], dt);
      advance(S, [shownGoal()], dt);
      advance(W, [0], dt);
      draw();
      const alive = shownGoal() > 0 || !resting(S, [0], 0.01) || !resting(W, [0], 0.01);
      if (!alive) running = false;
      return alive;
    };
    const wake = () => {
      if (reduced.matches) {
        snap(X, [xGoal()]);
        snap(S, [shownGoal()]);
        draw();
        return;
      }
      if (!running) {
        running = true;
        if (S.p[0] < 0.01) snap(X, [xGoal()]);
        animate(mover);
      }
    };
    // pointermove, а не pointerenter: так же определяет наведение и ui-refresh.js.
    wrap.addEventListener('pointermove', () => {
      if (!hover) ((hover = true), wake());
    });
    wrap.addEventListener('pointerleave', () => ((hover = false), wake()));
    seek.addEventListener('focus', wake);
    seek.addEventListener('blur', wake);
    seek.addEventListener('input', wake);
    seek.addEventListener('pointerdown', () => {
      dragging = true;
      W.v[0] = -18; // капля сплющивается под пальцем
      wake();
    });
    addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      W.v[0] = 26; // отпустили — пружинит
      wake();
    });
  }

  // ——— 3. Кнопки плеера липнут к курсору ———
  const buttons = document.querySelector('body > footer.player .transport-buttons');
  if (buttons) {
    const REACH = 16; // насколько далеко от кнопки она ещё «чувствует» курсор
    // Свои переходы дописываем к тем, что уже есть у кнопок (цвет, фон и т. п.): пока курсор
    // рядом — кнопка догоняет его быстро, ушёл — отпружинивает на место с перелётом.
    const FOLLOW = 'translate 110ms ease-out, scale 110ms ease-out',
      BACK =
        'translate 520ms cubic-bezier(0.3, 1.9, 0.4, 1), scale 520ms cubic-bezier(0.3, 1.9, 0.4, 1)';
    const base = new WeakMap();
    const transition = (b, own) => {
      if (!base.has(b)) {
        b.style.transition = '';
        const t = getComputedStyle(b).transition;
        base.set(b, !t || /^all 0s/.test(t) ? '' : t + ', ');
      }
      b.style.transition = base.get(b) + own;
    };
    buttons.addEventListener('pointermove', (e) => {
      if (reduced.matches) return;
      for (const b of buttons.querySelectorAll('button')) {
        const r = b.getBoundingClientRect(),
          cx = r.left + r.width / 2,
          cy = r.top + r.height / 2,
          dx = e.clientX - cx,
          dy = e.clientY - cy,
          near =
            Math.abs(dx) < r.width / 2 + REACH &&
            Math.abs(dy) < r.height / 2 + REACH &&
            !b.disabled;
        if (near) {
          const max = b.id === 'play' ? 5 : 7;
          const tx = clamp(dx * 0.3, -max, max),
            ty = clamp(dy * 0.3, -max, max);
          // Тянется в сторону курсора: немного длиннее вдоль движения, тоньше поперёк.
          const pull = Math.min(1, Math.hypot(tx, ty) / max),
            along = Math.abs(tx) >= Math.abs(ty);
          if (!b.classList.contains('liquid-stuck')) transition(b, FOLLOW);
          b.classList.add('liquid-stuck');
          b.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
          b.style.scale = along
            ? `${(1 + pull * 0.08).toFixed(3)} ${(1 - pull * 0.04).toFixed(3)}`
            : `${(1 - pull * 0.04).toFixed(3)} ${(1 + pull * 0.08).toFixed(3)}`;
        } else release(b);
      }
    });
    const release = (b) => {
      if (!b.classList.contains('liquid-stuck')) return;
      b.classList.remove('liquid-stuck');
      transition(b, BACK);
      b.style.translate = '';
      b.style.scale = '';
    };
    buttons.addEventListener('pointerleave', () =>
      buttons.querySelectorAll('button').forEach(release)
    );
  }
})();
