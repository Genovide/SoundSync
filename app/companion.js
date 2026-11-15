(() => {
  'use strict';
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (text, fn, cls = '') => {
    const b = el('button', 'pet-button ' + cls, text);
    b.type = 'button';
    b.onclick = fn;
    return b;
  };
  const dialog = el('dialog', 'pet-dialog');
  dialog.id = 'companion-dialog';
  dialog.setAttribute('aria-labelledby', 'pet-heading');
  const head = el('header', 'pet-head'),
    heading = el('h2', '', 'Твой спутник'),
    close = button('×', () => dialog.close(), 'pet-close');
  heading.id = 'pet-heading';
  close.setAttribute('aria-label', 'Закрыть питомца');
  head.append(heading, close);
  const stage = el('div', 'pet-stage');

  const platform = el('div', 'pet-platform');
  const creature = button('', () => stroke(), 'pet-creature');
  creature.setAttribute('aria-label', 'Погладить питомца');
  const bubble = el('p', 'pet-bubble', 'Знакомимся? Я питаюсь музыкой.');
  bubble.setAttribute('role', 'status');
  const status = el('span', 'pet-status', 'Тихий вечер');
  stage.append(platform, creature, bubble, status);
  const content = el('div', 'pet-content'),
    identity = el('div', 'pet-identity'),
    petName = el('h3', '', 'Синк'),
    level = el('span', 'pet-level');
  identity.append(petName, level);
  const description = el('p', 'pet-description', 'Включи музыку — будем расти вместе.');
  const progress = el('div', 'pet-progress'),
    fill = el('span');
  progress.append(fill);
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', 'Опыт питомца');
  const xpText = el('p', 'pet-xp'),
    stats = el('div', 'pet-stats');
  const minutes = el('strong'),
    discoveries = el('strong'),
    coins = el('strong');
  for (const [value, label] of [
    [minutes, 'минут вместе'],
    [discoveries, 'знакомых треков'],
    [coins, 'нот в копилке'],
  ]) {
    const cell = el('div');
    cell.append(value, el('span', '', label));
    stats.append(cell);
  }
  const actions = el('div', 'pet-actions');
  const strokeButton = button('♡ Погладить', () => stroke());
  const gameButton = button('♫ Ловить ноты', () => startGame(), 'pet-primary');
  const treatButton = button('✦ Угостить · 5 нот', () => act({ type: 'treat' }));
  const ballButton = button('● Бросить мячик', () => playBall());
  actions.append(strokeButton, gameButton, treatButton, ballButton);
  const gameBoard = el('div', 'pet-game');
  gameBoard.hidden = true;
  const gameLabel = el('div', 'pet-game-label');
  gameBoard.append(gameLabel);
  const choice = el('section', 'pet-choice');
  choice.append(
    el('h4', '', 'Выбирай с умом'),
    el('p', 'pet-description', 'Кто появится из яйца? Вид можно выбрать только один раз.')
  );
  const choiceGrid = el('div', 'pet-choice-grid');
  choice.append(choiceGrid);
  const speciesNames = { cat: 'Кот', dog: 'Собака', fox: 'Лиса', wolf: 'Волк', bear: 'Медведь' };
  for (const [id, label] of Object.entries(speciesNames)) {
    const b = button('', () => act({ type: 'species', id }), 'pet-choice-card');
    b.setAttribute('aria-label', 'Выбрать: ' + label);
    const preview = el('span');
    preview.innerHTML = window.SoundSyncPetArt({
      species: id,
      mood: 'calm',
      level: 1,
      accessory: 'none',
    });
    b.append(preview, el('span', '', label));
    choiceGrid.append(b);
  }
  const speciesLock = el('p', 'pet-description');
  const wardrobe = el('div', 'pet-wardrobe');
  wardrobe.append(el('span', 'pet-label', 'ГАРДЕРОБ'));
  const accessories = [];
  for (const [id, label, required] of [
    ['none', 'Без всего', 1],
    ['headphones', 'Наушники', 1],
    ['glasses', 'Очки', 1],
    ['bow', 'Бабочка · ур. 2', 2],
    ['star', '✦ Звезда · ур. 3', 3],
    ['bandana', 'Бандана · ур. 4', 4],
    ['crown', '♛ Корона · ур. 5', 5],
  ]) {
    const b = button(label, () => act({ type: 'accessory', id }));
    accessories.push({ id, required, b });
    wardrobe.append(b);
  }
  const rename = el('form', 'pet-rename'),
    nameInput = el('input');
  nameInput.maxLength = 30;
  nameInput.placeholder = 'Имя питомца';
  nameInput.setAttribute('aria-label', 'Имя питомца');
  const renameButton = button('Назвать', () => {});
  renameButton.type = 'submit';
  rename.append(nameInput, renameButton);
  rename.onsubmit = (e) => {
    e.preventDefault();
    act({ type: 'rename', name: nameInput.value });
  };
  content.append(
    identity,
    description,
    progress,
    xpText,
    stats,
    actions,
    gameBoard,
    choice,
    speciesLock,
    wardrobe,
    rename
  );
  dialog.append(head, stage, content);
  document.body.append(dialog);
  const nav = el('button', 'nav pet-nav');
  nav.type = 'button';
  nav.dataset.iconified = '1';
  const paw = el('span', 'nav-icon');
  paw.innerHTML =
    '<svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true"><ellipse cx="5" cy="8" rx="2.5" ry="3.3" transform="rotate(-25 5 8)"/><ellipse cx="10" cy="4.8" rx="2.5" ry="3.3"/><ellipse cx="16" cy="5.4" rx="2.5" ry="3.3" transform="rotate(15 16 5.4)"/><ellipse cx="21" cy="9.6" rx="2.3" ry="3.1" transform="rotate(30 21 9.6)"/><path d="M6 17c.5-3 3.5-6 6-6s5.5 3 6 6c.7 4-3 4.5-6 3-3 1.5-6.7 1-6-3z"/></svg>';
  nav.append(paw, el('span', '', 'Питомец'));
  nav.onclick = () => {
    visible(true);
    ambient();
  };
  document.querySelector('.sidebar nav')?.append(nav);
  const widget = el('div', 'player-pet'),
    face = el('div', 'player-pet-face'),
    tools = el('div', 'player-pet-tools');
  const speech = el('p', 'player-pet-speech');
  speech.setAttribute('role', 'status');
  tools.append(
    button('Меню', open),
    button('Мячик', () => playBall()),
    button('Скрыть', () => visible(false))
  );
  widget.append(speech, face, tools);
  document.body.append(widget);
  function visible(on) {
    widget.hidden = !on;
    nav.hidden = on;
    localStorage.setItem('pet-visible', String(on));
  }
  visible(localStorage.getItem('pet-visible') !== 'false');
  let x = Number(localStorage.getItem('pet-x') ?? 0.77),
    y = Number(localStorage.getItem('pet-y') ?? 0.58),
    drag;
  function place() {
    widget.style.left = Math.round(x * Math.max(0, innerWidth - widget.offsetWidth)) + 'px';
    widget.style.top = Math.round(y * Math.max(0, innerHeight - widget.offsetHeight)) + 'px';
  }
  place();
  window.addEventListener('resize', place);
  face.onpointerdown = (e) => {
    drag = [e.clientX - widget.offsetLeft, e.clientY - widget.offsetTop];
    face.setPointerCapture(e.pointerId);
  };
  face.onpointermove = (e) => {
    if (!drag) return;
    x = Math.max(
      0,
      Math.min(1, (e.clientX - drag[0]) / Math.max(1, innerWidth - widget.offsetWidth))
    );
    y = Math.max(
      0,
      Math.min(1, (e.clientY - drag[1]) / Math.max(1, innerHeight - widget.offsetHeight))
    );
    place();
  };
  face.onlostpointercapture = () => {
    drag = null;
    localStorage.setItem('pet-x', x);
    localStorage.setItem('pet-y', y);
  };

  let press;
  face.addEventListener('pointerdown', (event) => {
    press = { x: event.clientX, y: event.clientY, moved: false };
  });
  face.addEventListener('pointermove', (event) => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5)
      press.moved = true;
  });
  face.addEventListener('pointerup', () => {
    if (press && !press.moved) stroke();
    press = null;
  });
  face.addEventListener('pointercancel', () => {
    press = null;
  });
  let petEpoch = 0,
    resetBusy = false;
  let pet,
    busy = false,
    gameRunning = false,
    gameTimers = [],
    bubbleTimer,
    errorsShown = false;
  const errorText = (error) =>
    String(error.message || error).replace(
      /^Error invoking remote method '[^']+': (?:Error: )?/,
      ''
    );
  function say(text) {
    clearTimeout(bubbleTimer);
    speak(text);
    bubbleTimer = setTimeout(() => ambient(), 5500);
  }
  function speak(text) {
    if (localStorage.getItem('pet-speech-enabled') === 'false') return;
    window.SoundSyncPetSpeak(bubble, text);
    window.SoundSyncPetSpeak(speech, text);
  }
  function updateSpeechPreference() {
    const muted = localStorage.getItem('pet-speech-enabled') === 'false';
    bubble.hidden = speech.hidden = muted;
    if (muted) {
      clearTimeout(bubbleTimer);
      window.SoundSyncPetSpeak(bubble, '');
      window.SoundSyncPetSpeak(speech, '');
    } else ambient();
  }
  window.addEventListener('pet-speech-preference', updateSpeechPreference);
  // Apply visibility before the first phrase; ambient needs the player state below.
  bubble.hidden = speech.hidden = localStorage.getItem('pet-speech-enabled') === 'false';
  let ambientCount = 0;
  function sayEvent(event) {
    say(window.SoundSyncPetPhrases.pick(pet?.species, event));
  }
  function ambient() {
    if (!pet?.species) {
      speak('Выбирай с умом. Я жду внутри.');
      return;
    }
    const event = audio.paused ? 'paused' : ++ambientCount % 3 === 0 ? 'character' : 'playing';
    speak(window.SoundSyncPetPhrases.pick(pet.species, event));
  }
  function draw() {
    if (!pet) return;

    const artKey = JSON.stringify([pet.species, pet.accessory, pet.level]);
    if (face.dataset.art !== artKey) {
      face.innerHTML = window.SoundSyncPetArt(pet);
      creature.innerHTML = window.SoundSyncPetArt(pet);
      face.dataset.art = artKey;
    }
    widget.classList.toggle('playing', listening);

    choice.hidden = !!pet.species && !pet.creator;
    choice.querySelector('p').textContent = pet.creator
      ? 'Режим создателя · вид можно менять'
      : 'Вид можно выбрать только один раз.';
    speciesLock.hidden = !pet.species || pet.creator;
    speciesLock.textContent = pet.species
      ? 'Твой спутник — ' + speciesNames[pet.species] + '. Выбор сделан.'
      : '';
    wardrobe.hidden = !pet.species;
    petName.textContent = pet.species ? pet.name : 'Пока ещё яйцо';
    level.textContent = pet.species ? 'УРОВЕНЬ ' + pet.level : 'СКОРО ВЫЛУПЛЮСЬ';
    if (document.activeElement !== nameInput) nameInput.value = pet.name;
    description.textContent = !pet.species
      ? 'Внутри кто-то слушает. Выбери вид — и познакомимся.'
      : 'Слушаем музыку вместе. Каждый трек добавляет немного опыта.';
    const percentage = pet.nextXp
      ? Math.min(100, ((pet.xp - pet.floorXp) / (pet.nextXp - pet.floorXp)) * 100)
      : 100;
    fill.style.width = percentage + '%';
    progress.setAttribute('aria-valuenow', Math.round(percentage));
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    xpText.textContent = pet.nextXp
      ? pet.xp + ' / ' + pet.nextXp + ' опыта · 30 секунд музыки = +4 опыта'
      : 'Максимальный уровень. Легенда твоей коллекции.';
    minutes.textContent = Math.floor(pet.listeningSeconds / 60);
    discoveries.textContent = pet.discoveries;
    coins.textContent = pet.coins;
    treatButton.disabled = pet.coins < 5;
    for (const { id, required, b } of accessories) {
      b.disabled = pet.level < required;
      b.classList.toggle('chosen', pet.accessory === id);
      b.setAttribute('aria-pressed', String(pet.accessory === id));
    }
    dialog.classList.toggle('pet-listening', listening);
    status.textContent = !listening ? '● Отдыхает рядом' : '♫ Слушает с тобой';
  }
  function update(next, epoch = petEpoch) {
    if (epoch !== petEpoch) return;
    const previous = pet?.level,
      species = pet?.species;
    pet = next;
    draw();
    if (species !== pet.species || !speech.dataset.message) ambient();
    if (previous && next.level > previous) {
      react('level');
      say('Новый уровень! Кажется, я стал чуточку круче ✦');
    }
  }
  async function act(value) {
    if (busy || !pet) return;
    const epoch = petEpoch;
    busy = true;
    try {
      const next = await window.lumen.petAction(value);
      if (epoch !== petEpoch) return;
      update(next, epoch);
      if (value.type === 'stroke') react('love');
      if (value.type === 'treat') react('treat');
      if (next.message) say(next.message);
    } catch (error) {
      if (epoch === petEpoch) say(errorText(error));
    } finally {
      if (epoch === petEpoch) busy = false;
    }
  }
  function react(type) {
    const accepted = window.SoundSyncPetMotion(face, type);
    window.SoundSyncPetMotion(creature, type);
    return accepted;
  }
  async function stroke() {
    await act({ type: 'stroke' });
  }
  let toyAnimations = [], toyBalls = [];
  function stopToy() {
    toyAnimations.forEach((animation) => animation.cancel());
    toyBalls.forEach((ball) => ball.remove());
    toyAnimations = [];
    toyBalls = [];
    ballButton.disabled = false;
  }
  function playBall() {
    if (!pet?.species || toyAnimations.length || resetBusy) return;
    if (!react('ball')) return;
    ballButton.disabled = true;
    say('Лови! Ещё разок? ●');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const host of [face, creature]) {
      if (!host.getClientRects().length) continue;
      const ball = el('span', 'pet-toy-ball');
      ball.setAttribute('aria-hidden', 'true');
      host.append(ball);
      toyBalls.push(ball);
      const size = host.clientWidth;
      const animation = ball.animate(reduced ? [{ opacity: 1 }, { opacity: 0 }] : [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 0, offset: 0 },
        { transform: `translate(${-size * .12}px,${-size * .3}px) rotate(-100deg)`, opacity: 1, offset: .22 },
        { transform: `translate(${-size * .35}px,0) rotate(-220deg)`, opacity: 1, offset: .5 },
        { transform: `translate(${-size * .16}px,${-size * .18}px) rotate(-60deg)`, opacity: 1, offset: .7 },
        { transform: `translate(${size * .12}px,0) rotate(120deg)`, opacity: 0, offset: 1 },
      ], { duration: 2100, easing: 'ease-in-out', fill: 'forwards' });
      toyAnimations.push(animation);
    }
    const currentThrow = toyAnimations;
    Promise.allSettled(currentThrow.map((animation) => animation.finished)).then(() => {
      // A cancelled previous throw must not clear a newer one.
      if (toyAnimations === currentThrow) stopToy();
    });
  }
  async function exportPet() {
    try {
      if (await window.lumen.petExport()) say('Я в файле. Можно брать меня с собой!');
    } catch (e) {
      say(errorText(e));
    }
  }
  function replacePet(next) {
    stopToy();
    petEpoch++;
    busy = false;
    errorsShown = false;
    clearTimeout(bubbleTimer);
    stopGame();
    window.SoundSyncPetMotion.cancel(face);
    window.SoundSyncPetMotion.cancel(creature);
    last = performance.now();
    previousId = current?.id;
    wasPlaying = false;
    update(next);
  }
  async function resetPet() {
    if (resetBusy) return false;
    resetBusy = true;
    try {
      const next = await window.lumen.petReset();
      if (!next) return false;
      replacePet(next);
      return true;
    } finally {
      resetBusy = false;
    }
  }
  async function importPet() {
    stopGame();
    try {
      const next = await window.lumen.petImport();
      if (next) {
        replacePet(next);
        gameButton.disabled = false;
        strokeButton.disabled = false;
        say('Я дома. Всё помню ♡');
      }
    } catch (error) {
      say(errorText(error));
    }
  }
  function stopGame() {
    for (const t of gameTimers) {
      clearTimeout(t);
      clearInterval(t);
    }
    gameTimers = [];
    gameRunning = false;
    gameBoard.hidden = true;
    gameBoard.querySelectorAll('button').forEach((e) => e.remove());
    gameButton.disabled = !pet;
  }
  async function startGame() {
    if (gameRunning) return;
    const epoch = petEpoch;
    try {
      const { token } = await window.lumen.petGameStart();
      if (epoch !== petEpoch || !dialog.open) return;
      gameRunning = true;
      gameButton.disabled = true;
      gameBoard.hidden = false;
      gameBoard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      let score = 0,
        spawned = 0;
      const started = performance.now();
      const label = () => {
        gameLabel.textContent =
          'Лови ноты нажатием · ' +
          Math.max(0, 15 - Math.floor((performance.now() - started) / 1000)) +
          ' с · ' +
          score +
          ' ♫';
      };
      label();
      gameTimers.push(setInterval(label, 200));
      say('Лови падающие ноты. Я их потом съем.');
      const spawn = () => {
        if (++spawned > 22) return;
        const n = button(
          spawned % 3 ? '♪' : '♫',
          () => {
            if (!n.isConnected) return;
            score++;
            n.remove();
            label();
            react('note');
          },
          'pet-falling-note'
        );
        n.setAttribute('aria-label', 'Поймать ноту');
        n.style.left = 5 + Math.random() * 80 + '%';
        gameBoard.append(n);
        gameTimers.push(setTimeout(() => n.remove(), 2800));
      };
      spawn();
      gameTimers.push(setInterval(spawn, 620));
      gameTimers.push(
        setTimeout(async () => {
          stopGame();
          try {
            const next = await window.lumen.petGameFinish({ token, score });
            if (epoch !== petEpoch) return;
            update(next, epoch);
            say('Поймали ' + score + ' нот! +' + score * 2 + ' опыта');
          } catch (error) {
            if (epoch === petEpoch) say(errorText(error));
          }
        }, 15000)
      );
    } catch (e) {
      if (epoch === petEpoch) say(errorText(e));
    }
  }
  dialog.addEventListener('close', stopGame);
  dialog.addEventListener('close', stopToy);
  async function open() {
    if (!dialog.open) dialog.showModal();
    const epoch = petEpoch;
    try {
      const next = await window.lumen.petGet();
      if (epoch !== petEpoch) return;
      update(next, epoch);
      ambient();
    } catch (error) {
      if (epoch !== petEpoch) return;
      say(errorText(error));
      gameButton.disabled = true;
      strokeButton.disabled = true;
    }
  }
  window.SoundSyncPet = {
    open,
    export: exportPet,
    import: importPet,
    reset: resetPet,
    react,
    say,
    sayEvent,
    get species() {
      return pet?.species;
    },
  };
  let last = performance.now(),
    previousId = null,
    wasPlaying = false,
    pending = Promise.resolve();
  function tick(inactive = false) {
    const now = performance.now(),
      seconds = (now - last) / 1000;
    last = now;
    const id = previousId,
      playing = wasPlaying && previousId === current?.id;
    previousId = current?.id;
    wasPlaying =
      !inactive && !audio.paused && !audio.ended && !audio.seeking && audio.readyState >= 3;
    // Count wall time with audible playback, not seeks, file duration or a paused window.
    const epoch = petEpoch;
    pending = pending
      .catch(() => {})
      .then(() => {
        if (epoch !== petEpoch) return null;
        return window.lumen.petTick({ id, playing, seconds });
      })
      .then((next) => {
        if (!next || epoch !== petEpoch) return;
        update(next, epoch);
        errorsShown = false;
      })
      .catch((error) => {
        if (epoch === petEpoch && dialog.open && !errorsShown) {
          say(errorText(error));
          errorsShown = true;
        }
      });
  }
  let listening = !audio.paused && !audio.ended;
  for (const event of [
    'play',
    'playing',
    'pause',
    'waiting',
    'ended',
    'emptied',
    'seeking',
    'seeked',
  ]) {
    audio.addEventListener(event, () => {
      // Buffering and seeking keep the seated pose until playback is actually paused.
      listening = !audio.paused && !audio.ended;
      tick(['waiting', 'seeking', 'emptied'].includes(event));
      draw();
    });
  }
  setInterval(() => tick(), 5000);
  const initialEpoch = petEpoch;
  window.lumen
    .petGet()
    .then((next) => update(next, initialEpoch))
    .catch(() => {});
})();
