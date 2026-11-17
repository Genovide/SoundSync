/* Окно «Перенести плейлист»: список из Spotify, Яндекс Музыки или любого текста →
   подбор треков в своей библиотеке и SoundCloud → проверка → новый плейлист.
   Разбор и оценка совпадений — в playlist-transfer.js. */
(() => {
  const T = window.PlaylistTransfer;
  if (!T) return;
  const dialog = node('dialog', 'feedback-dialog transfer-dialog');
  dialog.innerHTML = `
    <form method="dialog">
      <div class="feedback-heading">
        <div><span class="feedback-eyebrow">ПЕРЕЕЗД</span><h2>Перенести плейлист</h2></div>
        <button type="button" class="feedback-close" data-close aria-label="Закрыть">×</button>
      </div>
      <section class="transfer-step" data-step="source">
        <p class="feedback-intro">Вставь ссылку Яндекс Музыки или список из Spotify — найдём треки в твоей музыке и в SoundCloud. Перед сохранением всё можно проверить.</p>
        <div class="transfer-howto" role="tablist" aria-label="Откуда переносишь">
          <button type="button" role="tab" data-how="yandex" aria-selected="true">Яндекс Музыка</button>
          <button type="button" role="tab" data-how="spotify" aria-selected="false">Spotify</button>
          <button type="button" role="tab" data-how="other" aria-selected="false">Другое</button>
        </div>
        <ol class="transfer-help" data-help="yandex">
          <li>В Яндекс Музыке открой «Мне нравится» или нужный плейлист.</li>
          <li>Нажми «Поделиться → Скопировать ссылку» и вставь её ниже.</li>
          <li>Загрузи коллекцию, затем проверь подобранные треки перед сохранением.</li>
        </ol>
        <ol class="transfer-help" data-help="spotify" hidden>
          <li>Открой exportify.app, войди своим аккаунтом Spotify.</li>
          <li>Нажми Export у нужного плейлиста — скачается CSV-файл.</li>
          <li>Нажми «Выбрать файл» ниже. Пароль от Spotify SoundSync не нужен.</li>
        </ol>
        <ol class="transfer-help" data-help="other" hidden>
          <li>Подойдёт любой список «Исполнитель — Название», по треку на строку.</li>
          <li>Или файл CSV (TuneMyMusic, Soundiiz) и плейлист M3U.</li>
        </ol>
        <div data-yandex-source>
          <label for="transfer-yandex-url">Ссылка на коллекцию или плейлист</label>
          <input id="transfer-yandex-url" type="url" autocomplete="off" placeholder="https://music.yandex.ru/playlists/…">
          <p class="transfer-yandex-status" role="status"></p>
        </div>
        <div data-list-source hidden>
        <label for="transfer-text">Список треков</label>
        <textarea id="transfer-text" rows="7" spellcheck="false" placeholder="Macan — Кино&#10;Daft Punk — Get Lucky&#10;…"></textarea>
        <div class="transfer-row">
          <label class="outline transfer-file">Выбрать файл<input type="file" accept=".csv,.txt,.m3u,.m3u8,text/plain,text/csv" hidden></label>
          <span class="transfer-parsed" role="status"></span>
        </div>
        </div>
        <label for="transfer-name">Название плейлиста</label>
        <input id="transfer-name" maxlength="80" placeholder="Например, «Из Яндекса»">
      </section>
      <section class="transfer-step" data-step="search" hidden>
        <p class="feedback-intro transfer-progress-text">Ищем треки…</p>
        <div class="transfer-bar"><i></i></div>
      </section>
      <section class="transfer-step" data-step="review" hidden>
        <div class="transfer-summary"></div>
        <div class="transfer-list" role="list"></div>
      </section>
      <p class="feedback-error" hidden></p>
      <div class="feedback-actions">
        <button type="button" class="outline" data-back hidden>Назад</button>
        <button type="button" class="outline" data-cancel hidden>Остановить</button>
        <button type="button" class="primary" data-search>Найти треки</button>
        <button type="button" class="primary" data-create hidden>Создать плейлист</button>
      </div>
    </form>`;
  document.body.append(dialog);
  const $d = (s) => dialog.querySelector(s),
    $$d = (s) => [...dialog.querySelectorAll(s)];
  const text = $d('#transfer-text'),
    nameInput = $d('#transfer-name'),
    parsedLabel = $d('.transfer-parsed'),
    errorBox = $d('.feedback-error');
  let parsed = { name: '', items: [] },
    results = [],
    run = 0,
    fileName = '',
    sourceKind = 'yandex',
    loadedYandexUrl = '';
  let task = 'idle',
    completed = 0,
    taskTotal = 0;
  const background = node('button', 'transfer-background');
  background.type = 'button';
  background.hidden = true;
  document.querySelector('.playlists-nav').after(background);
  function showTask() {
    background.hidden = task === 'idle';
    background.textContent =
      task === 'reading'
        ? 'Читаем коллекцию…'
        : task === 'searching'
          ? `Поиск треков: ${completed} из ${taskTotal}`
          : task === 'review'
            ? 'Перенос готов · проверить'
            : 'Коллекция загружена · открыть';
    background.title = 'Открыть перенос. Поиск продолжается, пока окно скрыто.';
  }
  const isWorking = () => task === 'reading' || task === 'searching';

  function step(name) {
    for (const s of $$d('.transfer-step')) s.hidden = s.dataset.step !== name;
    $d('[data-search]').hidden = name !== 'source';
    $d('[data-cancel]').hidden = name !== 'search';
    $d('[data-back]').hidden = name !== 'review';
    $d('[data-create]').hidden = name !== 'review';
    errorBox.hidden = true;
  }
  function fail(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
  const HINTS = {
    'spotify-links':
      'Это ссылки из приложения Spotify — в них нет названий. Выгрузи плейлист через exportify.app в CSV и выбери файл.',
    'yandex-links':
      'Это ссылки на треки без названий. Открой плейлист в браузере, выдели сам список треков и скопируй его.',
  };
  function syncSource() {
    $d('[data-yandex-source]').hidden = sourceKind !== 'yandex';
    $d('[data-list-source]').hidden = sourceKind === 'yandex';
    $d('[data-search]').textContent =
      sourceKind === 'yandex' && !loadedYandexUrl ? 'Загрузить коллекцию' : 'Найти треки';
  }
  const yandexUrl = $d('#transfer-yandex-url');
  yandexUrl.addEventListener('input', () => {
    loadedYandexUrl = '';
    parsed = { name: '', items: [] };
    $d('.transfer-yandex-status').textContent = '';
    syncSource();
  });
  async function loadYandex() {
    const url = yandexUrl.value.trim();
    if (!url) return fail('Вставь ссылку из меню «Поделиться» в Яндекс Музыке.');
    const token = ++run;
    task = 'reading';
    showTask();
    step('search');
    $d('.transfer-progress-text').textContent = 'Читаем коллекцию Яндекс Музыки…';
    $d('.transfer-bar i').style.width = '15%';
    try {
      const result = await window.lumen.yandexImportRead(url);
      if (token !== run) return;
      parsed = result;
      loadedYandexUrl = url;
      task = 'ready';
      showTask();
      if (!nameInput.value.trim()) nameInput.value = result.name;
      step('source');
      const status = $d('.transfer-yandex-status');
      status.textContent =
        `Прочитано ${result.items.length} из ${result.total} треков. Исполнители, альбомы и длительность загружены.` +
        (result.unavailable
          ? ` Яндекс не предоставил сведения о ${result.unavailable} треках — они будут пропущены.`
          : '');
      if (!result.items.length) fail('В этой коллекции нет доступных сведений о треках.');
      syncSource();
    } catch (error) {
      if (token !== run) return;
      task = 'idle';
      showTask();
      step('source');
      fail(cleanError(error));
      syncSource();
    }
  }
  function reparse() {
    if (sourceKind === 'yandex') {
      syncSource();
      return;
    }
    parsed = T.parse(text.value, fileName);
    if (parsed.hint) parsedLabel.textContent = HINTS[parsed.hint];
    else
      parsedLabel.textContent = parsed.items.length
        ? `Распознано треков: ${parsed.items.length}`
        : text.value.trim()
          ? 'Не нашли здесь треков — проверь, что скопирован сам список'
          : '';
    parsedLabel.classList.toggle(
      'warn',
      !!parsed.hint || (!parsed.items.length && !!text.value.trim())
    );
    if (parsed.name && !nameInput.value.trim()) nameInput.value = parsed.name;
  }
  text.addEventListener('input', () => {
    fileName = '';
    reparse();
  });
  $d('input[type=file]').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) return fail('Файл слишком большой: до 5 МБ.');
    fileName = file.name;
    text.value = await file.text();
    nameInput.value = '';
    reparse();
  });
  for (const tab of $$d('[data-how]'))
    tab.onclick = () => {
      run++;
      task = 'idle';
      showTask();
      sourceKind = tab.dataset.how;
      loadedYandexUrl = '';
      parsed = { name: '', items: [] };
      $d('.transfer-yandex-status').textContent = '';
      step('source');
      reparse();
      syncSource();
      for (const t of $$d('[data-how]')) t.setAttribute('aria-selected', String(t === tab));
      for (const h of $$d('[data-help]')) h.hidden = h.dataset.help !== tab.dataset.how;
    };

  // ——— Поиск ———
  // Своя медиатека: заранее раскладываем треки по словам названия, чтобы не сравнивать
  // каждый пункт списка с тысячами файлов.
  function libraryIndex() {
    const index = new Map();
    for (const t of library.tracks) {
      for (const word of new Set(T.normalize(t.title + ' ' + t.artist).split(' '))) {
        if (word.length < 2) continue;
        if (!index.has(word)) index.set(word, []);
        index.get(word).push(t);
      }
    }
    return index;
  }
  function localCandidates(index, item) {
    const found = new Set();
    for (const word of T.normalize(item.title + ' ' + item.artist).split(' '))
      for (const t of index.get(word) || []) found.add(t);
    return [...found].slice(0, 300);
  }
  const searchCache = new Map();
  async function remoteCandidates(item) {
    const q = T.query(item);
    if (!searchCache.has(q))
      searchCache.set(
        q,
        window.lumen
          .scSearch(q)
          .then((r) =>
            (Array.isArray(r) ? r : r?.tracks || []).filter((t) => !t.playbackUnavailable)
          )
          .catch(() => [])
      );
    return searchCache.get(q);
  }
  async function match(index, item) {
    const local = T.rank(item, localCandidates(index, item));
    // Есть точное совпадение в своей музыке — в SoundCloud не идём.
    if (local[0] && T.verdict(local[0]) === 'sure')
      return { item, options: local, choice: 0, verdict: 'sure', include: true };
    const remote = T.rank(item, await remoteCandidates(item));
    const options = [...local, ...remote].sort((a, b) => b.score - a.score).slice(0, 5);
    const verdict = T.verdict(options[0]);
    return { item, options, choice: 0, verdict, include: verdict === 'sure' };
  }
  async function search() {
    if (isWorking()) return;
    if (sourceKind === 'yandex' && (!loadedYandexUrl || loadedYandexUrl !== yandexUrl.value.trim()))
      return loadYandex();
    reparse();
    if (parsed.hint) return fail(HINTS[parsed.hint]);
    if (!parsed.items.length) return fail('Вставь список треков или выбери файл.');
    const token = ++run,
      items = parsed.items,
      index = libraryIndex(),
      bar = $d('.transfer-bar i'),
      label = $d('.transfer-progress-text');
    results = new Array(items.length);
    const runResults = results;
    task = 'searching';
    completed = 0;
    taskTotal = items.length;
    showTask();
    step('search');
    let done = 0,
      next = 0;
    const paint = () => {
      bar.style.width = (done / items.length) * 100 + '%';
      label.textContent = `Ищем треки: ${done} из ${items.length}`;
      completed = done;
      showTask();
    };
    paint();
    // Три поиска одновременно: быстро, но без лавины запросов к SoundCloud.
    const worker = async () => {
      while (token === run && next < items.length) {
        const at = next++;
        const result = await match(index, items[at]);
        if (token !== run) return;
        runResults[at] = result;
        done++;
        paint();
      }
    };
    try {
      await Promise.all([worker(), worker(), worker()]);
    } catch (error) {
      if (token !== run) return;
      task = 'idle';
      showTask();
      step('source');
      fail(cleanError(error));
      if (!dialog.open) toast('Подбор прерван: ' + cleanError(error));
      return;
    }
    if (token !== run) return;
    step('review');
    task = 'review';
    showTask();
    drawReview();
    if (!dialog.open)
      toast(
        'Подбор треков завершён. Открой «Перенос готов», чтобы проверить и сохранить плейлист.'
      );
  }

  // ——— Проверка ———
  const fmt = (s) =>
    Number.isFinite(s) && s > 0
      ? Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0')
      : '';
  const LABEL = { sure: 'Найдено', maybe: 'Проверь', missing: 'Не найдено' };
  const selectedTracks = () =>
    results.filter((r) => r?.include && r.options[r.choice]).map((r) => r.options[r.choice].track);
  const identity = (track) =>
    track.scId || track.soundcloudId ? 'sc:' + (track.scId || track.soundcloudId) : track.id;
  function drawSummary() {
    const count = (v) => results.filter((r) => r.verdict === v).length,
      selected = selectedTracks(),
      chosen = new Set(selected.map(identity)).size;
    $d('.transfer-summary').replaceChildren(
      node('span', 'transfer-chip sure', `✓ Найдено: ${count('sure')}`),
      node('span', 'transfer-chip maybe', `? Проверь: ${count('maybe')}`),
      node('span', 'transfer-chip missing', `✕ Не найдено: ${count('missing')}`),
      node('span', 'transfer-chip', `К сохранению: ${chosen}`),
      ...(selected.length > chosen
        ? [node('span', 'transfer-chip', `Повторов: ${selected.length - chosen}`)]
        : [])
    );
    const create = $d('[data-create]');
    create.textContent = chosen ? `Создать плейлист · ${chosen}` : 'Создать плейлист';
    create.disabled = !chosen;
  }
  let reviewLimit = 100;
  function drawReview(reset = true) {
    if (reset) reviewLimit = 100;
    // Сначала то, что требует внимания, потом найденное; в пределах групп — исходный порядок.
    const order = { maybe: 0, sure: 1, missing: 2 };
    const rows = results
      .map((r, i) => ({ r, i }))
      .sort((a, b) => order[a.r.verdict] - order[b.r.verdict] || a.i - b.i)
      .slice(0, reviewLimit)
      .map(({ r }) => row(r));
    if (results.length > reviewLimit) {
      const more = node(
        'button',
        'outline',
        `Показать ещё ${Math.min(100, results.length - reviewLimit)}`
      );
      more.type = 'button';
      more.onclick = () => {
        reviewLimit += 100;
        drawReview(false);
      };
      rows.push(more);
    }
    $d('.transfer-list').replaceChildren(...rows);
    drawSummary();
  }
  function row(r) {
    const el = node('div', 'transfer-item ' + r.verdict);
    el.setAttribute('role', 'listitem');
    const check = node('input');
    check.type = 'checkbox';
    check.checked = r.include;
    check.disabled = !r.options.length;
    check.setAttribute('aria-label', 'Добавить в плейлист');
    check.onchange = () => {
      r.include = check.checked;
      drawSummary();
    };
    const source = node('div', 'transfer-source');
    source.append(
      node('strong', '', r.item.title),
      node(
        'span',
        '',
        [r.item.artist, r.item.album, fmt(r.item.duration)].filter(Boolean).join(' · ')
      )
    );
    const target = node('div', 'transfer-target');
    const chosen = r.options[r.choice]?.track;
    if (!chosen)
      target.append(node('span', 'transfer-none', 'Нет ни в твоей музыке, ни в SoundCloud'));
    else {
      const info = node('div', 'transfer-match');
      info.append(
        art(chosen, 'track-cover'),
        (() => {
          const t = node('div');
          t.append(
            node('strong', '', chosen.title),
            node(
              'span',
              '',
              [chosen.artist, fmt(chosen.duration), chosen.remote ? 'SoundCloud' : 'Моя музыка']
                .filter(Boolean)
                .join(' · ')
            )
          );
          return t;
        })()
      );
      const listen = node('button', 'transfer-listen', '▶');
      listen.type = 'button';
      listen.title = 'Послушать';
      listen.setAttribute('aria-label', 'Послушать ' + chosen.title);
      listen.onclick = () => playList([chosen], 0);
      target.append(info, listen);
      if (r.options.length > 1) {
        const pick = node('select', 'transfer-pick');
        pick.setAttribute('aria-label', 'Другой вариант');
        r.options.forEach((o, i) => {
          const opt = node(
            'option',
            '',
            `${o.track.title} — ${o.track.artist}${o.track.remote ? '' : ' (моя музыка)'}`
          );
          opt.value = String(i);
          pick.append(opt);
        });
        pick.value = String(r.choice);
        pick.onchange = () => {
          r.choice = Number(pick.value);
          r.include = true;
          el.replaceWith(row(r));
          drawSummary();
        };
        target.append(pick);
      }
    }
    el.append(
      check,
      source,
      node('span', 'transfer-arrow', '→'),
      target,
      node('span', 'transfer-badge', LABEL[r.verdict])
    );
    return el;
  }
  async function createPlaylist() {
    // Pass complete selected records: the search cache may already have evicted them.
    const ids = selectedTracks();
    const name = nameInput.value.trim() || parsed.name || 'Перенесённый плейлист';
    const button = $d('[data-create]');
    button.disabled = true;
    try {
      const p = await window.lumen.playlistImportList(name, ids);
      results = [];
      searchCache.clear();
      $d('.transfer-list').replaceChildren();
      task = 'idle';
      showTask();
      dialog.close();
      toast(
        `Плейлист «${p.name}» создан: ${p.added} треков` +
          (p.duplicates ? ` · повторов исключено: ${p.duplicates}` : '')
      );
      window.openPlaylistById?.(p.id);
    } catch (e) {
      fail(cleanError(e));
    } finally {
      button.disabled = false;
    }
  }

  $d('[data-search]').onclick = search;
  $d('[data-create]').onclick = createPlaylist;
  $d('[data-cancel]').onclick = () => {
    run++;
    results = [];
    searchCache.clear();
    $d('.transfer-list').replaceChildren();
    task = 'idle';
    showTask();
    step('source');
  };
  $d('[data-back]').onclick = () => {
    task = sourceKind === 'yandex' && loadedYandexUrl ? 'ready' : 'idle';
    showTask();
    step('source');
  };
  $d('[data-close]').onclick = () => {
    dialog.close();
  };
  $d('[data-close]').title = 'Скрыть окно. Поиск продолжится в фоне.';
  $d('[data-close]').setAttribute('aria-label', 'Скрыть окно переноса');
  window.openPlaylistTransfer = () => {
    if (isWorking()) step('search');
    else if (task === 'review') step('review');
    else {
      step('source');
      reparse();
    }
    dialog.showModal();
    syncSource();
    if (isWorking()) $d('[data-cancel]').focus();
    else if (task === 'review') $d('[data-create]').focus();
    else (sourceKind === 'yandex' ? yandexUrl : text).focus();
  };
  background.onclick = () => window.openPlaylistTransfer();
  // Для проверок.
  window.runPlaylistTransfer = async (listText, name) => {
    window.openPlaylistTransfer();
    $d('[data-how="other"]').click();
    text.value = listText;
    nameInput.value = name || '';
    fileName = '';
    await search();
    return results.map((r) => ({
      title: r.item.title,
      verdict: r.verdict,
      picked: r.options[r.choice] && {
        title: r.options[r.choice].track.title,
        artist: r.options[r.choice].track.artist,
        remote: !!r.options[r.choice].track.remote,
        score: +r.options[r.choice].score.toFixed(2),
      },
    }));
  };
})();
