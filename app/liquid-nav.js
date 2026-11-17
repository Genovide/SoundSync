// Подсветка активного пункта меню — жидкая капля (стили — liquid-nav.css).
// Две капли — «голова» и «хвост» — летят к новому пункту на пружинах с разной жёсткостью.
// SVG-фильтр (размытие + порог прозрачности) сливает их в одну: на коротком пути капля
// вытягивается, на длинном — рвётся на две части, и хвост догоняет и вливается в голову.
(() => {
  const sidebar = document.querySelector('body > .sidebar'),
    nav = sidebar?.querySelector('nav');
  if (!sidebar || !nav) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const NS = 'http://www.w3.org/2000/svg',
    defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('class', 'liquid-nav-defs');
  defs.innerHTML =
    '<filter id="liquid-nav-goo" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>' +
    '<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11"/>' +
    '</filter>';
  const layer = document.createElement('div'),
    head = document.createElement('i'),
    tail = document.createElement('i');
  layer.className = 'liquid-nav';
  layer.setAttribute('aria-hidden', 'true');
  layer.append(tail, head);
  sidebar.prepend(defs, layer);
  sidebar.classList.add('liquid-nav-on');

  // Пружина по четырём величинам: x, y, ширина, высота.
  const body = (k, zeta) => ({
    k,
    c: 2 * Math.sqrt(k) * zeta,
    p: [0, 0, 0, 0],
    v: [0, 0, 0, 0],
  });
  // Голова — быстрая, с лёгким перелётом; хвост — мягкий и отстаёт.
  const H = body(340, 0.74),
    T = body(120, 0.95);
  let goal = null, // [x, y, w, h] цели
    shown = false,
    target = null,
    frame = 0,
    last = 0;

  const rectOf = (el) => {
    const s = sidebar.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    return [r.left - s.left, r.top - s.top, r.width, r.height];
  };
  const visible = (el) => el.getClientRects().length > 0 && el.offsetHeight > 0;
  const pick = () => [...sidebar.querySelectorAll('.nav.active')].find(visible) || null;

  // Капля видна только в области меню и нижнего блока, а не поверх плейлистов между ними,
  // когда пункт уехал при прокрутке.
  function clip() {
    const parts = [nav, sidebar.querySelector('.sidebar-bottom')].filter(Boolean).map((el) => {
      const [x, y, w, h] = rectOf(el);
      return `M${x - 20} ${y} h${w + 40} v${h} h${-(w + 40)} Z`;
    });
    layer.style.clipPath = `path('${parts.join(' ')}')`;
  }

  function draw() {
    const place = (el, b, stretch) => {
      const [x, y, w, h] = b.p,
        hh = Math.max(0, h + stretch);
      el.style.transform = `translate(${x}px, ${y - stretch / 2}px)`;
      el.style.width = Math.max(0, w) + 'px';
      el.style.height = hh + 'px';
    };
    // Голова на скорости чуть вытягивается вдоль движения.
    place(head, H, Math.min(16, Math.abs(H.v[1]) * 0.018));
    // Хвост в пути худеет — отрывается каплей поменьше.
    const far = goal ? Math.abs(goal[1] - T.p[1]) : 0,
      thin = Math.max(0.5, 1 - far / 260);
    const tw = T.p[2] * thin,
      th = T.p[3] * thin;
    tail.style.transform = `translate(${T.p[0] + (T.p[2] - tw) / 2}px, ${T.p[1] + (T.p[3] - th) / 2}px)`;
    tail.style.width = Math.max(0, tw) + 'px';
    tail.style.height = Math.max(0, th) + 'px';
    // Текст пункта становится тёмным, когда капля под ним.
    const arrived = target && goal && Math.abs(H.p[1] - goal[1]) < goal[3] * 0.45;
    for (const el of sidebar.querySelectorAll('.liquid-here'))
      if (el !== target || !arrived) el.classList.remove('liquid-here');
    if (arrived && !target.classList.contains('liquid-here')) target.classList.add('liquid-here');
  }

  function step(b, dt) {
    for (let i = 0; i < 4; i++) {
      const a = b.k * (goal[i] - b.p[i]) - b.c * b.v[i];
      b.v[i] += a * dt;
      b.p[i] += b.v[i] * dt;
    }
  }
  const settled = (b) =>
    b.p.every((p, i) => Math.abs(p - goal[i]) < 0.25) && b.v.every((v) => Math.abs(v) < 2);

  function tick(now) {
    const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    // Мелкие шаги — пружина устойчива при любом dt.
    for (let n = 0; n < 4; n++) {
      step(H, dt / 4);
      step(T, dt / 4);
    }
    draw();
    if (settled(H) && settled(T)) {
      H.p = goal.slice();
      T.p = goal.slice();
      H.v = [0, 0, 0, 0];
      T.v = [0, 0, 0, 0];
      draw();
      frame = 0;
      last = 0;
      if (!target) layer.classList.remove('shown');
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  const run = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  function update() {
    clip();
    const next = pick();
    if (!next) {
      if (!target && !shown) return;
      // Активного пункта нет: капля стягивается в точку и исчезает.
      const g = goal || [0, 0, 0, 0];
      target = null;
      shown = false;
      goal = [g[0] + g[2] / 2, g[1] + g[3] / 2, 0, 0];
      if (reduced.matches) {
        layer.classList.remove('shown');
        frame && cancelAnimationFrame(frame);
        frame = 0;
        draw();
      } else run();
      return;
    }
    const r = rectOf(next);
    const moved = next !== target || !goal || r.some((v, i) => Math.abs(v - goal[i]) > 0.5);
    if (!moved) return;
    const jump = next !== target;
    goal = r;
    target = next;
    layer.classList.add('shown');
    if (!shown || reduced.matches || !jump) {
      if (!shown && !reduced.matches) {
        // Первое появление: капля «набухает» из центра пункта.
        const seed = [r[0] + r[2] / 2, r[1] + r[3] / 2, 0, 0];
        H.p = seed.slice();
        T.p = seed.slice();
        shown = true;
        run();
        return;
      }
      // Сдвиг того же пункта (прокрутка, размер окна) или без анимации — сразу на место.
      if (!jump || reduced.matches) {
        if (frame && jump === false) {
          // Капля ещё летит — просто ведём к новой точке.
          return;
        }
        H.p = r.slice();
        T.p = r.slice();
        H.v = [0, 0, 0, 0];
        T.v = [0, 0, 0, 0];
        shown = true;
        draw();
        return;
      }
    }
    shown = true;
    run();
  }

  let queued = 0;
  const schedule = () => {
    if (!queued) queued = requestAnimationFrame(() => ((queued = 0), update()));
  };
  new MutationObserver((list) => {
    // Свои пометки (liquid-here, стили капли) не считаем изменениями.
    if (
      list.every(
        (m) =>
          layer.contains(m.target) ||
          (m.type === 'attributes' &&
            m.attributeName === 'class' &&
            m.target.classList.contains('liquid-here') !==
              (m.oldValue || '').split(' ').includes('liquid-here'))
      )
    )
      return;
    schedule();
  }).observe(sidebar, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ['class', 'open', 'hidden', 'style'],
  });
  new ResizeObserver(schedule).observe(sidebar);
  new ResizeObserver(schedule).observe(nav);
  nav.addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();
})();
