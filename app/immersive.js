const svgPaths = {
  play: 'M9 5l11 7-11 7z',
  pause: 'M8 5v14M16 5v14',
  previous: 'M5 5v14M19 5l-10 7 10 7z',
  next: 'M19 5v14M5 5l10 7-10 7z',
  shuffle:
    'M3 6h3c5 0 7 12 12 12h3M17 14l4 4-4 4M3 18h3c2 0 3-2 4-4M14 8c1-1 2-2 4-2h3M17 2l4 4-4 4',
  repeat: 'M4 10V8a4 4 0 014-4h12M17 1l3 3-3 3M20 14v2a4 4 0 01-4 4H4M7 17l-3 3 3 3',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z',
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', name === 'play' ? 'currentColor' : 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(s.namespaceURI, 'path');
  p.setAttribute('d', svgPaths[name] || svgPaths.play);
  s.append(p);
  return s;
}
function refreshPlayIcon() {
  $('play').replaceChildren(icon(audio.paused ? 'play' : 'pause'));
}
for (const id of ['previous', 'next', 'shuffle', 'repeat']) $(id).replaceChildren(icon(id));
audio.addEventListener('play', refreshPlayIcon);
audio.addEventListener('pause', refreshPlayIcon);
refreshPlayIcon();
const immersive = node('section', 'immersive hidden');
immersive.id = 'immersive';
immersive.setAttribute('aria-label', 'Экран трека');
const immersiveTop = node('div', 'immersive-top'),
  closeImmersive = node('button', 'back-button');
closeImmersive.type = 'button';
closeImmersive.append(icon('back'), node('span', '', 'В библиотеку'));
const immersiveBadge = node('span', 'immersive-badge', 'СЕЙЧАС ИГРАЕТ');
const viewSwitch = node('div', 'listening-switch');
viewSwitch.setAttribute('role', 'tablist');
viewSwitch.setAttribute('aria-label', 'Экран трека');
const showVisual = node('button', 'listening-tab active', 'Визуализация'),
  showBoth = node('button', 'listening-tab', 'Вместе'),
  showLyrics = node('button', 'listening-tab', 'Текст песни');
showBoth.title = 'Визуализация + текст песни';
const viewTabs = [showVisual, showBoth, showLyrics];
for (const [button, id, panel] of [
  [showVisual, 'visual-view-tab', 'visual-panel'],
  [showBoth, 'both-view-tab', 'visual-panel listening-lyrics'],
  [showLyrics, 'lyrics-view-tab', 'listening-lyrics'],
]) {
  button.id = id;
  button.type = 'button';
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', panel);
  viewSwitch.append(button);
}
const listeningControls = node('div', 'listening-controls');
immersiveTop.append(closeImmersive, viewSwitch, listeningControls);
const immersiveArt = node('div', 'immersive-art'),
  immersiveTitle = node('h1', 'immersive-title'),
  immersiveArtist = node('p', 'immersive-artist'),
  immersiveAlbum = node('p', 'immersive-album'),
  immersiveInfo = node('div', 'immersive-info'),
  listeningActions = node('div', 'listening-actions');
immersiveInfo.append(
  immersiveBadge,
  immersiveArt,
  immersiveTitle,
  immersiveArtist,
  immersiveAlbum,
  listeningActions
);
const visualPanel = node('div', 'visual-panel'),
  visualHeader = node('div', 'visual-header');
visualPanel.id = 'visual-panel';
visualPanel.setAttribute('role', 'tabpanel');
visualPanel.setAttribute('aria-labelledby', showVisual.id);
const visualStatus = node('span', 'visual-status', 'НАЖМИ PLAY'),
  visualMode = node('select', 'visual-mode');
visualHeader.append(node('span', '', 'АУДИОВИЗУАЛИЗАЦИЯ'), visualMode);
const visualCanvas = node('canvas', 'visual-canvas');
visualCanvas.id = 'visualizer';
visualCanvas.setAttribute('aria-label', 'Визуализация звука');
const visualFooter = node('div', 'visual-footer');
visualFooter.append(visualStatus, node('span', '', 'ЖИВОЙ СИГНАЛ'));
visualPanel.append(visualHeader, visualCanvas, visualFooter);
const listeningLyrics = node('div', 'listening-lyrics hidden');
listeningLyrics.id = 'listening-lyrics';
listeningLyrics.setAttribute('role', 'tabpanel');
listeningLyrics.setAttribute('aria-labelledby', showLyrics.id);
immersive.append(immersiveTop, immersiveInfo, visualPanel, listeningLyrics);
document.body.append(immersive);
let listeningView = 'visual',
  listeningReturnFocus = null,
  sidebarLyrics = true;
const listeningHomes = new Map();
function mountListeningContent() {
  sidebarLyrics = !$('lyrics').classList.contains('hidden');
  for (const [selector, target] of [
    ['.alignment-tools', listeningActions],
    ['.song-insight', listeningActions],
    ['#lyrics', listeningLyrics],
  ]) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const placeholder = document.createComment('listening-home');
    element.before(placeholder);
    listeningHomes.set(element, placeholder);
    target.append(element);
  }
}
function restoreListeningContent() {
  for (const [element, placeholder] of listeningHomes) {
    placeholder.replaceWith(element);
  }
  listeningHomes.clear();
  panelTab(sidebarLyrics);
}
// Три режима: только сцена, сцена с текстом поверх («Вместе») и только текст.
function setListeningView(mode) {
  listeningView = ['lyrics', 'both'].includes(mode) ? mode : 'visual';
  const lyrics = listeningView !== 'visual',
    scene = listeningView !== 'lyrics';
  // Запоминаем выбор между сценой и «Вместе», чтобы экран трека открывался так же.
  if (scene)
    try {
      localStorage.setItem('listening-view', listeningView);
    } catch {}
  document.body.classList.toggle('lyrics-focus', lyrics);
  immersive.classList.toggle('showing-lyrics', listeningView === 'lyrics');
  immersive.classList.toggle('showing-both', listeningView === 'both');
  visualPanel.classList.toggle('hidden', !scene);
  listeningLyrics.classList.toggle('hidden', !lyrics);
  listeningControls.classList.toggle('hidden', !scene);
  for (const [button, active] of [
    [showVisual, listeningView === 'visual'],
    [showBoth, listeningView === 'both'],
    [showLyrics, listeningView === 'lyrics'],
  ]) {
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  if (lyrics) {
    panelTab(true);
    requestAnimationFrame(() => {
      if (typeof targetLyricScroll === 'function') targetLyricScroll();
    });
  }
}
viewSwitch.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const at = Math.max(0, viewTabs.indexOf(document.activeElement)),
    next =
      event.key === 'Home'
        ? viewTabs[0]
        : event.key === 'End'
          ? viewTabs[viewTabs.length - 1]
          : viewTabs[
              (at + (event.key === 'ArrowRight' ? 1 : viewTabs.length - 1)) % viewTabs.length
            ];
  next.click();
  next.focus();
});
// Шесть шейдерных сцен; прежние сохранённые значения (старые сцены) открываются как «Аврора».
const SHADER_SCENES = Object.keys(window.shaderScenePresets || {});
let visualPreset = SHADER_SCENES.includes(localStorage.getItem('visual-preset'))
    ? localStorage.getItem('visual-preset')
    : 'aurora',
  visualTick = 0,
  visualPaints = 0;
function updateImmersive() {
  if (!current) return;
  const artKey = current.id + ':' + current.cover + ':' + (current.customCover || '');
  if (immersiveArt.dataset.track !== artKey) {
    immersiveArt.replaceChildren(art(current, 'immersive-image'));
    immersiveArt.dataset.track = artKey;
  }
  immersiveTitle.textContent = current.title;
  immersiveArtist.textContent = current.artist;
  immersiveAlbum.textContent = current.album;
  visualStatus.textContent = audio.paused ? 'НА ПАУЗЕ' : 'СЕЙЧАС ЗВУЧИТ';
}
function openImmersive() {
  if (!current) {
    toast('Сначала выбери трек');
    return;
  }
  if (immersive.classList.contains('hidden')) {
    listeningReturnFocus = document.activeElement;
    mountListeningContent();
  }
  document.body.classList.add('track-focus');
  immersive.classList.remove('hidden');
  let saved = 'visual';
  try {
    saved = localStorage.getItem('listening-view') === 'both' ? 'both' : 'visual';
  } catch {}
  setListeningView(saved);
  updateImmersive();
  (saved === 'both' ? showBoth : showVisual).focus();
}
function exitImmersive() {
  if (immersive.classList.contains('hidden')) return;
  document.body.classList.remove('track-focus', 'lyrics-focus');
  immersive.classList.add('hidden');
  restoreListeningContent();
  if (listeningReturnFocus?.isConnected) listeningReturnFocus.focus();
  else $('mini-cover').focus();
}
for (const id of ['mini-cover', 'now-cover']) {
  const e = $(id);
  e.tabIndex = 0;
  e.setAttribute('role', 'button');
  e.setAttribute('aria-label', 'Открыть экран трека');
  e.title = 'Визуализация и текст песни';
  e.onclick = openImmersive;
  e.onkeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      openImmersive();
    }
  };
}
closeImmersive.onclick = exitImmersive;
showVisual.onclick = () => setListeningView('visual');
showBoth.onclick = () => setListeningView('both');
showLyrics.onclick = () => setListeningView('lyrics');
const closeLyrics = closeImmersive;
expand.onclick = openImmersive;
expand.title = 'Открыть экран трека';
expand.setAttribute('aria-label', 'Открыть визуализацию и текст песни');
addEventListener('keydown', (event) => {
  // Esc, который закрывает панель настроек визуализации, экран трека не закрывает. Проверяем
  // и пометку, и саму панель: порядок обработчиков на window не гарантирован.
  if (
    event.key === 'Escape' &&
    !event.defaultPrevented &&
    !document.querySelector('dialog[open]') &&
    !document.querySelector('.visual-settings:not(.hidden)')
  )
    exitImmersive();
});
audio.addEventListener('play', updateImmersive);
audio.addEventListener('pause', () => (visualStatus.textContent = 'НА ПАУЗЕ'));
audio.addEventListener('loadedmetadata', updateImmersive);
const loadBeforeImmersive = load;
load = function (track) {
  loadBeforeImmersive(track);
  updateImmersive();
};
const vg = visualCanvas.getContext('2d'),
  levels = new Float32Array(80);
let visualPrevious = 0;
const response = new AudioResponse();
const shaderScene = new ShaderScene();
const sceneInfo = window.shaderSceneInfo || {};

// Палитра сцен: по умолчанию цвета обложки трека, либо одна из готовых.
const VISUAL_PALETTES = {
  cover: { name: 'Обложка', colors: null },
  soundsync: { name: 'SoundSync', colors: ['#FFD23F', '#FF4FA3', '#7A5CFF'] },
  neon: { name: 'Неон', colors: ['#00E5FF', '#7B2FFF', '#FF2E88'] },
  sunset: { name: 'Закат', colors: ['#FF7A3D', '#FF3D6E', '#FFD9A0'] },
  ice: { name: 'Лёд', colors: ['#9FD8FF', '#E8F4FF', '#4D7CFF'] },
  mono: { name: 'Моно', colors: ['#FFFFFF', '#8E8E96', '#D2D2D8'] },
};
let visualPalette = VISUAL_PALETTES[localStorage.getItem('visual-palette')]
  ? localStorage.getItem('visual-palette')
  : 'cover';
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const scenePalette = () => VISUAL_PALETTES[visualPalette].colors?.map(hexRgb) || palette;

// ——— Настройки визуализации: отдельная кнопка и панель, на экране только кнопка ———
const reactionLabel = node('label', 'reaction-control'),
  reactionText = node('span', '', 'Реакция'),
  reactionSlider = node('input');
reactionSlider.type = 'range';
reactionSlider.min = '.5';
reactionSlider.max = '3';
reactionSlider.step = '.1';
reactionSlider.value = localStorage.getItem('visual-sensitivity') || '1.4';
reactionSlider.setAttribute('aria-label', 'Чувствительность визуализации');
reactionSlider.oninput = () => localStorage.setItem('visual-sensitivity', reactionSlider.value);
reactionLabel.append(reactionText, reactionSlider);

const visualSettingsButton = node('button', 'visual-settings-button'),
  visualSettingsName = node('span', 'visual-settings-name');
visualSettingsButton.type = 'button';
visualSettingsButton.title = 'Настройки визуализации';
visualSettingsButton.setAttribute('aria-haspopup', 'dialog');
visualSettingsButton.setAttribute('aria-expanded', 'false');
visualSettingsButton.append(icon('settings'), visualSettingsName);
listeningControls.append(visualSettingsButton);

const visualSettings = node('div', 'visual-settings hidden');
visualSettings.setAttribute('role', 'dialog');
visualSettings.setAttribute('aria-label', 'Настройки визуализации');
const sceneGrid = node('div', 'visual-scene-grid'),
  paletteRow = node('div', 'visual-palettes');
for (const [id, info] of Object.entries(sceneInfo)) {
  const card = node('button', 'visual-scene-card');
  card.type = 'button';
  card.dataset.scene = id;
  card.append(
    node('span', 'visual-scene-key', String(Object.keys(sceneInfo).indexOf(id) + 1)),
    node('strong', '', info.name),
    node('small', '', info.desc)
  );
  card.onclick = () => setVisualPreset(id);
  sceneGrid.append(card);
}
for (const [id, p] of Object.entries(VISUAL_PALETTES)) {
  const chip = node('button', 'visual-palette-chip');
  chip.type = 'button';
  chip.dataset.palette = id;
  const swatch = node('i');
  for (const c of p.colors || []) {
    const s = node('span');
    s.style.background = c;
    swatch.append(s);
  }
  if (!p.colors) swatch.classList.add('cover-swatch');
  chip.append(swatch, node('span', '', p.name));
  chip.onclick = () => {
    visualPalette = id;
    localStorage.setItem('visual-palette', id);
    refreshVisualMode();
  };
  paletteRow.append(chip);
}
visualMode.classList.add('visually-hidden');
visualMode.tabIndex = -1;
visualMode.setAttribute('aria-hidden', 'true');
visualSettings.append(
  node('div', 'visual-settings-title', 'Визуализация'),
  node('div', 'visual-settings-label', 'Сцена'),
  sceneGrid,
  node('div', 'visual-settings-label', 'Цвета'),
  paletteRow,
  reactionLabel,
  visualMode
);
immersive.append(visualSettings);
const sceneCaption = node('div', 'scene-caption');
sceneCaption.setAttribute('aria-live', 'polite');
visualPanel.append(sceneCaption);

function setVisualSettingsOpen(open) {
  visualSettings.classList.toggle('hidden', !open);
  visualSettingsButton.classList.toggle('active', open);
  visualSettingsButton.setAttribute('aria-expanded', String(open));
}
visualSettingsButton.onclick = () =>
  setVisualSettingsOpen(visualSettings.classList.contains('hidden'));
document.addEventListener('pointerdown', (event) => {
  if (
    !visualSettings.classList.contains('hidden') &&
    !visualSettings.contains(event.target) &&
    !visualSettingsButton.contains(event.target)
  )
    setVisualSettingsOpen(false);
});
// Esc сначала закрывает панель настроек, а не весь экран трека; 1–6 переключают сцены.
addEventListener(
  'keydown',
  (event) => {
    if (immersive.classList.contains('hidden') || listeningView === 'lyrics') return;
    if (event.target.matches?.('input,textarea,select,[contenteditable]')) return;
    if (event.key === 'Escape' && !visualSettings.classList.contains('hidden')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setVisualSettingsOpen(false);
      visualSettingsButton.focus();
      return;
    }
    const n = Number(event.key);
    if (!event.ctrlKey && !event.metaKey && !event.altKey && n >= 1 && n <= SHADER_SCENES.length) {
      event.preventDefault();
      setVisualPreset(SHADER_SCENES[n - 1]);
    }
  },
  true
);

let captionTimer = 0;
function showSceneCaption() {
  const info = sceneInfo[visualPreset];
  if (!info) return;
  sceneCaption.replaceChildren(node('strong', '', info.name), node('span', '', info.desc));
  sceneCaption.classList.remove('visible');
  void sceneCaption.offsetWidth;
  sceneCaption.classList.add('visible');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => sceneCaption.classList.remove('visible'), 2600);
}

// Запасная 2D-сцена на случай, если видеокарта не справилась с шейдером.
function drawFallback(w, h, colors, moving) {
  const [a, b] = colors,
    cx = w / 2,
    cy = h / 2,
    pulse = moving ? response.bass : 0.1;
  const glow = vg.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.6);
  glow.addColorStop(0, `rgba(${a},${0.18 + pulse * 0.3})`);
  glow.addColorStop(1, 'rgba(14,13,16,0)');
  vg.fillStyle = glow;
  vg.fillRect(0, 0, w, h);
  const bars = 64,
    gap = w / bars;
  for (let i = 0; i < bars; i++) {
    const v = levels[Math.floor((i / bars) * 80)],
      bh = Math.max(2, v * h * 0.55);
    vg.fillStyle = `rgba(${i % 2 ? a : b},${0.35 + v * 0.6})`;
    vg.fillRect(i * gap + gap * 0.2, cy - bh / 2, gap * 0.6, bh);
  }
}
const fallbackNotified = {};

function drawVisualizer(ms) {
  requestAnimationFrame(drawVisualizer);
  // Все сцены считает видеокарта, поэтому рисуем в каждом кадре дисплея.
  if (
    document.hidden ||
    immersive.classList.contains('hidden') ||
    visualPanel.classList.contains('hidden') ||
    ms - visualTick < 4
  )
    return;
  visualTick = ms;
  visualPaints++;
  const w = visualCanvas.clientWidth,
    h = visualCanvas.clientHeight,
    dpr = Math.min(devicePixelRatio, 1.5);
  if (!w || !h) return;
  if (visualCanvas.width !== Math.round(w * dpr) || visualCanvas.height !== Math.round(h * dpr)) {
    visualCanvas.width = Math.round(w * dpr);
    visualCanvas.height = Math.round(h * dpr);
  }
  // Сцены реагируют на музыку и при системной настройке «уменьшить движение»: там они просто
  // двигаются медленнее (это учитывает ShaderScene), а не замирают.
  const playing = analyser && !audio.paused,
    moving = !!(playing && effect);
  if (playing) {
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(wave);
  }
  for (let i = 0; i < 80; i++) {
    const bin = Math.min(
      (freq?.length || 512) - 1,
      Math.floor(2 * Math.pow((freq?.length || 512) / 2, i / 80))
    );
    const raw = playing ? freq[bin] / 255 : 0;
    levels[i] += (raw - levels[i]) * 0.08;
  }
  const dt = Math.min(80, ms - (visualPrevious || ms)) || 16;
  visualPrevious = ms;
  response.update(
    freq,
    wave,
    ctx?.sampleRate || 48000,
    analyser?.fftSize || 1024,
    Number(reactionSlider.value),
    moving,
    dt
  );
  const colors = scenePalette();
  if (
    shaderScene.draw(
      vg,
      visualCanvas.width,
      visualCanvas.height,
      visualPreset,
      response,
      playing ? freq : null,
      ctx?.sampleRate || 48000,
      analyser?.fftSize || 1024,
      colors,
      dt,
      moving,
      effect === 1 ? 0.65 : 1
    )
  )
    return;
  if (!fallbackNotified[visualPreset]) {
    fallbackNotified[visualPreset] = true;
    toast(
      `Сцена «${sceneInfo[visualPreset]?.name || visualPreset}» не поддерживается этой видеокартой — показываем простую визуализацию`
    );
  }
  vg.setTransform(dpr, 0, 0, dpr, 0, 0);
  vg.clearRect(0, 0, w, h);
  drawFallback(w, h, colors, moving);
}
requestAnimationFrame(drawVisualizer);

for (const id of SHADER_SCENES) {
  const option = node('option', '', sceneInfo[id]?.name || id);
  option.value = id;
  visualMode.append(option);
}
function refreshVisualMode() {
  immersive.classList.add('shader-layout');
  visualMode.value = visualPreset;
  visualMode.setAttribute('aria-label', 'Визуализация');
  visualSettingsName.textContent = sceneInfo[visualPreset]?.name || '';
  for (const card of sceneGrid.children)
    card.classList.toggle('active', card.dataset.scene === visualPreset);
  for (const chip of paletteRow.children)
    chip.classList.toggle('active', chip.dataset.palette === visualPalette);
}
function setVisualPreset(id) {
  if (!SHADER_SCENES.includes(id) || id === visualPreset) return;
  visualPreset = id;
  localStorage.setItem('visual-preset', id);
  refreshVisualMode();
  showSceneCaption();
}
refreshVisualMode();
// Список сцен скрыт, но через него сцену меняют экран «Настройки» и самопроверка.
visualMode.onchange = () => setVisualPreset(visualMode.value);

window.runImmersiveTest = async () => {
  $('mini-cover').click();
  await new Promise((r) => setTimeout(r, 1200));
  const checks = {
    opens: !immersive.classList.contains('hidden'),
    cover: !!immersiveArt.querySelector('img,.generated-art'),
    title: immersiveTitle.textContent === current?.title,
    canvas: visualCanvas.width > 0 && visualPaints > 0,
    sceneIsBackground: getComputedStyle(visualPanel).position === 'absolute',
    settingsHiddenByDefault: visualSettings.classList.contains('hidden'),
    sixScenes: visualMode.options.length === 6 && SHADER_SCENES.length === 6,
  };
  visualSettingsButton.click();
  checks.settingsOpen = !visualSettings.classList.contains('hidden');
  dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  checks.escapeClosesSettingsFirst =
    visualSettings.classList.contains('hidden') && !immersive.classList.contains('hidden');
  dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  checks.escapeCloses = immersive.classList.contains('hidden');
  openImmersive();
  await start();
  await new Promise((r) => setTimeout(r, 900));
  checks.reactsToAudio = levels.some((x) => x > 0.05);
  showBoth.click();
  checks.bothShowsSceneAndLyrics =
    !visualPanel.classList.contains('hidden') &&
    !listeningLyrics.classList.contains('hidden') &&
    !listeningControls.classList.contains('hidden');
  showLyrics.click();
  checks.lyricsHidesScene = visualPanel.classList.contains('hidden');
  showVisual.click();
  const artBounds = immersiveArt.getBoundingClientRect(),
    visualBounds = visualCanvas.getBoundingClientRect();
  // Сцена теперь фон всего экрана: проверяем, что обложка лежит поверх неё, а не под ней.
  const coverHit = document.elementFromPoint(
    artBounds.left + artBounds.width / 2,
    artBounds.top + artBounds.height / 2
  );
  checks.coverAboveScene =
    !!coverHit && !visualPanel.contains(coverHit) && immersiveInfo.contains(coverHit);
  checks.sceneFillsBackground = visualBounds.right >= immersive.getBoundingClientRect().right - 1;
  checks.visualizerSpace = visualBounds.width > 400 && visualBounds.height > 300;
  const before = visualPreset;
  for (const key of SHADER_SCENES) {
    visualMode.value = key;
    visualMode.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 600));
    checks[key + 'Selected'] = visualPreset === key;
    checks[key + 'Rendered'] = (shaderScene.frames[key] || 0) > 10 && !shaderScene.failed[key];
  }
  setVisualPreset(before);
  return { ok: Object.values(checks).every(Boolean), checks };
};
