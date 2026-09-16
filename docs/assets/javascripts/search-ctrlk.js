/* ============================================================
   POTOK · Командная палитра (F2)
   Ctrl/Cmd+K → оверлей: поиск по страницам (search_index.json,
   fuzzy subsequence) + статические команды (темы, этапы 0–9,
   инструменты, ключевые страницы). Недавние — localStorage.
   Чистый JS без зависимостей; иконки Lucide (если загружен).
   ============================================================ */
(function () {
  'use strict';

  // --- Базовый URL сайта (GH Pages: /potoksite/, локально: /) ---
  var ASSET_BASE = '';
  try {
    var cs = document.currentScript;
    if (cs && cs.src && cs.src.indexOf('/assets/') !== -1) {
      ASSET_BASE = cs.src.slice(0, cs.src.indexOf('/assets/'));
    }
  } catch (e) {}

  // ============================================================
  // Тема: клик по toggle Material, fallback — ручная смена схемы
  // ============================================================
  function currentScheme() {
    // Material 9.6+ держит схему на <body>, старые версии — на <html>
    return document.body.getAttribute('data-md-color-scheme') ||
      document.documentElement.getAttribute('data-md-color-scheme') || 'slate';
  }

  function setTheme(scheme) {
    // Material 9.6+: палитра = radio-инпуты в form[data-md-component="palette"].
    // Клик по нужному инпуту запускает штатный конвейер Material: схема
    // применяется к <body>, выбор сохраняется в localStorage ("__palette").
    var inputs = document.querySelectorAll('form[data-md-component="palette"] input[type=radio]');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].getAttribute('data-md-color-scheme') === scheme) {
        if (!inputs[i].checked) inputs[i].click();
        // Страховка: применяем схему напрямую, если конвейер Material не сработал
        document.body.setAttribute('data-md-color-scheme', scheme);
        return;
      }
    }
    // Fallback (старые версии Material): ручная смена на html+body + localStorage "md"
    document.documentElement.setAttribute('data-md-color-scheme', scheme);
    if (document.body) document.body.setAttribute('data-md-color-scheme', scheme);
    try {
      var raw = localStorage.getItem('md');
      var data = raw ? JSON.parse(raw) : {};
      data.system = false;
      if (!data.slate || !data.default) { data.slate = 'custom'; data.default = 'custom'; }
      localStorage.setItem('md', JSON.stringify(data));
    } catch (e) {}
  }

  function toggleTheme() { setTheme(currentScheme() === 'slate' ? 'default' : 'slate'); }

  // ============================================================
  // Команды
  // ============================================================
  var STAGE_NAMES = [
    'Подготовка к продакшну', 'Первые Биты', 'Сведение и VST Плагины',
    'Усложнённые биты', 'Теория музыки и Аккорды', 'EDM и Саунд-дизайн',
    'Живая Музыка', 'Сведение Вокала и Мастеринг', 'Саундтреки и Эмбиент',
    'Продвижение и Заработок'
  ];

  function buildCommands() {
    var cmds = [];
    // Тема (динамический label по текущей схеме)
    cmds.push({
      id: 'theme-toggle', icon: currentScheme() === 'slate' ? 'sun' : 'moon',
      group: 'Тема',
      label: currentScheme() === 'slate' ? 'Светлая тема' : 'Тёмная тема',
      keywords: 'тема тёмная светлая dark light theme',
      run: toggleTheme
    });
    // Этапы 0–9
    for (var i = 0; i < 10; i++) {
      (function (n) {
        cmds.push({
          id: 'stage-' + n, icon: 'target', group: 'Этапы',
          label: 'Этап №' + n + ': ' + STAGE_NAMES[n],
          keywords: 'этап stage etap ' + n,
          run: function () { location.href = ASSET_BASE + '/etap' + n + '/'; }
        });
      })(i);
    }
    // Инструменты
    var tools = [
      ['wavetable', 'Wavetable-синтезатор', 'waveform'],
      ['eq-trainer', 'EQ-тренажёр (слух)', 'ear'],
      ['browser-daw', 'Браузерная DAW', 'music'],
      ['quiz', 'Квиз по курсу', 'list-checks'],
      ['compressor', 'Компрессор (интерактив)', 'sliders-horizontal'],
      ['frequency-map', 'Карта частот', 'activity'],
      ['harmony-map', 'Harmony Map', 'git-branch'],
      ['waveforms', 'Волновые формы', 'audio-waveform'],
      ['eq-pink', 'Розовый шум (EQ)', 'noise'],
      ['eq-ab-test', 'A/B тест EQ', 'flip-horizontal']
    ];
    tools.forEach(function (t) {
      cmds.push({
        id: 'tool-' + t[0], icon: t[2], group: 'Инструменты',
        label: t[1], keywords: 'инструмент tool ' + t[0].replace(/-/g, ' '),
        run: (function (slug) { return function () { location.href = ASSET_BASE + '/tools/' + slug + '/'; }; })(t[0])
      });
    });
    // Ключевые страницы
    var pages = [
      ['glossary', 'Словарь терминов', 'book-open'],
      ['faq', 'FAQ — частые вопросы', 'circle-help'],
      ['badges', 'Бейджи и достижения', 'award'],
      ['stats', 'Статистика прогресса', 'bar-chart-3'],
      ['roadmap', 'Маршрут курса', 'route'],
      ['interactive-tools', 'Все интерактивные инструменты', 'layout-grid']
    ];
    pages.forEach(function (p) {
      cmds.push({
        id: 'page-' + p[0], icon: p[2], group: 'Страницы',
        label: p[1], keywords: p[0].replace(/-/g, ' '),
        run: (function (slug) { return function () { location.href = ASSET_BASE + '/' + slug + '/'; }; })(p[0])
      });
    });
    return cmds;
  }

  // ============================================================
  // Fuzzy: subsequence scoring без зависимостей
  // score > 0 — совпадение; выше — лучше. Бонусы: префикс слова,
  // непрерывность, начало строки.
  // ============================================================
  function fuzzyScore(query, text) {
    if (!query) return 1;
    query = query.toLowerCase();
    var t = text.toLowerCase();
    if (t.indexOf(query) !== -1) {
      // Прямое вхождение — максимальный приоритет
      var bonus = t === query ? 200 : (t.indexOf(query) === 0 ? 120 : 60);
      return bonus + Math.max(0, 40 - t.length * 0.5);
    }
    // Subsequence: все символы запроса по порядку
    var score = 0, ti = 0, streak = 0;
    for (var qi = 0; qi < query.length; qi++) {
      var ch = query[qi];
      if (ch === ' ') continue; // пробелы запроса не обязательны
      var found = t.indexOf(ch, ti);
      if (found === -1) return 0;
      streak = (found === ti) ? streak + 1 : 1;
      score += 2 + Math.min(streak * 2, 8); // непрерывность бонусом
      if (found === 0 || t[found - 1] === ' ' || t[found - 1] === '-' || t[found - 1] === '/') {
        score += 6; // начало слова
      }
      score -= Math.min(found - ti, 12) * 0.3; // штраф за разрыв
      ti = found + 1;
    }
    return score > query.length ? score : 0;
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    var q = query.toLowerCase(), t = text.toLowerCase();
    // Прямое вхождение — подсвечиваем его
    var idx = t.indexOf(q);
    if (idx !== -1) {
      return escapeHtml(text.slice(0, idx)) + '<mark class="pk-mark">' + escapeHtml(text.substr(idx, q.length)) + '</mark>' + escapeHtml(text.slice(idx + q.length));
    }
    // Subsequence — подсвечиваем совпавшие символы
    var out = '', ti = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = query.charAt(ti);
      if (ch !== ' ' && t[i] === ch.toLowerCase()) {
        out += '<mark class="pk-mark">' + escapeHtml(text[i]) + '</mark>';
        ti++;
        while (ti < query.length && query[ti] === ' ') ti++;
      } else {
        out += escapeHtml(text[i]);
      }
    }
    return out;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============================================================
  // Поиск по страницам (search_index.json, лениво + кэш)
  // ============================================================
  var searchIndex = null;      // {docs:[...]} | null
  var indexFailed = false;
  var indexPromise = null;

  function loadSearchIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = new Promise(function (resolve) {
      fetch(ASSET_BASE + '/search/search_index.json')
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) { searchIndex = data; resolve(true); })
        .catch(function () { indexFailed = true; resolve(false); });
    });
    return indexPromise;
  }

  function pageUrl(doc) {
    var loc = doc.location || '';
    if (!loc) return ASSET_BASE + '/';
    if (loc.indexOf('.html') === -1 && loc.charAt(loc.length - 1) !== '/') loc += '/';
    return ASSET_BASE + '/' + loc;
  }

  function searchPages(query, limit) {
    var out = [];
    if (!searchIndex || !searchIndex.docs) return out;
    for (var i = 0; i < searchIndex.docs.length; i++) {
      var d = searchIndex.docs[i];
      var title = d.title || '';
      var loc = d.location || '';
      var text = d.text || '';
      // Ранжирование: title > location > text (взрываемся на первом хорошем)
      var sTitle = fuzzyScore(query, title);
      var sLoc = sTitle ? 0 : fuzzyScore(query, loc.replace(/\//g, ' '));
      var sText = (sTitle || sLoc) ? 0 : fuzzyScore(query, text.slice(0, 400));
      var best = Math.max(sTitle * 3, sLoc * 2, sText);
      if (best > 0) out.push({ doc: d, score: best });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit || 8).map(function (x) { return x.doc; });
  }

  // ============================================================
  // Недавние (localStorage potok-palette-recent, до 5)
  // ============================================================
  var RECENT_KEY = 'potok-palette-recent';

  function loadRecent() {
    try { var v = localStorage.getItem(RECENT_KEY); return v ? JSON.parse(v) : []; } catch (e) { return []; }
  }

  function pushRecent(item) {
    var list = loadRecent().filter(function (r) { return r.key !== item.key; });
    list.unshift(item);
    if (list.length > 5) list = list.slice(0, 5);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) {}
  }

  // ============================================================
  // Палитра: DOM + состояние
  // ============================================================
  var overlay, input, listEl;
  var items = [];        // плоский список {type:'command'|'page', data, label, icon, group}
  var activeIdx = -1;
  var lastFocus = null;

  function buildDom() {
    overlay = document.createElement('div');
    overlay.className = 'pk-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="pk-panel" role="dialog" aria-modal="true" aria-label="Командная палитра">' +
        '<div class="pk-inputrow">' +
          '<i data-lucide="search" class="pk-searchicon"></i>' +
          '<input class="pk-input" type="text" placeholder="Поиск по курсу или команда…" autocomplete="off" spellcheck="false">' +
          '<kbd class="pk-esc">Esc</kbd>' +
        '</div>' +
        '<div class="pk-list" role="listbox"></div>' +
        '<div class="pk-footer">' +
          '<span><kbd>↑↓</kbd> навигация</span>' +
          '<span><kbd>Enter</kbd> открыть</span>' +
          '<span><kbd>Esc</kbd> закрыть</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    input = overlay.querySelector('.pk-input');
    listEl = overlay.querySelector('.pk-list');

    input.addEventListener('input', function () { render(); });
    input.addEventListener('keydown', onKeydown);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) closePalette(); });
  }

  // ============================================================
  // Рендер результатов
  // ============================================================
  function collectItems(query) {
    var q = query.trim();
    items = [];

    // Команды
    buildCommands().forEach(function (c) {
      var s = fuzzyScore(q, c.label + ' ' + (c.keywords || ''));
      if (!q || s > 0) items.push({ type: 'command', data: c, label: c.label, icon: c.icon, group: q ? c.group : null, score: s });
    });

    // Недавние — только при пустом запросе
    if (!q) {
      loadRecent().forEach(function (r) {
        items.push({ type: 'recent', data: r, label: r.label, icon: r.icon || 'clock', group: null, score: 0 });
      });
    }

    // Страницы
    if (searchIndex && q) {
      searchPages(q, 8).forEach(function (d) {
        items.push({ type: 'page', data: d, label: d.title || '(без названия)', icon: 'file-text', group: null, score: 0 });
      });
    } else if (!q && searchIndex) {
      // Пустой запрос: показываем несколько ключевых страниц
      var docs = searchIndex.docs || [];
      var count = 0;
      for (var j = 0; j < docs.length && count < 5; j++) {
        var d2 = docs[j];
        if (!d2.title) continue;
        items.push({ type: 'page', data: d2, label: d2.title, icon: 'file-text', group: null, score: 0 });
        count++;
      }
    }

    // Сортировка: команды (по score), затем недавние, затем страницы
    var order = { command: 0, recent: 1, page: 2 };
    items.sort(function (a, b) {
      if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
      return (b.score || 0) - (a.score || 0);
    });
    // Ограничение: без запроса — команды(топ-6)+недавние+страницы(5); с запросом — всё, что прошло fuzzy
    if (!q) {
      var cmds = items.filter(function (x) { return x.type === 'command'; }).slice(0, 6);
      var recs = items.filter(function (x) { return x.type === 'recent'; });
      var pgs = items.filter(function (x) { return x.type === 'page'; });
      items = cmds.concat(recs).concat(pgs);
    } else if (items.length > 14) {
      items = items.slice(0, 14);
    }
  }

  function render() {
    var q = input.value;
    collectItems(q);
    activeIdx = items.length ? 0 : -1;
    listEl.innerHTML = '';

    if (!items.length) {
      listEl.innerHTML = '<div class="pk-empty">Ничего не найдено</div>';
      return;
    }

    var lastGroup = null;
    items.forEach(function (it, i) {
      // Заголовок группы: «Команды» / «Недавние» / «Страницы сайта»
      var gname = it.type === 'command' ? 'Команды' : (it.type === 'recent' ? 'Недавние' : 'Страницы сайта');
      if (gname !== lastGroup) {
        lastGroup = gname;
        var gt = document.createElement('div');
        gt.className = 'pk-grouptitle';
        gt.textContent = gname;
        listEl.appendChild(gt);
      }
      var row = document.createElement('div');
      row.className = 'pk-item' + (i === activeIdx ? ' is-active' : '');
      row.setAttribute('role', 'option');
      row.innerHTML = '<span class="pk-ic"><i data-lucide="' + escapeHtml(it.icon || 'circle') + '"></i></span>' +
        '<span class="pk-label">' + highlight(it.label, q) + '</span>' +
        (it.type === 'page' ? '<span class="pk-loc">' + escapeHtml((it.data.location || '').replace(/\//g, ' › ')) + '</span>' : '');
      row.addEventListener('mousedown', function (e) { e.preventDefault(); selectItem(i); });
      row.addEventListener('mousemove', function () { if (activeIdx !== i) { activeIdx = i; updateActive(); } });
      listEl.appendChild(row);
    });

    // Lucide-иконки для динамически добавленных элементов
    try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {}
  }

  function updateActive() {
    var rows = listEl.querySelectorAll('.pk-item');
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-active', i === activeIdx);
    if (rows[activeIdx]) rows[activeIdx].scrollIntoView({ block: 'nearest' });
  }

  // ============================================================
  // Выбор и исполнение
  // ============================================================
  function findCommand(id) {
    var cmds = buildCommands();
    for (var i = 0; i < cmds.length; i++) if (cmds[i].id === id) return cmds[i];
    return null;
  }

  function selectItem(i) {
    var it = items[i];
    if (!it) return;
    if (it.type === 'command') {
      pushRecent({ key: 'cmd:' + it.data.id, label: it.label, icon: it.icon });
      closePalette();
      it.data.run();
    } else if (it.type === 'recent' && it.data.key && it.data.key.indexOf('cmd:') === 0) {
      // Недавняя команда — исполняем заново
      var cmd = findCommand(it.data.key.slice(4));
      closePalette();
      if (cmd) cmd.run();
    } else if (it.type === 'page' || it.type === 'recent') {
      var url = it.type === 'page' ? pageUrl(it.data) : it.data.url;
      pushRecent({ key: 'url:' + url, label: it.label, icon: it.icon || 'file-text', url: url });
      location.href = url;
    }
  }

  // ============================================================
  // Клавиатура
  // ============================================================
  function onKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (activeIdx < items.length - 1) { activeIdx++; updateActive(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (activeIdx > 0) { activeIdx--; updateActive(); } }
    else if (e.key === 'Enter') { e.preventDefault(); selectItem(activeIdx); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    else if (e.key === 'Tab') { e.preventDefault(); } // focus-trap: фокус остаётся в инпуте
  }

  function openPalette() {
    if (!overlay) buildDom();
    lastFocus = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('is-open'); });
    input.value = '';
    render();
    input.focus();
    // Ленивая загрузка индекса при первом открытии
    loadSearchIndex().then(function (ok) { if (!overlay.hidden && ok) render(); });
  }

  function closePalette() {
    if (overlay && !overlay.hidden) {
      overlay.classList.remove('is-open');
      var fast = false;
      try { fast = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      if (fast) overlay.hidden = true;
      else setTimeout(function () { if (!overlay.classList.contains('is-open')) overlay.hidden = true; }, 160);
    }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  // ============================================================
  // Boot: Ctrl/Cmd+K (заменяет старый хендлер фокуса Material-поиска)
  // ============================================================
  // Видимая подсказка «Ctrl K» рядом с поиском в шапке
  function addHintChip() {
    var searchLabel = document.querySelector('label[for="__search"].md-header__button');
    if (!searchLabel || document.querySelector('.pk-hint')) return;
    var hint = document.createElement('span');
    hint.className = 'pk-hint';
    hint.innerHTML = '<kbd>Ctrl</kbd><kbd>K</kbd>';
    searchLabel.insertAdjacentElement('afterend', hint);
  }

  function boot() {
    addHintChip();
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
        e.preventDefault();
        if (overlay && !overlay.hidden) closePalette();
        else openPalette();
      } else if (e.key === 'Escape' && overlay && !overlay.hidden) {
        // Глобальный Esc: работает даже если фокус не в инпуте
        e.preventDefault();
        closePalette();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
