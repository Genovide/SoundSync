// Нижняя часть меню: «Настройки» прижаты к низу, а между пунктами меню и ними — быстрый
// список своих плейлистов (как в Spotify). Пустое место превращается в полезное.
(() => {
  const sidebar = document.querySelector('.sidebar'),
    nav = sidebar?.querySelector('nav'),
    bottom = sidebar?.querySelector('.sidebar-bottom');
  if (!sidebar || !nav || !bottom) return;

  // «Настройки» — вниз меню, над кнопкой обновления.
  const settings = nav.querySelector('.settings-nav');
  if (settings) bottom.prepend(settings);

  const box = document.createElement('section'),
    head = document.createElement('div'),
    title = document.createElement('span'),
    add = document.createElement('button'),
    list = document.createElement('div');
  box.className = 'sidebar-playlists';
  box.setAttribute('aria-label', 'Мои плейлисты');
  head.className = 'sidebar-playlists-head';
  title.textContent = 'Мои плейлисты';
  add.type = 'button';
  add.className = 'sidebar-playlists-add';
  add.textContent = '+';
  add.title = 'Плейлисты: создать или перенести';
  add.setAttribute('aria-label', 'Открыть плейлисты');
  add.onclick = () => document.querySelector('.playlists-nav')?.click();
  head.append(title, add);
  list.className = 'sidebar-playlists-list';
  box.append(head, list);
  bottom.before(box);

  const coverOf = (p) => {
    const first = p.preview?.find((t) => t && !t.missing);
    if (first && typeof art === 'function') return art(first, 'track-cover');
    const empty = document.createElement('span');
    empty.className = 'sidebar-playlist-glyph';
    empty.textContent = p.id === 'builtin:frequent' ? '★' : '♪';
    return empty;
  };
  function row(p) {
    const b = document.createElement('button'),
      text = document.createElement('span'),
      name = document.createElement('strong'),
      count = document.createElement('small');
    b.type = 'button';
    b.className = 'sidebar-playlist';
    b.dataset.id = p.id;
    name.textContent = p.name;
    count.textContent = p.count + ' ' + plural(p.count);
    text.append(name, count);
    b.append(coverOf(p), text);
    b.title = p.name;
    b.onclick = () => window.openPlaylistById?.(p.id);
    return b;
  }
  const plural = (n) => {
    const a = Math.abs(n) % 100,
      b = a % 10;
    if (a > 10 && a < 20) return 'треков';
    if (b === 1) return 'трек';
    if (b >= 2 && b <= 4) return 'трека';
    return 'треков';
  };

  let busy = false,
    again = false;
  async function refresh() {
    if (busy) return (again = true);
    busy = true;
    try {
      const all = await window.lumen.playlistsList();
      const own = all.filter((p) => !p.builtin);
      const frequent = all.find((p) => p.id === 'builtin:frequent' && p.count > 0);
      const items = [...own, ...(frequent ? [frequent] : [])];
      if (!items.length) {
        const hint = document.createElement('button');
        hint.type = 'button';
        hint.className = 'sidebar-playlists-empty';
        hint.textContent = 'Создай плейлист или перенеси его из Spotify и Яндекса';
        hint.onclick = () => document.querySelector('.playlists-nav')?.click();
        list.replaceChildren(hint);
      } else list.replaceChildren(...items.map(row));
      markActive();
    } catch {
      // Список плейлистов — подсказка, а не обязательная часть: при ошибке просто не трогаем.
    } finally {
      busy = false;
      if (again) {
        again = false;
        refresh();
      }
    }
  }
  function markActive() {
    const opened = document.querySelector('.playlist-detail, [data-playlist-id]')?.dataset
      ?.playlistId;
    for (const b of list.querySelectorAll('.sidebar-playlist'))
      b.classList.toggle('active', !!opened && b.dataset.id === opened);
  }

  // Обновляем при смене экрана (плейлист могли создать, переименовать, удалить) и при
  // возвращении в окно. Чаще раза в секунду не ходим.
  let last = 0;
  const soon = () => {
    if (Date.now() - last < 1000) return;
    last = Date.now();
    refresh();
  };
  if (typeof render === 'function') {
    const renderBeforeSidebarPlaylists = render;
    render = function () {
      renderBeforeSidebarPlaylists();
      soon();
    };
  }
  window.addEventListener('focus', soon);
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('dialog, .playlists-section, .playlist-detail'))
      setTimeout(refresh, 700);
  });
  refresh();
})();
