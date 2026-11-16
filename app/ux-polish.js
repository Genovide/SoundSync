// Мелочи удобства, которым нужен код: «Назад» без пустых переходов и подсказка ⌘K на Mac.
(() => {
  // «Назад» на главной, когда возвращаться некуда, не показываем (место под кнопку остаётся,
  // чтобы поиск не прыгал).
  const back = document.querySelector('.dashboard-back');
  const syncBack = () => {
    if (!back) return;
    const nowhere =
      typeof navigationTrail !== 'undefined' &&
      !navigationTrail.length &&
      document.body.classList.contains('dashboard-home') &&
      !document.body.classList.contains('track-focus');
    back.classList.toggle('nowhere-back', nowhere);
    back.tabIndex = nowhere ? -1 : 0;
  };
  if (typeof render === 'function') {
    const renderBeforeBack = render;
    render = function () {
      renderBeforeBack();
      syncBack();
    };
  }
  new MutationObserver(syncBack).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });
  back?.addEventListener('click', () => setTimeout(syncBack));
  syncBack();

  // Меню слева: помечаем, когда пункты не помещаются, чтобы показать затухание снизу.
  const menu = document.querySelector('.sidebar > nav');
  if (menu) {
    const markMenu = () => {
      menu.classList.toggle('nav-scrollable', menu.scrollHeight > menu.clientHeight + 2);
      menu.classList.toggle(
        'nav-at-end',
        menu.scrollTop + menu.clientHeight >= menu.scrollHeight - 2
      );
    };
    menu.addEventListener('scroll', markMenu, { passive: true });
    new ResizeObserver(markMenu).observe(menu);
    new MutationObserver(markMenu).observe(menu, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    markMenu();
  }

  // На Mac подсказка в поиске — ⌘K: сочетание работает и с Cmd, и с Ctrl.
  if (/Mac/i.test(navigator.platform || navigator.userAgent)) {
    const kbd = document.querySelector('.search kbd');
    if (kbd) kbd.textContent = '⌘K';
  }
})();
