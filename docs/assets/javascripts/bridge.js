/* ========================================
   IY Quest Bridge — Интеграция квеста с навигацией
   Авто-отслеживание прогресса при просмотре страниц
   ======================================== */

(function () {
  'use strict';

  // ========================
  // Mapping: etap → quest tasks
  // ========================
  var ETAP_MAP = [
    { id: 0, etap: 'etap0', start: 1, end: 5, tasks: 5, icon: '\uD83D\uDDA5\uFE0F', color: '#4caf50' },
    { id: 1, etap: 'etap1', start: 6, end: 15, tasks: 10, icon: '\uD83E\uDD41', color: '#2196f3' },
    { id: 2, etap: 'etap2', start: 16, end: 25, tasks: 10, icon: '\uD83C\uDFDB\uFE0F', color: '#ff6b35' },
    { id: 3, etap: 'etap3', start: 26, end: 35, tasks: 10, icon: '\uD83C\uDFB9', color: '#9c27b0' },
    { id: 4, etap: 'etap4', start: 36, end: 45, tasks: 10, icon: '\uD83C\uDFBC', color: '#667eea' },
    { id: 5, etap: 'etap5', start: 46, end: 55, tasks: 10, icon: '\u26A1', color: '#ffc107' },
    { id: 6, etap: 'etap6', start: 56, end: 65, tasks: 10, icon: '\uD83C\uDFB8', color: '#4caf50' },
    { id: 7, etap: 'etap7', start: 66, end: 75, tasks: 10, icon: '\uD83C\uDFA4', color: '#00bcd4' },
    { id: 8, etap: 'etap8', start: 76, end: 85, tasks: 10, icon: '\uD83C\uDFAC', color: '#9c27b0' },
    { id: 9, etap: 'etap9', start: 86, end: 100, tasks: 15, icon: '\uD83D\uDE80', color: '#ffd700' }
  ];

  var TOTAL_TASKS = 100;
  var MILESTONE_TASKS = [5, 15, 25, 35, 45, 55, 65, 75, 85, 100];

  // ========================
  // IY Quest state loader
  // ========================
  function loadQuestState() {
    try {
      var raw = localStorage.getItem('iyquest_state');
      if (raw) {
        var parsed = JSON.parse(raw);
        return {
          completedTasks: parsed.completedTasks || 0,
          completedSet: new Set(parsed.completedSet || []),
          xp: parsed.xp || 0,
          achievements: new Set(parsed.achievements || [])
        };
      }
    } catch (e) { /* ignore */ }
    return { completedTasks: 0, completedSet: new Set(), xp: 0, achievements: new Set() };
  }

  function saveQuestState(state) {
    try {
      localStorage.setItem('iyquest_state', JSON.stringify({
        completedTasks: state.completedTasks,
        completedSet: Array.from(state.completedSet),
        xp: state.xp,
        streak: state.streak || 8,
        achievements: Array.from(state.achievements)
      }));
    } catch (e) { /* ignore */ }
  }

  // ========================
  // Detect current etap from URL
  // ========================
  function detectCurrentEtap() {
    var path = window.location.pathname;
    for (var i = 0; i < ETAP_MAP.length; i++) {
      var etap = ETAP_MAP[i];
      if (path.indexOf('/' + etap.etap + '/') === 0 || path === '/' + etap.etap + '/') {
        return etap;
      }
    }
    return null;
  }

  // ========================
  // Auto-complete next task when visiting etap page
  // ========================
  function autoCompleteTask(questState) {
    var currentEtap = detectCurrentEtap();
    if (!currentEtap) return null;

    var nextTask = questState.completedTasks + 1;
    if (nextTask > TOTAL_TASKS) return null;

    // Проверяем, что следующая задача относится к текущему этапу
    if (nextTask >= currentEtap.start && nextTask <= currentEtap.end) {
      // Авто-комплит задачи
      questState.completedTasks++;
      questState.completedSet.add(nextTask);
      questState.xp += Math.floor(15 + nextTask * 2);
      saveQuestState(questState);

      return {
        taskNum: nextTask,
        xp: Math.floor(15 + nextTask * 2),
        etap: currentEtap
      };
    }
    return null;
  }

  // ========================
  // Check if all tasks in etap are done
  // ========================
  function checkEtapComplete(questState, etap) {
    for (var t = etap.start; t <= etap.end; t++) {
      if (!questState.completedSet.has(t)) return false;
    }
    return true;
  }

  // ========================
  // Sync to course progress (potok_progress_v1)
  // ========================
  function syncToCourseProgress(questState) {
    var key = 'potok_progress_v1';
    var all;
    try {
      var raw = localStorage.getItem(key);
      all = raw ? JSON.parse(raw) : {};
    } catch (e) { all = {}; }

    if (!all['18potok']) all['18potok'] = {};

    var changed = false;
    for (var i = 0; i < ETAP_MAP.length; i++) {
      var etap = ETAP_MAP[i];
      var lessonId = etap.etap + '-done';
      var wasComplete = !!all['18potok'][lessonId];
      var isComplete = checkEtapComplete(questState, etap);

      if (isComplete && !wasComplete) {
        all['18potok'][lessonId] = true;
        changed = true;
      }
    }

    if (changed) {
      try { localStorage.setItem(key, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }

    return changed;
  }

  // ========================
  // Award XP via gamification
  // ========================
  function awardGamificationXP(taskNum, questState) {
    if (typeof window.PotokGamification === 'undefined') return;

    var gam = window.PotokGamification;

    // Начисляем XP за задачу
    var xpGain = Math.floor(15 + taskNum * 2);
    gam.addXP(xpGain, 'quest_task_' + taskNum);

    // Бонус за milestone
    if (MILESTONE_TASKS.indexOf(taskNum) !== -1) {
      var bonus = taskNum * 2;
      gam.addXP(bonus, 'quest_milestone_' + taskNum);
    }

    // Бонус за completion этапа
    var currentEtap = detectCurrentEtap();
    if (currentEtap && checkEtapComplete(questState, currentEtap)) {
      var etapBonus = currentEtap.tasks * 10;
      gam.addXP(etapBonus, 'quest_etap_complete_' + currentEtap.id);
    }
  }

  // ========================
  // Toast notification
  // ========================
  function showQuestToast(message, color) {
    var existing = document.querySelector('.potok-quest-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'potok-quest-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    if (color) {
      toast.style.setProperty('--toast-accent', color);
    }

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 400);
    }, 3500);
  }

  // ========================
  // Quest Progress Widget в сайдбаре
  // ========================
  var questWidgetEl = null;

  function createQuestWidget(questState) {
    var existing = document.querySelector('.potok-quest-widget');
    if (existing) existing.remove();

    var sidebar = document.querySelector('.md-sidebar--primary');
    if (!sidebar) return;

    var nav = sidebar.querySelector('.md-nav--primary');
    if (!nav) return;

    var widget = document.createElement('div');
    widget.className = 'potok-quest-widget';
    widget.setAttribute('role', 'complementary');
    widget.setAttribute('aria-label', 'IY Quest прогресс');

    var progress = questState.completedTasks;
    var xp = questState.xp;

    // Определяем ранг
    var ranks = [
      { name: '\uD83C\uDF31 Novice', min: 0 },
      { name: '\uD83D\uDCD6 Student', min: 100 },
      { name: '\uD83E\uDD41 Beatmaker', min: 300 },
      { name: '\uD83C\uDFE7 Producer', min: 600 },
      { name: '\u26A1 Sound Designer', min: 1000 },
      { name: '\uD83D\uDC51 Master', min: 1500 },
      { name: '\uD83C\uDFCB\uFE0F Legend', min: 2200 }
    ];
    var rank = ranks[0];
    for (var i = ranks.length - 1; i >= 0; i--) {
      if (xp >= ranks[i].min) { rank = ranks[i]; break; }
    }

    var nextRankIdx = ranks.findIndex(function (r) { return r.min > xp; });
    var currentMin = nextRankIdx > 0 ? ranks[nextRankIdx - 1].min : 0;
    var nextMin = nextRankIdx >= 0 ? ranks[nextRankIdx].min : ranks[ranks.length - 1].min;
    var rankProgress = nextMin > currentMin ? Math.min(((xp - currentMin) / (nextMin - currentMin)) * 100, 100) : 100;

    widget.innerHTML =
      '<div class="potok-quest-widget__header">' +
        '<i data-lucide="sword" class="quest-widget-icon"></i>' +
        '<span class="potok-quest-widget__title">IY Quest</span>' +
      '</div>' +
      '<div class="potok-quest-widget__stats">' +
        '<span class="potok-quest-widget__tasks">' + progress + ' / ' + TOTAL_TASKS + '</span>' +
        '<span class="potok-quest-widget__xp">' + xp + ' XP</span>' +
      '</div>' +
      '<div class="potok-quest-widget__track">' +
        '<div class="potok-quest-widget__fill" style="width:' + rankProgress + '%"></div>' +
      '</div>' +
      '<div class="potok-quest-widget__rank">' + rank.name + '</div>' +
      '<a class="potok-quest-widget__link" href="tools/iy-quest/index.html">' +
        '<i data-lucide="external-link" class="quest-widget-icon-sm"></i>' +
        ' Открыть квест' +
      '</a>';

    if (nav) {
      nav.parentNode.insertBefore(widget, nav.nextSibling);
    } else {
      sidebar.appendChild(widget);
    }

    questWidgetEl = widget;

    // Re-init lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  function updateQuestWidget(questState) {
    if (!questWidgetEl) return;

    var progress = questState.completedTasks;
    var xp = questState.xp;

    var tasksEl = questWidgetEl.querySelector('.potok-quest-widget__tasks');
    if (tasksEl) tasksEl.textContent = progress + ' / ' + TOTAL_TASKS;

    var xpEl = questWidgetEl.querySelector('.potok-quest-widget__xp');
    if (xpEl) xpEl.textContent = xp + ' XP';

    // Rank
    var ranks = [
      { name: '\uD83C\uDF31 Novice', min: 0 },
      { name: '\uD83D\uDCD6 Student', min: 100 },
      { name: '\uD83E\uDD41 Beatmaker', min: 300 },
      { name: '\uD83C\uDFE7 Producer', min: 600 },
      { name: '\u26A1 Sound Designer', min: 1000 },
      { name: '\uD83D\uDC51 Master', min: 1500 },
      { name: '\uD83C\uDFCB\uFE0F Legend', min: 2200 }
    ];
    var rank = ranks[0];
    for (var i = ranks.length - 1; i >= 0; i--) {
      if (xp >= ranks[i].min) rank = ranks[i];
    }
    var rankEl = questWidgetEl.querySelector('.potok-quest-widget__rank');
    if (rankEl) rankEl.textContent = rank.name;
  }

  // ========================
  // Show completion notification
  // ========================
  function showEtapCompleteNotification(etap, questState) {
    var bonus = etap.tasks * 10;
    var msg = '\uD83C\uDF89 ' + etap.icon + ' Этап ' + etap.id + ' пройден! +' + bonus + ' XP';
    showQuestToast(msg, etap.color);
  }

  function showTaskCompleteNotification(taskNum, xp) {
    var msg = '\u2705 Задание #' + taskNum + ' выполнено! +' + xp + ' XP';
    showQuestToast(msg, '#4caf50');
  }

  // ========================
  // Main integration logic
  // ========================
  var lastCompletedTask = -1;

  function initBridge(questState) {
    // Загружаем последний выполненный task из состояния
    lastCompletedTask = questState.completedTasks;

    // Проверяем, есть ли новая страница этапа
    var currentEtap = detectCurrentEtap();
    if (currentEtap) {
      // Авто-комплит следующей задачи
      var result = autoCompleteTask(questState);
      if (result) {
        showTaskCompleteNotification(result.taskNum, result.xp);

        // Award XP via gamification
        awardGamificationXP(result.taskNum, questState);

        // Sync to course progress
        syncToCourseProgress(questState);

        // Проверяем completion этапа
        if (checkEtapComplete(questState, currentEtap)) {
          showEtapCompleteNotification(currentEtap, questState);
          awardGamificationXP(result.taskNum, questState);
        }
      } else {
        // Если следующая задача не на этом этапе — показываем текущий этап
        var nextTask = questState.completedTasks + 1;
        if (nextTask > TOTAL_TASKS) {
          showQuestToast('\uD83D\uDC51 Курс пройден! Все 100 заданий выполнены!', '#ffd700');
        }
      }
    }

    // Создаём/обновляем виджет
    createQuestWidget(questState);
  }

  // ========================
  // SPA Navigation handler
  // ========================
  function onNavigate() {
    var questState = loadQuestState();
    initBridge(questState);
    updateQuestWidget(questState);
  }

  // MkDocs Material SPA-навигация
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(onNavigate);
  }

  // Обычная загрузка
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      var questState = loadQuestState();
      initBridge(questState);
    });
  } else {
    var questState = loadQuestState();
    initBridge(questState);
  }

  // ========================
  // Public API
  // ========================
  window.PotokQuestBridge = {
    loadState: loadQuestState,
    detectEtap: detectCurrentEtap,
    autoCompleteTask: autoCompleteTask,
    syncToCourseProgress: syncToCourseProgress,
    ETAP_MAP: ETAP_MAP
  };

})();
