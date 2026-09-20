/* ========================================
   Gamification — Геймификация курса «18 ПОТОК»
   Уровни, XP, статистика (LocalStorage).
   Ачивки (единая коллекция наград) — в personalization.js.
   ======================================== */

(function () {
  'use strict';

  // ========================
  // КЛЮЧИ LocalStorage
  // ========================
  var BADGES_KEY = 'potok_badges'; // legacy-ключ: читается personalization.js для миграции, чистится при сбросе
  var XP_KEY = 'potok_xp';
  var STATS_KEY = 'potok_stats';

  // ========================
  // КОНФИГУРАЦИЯ УРОВНЕЙ
  // XP, необходимый для каждого уровня
  // ========================
  var LEVEL_XP = [];
  (function buildLevelTable() {
    var cumulative = 0;
    for (var i = 1; i <= 50; i++) {
      var xpForLevel = Math.floor(75 * Math.pow(1.2, i - 1));
      cumulative += xpForLevel;
      LEVEL_XP[i] = cumulative;
    }
  })();

  // ========================
  // XP ЗА ДЕЙСТВИЯ
  // ========================
  var XP_REWARDS = {
    lesson_complete: 25,
    page_view: 5,
    tool_use: 10,
    session_start: 3
  };

  // ========================
  // LocalStorage (с fallback)
  // ========================
  function loadJSON(key, fallback) {
    try {
      var data = localStorage.getItem(key);
      if (!data) return fallback;
      var parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (e) {
      console.warn('[Gamification] Ошибка чтения ' + key + ':', e);
      return fallback;
    }
  }

  function saveJSON(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[Gamification] Ошибка записи ' + key + ':', e);
    }
  }

  // ========================
  // СОСТОЯНИЕ МОДУЛЯ
  // ========================
  var loadedXp = loadJSON(XP_KEY, { total: 0, log: [] });

  var state = {
    xp: loadedXp,
    stats: normalizeStats(loadJSON(STATS_KEY, defaultStats()), loadedXp.log)
  };

  function defaultStats() {
    return {
      lessonsDone: 0,
      sessions: 0,
      totalMinutes: 0,
      totalXP: 0,
      level: 1,
      sectionsVisited: 0,
      nightSession: false,
      earlySession: false,
      firstVisit: null,
      lastVisit: null,
      pagesViewed: 0,
      lastSessionXP: 0,
      lastPageXP: 0,
      activityDays: {},
      visitedPages: {}
    };
  }

  // ========================
  // ДАТЫ И АКТИВНОСТЬ ПО ДНЯМ
  // ========================
  var MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  function dateKey(d) {
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function parseDateKey(key) {
    var parts = key.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  // Записать XP за текущий день (для сирека и heatmap)
  function recordActivity(amount) {
    if (!state.stats.activityDays || typeof state.stats.activityDays !== 'object') {
      state.stats.activityDays = {};
    }
    var key = dateKey(new Date());
    state.stats.activityDays[key] = (state.stats.activityDays[key] || 0) + amount;
  }

  // Запомнить просмотренную страницу (для освоения разделов)
  function trackPage() {
    if (!state.stats.visitedPages || typeof state.stats.visitedPages !== 'object') {
      state.stats.visitedPages = {};
    }
    var path = window.location.pathname;
    if (path.length > 1 && path.charAt(path.length - 1) === '/') {
      path = path.slice(0, -1);
    }
    state.stats.visitedPages[path] = 1;
  }

  // Сирек: текущая и лучшая серия дней подряд с активностью
  function computeStreaks(activityDays) {
    var days = activityDays || {};
    var keys = Object.keys(days).sort();

    var best = 0;
    var run = 0;
    for (var i = 0; i < keys.length; i++) {
      if (i > 0) {
        var diff = Math.round((parseDateKey(keys[i]) - parseDateKey(keys[i - 1])) / 86400000);
        run = diff === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      if (run > best) best = run;
    }

    var current = 0;
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    // Если сегодня ещё нет активности — серия считается от вчерашнего дня
    if (!days[dateKey(d)]) {
      d.setDate(d.getDate() - 1);
    }
    while (days[dateKey(d)]) {
      current++;
      d.setDate(d.getDate() - 1);
    }

    return { current: current, best: Math.max(best, current) };
  }

  // Обновить недостающие поля в старых данных (бэкфилл из xp.log)
  function normalizeStats(stats, xpLog) {
    if (!stats.activityDays || typeof stats.activityDays !== 'object') {
      var days = {};
      var log = xpLog || [];
      for (var i = 0; i < log.length; i++) {
        var key = dateKey(new Date(log[i].time));
        days[key] = (days[key] || 0) + log[i].amount;
      }
      stats.activityDays = days;
    }
    if (!stats.visitedPages || typeof stats.visitedPages !== 'object') {
      stats.visitedPages = {};
    }
    return stats;
  }

  // ========================
  // СЕССИИ И ВРЕМЯ
  // ========================
  var sessionStart = null;
  var sessionTimer = null;
  var visitedSections = new Set();
  var SESSION_COOLDOWN = 30000;

  function startSession() {
    var now = Date.now();
    var hour = new Date().getHours();

    // Обновляем время сессии
    if (!state.stats.firstVisit) {
      state.stats.firstVisit = now;
    }
    state.stats.lastVisit = now;
    state.stats.pagesViewed++;

    // Cooldown для сессий — не чаще чем раз в SESSION_COOLDOWN
    var lastSession = state.stats.lastSessionXP || 0;
    var sessionAwarded = false;
    if (now - lastSession >= SESSION_COOLDOWN) {
      state.stats.sessions++;
      state.stats.lastSessionXP = now;
      sessionAwarded = true;
    }

    // Проверяем время суток
    if (hour >= 23 || hour < 0) state.stats.nightSession = true;
    if (hour >= 0 && hour < 7) state.stats.earlySession = true;

    // Запускаем таймер времени
    sessionStart = now;
    sessionTimer = setInterval(function () {
      var elapsed = Math.floor((Date.now() - sessionStart) / 60000);
      state.stats.totalMinutes = elapsed;
      saveStats();
    }, 60000);

    // Начисляем XP за сессию (только если cooldown прошёл)
    if (sessionAwarded) {
      addXP(XP_REWARDS.session_start, 'session_start');
    }

    // Отслеживаем текущий раздел и страницу
    trackSection();
    trackPage();

    // Cooldown для page_view — не чаще 10 секунд
    var lastPageXP = state.stats.lastPageXP || 0;
    if (now - lastPageXP >= 10000) {
      addXP(XP_REWARDS.page_view, 'page_view');
      state.stats.lastPageXP = now;
    }

    saveStats();
  }

  function trackSection() {
    var path = window.location.pathname;
    var sectionMatch = path.match(/\/(etap\d+|plugins|zvuk|tools|glossary|faq|roadmap)/);
    if (sectionMatch) {
      var section = sectionMatch[1];
      if (!visitedSections.has(section)) {
        visitedSections.add(section);
        state.stats.sectionsVisited = visitedSections.size;
      }
    }
  }

  function saveStats() {
    // Обновляем уровень и XP в статистике
    state.stats.level = calculateLevel(state.xp.total);
    state.stats.totalXP = state.xp.total;
    saveJSON(STATS_KEY, state.stats);
  }

  // ========================
  // СИСТЕМА УРОВНЕЙ И XP
  // ========================
  function calculateLevel(totalXP) {
    var level = 1;
    for (var i = LEVEL_XP.length - 1; i >= 1; i--) {
      if (totalXP >= LEVEL_XP[i]) {
        level = i;
        break;
      }
    }
    return level;
  }

  function getCurrentLevel() {
    return calculateLevel(state.xp.total);
  }

  function getXpForNextLevel() {
    var level = getCurrentLevel();
    if (level >= LEVEL_XP.length) return 0;
    return LEVEL_XP[level];
  }

  function getXpInCurrentLevel() {
    var level = getCurrentLevel();
    var prevXP = level > 1 ? LEVEL_XP[level - 1] : 0;
    return state.xp.total - prevXP;
  }

  function getXpNeededForNextLevel() {
    var level = getCurrentLevel();
    var prevXP = level > 1 ? LEVEL_XP[level - 1] : 0;
    var nextXP = level < LEVEL_XP.length ? LEVEL_XP[level] : state.xp.total + 1;
    return nextXP - state.xp.total;
  }

  function getLevelProgressPercent() {
    var level = getCurrentLevel();
    var prevXP = level > 1 ? LEVEL_XP[level - 1] : 0;
    var nextXP = level < LEVEL_XP.length ? LEVEL_XP[level] : prevXP + 100;
    var totalNeeded = nextXP - prevXP;
    var current = state.xp.total - prevXP;
    return totalNeeded > 0 ? Math.min(100, Math.round((current / totalNeeded) * 100)) : 100;
  }

  // Начислить XP за действие
  function addXP(amount, reason) {
    var oldLevel = getCurrentLevel();

    state.xp.total += amount;
    state.xp.log.push({
      amount: amount,
      reason: reason,
      time: Date.now()
    });

    // Ограничиваем лог
    if (state.xp.log.length > 200) {
      state.xp.log = state.xp.log.slice(-150);
    }

    recordActivity(amount);

    saveJSON(XP_KEY, state.xp);
    saveStats();

    // Проверяем повышение уровня
    var newLevel = getCurrentLevel();
    if (newLevel > oldLevel) {
      var levelUps = newLevel - oldLevel;
      for (var i = 0; i < levelUps; i++) {
        showLevelUpToast(oldLevel + i + 1);
      }
    }

    // Мост в систему персонализации: единый totalXP под Telegram ID.
    // Ачивки проверяются там же (checkAchievements внутри _award).
    try {
      document.dispatchEvent(new CustomEvent('potok:xp', { detail: { amount: amount, reason: reason } }));
    } catch (e) { /* ignore */ }

    return { amount: amount, newLevel: newLevel, leveledUp: newLevel > oldLevel };
  }

  // Персонализация начислила XP напрямую (задания/тесты/челленджи) — синхронизируем отображение
  document.addEventListener('potok:xp-awarded', function (e) {
    var d = e.detail || {};
    if (typeof d.total !== 'number') return;
    state.xp.total = d.total;
    saveStats();
    updateLevelPanel();
  });

  // ========================
  // УВЕДОМЛЕНИЯ
  // ========================
  function showLevelUpToast(level) {
    // Используем общий toast из progress.js (если есть) или создаём свой
    var toast = document.createElement('div');
    toast.className = 'potok-toast potok-levelup-toast';
    toast.textContent = '⬆️ Уровень ' + level + '!';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3000);
  }

  // Простой toast (самодостаточный, без progress.js)
  function showToast(message) {
    var old = document.querySelector('.potok-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.className = 'potok-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 2500);
  }

  // ========================
  // СБРОС ДАННЫХ
  // ========================
  function resetAll() {
    localStorage.removeItem(BADGES_KEY);
    localStorage.removeItem(XP_KEY);
    localStorage.removeItem(STATS_KEY);

    state.xp = { total: 0, log: [] };
    state.stats = defaultStats();
    visitedSections.clear();

    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }

    showToast('🔄 Геймификация сброшена');
  }

  // ========================
  // ЭКСПОРТ / ИМПОРТ
  // ========================
  function exportData() {
    var data = {
      version: '1.2',
      exportDate: new Date().toISOString(),
      xp: state.xp,
      stats: state.stats
    };
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'potok_gamification_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();

    URL.revokeObjectURL(url);
    showToast('📦 Данные экспортированы');
  }

  function importData(jsonString) {
    try {
      var data = JSON.parse(jsonString);

      if (!data.xp || !data.stats) {
        throw new Error('Неверный формат данных');
      }

      state.xp = data.xp;
      state.stats = normalizeStats(data.stats, data.xp.log);

      saveJSON(XP_KEY, state.xp);
      saveJSON(STATS_KEY, state.stats);

      showToast('📥 Данные импортированы');
      return true;
    } catch (e) {
      console.error('[Gamification] Ошибка импорта:', e);
      showToast('❌ Ошибка импорта: ' + e.message);
      return false;
    }
  }

  // ========================
  // ПУБЛИЧНЫЙ API
  // ========================
  var GamificationAPI = {
    addXP: addXP,
    getStats: function () { return Object.assign({}, state.stats); },
    getCurrentLevel: getCurrentLevel,
    getLevelProgressPercent: getLevelProgressPercent,
    getXpInCurrentLevel: getXpInCurrentLevel,
    getXpNeededForNextLevel: getXpNeededForNextLevel,
    getXpForNextLevel: getXpForNextLevel,
    resetAll: resetAll,
    exportData: exportData,
    importData: importData,
    XP_REWARDS: XP_REWARDS
  };

  // Глобальный объект для доступа из других скриптов
  window.PotokGamification = GamificationAPI;

  // ========================
  // UI: ПАНЕЛЬ УРОВНЯ (в контенте)
  // ========================
  var levelPanelEl = null;

  // Счётчик ачивок берём из системы персонализации (единая коллекция наград)
  function getAchievementCounts() {
    try {
      var pers = window.PotokPersonalization;
      if (!pers || !pers.getState) return null;
      var st = pers.getState();
      if (!st || !st.achievements || !st.achievements.unlocked) return null;
      return {
        earned: Object.keys(st.achievements.unlocked).length,
        total: (pers.ACHIEVEMENT_DEFS && pers.ACHIEVEMENT_DEFS.length) || 0
      };
    } catch (e) { return null; }
  }

  function createLevelPanel() {
    var old = document.querySelector('.potok-level-panel');
    if (old) old.remove();

    var article = document.querySelector('.md-content__inner');
    if (!article) return;

    var panel = document.createElement('div');
    panel.className = 'potok-level-panel';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'Уровень и прогресс');

    var level = getCurrentLevel();
    var progress = getLevelProgressPercent();
    var currentXP = getXpInCurrentLevel();
    var neededXP = getXpForNextLevel();
    var ach = getAchievementCounts();

    panel.innerHTML =
      '<div class="potok-level-panel__header">' +
        '<div class="potok-level-panel__level">' +
          '<span class="potok-level-panel__level-icon">⚡</span>' +
          '<span class="potok-level-panel__level-num">' + level + '</span>' +
          '<span class="potok-level-panel__level-label">Уровень</span>' +
        '</div>' +
        '<div class="potok-level-panel__xp">' +
          '<span class="potok-level-panel__xp-val">' + state.xp.total + '</span>' +
          '<span class="potok-level-panel__xp-label">XP</span>' +
        '</div>' +
      '</div>' +
      '<div class="potok-level-panel__track">' +
        '<div class="potok-level-panel__fill" style="width:' + progress + '%"></div>' +
      '</div>' +
      '<div class="potok-level-panel__progress-text">' +
        currentXP + ' / ' + neededXP + ' XP до уровня ' + (level + 1) +
      '</div>' +
      (ach
        ? '<div class="potok-level-panel__ach-count"><i data-lucide="trophy"></i>Ачивок: ' + ach.earned + ' / ' + ach.total + '</div>'
        : '');

    article.insertBefore(panel, article.firstChild);
    levelPanelEl = panel;
  }

  function updateLevelPanel() {
    if (!levelPanelEl) return;

    var level = getCurrentLevel();
    var progress = getLevelProgressPercent();
    var currentXP = getXpInCurrentLevel();
    var neededXP = getXpForNextLevel();

    var levelNum = levelPanelEl.querySelector('.potok-level-panel__level-num');
    if (levelNum) levelNum.textContent = level;

    var xpVal = levelPanelEl.querySelector('.potok-level-panel__xp-val');
    if (xpVal) xpVal.textContent = state.xp.total;

    var fill = levelPanelEl.querySelector('.potok-level-panel__fill');
    if (fill) fill.style.width = progress + '%';

    var progressText = levelPanelEl.querySelector('.potok-level-panel__progress-text');
    if (progressText) progressText.textContent = currentXP + ' / ' + neededXP + ' XP до уровня ' + (level + 1);

    var achCount = levelPanelEl.querySelector('.potok-level-panel__ach-count');
    if (achCount) {
      var ach = getAchievementCounts();
      if (ach) achCount.innerHTML = '<i data-lucide="trophy"></i>Ачивок: ' + ach.earned + ' / ' + ach.total;
    }
  }

  // ========================
  // HEATMAP АКТИВНОСТИ (6 месяцев)
  // ========================
  var HEATMAP_WEEKS = 26;

  function heatLevel(xp) {
    if (!xp || xp <= 0) return 0;
    if (xp < 15) return 1;
    if (xp < 40) return 2;
    if (xp < 80) return 3;
    return 4;
  }

  function buildHeatmapHTML() {
    var days = state.stats.activityDays || {};

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    // Начало: понедельник недели, в которую попадает (today - 181 день)
    var start = new Date(today);
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));
    var diffToMonday = (start.getDay() + 6) % 7; // 0=Пн ... 6=Вс
    start.setDate(start.getDate() - diffToMonday);

    // Колонки-недели по 7 дней
    var weeks = [];
    var cur = new Date(start);
    while (cur <= today) {
      var week = [];
      for (var i = 0; i < 7; i++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }

    var html = '<div class="potok-heatmap__grid" style="--weeks:' + weeks.length + '">';

    // Уголок (пересечение подписей)
    html += '<span class="potok-heatmap__corner"></span>';

    // Подписи месяцев — в первой строке, явная колонка
    var lastMonth = -1;
    for (var w = 0; w < weeks.length; w++) {
      var m = weeks[w][0].getMonth();
      if (m !== lastMonth) {
        html += '<span class="potok-heatmap__month" style="grid-column:' + (w + 2) + '">' + MONTHS_SHORT[m] + '</span>';
        lastMonth = m;
      }
    }

    // Подписи дней недели — в первом столбце, все 7 строк (часть пустые)
    var dowLabels = ['Пн', '', 'Ср', '', 'Пт', '', ''];
    for (var r = 0; r < 7; r++) {
      html += '<span class="potok-heatmap__dow" style="grid-row:' + (r + 2) + ';grid-column:1">' + dowLabels[r] + '</span>';
    }

    // Клетки
    for (var w2 = 0; w2 < weeks.length; w2++) {
      for (var r2 = 0; r2 < 7; r2++) {
        var date = weeks[w2][r2];
        if (date > today) continue; // будущие дни не рисуем

        var key = dateKey(date);
        var xp = days[key] || 0;
        var level = heatLevel(xp);
        var tipDate = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        var title = xp > 0 ? (xp + ' XP — ' + tipDate) : ('Нет активности — ' + tipDate);

        html += '<span class="potok-heatmap__cell potok-heatmap__cell--lvl' + level + '" ' +
          'style="grid-row:' + (r2 + 2) + ';grid-column:' + (w2 + 2) + '" title="' + title + '"></span>';
      }
    }

    html += '</div>';

    // Легенда
    html += '<div class="potok-heatmap__legend">' +
      '<span>Меньше</span>' +
      '<span class="potok-heatmap__cell potok-heatmap__cell--lvl0"></span>' +
      '<span class="potok-heatmap__cell potok-heatmap__cell--lvl1"></span>' +
      '<span class="potok-heatmap__cell potok-heatmap__cell--lvl2"></span>' +
      '<span class="potok-heatmap__cell potok-heatmap__cell--lvl3"></span>' +
      '<span class="potok-heatmap__cell potok-heatmap__cell--lvl4"></span>' +
      '<span>Больше</span>' +
    '</div>';

    return html;
  }

  // ========================
  // ОСВОЕНИЕ РАЗДЕЛОВ
  // ========================
  function getSectionTotals() {
    var totals = {};
    var links = document.querySelectorAll('.md-nav--primary a[href]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var m = href.match(/\/(etap\d+|plugins|zvuk)\//);
      if (m) totals[m[1]] = (totals[m[1]] || 0) + 1;
    }
    return totals;
  }

  function getSectionVisited() {
    var visited = {};
    var pages = state.stats.visitedPages || {};
    for (var path in pages) {
      if (!pages.hasOwnProperty(path)) continue;
      var m = path.match(/\/(etap\d+|plugins|zvuk)\//);
      if (m) visited[m[1]] = (visited[m[1]] || 0) + 1;
    }
    return visited;
  }

  function sectionLabel(key) {
    var m = key.match(/^etap(\d+)$/);
    if (m) return 'Этап №' + m[1];
    if (key === 'plugins') return 'Плагины';
    if (key === 'zvuk') return 'Основы звука';
    return key;
  }

  function buildSectionsHTML() {
    var totals = getSectionTotals();
    var visited = getSectionVisited();

    var keys = Object.keys(totals).sort(function (a, b) {
      var na = parseInt(a.match(/\d+/), 10);
      var nb = parseInt(b.match(/\d+/), 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    if (keys.length === 0) {
      return '<p class="potok-stats-empty">Разделы не найдены</p>';
    }

    var html = '';
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var total = totals[key];
      var done = Math.min(visited[key] || 0, total);
      var percent = total > 0 ? Math.round((done / total) * 100) : 0;

      html += '<div class="potok-sections-row' + (percent === 100 ? ' potok-sections-row--full' : '') + '">';
      html += '<div class="potok-sections-row__name">' + sectionLabel(key) + '</div>';
      html += '<div class="potok-sections-row__track"><div class="potok-sections-row__fill" style="width:' + percent + '%"></div></div>';
      html += '<div class="potok-sections-row__stat">' + done + ' / ' + total + ' · ' + percent + '%</div>';
      html += '</div>';
    }

    return html;
  }

  // ========================
  // РЕНДЕР СТРАНИЦЫ СТАТИСТИКИ
  // ========================
  function renderStatsPage() {
    var container = document.getElementById('potok-stats-container');
    if (!container) return;

    var s = state.stats;
    var level = getCurrentLevel();
    var progress = getLevelProgressPercent();
    var streak = computeStreaks(state.stats.activityDays);
    var ach = getAchievementCounts();

    // Форматируем даты
    var firstVisitDate = s.firstVisit ? new Date(s.firstVisit).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric'
    }) : '—';

    var lastVisitDate = s.lastVisit ? new Date(s.lastVisit).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }) : '—';

    // Время в часах и минутах
    var hours = Math.floor(s.totalMinutes / 60);
    var minutes = s.totalMinutes % 60;
    var timeStr = hours > 0 ? hours + ' ч ' + minutes + ' мин' : minutes + ' мин';

    container.innerHTML =
      '<div class="potok-stats-grid">' +
        // Уровень
        '<div class="potok-stats-card potok-stats-card--level">' +
          '<div class="potok-stats-card__icon">⚡</div>' +
          '<div class="potok-stats-card__value">' + level + '</div>' +
          '<div class="potok-stats-card__label">Уровень</div>' +
          '<div class="potok-stats-card__track">' +
            '<div class="potok-stats-card__fill" style="width:' + progress + '%"></div>' +
          '</div>' +
          '<div class="potok-stats-card__sub">' + progress + '% до уровня ' + (level + 1) + '</div>' +
        '</div>' +

        // XP
        '<div class="potok-stats-card potok-stats-card--xp">' +
          '<div class="potok-stats-card__icon">💫</div>' +
          '<div class="potok-stats-card__value">' + s.totalXP + '</div>' +
          '<div class="potok-stats-card__label">Всего XP</div>' +
          '<div class="potok-stats-card__sub">+' + XP_REWARDS.lesson_complete + ' XP за урок</div>' +
        '</div>' +

        // Ачивки (единая коллекция наград — personalization.js)
        '<div class="potok-stats-card potok-stats-card--achievements">' +
          '<div class="potok-stats-card__icon">🏆</div>' +
          '<div class="potok-stats-card__value">' + (ach ? ach.earned + ' / ' + ach.total : '—') + '</div>' +
          '<div class="potok-stats-card__label">Ачивок</div>' +
          '<div class="potok-stats-card__sub">' + (ach && ach.total ? Math.round((ach.earned / ach.total) * 100) : 0) + '% открыто</div>' +
        '</div>' +

        // Уроки
        '<div class="potok-stats-card potok-stats-card--lessons">' +
          '<div class="potok-stats-card__icon">📚</div>' +
          '<div class="potok-stats-card__value">' + s.lessonsDone + '</div>' +
          '<div class="potok-stats-card__label">Уроков пройдено</div>' +
        '</div>' +

        // Сессии
        '<div class="potok-stats-card potok-stats-card--sessions">' +
          '<div class="potok-stats-card__icon">📅</div>' +
          '<div class="potok-stats-card__value">' + s.sessions + '</div>' +
          '<div class="potok-stats-card__label">Сессий</div>' +
        '</div>' +

        // Время
        '<div class="potok-stats-card potok-stats-card--time">' +
          '<div class="potok-stats-card__icon">⏱️</div>' +
          '<div class="potok-stats-card__value">' + timeStr + '</div>' +
          '<div class="potok-stats-card__label">Время в курсе</div>' +
        '</div>' +

        // Страницы
        '<div class="potok-stats-card potok-stats-card--pages">' +
          '<div class="potok-stats-card__icon">👁️</div>' +
          '<div class="potok-stats-card__value">' + s.pagesViewed + '</div>' +
          '<div class="potok-stats-card__label">Страниц просмотрено</div>' +
        '</div>' +

        // Разделы
        '<div class="potok-stats-card potok-stats-card--sections">' +
          '<div class="potok-stats-card__icon">🗺️</div>' +
          '<div class="potok-stats-card__value">' + s.sectionsVisited + '</div>' +
          '<div class="potok-stats-card__label">Разделов посещено</div>' +
        '</div>' +

        // Сирек
        '<div class="potok-stats-card potok-stats-card--streak">' +
          '<div class="potok-stats-card__icon">🔥</div>' +
          '<div class="potok-stats-card__value">' + streak.current + '</div>' +
          '<div class="potok-stats-card__label">Дней подряд</div>' +
          '<div class="potok-stats-card__sub">Лучший сирек: ' + streak.best + '</div>' +
        '</div>' +
      '</div>' +

      // Heatmap активности
      '<div class="potok-heatmap-panel">' +
        '<h3>📅 Активность за 6 месяцев</h3>' +
        buildHeatmapHTML() +
      '</div>' +

      // Освоение разделов
      '<div class="potok-sections-panel">' +
        '<h3>🗺️ Освоение разделов</h3>' +
        buildSectionsHTML() +
      '</div>' +

      // История XP
      '<div class="potok-stats-history">' +
        '<h3>📊 Последние действия</h3>' +
        '<div class="potok-stats-history__list">' +
        renderXpLog() +
        '</div>' +
      '</div>' +

      // Информация
      '<div class="potok-stats-info">' +
        '<p>Первый визит: <strong>' + firstVisitDate + '</strong></p>' +
        '<p>Последний визит: <strong>' + lastVisitDate + '</strong></p>' +
      '</div>' +

      // Управление данными
      '<div class="potok-stats-actions">' +
        '<button class="potok-stats-btn potok-stats-btn--export" id="potok-export-btn">📦 Экспорт данных</button>' +
        '<button class="potok-stats-btn potok-stats-btn--import" id="potok-import-btn">📥 Импорт данных</button>' +
        '<button class="potok-stats-btn potok-stats-btn--reset" id="potok-reset-btn">🔄 Сбросить всё</button>' +
        '<input type="file" id="potok-import-file" accept=".json" style="display:none">' +
      '</div>';

    // Обработчики кнопок
    var exportBtn = document.getElementById('potok-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    var importBtn = document.getElementById('potok-import-btn');
    var importFile = document.getElementById('potok-import-file');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () { importFile.click(); });
      importFile.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          importData(ev.target.result);
          renderStatsPage();
        };
        reader.readAsText(file);
        importFile.value = '';
      });
    }

    var resetBtn = document.getElementById('potok-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (confirm('Сбросить все данные геймификации? Это действие нельзя отменить.')) {
          resetAll();
          renderStatsPage();
        }
      });
    }
  }

  function renderXpLog() {
    var log = state.xp.log.slice(-20).reverse();
    if (log.length === 0) return '<p class="potok-stats-empty">Действий пока нет</p>';

    var html = '';
    for (var i = 0; i < log.length; i++) {
      var entry = log[i];
      var date = new Date(entry.time).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });
      var reasonLabel = reasonLabelMap(entry.reason);
      html += '<div class="potok-stats-history__item">' +
        '<span class="potok-stats-history__xp">+' + entry.amount + ' XP</span>' +
        '<span class="potok-stats-history__reason">' + reasonLabel + '</span>' +
        '<span class="potok-stats-history__time">' + date + '</span>' +
        '</div>';
    }
    return html;
  }

  function reasonLabelMap(reason) {
    var map = {
      'lesson_complete': '✅ Урок пройден',
      'page_view': '👁️ Просмотр страницы',
      'tool_use': '🔧 Использование инструмента',
      'session_start': '🚀 Начало сессии',
      'level_up_bonus': '⬆️ Бонус за уровень',
      'badge_': '🏆 Ачивка' // legacy-записи в логе XP (бейджи → ачивки)
    };

    for (var key in map) {
      if (reason.indexOf(key) === 0) return map[key];
    }
    return reason;
  }

  // ========================
  // ИНТЕГРАЦИЯ С PROGRESS.JS
  // ========================
  function hookProgressCheckboxes() {
    // Перехватываем чекбоксы уроков для начисления XP
    var origSetLessonDone = null;

    // Слушаем изменения чекбоксов
    function observeCheckboxes() {
      var checkboxes = document.querySelectorAll('input.potok-lesson');
      checkboxes.forEach(function (cb) {
        var handler = function () {
          if (cb.checked) {
            var lessonId = cb.getAttribute('data-lesson');
            state.stats.lessonsDone++;
            addXP(XP_REWARDS.lesson_complete, 'lesson_complete');
            saveStats();
          }
        };

        // Проверяем, не добавлен ли уже обработчик
        if (!cb.getAttribute('data-gam-hooked')) {
          cb.setAttribute('data-gam-hooked', '1');
          cb.addEventListener('change', handler);
        }
      });
    }

    observeCheckboxes();
  }

  // ========================
  // ИНИЦИАЛИЗАЦИЯ
  // ========================
  function init() {
    startSession();
    hookProgressCheckboxes();

    // Рендерим страницу статистики (ачивки рендерит personalization.js)
    renderStatsPage();
  }

  // MkDocs Material SPA-навигация
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () {
      // Сбрасываем таймер сессии при навигации
      if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
      }
      init();
    });
  }

  // Обычная загрузка страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
