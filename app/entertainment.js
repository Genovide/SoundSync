/* Blind listening uses its own audio element so track metadata never reaches the player. */
(() => {
  const make = (tag, cls, text) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const nav = document.querySelector('.sidebar nav');
  const group = make('details', 'nav-more entertainment-nav');
  const summary = make('summary', 'nav nav-more-toggle');
  summary.append(make('span', 'nav-icon', '◈'), document.createTextNode('Развлечения'));
  const items = make('div', 'nav-more-items');
  const entry = (label, glyph, action) => {
    const b = make('button', 'nav');
    b.type = 'button';
    b.append(make('span', 'nav-icon', glyph), document.createTextNode(label));
    b.onclick = action;
    return b;
  };
  const launch = entry('Инкогнито', '◇', () => open());
  launch.id = 'incognito-open';
  items.append(launch);
  const upgrader = document.getElementById('upgrader-open');
  if (upgrader) items.append(upgrader);
  const oldPet = document.querySelector('.pet-nav');
  const petEntry = entry('Питомец', '♡', () => window.SoundSyncPet.open());
  const paw = oldPet?.querySelector('.nav-icon');
  if (paw) petEntry.firstChild.replaceWith(paw.cloneNode(true));
  oldPet?.remove();
  items.append(petEntry);
  group.append(summary, items);
  group.open = localStorage.getItem('entertainment-open') !== 'false';
  group.ontoggle = () => localStorage.setItem('entertainment-open', String(group.open));
  (nav.querySelector('.nav-more, .settings-nav') || null)?.before(group);
  if (!group.isConnected) nav.append(group);

  const dialog = make('dialog', 'incognito-dialog');
  dialog.innerHTML = `<header class="incognito-header"><div><span class="incognito-eyebrow">ТОЛЬКО ТЫ И ЗВУК</span><h2>Музыкальный инкогнито</h2></div><button type="button" class="quiet incognito-close" aria-label="Закрыть">×</button></header>
    <p class="incognito-intro">Пять треков без имён и обложек. Сначала впечатление — потом раскрытие.</p>
    <div class="incognito-stage"><div class="incognito-art" aria-hidden="true"></div><span class="incognito-count"></span><h3 class="incognito-title">Доверься слуху</h3><p class="incognito-detail">Новые записи и одно забытое знакомство из твоей музыки.</p></div>
    <p class="incognito-status" role="status"></p><div class="incognito-progress"><i></i></div><div class="incognito-actions"></div><div class="incognito-results"></div>`;
  document.body.append(dialog);
  const q = (s) => dialog.querySelector(s);
  const artwork = window.createIncognitoArt(q('.incognito-art'));
  const preview = new Audio();
  preview.preload = 'metadata';
  let sessionActive = false;
  let rounds = [],
    index = 0,
    revealed = false,
    token = 0,
    oldTrack = null,
    resume = false,
    seekAt = 0,
    started = false,
    timer = null;
  const votes = [];
  function reactionIcon(kind) {
    const box = make('span', 'incognito-reaction');
    box.setAttribute('aria-hidden', 'true');
    const path =
      kind === 'skip'
        ? '<path d="m12 3-2 5 4 3-4 4 2 6"/><path d="M12 4.5C7-1 0 5 4 11l8 10 8-10c4-6-3-12-8-6.5Z"/>'
        : kind === 'full'
          ? '<path d="m8 4 12 8-12 8Z"/>'
          : '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>';
    box.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    return box;
  }
  function favoriteLabel(button, liked) {
    const icon = reactionIcon('like');
    icon.classList.toggle('is-liked', liked);
    button.replaceChildren(icon, make('span', '', liked ? 'В любимом' : 'В любимое'));
  }
  function action(label, fn, primary = false) {
    const b = make('button', primary ? 'primary' : 'outline', label);
    b.type = 'button';
    b.onclick = fn;
    q('.incognito-actions').append(b);
    return b;
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
    artwork.setPlaying(false);
  }
  function status(text) {
    q('.incognito-status').textContent = text;
  }
  function open() {
    if (!dialog.open) {
      dialog.showModal();
      artwork.resume();
      if (rounds.length && index < rounds.length && !revealed) round();
    }
  }
  function idle() {
    q('.incognito-actions').replaceChildren();
    action('Начать · 5 треков', start, true);
  }
  function shuffleList(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  async function start() {
    const generation = ++token;
    stop();
    votes.length = 0;
    index = 0;
    rounds = [];
    q('.incognito-results').replaceChildren();
    q('.incognito-actions').replaceChildren();
    status('Подбираем пять встреч со звуком…');
    let remote = [];
    try {
      const r = await Promise.race([
        window.lumen.scRandom([...favorites]),
        new Promise((resolve) => setTimeout(() => resolve([]), 8000)),
      ]);
      remote = Array.isArray(r) ? r : r?.tracks || [];
    } catch {}
    if (generation !== token || !dialog.open) return;
    const seen = new Set();
    const clean = (t) => t && !t.playbackUnavailable && t.id !== current?.id;
    const remotePicks = shuffleList(remote.filter((t) => clean(t) && !favorites.has(t.id)));
    const history = window.initialUiPreferences?.recent || [];
    const forgotten = shuffleList(
      library.tracks.filter((t) => clean(t) && !history.slice(0, 20).includes(t.id))
    );
    for (const t of [...remotePicks.slice(0, 4), ...forgotten, ...remotePicks.slice(4)]) {
      const key = String(t.artist || '').toLowerCase() + '|' + String(t.title || '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rounds.push(t);
      if (rounds.length === 5) break;
    }
    rounds = shuffleList(rounds);
    if (!rounds.length) {
      status(
        'Пока нет доступных треков. Добавь музыку в библиотеку или проверь подключение к SoundCloud.'
      );
      idle();
      return;
    }
    if (!sessionActive) {
      oldTrack = current;
      resume = !audio.paused;
      sessionActive = true;
    }
    audio.pause();
    round();
  }
  function round() {
    stop();
    revealed = false;
    started = false;
    const t = rounds[index];
    q('.incognito-count').textContent = `${index + 1} / ${rounds.length}`;
    q('.incognito-title').textContent = 'Кто скрывается за звуком?';
    q('.incognito-detail').textContent = 'Без подсказок. Просто послушай.';
    artwork.reset(index + 1);
    q('.incognito-progress i').style.width = '0%';
    q('.incognito-actions').replaceChildren();
    status('Загружаем фрагмент…');
    action('Слушать / пауза', () => (preview.paused ? play() : preview.pause()));
    action('Цепляет', () => reveal('like'), true);
    action('Мимо', () => reveal('skip'));
    action('Хочу дослушать', () => reveal('full'));
    preview.volume = audio.volume;
    preview.muted = audio.muted;
    seekAt = Number(t.duration) > 60 ? Math.min(45, t.duration * 0.35) : 0;
    preview.src = media(t) + (t.remote ? '?start=' + seekAt : '');
    preview.load();
  }
  async function play() {
    if (started && !revealed && preview.currentTime - (rounds[index]?.remote ? 0 : seekAt) >= 25) {
      round();
      return;
    }
    try {
      await preview.play();
      status('');
    } catch {
      status('Не удалось запустить запись. Можно повторить или раскрыть трек.');
    }
  }
  preview.addEventListener('loadedmetadata', () => {
    if (revealed || !dialog.open) return;
    if (Number.isFinite(preview.duration) && preview.duration > 0)
      seekAt = Math.min(seekAt, Math.max(0, preview.duration - 15));
    if (!rounds[index]?.remote) preview.currentTime = seekAt;
    started = true;
    play();
  });
  preview.addEventListener('playing', () => artwork.setPlaying(true));
  preview.addEventListener('pause', () => artwork.setPlaying(false));
  preview.addEventListener('error', () => {
    artwork.setPlaying(false);
    if (dialog.open && rounds.length)
      status('Запись сейчас недоступна. Повтори запуск или раскрой её.');
  });
  preview.addEventListener('timeupdate', () => {
    if (!started || revealed) return;
    const elapsed = Math.max(0, preview.currentTime - (rounds[index]?.remote ? 0 : seekAt));
    q('.incognito-progress i').style.width = Math.min(100, (elapsed / 25) * 100) + '%';
    if (elapsed >= 25) {
      preview.pause();
      status('Первое впечатление? Выбери ответ, чтобы раскрыть трек.');
    }
  });
  function reveal(vote) {
    if (revealed) return;
    revealed = true;
    const t = rounds[index];
    votes.push({ track: t, vote });
    stop();
    q('.incognito-title').textContent = t.title;
    q('.incognito-detail').textContent = t.artist + (t.album ? ' · ' + t.album : '');
    artwork.reveal(t);
    status(
      t.remote ? 'Новое знакомство из SoundCloud' : 'Этот трек уже в твоей библиотеке. Узнал?'
    );
    q('.incognito-actions').replaceChildren();
    action(
      'Слушать целиком',
      () => {
        resume = false;
        dialog.close();
        playList([t], 0);
      },
      vote === 'full'
    );
    const save = action(favorites.has(t.id) ? '♥ В любимом' : '♡ В любимое', async () => {
      if (favorites.has(t.id)) return;
      save.disabled = true;
      try {
        if (t.remote) await window.lumen.scFavoriteSet(t.id, true);
        favorites.add(t.id);
        if (t.remote && typeof remoteFavoriteTracks !== 'undefined')
          remoteFavoriteTracks.set(t.id, t);
        localStorage.setItem('favorites', JSON.stringify([...favorites]));
        await window.lumen.preferencesSet({ favoriteIds: [...favorites] });
        favoriteLabel(save, true);
      } catch {
        status('Не удалось сохранить. Попробуй ещё раз.');
      } finally {
        save.disabled = false;
      }
    });
    favoriteLabel(save, favorites.has(t.id));
    action(
      index + 1 < rounds.length ? 'Следующий →' : 'Итоги',
      () => {
        if (++index < rounds.length) round();
        else finish();
      },
      true
    );
  }
  function finish() {
    stop();
    artwork.summary();
    q('.incognito-count').textContent = 'СЕАНС ЗАВЕРШЁН';
    q('.incognito-title').textContent = 'Твои впечатления';
    q('.incognito-detail').textContent = 'Вот кто был по ту сторону звука.';
    status('');
    const results = q('.incognito-results');
    results.replaceChildren();
    for (const { track: t, vote } of votes) {
      const b = make('button', 'incognito-result');
      b.type = 'button';
      b.append(reactionIcon(vote), make('span', '', t.title + ' · ' + t.artist));
      b.onclick = () => {
        resume = false;
        dialog.close();
        playList([t], 0);
      };
      results.append(b);
    }
    idle();
  }
  q('.incognito-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    token++;
    stop();
    artwork.stop();
    if (resume && current === oldTrack) audio.play().catch(() => {});
    resume = false;
    sessionActive = false;
    if (!rounds.length) {
      status('');
      idle();
    }
  });
  idle();
})();
