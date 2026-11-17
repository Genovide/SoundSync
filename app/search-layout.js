/* One local search field, placed in the context of the current page. */
(() => {
  const input = $('search');
  const field = input.closest('.search');
  const hero = document.querySelector('.hero');
  const header = document.querySelector('.collection-header');
  const form = node('form', 'section-search');
  const submit = node('button', 'section-search-submit', 'Найти');
  submit.type = 'submit';
  form.setAttribute('role', 'search');
  form.setAttribute('aria-label', 'Поиск в моей музыке');
  input.setAttribute('aria-label', 'Трек, исполнитель или альбом');
  field.classList.add('local-search-field');
  form.append(field, submit);
  document.body.classList.add('search-layout');
  document.querySelector('.dashboard-back')?.remove();

  const isHome = () => window.dashboardNavigation?.isHome() === true;
  function playlistSearchHost() {
    const section = document.querySelector('#playlists-section');
    const heading = section?.querySelector('.playlist-heading');
    if (!heading) return header;
    let toolbar = heading.querySelector('.playlist-search-toolbar');
    if (!toolbar) {
      const actions = heading.querySelector('.playlist-actions');
      const create = actions?.querySelector('.primary');
      if (create) {
        create.classList.add('playlist-create-action');
        heading.append(create);
      }
      toolbar = node('div', 'playlist-search-toolbar');
      if (actions) toolbar.append(actions);
      heading.append(toolbar);
    }
    const note = section.querySelector(':scope > .playlist-note');
    if (note) {
      note.classList.add('playlist-search-intro');
      heading.insertBefore(note, toolbar);
    }
    return toolbar;
  }
  function placeSearch() {
    const home = isHome();
    const local = home || !['soundcloud'].includes(view);
    const destination = home ? hero : view === 'playlists' ? playlistSearchHost() : header;
    const focused = document.activeElement === input;
    if (form.parentElement !== destination) {
      if (view === 'playlists' && !home) destination.prepend(form);
      else destination.append(form);
      if (focused && local) input.focus({ preventScroll: true });
    }
    form.hidden = !local || input.disabled;
    form.classList.toggle('home-search', home);
    if (home) destination.classList.add('home-search-host');
    else if (view !== 'playlists') destination.classList.add('collection-search-header');
    input.placeholder = home
      ? 'Найти трек, исполнителя или альбом'
      : view === 'favorites'
        ? 'Поиск в любимом'
        : view === 'albums'
          ? 'Поиск по альбомам и исполнителям'
          : view === 'artists'
            ? 'Поиск по исполнителям'
            : view === 'playlists'
              ? 'Поиск по плейлистам'
              : 'Поиск в моей музыке';
  }
  // On the home page, typing should not navigate away and move the field mid-word.
  input.addEventListener(
    'input',
    (event) => {
      if (isHome()) event.stopImmediatePropagation();
    },
    true
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isHome()) window.dashboardNavigation.restore(false);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    placeSearch();
  });
  const before = render;
  render = function () {
    const focused = document.activeElement === input;
    before();
    placeSearch();
    if (focused && !form.hidden) input.focus({ preventScroll: true });
  };
  new MutationObserver(placeSearch).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
  const playlists = document.querySelector('#playlists-section');
  if (playlists)
    new MutationObserver(placeSearch).observe(playlists, {
      childList: true,
      subtree: true,
    });
  addEventListener(
    'keydown',
    (event) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'k' ||
        document.querySelector('dialog[open]')
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const target =
        view === 'soundcloud' && !isHome() ? document.querySelector('.sc-search input') : input;
      target?.focus();
      target?.select();
    },
    true
  );
  placeSearch();
})();
