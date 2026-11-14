/* Эквалайзер: 7 полос между источником звука и анализатором визуализатора.
   Цепочка: источник → полосы → предусилитель (защита от перегрузки) → анализатор → динамики. */
(() => {
  'use strict';
  const BANDS = [
    { freq: 60, type: 'lowshelf', label: '60' },
    { freq: 150, type: 'peaking', label: '150' },
    { freq: 400, type: 'peaking', label: '400' },
    { freq: 1000, type: 'peaking', label: '1к' },
    { freq: 2400, type: 'peaking', label: '2,4к' },
    { freq: 6000, type: 'peaking', label: '6к' },
    { freq: 15000, type: 'highshelf', label: '15к' },
  ];
  const PRESETS = {
    flat: { name: 'Ровно', gains: [0, 0, 0, 0, 0, 0, 0] },
    bass: { name: 'Бас', gains: [6, 4, 1, 0, 0, 0, 0] },
    vocal: { name: 'Вокал', gains: [-2, -1, 1, 3, 3, 1, 0] },
    bright: { name: 'Яркость', gains: [0, 0, 0, 1, 2, 4, 5] },
    rock: { name: 'Рок', gains: [4, 2, -1, -1, 1, 3, 4] },
    electronic: { name: 'Электроника', gains: [5, 3, 0, -1, 1, 2, 4] },
    night: { name: 'Ночью тише', gains: [-4, -2, 0, 1, 1, -1, -3] },
  };
  const KEY = 'equalizer-v1';
  const clamp = (x) => Math.max(-12, Math.min(12, Number(x) || 0));
  let state = { enabled: true, preset: 'flat', gains: PRESETS.flat.gains.slice() };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && Array.isArray(saved.gains) && saved.gains.length === BANDS.length)
      state = {
        enabled: saved.enabled !== false,
        preset: saved.preset || 'custom',
        gains: saved.gains.map(clamp),
      };
  } catch {}
  let filters = [],
    preamp = null;
  const listeners = new Set();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };
  function apply() {
    if (!filters.length || typeof ctx === 'undefined' || !ctx) return;
    const now = ctx.currentTime;
    filters.forEach((f, i) =>
      f.gain.setTargetAtTime(state.enabled ? state.gains[i] : 0, now, 0.03)
    );
    // Поднятые полосы могут перегрузить звук: снижаем общий уровень на половину максимума.
    const boost = state.enabled ? Math.max(0, ...state.gains) : 0;
    preamp.gain.setTargetAtTime(Math.pow(10, -(boost * 0.5) / 20), now, 0.03);
  }
  function notify() {
    for (const fn of listeners) fn(api.get());
  }
  // Заменяем сборку звуковой цепочки, чтобы вставить полосы перед анализатором.
  initAudio = function () {
    if (ctx) return;
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    const source = ctx.createMediaElementSource(audio);
    filters = BANDS.map((band) => {
      const f = ctx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      if (band.type === 'peaking') f.Q.value = 1.1;
      return f;
    });
    preamp = ctx.createGain();
    let node = source;
    for (const f of filters) {
      node.connect(f);
      node = f;
    }
    node.connect(preamp);
    preamp.connect(analyser);
    analyser.connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    wave = new Uint8Array(analyser.fftSize);
    apply();
  };
  const api = {
    bands: BANDS,
    presets: PRESETS,
    get: () => ({ ...state, gains: state.gains.slice() }),
    setEnabled(enabled) {
      state.enabled = !!enabled;
      save();
      apply();
      notify();
    },
    setGain(index, value) {
      state.gains[index] = clamp(value);
      state.preset =
        Object.keys(PRESETS).find((k) => PRESETS[k].gains.every((g, i) => g === state.gains[i])) ||
        'custom';
      save();
      apply();
      notify();
    },
    setPreset(id) {
      if (!PRESETS[id]) return;
      state.preset = id;
      state.gains = PRESETS[id].gains.slice();
      save();
      apply();
      notify();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Для проверок: фактические значения фильтров в звуковой цепочке.
    live: () =>
      filters.length
        ? {
            gains: filters.map((f) => +f.gain.value.toFixed(2)),
            preamp: +preamp.gain.value.toFixed(3),
          }
        : null,
  };
  window.SoundSyncEQ = api;
})();
