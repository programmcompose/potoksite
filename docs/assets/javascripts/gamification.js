/* ========================================
   Gamification — Геймификация курса «18 ПОТОК»
   Бейджи, уровни, XP, статистика (LocalStorage)
   ======================================== */

(function () {
  'use strict';

  // ========================
  // КЛЮЧИ LocalStorage
  // ========================
  var BADGES_KEY = 'potok_badges';
  var XP_KEY = 'potok_xp';
  var STATS_KEY = 'potok_stats';

  // ========================
  // КОНФИГУРАЦИЯ БЕЙДЖЕЙ
  // ========================
  var BADGE_DEFS = [
    {
      id: 'first_step',
      name: 'Первый шаг',
      desc: 'Отметить первый урок',
      icon: '👣',
      rarity: 'common',
      condition: function (stats) { return (stats.lessonsDone || 0) >= 1; }
    },
    {
      id: 'five_lessons',
      name: 'Пять уроков',
      desc: 'Пройти 5 уроков',
      icon: '🔥',
      rarity: 'common',
      condition: function (stats) { return (stats.lessonsDone || 0) >= 5; }
    },
    {
      id: 'ten_lessons',
      name: 'Десять уроков',
      desc: 'Пройти 10 уроков',
      icon: '💯',
      rarity: 'uncommon',
      condition: function (stats) { return (stats.lessonsDone || 0) >= 10; }
    },
    {
      id: 'quarter_hour',
      name: '15 минут',
      desc: 'Потратить 15 минут в курсе',
      icon: '⏱️',
      rarity: 'common',
      condition: function (stats) { return (stats.totalMinutes || 0) >= 15; }
    },
    {
      id: 'hour_warrior',
      name: 'Часовой воин',
      desc: 'Потратить 60 минут в курсе',
      icon: '⚔️',
      rarity: 'uncommon',
      condition: function (stats) { return (stats.totalMinutes || 0) >= 60; }
    },
    {
      id: 'marathon',
      name: 'Марафонец',
      desc: 'Потратить 300 минут в курсе',
      icon: '🏃',
      rarity: 'rare',
      condition: function (stats) { return (stats.totalMinutes || 0) >= 300; }
    },
    {
      id: 'five_sessions',
      name: 'Регулярность',
      desc: '5 учебных сессий',
      icon: '📅',
      rarity: 'uncommon',
      condition: function (stats) { return (stats.sessions || 0) >= 5; }
    },
    {
      id: 'ten_sessions',
      name: 'Преданность',
      desc: '10 учебных сессий',
      icon: '🏅',
      rarity: 'rare',
      condition: function (stats) { return (stats.sessions || 0) >= 10; }
    },
    {
      id: 'level5',
      name: 'Ученик',
      desc: 'Достичь 5 уровня',
      icon: '🎓',
      rarity: 'uncommon',
      condition: function (stats) { return (stats.level || 1) >= 5; }
    },
    {
      id: 'level10',
      name: 'Продвинутый',
      desc: 'Достичь 10 уровня',
      icon: '🌟',
      rarity: 'rare',
      condition: function (stats) { return (stats.level || 1) >= 10; }
    },
    {
      id: 'level20',
      name: 'Мастер',
      desc: 'Достичь 20 уровня',
      icon: '👑',
      rarity: 'epic',
      condition: function (stats) { return (stats.level || 1) >= 20; }
    },
    {
      id: 'explorer',
      name: 'Исследователь',
      desc: 'Посетить все разделы',
      icon: '🗺️',
      rarity: 'rare',
      condition: function (stats) { return (stats.sectionsVisited || 0) >= 5; }
    },
    {
      id: 'xp_1000',
      name: 'Тысячник',
      desc: 'Набрать 1000 XP',
      icon: '💎',
      rarity: 'epic',
      condition: function (stats) { return (stats.totalXP || 0) >= 1000; }
    },
    {
      id: 'xp_5000',
      name: 'Легенда',
      desc: 'Набрать 5000 XP',
      icon: '🔮',
      rarity: 'legendary',
      condition: function (stats) { return (stats.totalXP || 0) >= 5000; }
    },
    {
      id: 'night_owl',
      name: 'Сова',
      desc: 'Учиться после 23:00',
      icon: '🦉',
      rarity: 'uncommon',
      condition: function (stats) { return !!stats.nightSession; }
    },
    {
      id: 'early_bird',
      name: 'Жаворонок',
      desc: 'Учиться до 07:00',
      icon: '🐦',
      rarity: 'uncommon',
      condition: function (stats) { return !!stats.earlySession; }
    }
  ];

  // ========================
  // КОНФИГУРАЦИЯ УРОВНЕЙ
  // XP, необходимый для каждого уровня
  // ========================
  var LEVEL_XP = [];
  (function buildLevelTable() {
    var cumulative = 0;
    for (var i = 1; i <= 50; i++) {
      var xpForLevel = Math.floor(50 * Math.pow(1.15, i - 1));
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
    session_start: 3,
    badge_earn: 50,
    level_up: 100
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
  var state = {
    badges: loadJSON(BADGES_KEY, []),
    xp: loadJSON(XP_KEY, { total: 0, log: [] }),
    stats: loadJSON(STATS_KEY, defaultStats())
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
      pagesViewed: 0
    };
  }

  // ========================
  // СЕССИИ И ВРЕМЯ
  // ========================
  var sessionStart = null;
  var sessionTimer = null;
  var visitedSections = new Set();

  function startSession() {
    var now = Date.now();
    var hour = new Date().getHours();

    // Обновляем время сессии
    if (!state.stats.firstVisit) {
      state.stats.firstVisit = now;
    }
    state.stats.lastVisit = now;
    state.stats.sessions++;
    state.stats.pagesViewed++;

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

    // Начисляем XP за сессию
    addXP(XP_REWARDS.session_start, 'session_start');

    // Отслеживаем текущий раздел
    trackSection();

    // Начисляем XP за просмотр
    addXP(XP_REWARDS.page_view, 'page_view');

    saveStats();
    checkBadges();
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

    saveJSON(XP_KEY, state.xp);
    saveStats();

    // Проверяем повышение уровня
    var newLevel = getCurrentLevel();
    if (newLevel > oldLevel) {
      var levelUps = newLevel - oldLevel;
      for (var i = 0; i < levelUps; i++) {
        showLevelUpToast(oldLevel + i + 1);
      }
      addXP(XP_REWARDS.level_up, 'level_up_bonus');
    }

    checkBadges();
    return { amount: amount, newLevel: newLevel, leveledUp: newLevel > oldLevel };
  }

  // ========================
  // СИСТЕМА БЕЙДЖЕЙ
  // ========================
  function hasBadge(badgeId) {
    return state.badges.indexOf(badgeId) !== -1;
  }

  function getBadgeDef(badgeId) {
    for (var i = 0; i < BADGE_DEFS.length; i++) {
      if (BADGE_DEFS[i].id === badgeId) return BADGE_DEFS[i];
    }
    return null;
  }

  function getEarnedBadges() {
    var earned = [];
    for (var i = 0; i < BADGE_DEFS.length; i++) {
      if (state.badges.indexOf(BADGE_DEFS[i].id) !== -1) {
        earned.push(BADGE_DEFS[i]);
      }
    }
    return earned;
  }

  function getUnearnedBadges() {
    var unearned = [];
    for (var i = 0; i < BADGE_DEFS.length; i++) {
      if (state.badges.indexOf(BADGE_DEFS[i].id) === -1) {
        unearned.push(BADGE_DEFS[i]);
      }
    }
    return unearned;
  }

  function getAllBadges() {
    return BADGE_DEFS.map(function (def) {
      return {
        def: def,
        earned: state.badges.indexOf(def.id) !== -1
      };
    });
  }

  // Начислить бейдж вручную
  function earnBadge(badgeId) {
    if (hasBadge(badgeId)) return null;

    var def = getBadgeDef(badgeId);
    if (!def) return null;

    state.badges.push(badgeId);
    saveJSON(BADGES_KEY, state.badges);

    addXP(XP_REWARDS.badge_earn, 'badge_' + badgeId);
    showBadgeToast(def);

    return def;
  }

  // Автоматическая проверка условий
  function checkBadges() {
    var newBadges = [];
    for (var i = 0; i < BADGE_DEFS.length; i++) {
      var def = BADGE_DEFS[i];
      if (!hasBadge(def.id) && def.condition(state.stats)) {
        var earned = earnBadge(def.id);
        if (earned) newBadges.push(earned);
      }
    }
    return newBadges;
  }

  // ========================
  // УВЕДОМЛЕНИЯ
  // ========================
  var badgeToastEl = null;
  var badgeToastTimeout = null;

  function showBadgeToast(badgeDef) {
    hideBadgeToast();

    var toast = document.createElement('div');
    toast.className = 'potok-badge-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');

    toast.innerHTML =
      '<div class="potok-badge-toast__icon">' + badgeDef.icon + '</div>' +
      '<div class="potok-badge-toast__content">' +
        '<div class="potok-badge-toast__title">Новый бейдж!</div>' +
        '<div class="potok-badge-toast__name">' + badgeDef.name + '</div>' +
        '<div class="potok-badge-toast__desc">' + badgeDef.desc + '</div>' +
        '<div class="potok-badge-toast__xp">+' + XP_REWARDS.badge_earn + ' XP</div>' +
      '</div>' +
      '<div class="potok-badge-toast__rarity potok-badge-toast__rarity--' + badgeDef.rarity + '">' +
        rarityLabel(badgeDef.rarity) +
      '</div>';

    document.body.appendChild(toast);
    badgeToastEl = toast;

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    badgeToastTimeout = setTimeout(function () {
      hideBadgeToast();
    }, 4000);
  }

  function hideBadgeToast() {
    if (badgeToastEl) {
      badgeToastEl.classList.remove('show');
      badgeToastTimeout = setTimeout(function () {
        if (badgeToastEl && badgeToastEl.parentNode) {
          badgeToastEl.remove();
          badgeToastEl = null;
        }
      }, 400);
    }
  }

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

  function rarityLabel(rarity) {
    var labels = {
      common: 'Обычный',
      uncommon: 'Необычный',
      rare: 'Редкий',
      epic: 'Эпический',
      legendary: 'Легендарный'
    };
    return labels[rarity] || rarity;
  }

  // ========================
  // СБРОС ДАННЫХ
  // ========================
  function resetAll() {
    localStorage.removeItem(BADGES_KEY);
    localStorage.removeItem(XP_KEY);
    localStorage.removeItem(STATS_KEY);

    state.badges = [];
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
      version: '1.0',
      exportDate: new Date().toISOString(),
      badges: state.badges,
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

      if (!data.badges || !data.xp || !data.stats) {
        throw new Error('Неверный формат данных');
      }

      state.badges = data.badges;
      state.xp = data.xp;
      state.stats = data.stats;

      saveJSON(BADGES_KEY, state.badges);
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
    earnBadge: earnBadge,
    addXP: addXP,
    getStats: function () { return Object.assign({}, state.stats); },
    getBadges: getAllBadges,
    getEarnedBadges: getEarnedBadges,
    getUnearnedBadges: getUnearnedBadges,
    hasBadge: hasBadge,
    getCurrentLevel: getCurrentLevel,
    getLevelProgressPercent: getLevelProgressPercent,
    getXpInCurrentLevel: getXpInCurrentLevel,
    getXpNeededForNextLevel: getXpNeededForNextLevel,
    getXpForNextLevel: getXpForNextLevel,
    resetAll: resetAll,
    exportData: exportData,
    importData: importData,
    checkBadges: checkBadges,
    getBadgeDef: getBadgeDef,
    BADGE_DEFS: BADGE_DEFS,
    XP_REWARDS: XP_REWARDS
  };

  // Глобальный объект для доступа из других скриптов
  window.PotokGamification = GamificationAPI;

  // ========================
  // UI: ПАНЕЛЬ УРОВНЯ (в контенте)
  // ========================
  var levelPanelEl = null;

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
    var earnedCount = state.badges.length;
    var totalCount = BADGE_DEFS.length;

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
      '<div class="potok-level-panel__badges-count">' +
        '🏅 Бейджей: ' + earnedCount + ' / ' + totalCount +
      '</div>';

    article.insertBefore(panel, article.firstChild);
    levelPanelEl = panel;
  }

  function updateLevelPanel() {
    if (!levelPanelEl) return;

    var level = getCurrentLevel();
    var progress = getLevelProgressPercent();
    var currentXP = getXpInCurrentLevel();
    var neededXP = getXpForNextLevel();
    var earnedCount = state.badges.length;
    var totalCount = BADGE_DEFS.length;

    var levelNum = levelPanelEl.querySelector('.potok-level-panel__level-num');
    if (levelNum) levelNum.textContent = level;

    var xpVal = levelPanelEl.querySelector('.potok-level-panel__xp-val');
    if (xpVal) xpVal.textContent = state.xp.total;

    var fill = levelPanelEl.querySelector('.potok-level-panel__fill');
    if (fill) fill.style.width = progress + '%';

    var progressText = levelPanelEl.querySelector('.potok-level-panel__progress-text');
    if (progressText) progressText.textContent = currentXP + ' / ' + neededXP + ' XP до уровня ' + (level + 1);

    var badgesCount = levelPanelEl.querySelector('.potok-level-panel__badges-count');
    if (badgesCount) badgesCount.textContent = '🏅 Бейджей: ' + earnedCount + ' / ' + totalCount;
  }

  // ========================
  // РЕНДЕР СТРАНИЦЫ БЕЙДЖЕЙ
  // ========================
  function renderBadgesPage() {
    var container = document.getElementById('potok-badges-container');
    if (!container) return;

    var allBadges = getAllBadges();
    var html = '';

    // Фильтр-табы
    html += '<div class="potok-badges-tabs">';
    html += '<button class="potok-badges-tab active" data-filter="all">Все (' + allBadges.length + ')</button>';
    html += '<button class="potok-badges-tab" data-filter="earned">Полученные (' + state.badges.length + ')</button>';
    html += '<button class="potok-badges-tab" data-filter="unearned">Неполученные (' + (allBadges.length - state.badges.length) + ')</button>';
    html += '</div>';

    // Сетка бейджей
    html += '<div class="potok-badges-grid" id="potok-badges-grid">';
    for (var i = 0; i < allBadges.length; i++) {
      var badge = allBadges[i];
      var def = badge.def;
      var earned = badge.earned;

      html += '<div class="potok-badge-card potok-badge-card--' + def.rarity + '" ' +
        'data-earned="' + earned + '" data-rarity="' + def.rarity + '">';
      html += '<div class="potok-badge-card__icon ' + (earned ? '' : 'potok-badge-card__icon--locked') + '">' +
        (earned ? def.icon : '❓') + '</div>';
      html += '<div class="potok-badge-card__name">' + def.name + '</div>';
      html += '<div class="potok-badge-card__desc">' + def.desc + '</div>';
      html += '<div class="potok-badge-card__rarity potok-badge-card__rarity--' + def.rarity + '">' +
        rarityLabel(def.rarity) + '</div>';
      if (!earned) {
        html += '<div class="potok-badge-card__lock">🔒</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    container.innerHTML = html;

    // Обработчики табов
    var tabs = container.querySelectorAll('.potok-badges-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        var filter = tab.getAttribute('data-filter');
        var cards = container.querySelectorAll('.potok-badge-card');
        cards.forEach(function (card) {
          var earned = card.getAttribute('data-earned') === 'true';
          if (filter === 'all') {
            card.style.display = '';
          } else if (filter === 'earned') {
            card.style.display = earned ? '' : 'none';
          } else {
            card.style.display = earned ? 'none' : '';
          }
        });
      });
    });
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

        // Бейджи
        '<div class="potok-stats-card potok-stats-card--badges">' +
          '<div class="potok-stats-card__icon">🏅</div>' +
          '<div class="potok-stats-card__value">' + state.badges.length + ' / ' + BADGE_DEFS.length + '</div>' +
          '<div class="potok-stats-card__label">Бейджей</div>' +
          '<div class="potok-stats-card__sub">' + Math.round((state.badges.length / BADGE_DEFS.length) * 100) + '% собрано</div>' +
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
      'badge_': '🏅 Бейдж'
    };

    for (var key in map) {
      if (reason.indexOf(key) === 0) return map[key].replace('badge_', 'badge_' + reason.split('_').slice(2).join('_'));
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

    // Рендерим страницы бейджей и статистики
    renderBadgesPage();
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
