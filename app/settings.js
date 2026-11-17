/* Экран «Настройки»: всё, что раньше было разбросано по интерфейсу, плюс эквалайзер. */
(() => {
  'use strict';
  svgPaths.settings =
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z';
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const store = {
    get: (key, fallback) => {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
  };

  // ——— Каркас окна ———
  const dialog = el('dialog', 'settings-dialog');
  dialog.setAttribute('aria-labelledby', 'settings-title');
  const head = el('div', 'settings-head'),
    title = el('h2', '', 'Настройки'),
    close = el('button', 'settings-close');
  title.id = 'settings-title';
  close.replaceChildren(icon('close'));
  close.setAttribute('aria-label', 'Закрыть');
  close.onclick = () => dialog.close();
  head.append(icon('settings'), title, close);
  const body = el('div', 'settings-body');
  dialog.append(head, body);
  document.body.append(dialog);

  function section(name, hint) {
    const box = el('section', 'settings-section');
    const h = el('h3', '', name);
    box.append(h);
    if (hint) box.append(el('p', 'settings-hint', hint));
    body.append(box);
    return box;
  }
  function row(parent, label, control, hint) {
    const r = el('div', 'settings-row'),
      text = el('div', 'settings-row-text');
    text.append(el('span', 'settings-label', label));
    if (hint) text.append(el('span', 'settings-hint', hint));
    r.append(text, control);
    parent.append(r);
    return r;
  }
  function toggle(checked, onChange) {
    const wrap = el('label', 'settings-toggle'),
      input = el('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.onchange = () => onChange(input.checked);
    wrap.append(input, el('span', 'settings-toggle-track'));
    return { wrap, input };
  }
  function slider(min, max, step, value, onInput) {
    const input = el('input', 'settings-range');
    input.type = 'range';
    Object.assign(input, { min, max, step, value });
    // --p (0…1) — положение ползунка: по нему заливка заканчивается ровно в центре кружка.
    const paint = () => {
      const p = (input.value - min) / (max - min);
      input.style.setProperty('--fill', p * 100 + '%');
      input.style.setProperty('--p', String(p));
    };
    input.oninput = () => {
      paint();
      onInput(Number(input.value));
    };
    paint();
    input.paint = paint;
    return input;
  }
  const button = (text, onClick, cls = 'settings-button') => {
    const b = el('button', cls, text);
    b.type = 'button';
    b.onclick = onClick;
    return b;
  };

  // ——— Внешний вид ———
  const look = section('Внешний вид');
  const background = window.SoundSyncBackground;
  const backgroundSelect = el('select', 'settings-select');
  backgroundSelect.id = 'settings-app-background';
  backgroundSelect.setAttribute('aria-label', 'Фон приложения');
  for (const option of background.options)
    backgroundSelect.append(new Option(option.name, option.value));
  row(look, 'Фон приложения', backgroundSelect, 'Для всего интерфейса: меню, страницы и плеер');
  const backgroundWarning = el(
    'p',
    'settings-background-warning',
    'АНИМИРОВАННЫЙ ФОН ТРЕБУЕТ РЕСУРСОВ ВИДЕОКАРТЫ И МОЖЕТ ВЫЗЫВАТЬ ЛАГИ. На ноутбуках может увеличиться расход батареи. Если приложение тормозит, выбери «По обложке трека».'
  );
  backgroundWarning.id = 'settings-background-warning';
  backgroundSelect.setAttribute('aria-describedby', backgroundWarning.id);
  const backgroundError = el('span', 'settings-background-error');
  backgroundError.setAttribute('role', 'status');
  backgroundWarning.append(backgroundError);
  look.append(backgroundWarning);
  const gradients = toggle(!document.body.classList.contains('flat-theme'), (on) =>
    typeof setFlatTheme === 'function' ? setFlatTheme(!on) : null
  );
  row(look, 'Градиенты и подсветка', gradients.wrap, 'Цветной фон по обложке трека');
  function refreshBackground() {
    const state = background.get();
    backgroundSelect.value = state.mode;
    backgroundWarning.hidden = state.mode === 'cover';
    backgroundError.textContent = state.error;
    gradients.input.disabled = state.mode !== 'cover';
    gradients.wrap.title = state.mode !== 'cover' ? 'Цвета задаёт выбранная анимация' : '';
  }
  backgroundSelect.onchange = () => background.set(backgroundSelect.value);
  addEventListener('app-background-change', refreshBackground);
  refreshBackground();
  const splash = toggle(store.get('splash-enabled', '1') !== '0', (on) =>
    store.set('splash-enabled', on ? '1' : '0')
  );
  row(look, 'Заставка при запуске', splash.wrap, 'Логотип SoundSync перед открытием плеера');

  // ——— Звук: эквалайзер ———
  const sound = section('Звук', 'Эквалайзер меняет звук и в визуализации.');
  const EQ = window.SoundSyncEQ;
  if (EQ) {
    const eqToggle = toggle(EQ.get().enabled, (on) => EQ.setEnabled(on));
    row(sound, 'Эквалайзер', eqToggle.wrap);
    const presets = el('div', 'eq-presets');
    for (const [id, preset] of Object.entries(EQ.presets)) {
      const chip = button(preset.name, () => EQ.setPreset(id), 'eq-chip');
      chip.dataset.preset = id;
      presets.append(chip);
    }
    sound.append(presets);
    const curve = el('canvas', 'eq-curve');
    curve.width = 640;
    curve.height = 120;
    sound.append(curve);
    const bands = el('div', 'eq-bands');
    const sliders = EQ.bands.map((band, i) => {
      const col = el('div', 'eq-band'),
        value = el('span', 'eq-value'),
        input = slider(-12, 12, 1, EQ.get().gains[i], (v) => EQ.setGain(i, v));
      input.classList.add('eq-slider');
      input.setAttribute('aria-label', band.label + ' Гц');
      // Вертикальный ползунок — обычный горизонтальный, повёрнутый в своей ячейке: так кружок
      // всегда точно на дорожке (у writing-mode: vertical он съезжает).
      const slot = el('div', 'eq-slot');
      slot.append(input);
      col.append(value, slot, el('span', 'eq-freq', band.label));
      bands.append(col);
      return { input, value };
    });
    sound.append(bands);
    // Частотная характеристика: те же фильтры в автономном контексте, без звука.
    const offline = new OfflineAudioContext(1, 1, 44100);
    const probe = EQ.bands.map((band) => {
      const f = offline.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      if (band.type === 'peaking') f.Q.value = 1.1;
      return f;
    });
    const points = 160,
      freqs = new Float32Array(points).map((_, i) => 20 * Math.pow(1000, i / (points - 1))),
      mag = new Float32Array(points),
      phase = new Float32Array(points);
    function drawCurve(stateNow) {
      const g = curve.getContext('2d'),
        w = curve.width,
        h = curve.height,
        total = new Float32Array(points);
      probe.forEach((f, i) => {
        f.gain.value = stateNow.enabled ? stateNow.gains[i] : 0;
        f.getFrequencyResponse(freqs, mag, phase);
        for (let k = 0; k < points; k++) total[k] += 20 * Math.log10(mag[k]);
      });
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#ffffff14';
      g.lineWidth = 1;
      for (const db of [-12, -6, 0, 6, 12]) {
        const y = h / 2 - (db / 15) * (h / 2);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ffd629';
      const path = new Path2D();
      for (let k = 0; k < points; k++) {
        const x = (k / (points - 1)) * w,
          y = h / 2 - (Math.max(-15, Math.min(15, total[k])) / 15) * (h / 2);
        k ? path.lineTo(x, y) : path.moveTo(x, y);
      }
      const fill = new Path2D(path);
      fill.lineTo(w, h / 2);
      fill.lineTo(0, h / 2);
      fill.closePath();
      const gradient = g.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, accent + '55');
      gradient.addColorStop(0.5, accent + '10');
      gradient.addColorStop(1, accent + '55');
      g.fillStyle = gradient;
      g.fill(fill);
      g.strokeStyle = stateNow.enabled ? accent : '#8b909a';
      g.lineWidth = 2.5;
      g.stroke(path);
    }
    function paintEq(stateNow) {
      eqToggle.input.checked = stateNow.enabled;
      sliders.forEach(({ input, value }, i) => {
        input.value = stateNow.gains[i];
        input.paint();
        const db = stateNow.gains[i];
        value.textContent = (db > 0 ? '+' : '') + db;
        value.classList.toggle('boost', db > 0);
        value.classList.toggle('cut', db < 0);
      });
      for (const chip of presets.children)
        chip.classList.toggle('active', chip.dataset.preset === stateNow.preset);
      bands.classList.toggle('disabled', !stateNow.enabled);
      drawCurve(stateNow);
    }
    EQ.onChange(paintEq);
    paintEq(EQ.get());
  }

  // ——— Звук: переходы между треками ———
  const TR = window.SoundSyncTransitions;
  if (TR) {
    const fadeValue = el('span', 'settings-value');
    const paintFade = (seconds) => (fadeValue.textContent = seconds ? seconds + ' с' : 'выкл.');
    const fade = slider(0, 12, 1, TR.get().crossfade, (v) => {
      TR.setCrossfade(v);
      paintFade(v);
    });
    fade.setAttribute('aria-label', 'Кроссфейд, секунды');
    const fadeBox = el('div', 'settings-range-row');
    fadeBox.append(fade, fadeValue);
    paintFade(TR.get().crossfade);
    row(
      sound,
      'Плавный переход',
      fadeBox,
      'Конец трека затихает, следующий в это время набирает громкость'
    );
    const level = toggle(TR.get().normalize, (on) => TR.setNormalize(on));
    row(
      sound,
      'Выравнивать громкость',
      level.wrap,
      'Тихие треки чуть громче, громкие — тише, чтобы не крутить ручку'
    );
  }

  // ——— Текст песен ———
  const lyrics = section('Текст песен');
  const offsetValue = el('span', 'settings-value');
  const offset = slider(
    -2000,
    2000,
    50,
    Math.round((typeof lyricsOffset === 'number' ? lyricsOffset : 0) * 1000),
    (ms) => {
      offsetValue.textContent = (ms > 0 ? '+' : ms < 0 ? '−' : '') + Math.abs(ms) + ' мс';
    }
  );
  offset.addEventListener(
    'change',
    () => typeof setLyricsOffset === 'function' && setLyricsOffset(Number(offset.value) / 1000)
  );
  const offsetBox = el('div', 'settings-inline');
  offsetBox.append(
    offset,
    offsetValue,
    button(
      'Сбросить',
      () => typeof setLyricsOffset === 'function' && setLyricsOffset(0),
      'settings-link'
    )
  );
  row(
    lyrics,
    'Сдвиг синхронности',
    offsetBox,
    'Если текст спешит или отстаёт от голоса. Также Alt+[ и Alt+]'
  );

  // ——— Визуализация ———
  const visual = section('Визуализация');
  const sceneSelect = el('select', 'settings-select');
  const modeSelect = document.querySelector('select.visual-mode');
  for (const option of modeSelect?.options || [])
    sceneSelect.append(new Option(option.textContent, option.value));
  sceneSelect.onchange = () => {
    if (!modeSelect) return;
    modeSelect.value = sceneSelect.value;
    modeSelect.dispatchEvent(new Event('change'));
  };
  row(visual, 'Сцена полноэкранного режима', sceneSelect);
  const reaction = document.querySelector('.reaction-control input');
  const sensitivity = slider(0.5, 3, 0.1, reaction?.value || 1.4, (v) => {
    if (!reaction) return;
    reaction.value = String(v);
    reaction.dispatchEvent(new Event('input'));
  });
  row(visual, 'Чувствительность к музыке', sensitivity);

  const playback = section('Продолжение прослушивания');
  const resume = toggle(window.SoundSyncResume.enabled, (on) =>
    window.SoundSyncResume.setEnabled(on)
  );
  row(
    playback,
    'Запоминать трек и позицию',
    resume.wrap,
    'После запуска восстановятся очередь и позиция. Нажми Play, чтобы продолжить.'
  );

  const petSection = section(
    'Питомец',
    'Хранится в пользовательских данных и переживает обновления. Экспорт позволяет перенести его на другой компьютер.'
  );
  const petControls = el('div', 'settings-inline');
  const petSpeech = toggle(store.get('pet-speech-enabled', 'true') !== 'false', (enabled) => {
    store.set('pet-speech-enabled', String(enabled));
    window.dispatchEvent(new Event('pet-speech-preference'));
  });
  petSpeech.input.setAttribute('aria-label', 'Реплики питомца');
  row(petSection, 'Реплики питомца', petSpeech.wrap, 'Показывать фразы над питомцем.');
  petControls.append(
    button('Открыть питомца', () => {
      dialog.close();
      window.SoundSyncPet.open();
    }),
    button('Экспорт', () => window.SoundSyncPet.export()),
    button('Импорт', () => window.SoundSyncPet.import())
  );
  const resetWarning = el('p', 'pet-reset-warning', 'ВЕСЬ ПРОГРЕСС ПИТОМЦА БУДЕТ УДАЛЁН');
  const resetHint = el(
    'p',
    'settings-hint',
    'При перевыборе сбросятся имя, опыт, уровень, ноты, статистика и аксессуары. Ты снова начнёшь с яйца.'
  );
  const resetStatus = el('p', 'settings-hint');
  resetStatus.setAttribute('role', 'alert');
  const resetPet = button(
    'Перевыбрать питомца',
    async () => {
      resetPet.disabled = true;
      resetStatus.textContent = '';
      try {
        if (await window.SoundSyncPet.reset()) {
          dialog.close();
          await window.SoundSyncPet.open();
        }
      } catch (error) {
        resetStatus.textContent = String(error.message || error).replace(
          /^Error invoking remote method '[^']+': (?:Error: )?/,
          ''
        );
      } finally {
        resetPet.disabled = false;
      }
    },
    'settings-button pet-reset-button'
  );
  const resetBox = el('div', 'pet-reset-box');
  resetBox.append(resetWarning, resetHint, resetPet, resetStatus);
  petSection.append(petControls, resetBox);

  const storage = section(
    'Хранилище',
    'Размер приложения и его данных. Музыкальные файлы в твоих папках сюда не входят.'
  );
  const storageSummary = el('p', 'settings-hint', 'Подсчёт размера…');
  storageSummary.setAttribute('role', 'status');
  const storageRows = el('div', 'storage-rows');
  const storageButtons = el('div', 'settings-inline');
  const refreshStorage = button('Обновить', () => loadStorage(true));
  storageButtons.append(
    refreshStorage,
    button('Открыть папку данных', () => window.lumen.storageOpen())
  );
  storage.append(storageSummary, storageRows, storageButtons);
  const bytes = (n) =>
    n >= 1073741824
      ? (n / 1073741824).toFixed(2) + ' ГБ'
      : n >= 1048576
        ? (n / 1048576).toFixed(1) + ' МБ'
        : Math.round(n / 1024) + ' КБ';
  let storageBusy = false;
  function showStorage(info) {
    storageSummary.textContent = 'Всего: ' + bytes(info.total);
    storageRows.replaceChildren();
    for (const item of info.rows) {
      const controls = el('div', 'settings-inline');
      controls.append(el('span', 'storage-size', bytes(item.bytes)));
      if (item.clearable) {
        const clear = button('Очистить', async () => {
          if (storageBusy) return;
          storageBusy = true;
          clear.disabled = true;
          try {
            showStorage(await window.lumen.storageClear(item.id));
          } catch (error) {
            storageSummary.textContent = error.message.replace(
              /^Error invoking remote method '[^']+': Error: /,
              ''
            );
          } finally {
            storageBusy = false;
            clear.disabled = false;
          }
        });
        clear.disabled = !item.bytes;
        controls.append(clear);
      }
      row(
        storageRows,
        item.name,
        controls,
        item.id === 'backups'
          ? 'При очистке последняя копия останется'
          : item.id === 'playback'
            ? 'Используемые плеером файлы сохранятся'
            : undefined
      );
    }
  }
  async function loadStorage(force = false) {
    if (storageBusy) return;
    storageBusy = true;
    refreshStorage.disabled = true;
    storageSummary.textContent = 'Подсчёт размера…';
    try {
      showStorage(await window.lumen.storageInfo(force));
    } catch {
      storageSummary.textContent = 'Не удалось подсчитать размер. Попробуй обновить.';
    } finally {
      storageBusy = false;
      refreshStorage.disabled = false;
    }
  }

  // ——— Медиатека ———
  const mediaSection = section('Медиатека');
  const folderText = el('span', 'settings-path');
  const folderButtons = el('div', 'settings-inline');
  folderButtons.append(
    button('Выбрать папку', () => document.getElementById('choose-folder')?.click()),
    button('Обновить библиотеку', () => document.getElementById('rescan')?.click())
  );
  row(mediaSection, 'Папка с музыкой', folderButtons);
  mediaSection.append(folderText);

  // ——— Обновления ———
  const updates = section('Обновления');
  const version = window.lumen.appVersion?.() || '';
  const auto = toggle(store.get('updates-auto', '1') !== '0', (on) =>
    store.set('updates-auto', on ? '1' : '0')
  );
  row(updates, 'Проверять при запуске', auto.wrap, 'Установлена версия ' + version);
  const checkNow = button('Проверить сейчас', () => {
    dialog.close();
    document.querySelector('.update-button')?.click();
  });
  row(updates, 'Новые версии', checkNow, 'Обновление ставится прямо из приложения');

  // ——— Горячие клавиши ———
  const keys = section('Горячие клавиши');
  row(
    keys,
    'Шпаргалка',
    button('Открыть', () => {
      dialog.close();
      document.querySelector('.keys-open')?.click();
    }),
    'Или клавиша ?'
  );

  // ——— Открытие ———
  function refresh() {
    refreshBackground();
    resume.input.checked = window.SoundSyncResume.enabled;
    loadStorage();
    gradients.input.checked = !document.body.classList.contains('flat-theme');
    sceneSelect.value = modeSelect?.value || '';
    if (reaction) {
      sensitivity.value = reaction.value;
      sensitivity.paint();
    }
    const ms = Math.round((typeof lyricsOffset === 'number' ? lyricsOffset : 0) * 1000);
    offset.value = String(ms);
    offset.paint();
    offsetValue.textContent = (ms > 0 ? '+' : ms < 0 ? '−' : '') + Math.abs(ms) + ' мс';
    folderText.textContent =
      (typeof library !== 'undefined' && library.folder) || 'Папка ещё не выбрана';
  }
  const navButton = el('button', 'nav settings-nav');
  navButton.type = 'button';
  const navIcon = el('span', 'nav-icon');
  navIcon.append(icon('settings'));
  navButton.append(navIcon, el('span', '', 'Настройки'));
  navButton.dataset.iconified = '1';
  navButton.onclick = () => {
    refresh();
    dialog.showModal();
  };
  document.querySelector('.sidebar nav')?.append(navButton);
  window.openSettings = () => navButton.click();
})();
