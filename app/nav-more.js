// Меню: главное — сверху, редкие разделы (скачанное, апгрейдер, рецензии) — под «Ещё».
// Раздел раскрывается сам, если открыт один из его пунктов, и помнит, раскрыт ли он.
(() => {
  const nav = document.querySelector('.sidebar nav');
  if (!nav) return;
  const rare = ['[data-view="downloads"]', '#upgrader-open', '#rzt-reviews']
    .map((selector) => nav.querySelector(selector))
    .filter(Boolean);
  if (!rare.length) return;
  if (typeof svgPaths === 'object')
    Object.assign(svgPaths, { more: 'M5 12h.01M12 12h.01M19 12h.01' });
  const more = document.createElement('details'),
    summary = document.createElement('summary'),
    glyph = document.createElement('span'),
    items = document.createElement('div');
  more.className = 'nav-more';
  summary.className = 'nav nav-more-toggle';
  summary.dataset.iconified = '1';
  glyph.className = 'nav-icon';
  if (typeof icon === 'function') glyph.append(icon('more'));
  summary.append(glyph, document.createTextNode('Ещё'));
  items.className = 'nav-more-items';
  items.append(...rare);
  more.append(summary, items);
  const settings = nav.querySelector('.settings-nav');
  if (settings) settings.before(more);
  else nav.append(more);

  let open = false;
  try {
    open = localStorage.getItem('nav-more-open') === '1';
  } catch {}
  more.open = open;
  more.addEventListener('toggle', () => {
    try {
      localStorage.setItem('nav-more-open', more.open ? '1' : '0');
    } catch {}
  });
  // Открытый раздел не прячем: если активен пункт внутри «Ещё», раскрываем его.
  const reveal = () => {
    if (!more.open && items.querySelector('.active')) more.open = true;
    summary.classList.toggle('has-active', !!items.querySelector('.active'));
  };
  new MutationObserver(reveal).observe(items, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  reveal();
})();
