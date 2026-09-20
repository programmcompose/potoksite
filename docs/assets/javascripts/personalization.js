/* ========================================
   Personalization — Система персонализации курса «18 ПОТОК»
   Профиль, прогресс, навыки (радар), ачивки, челленджи, рекомендации.
   Данные хранятся под Telegram ID: CloudStorage (Mini App) + localStorage (зеркало).
   Спецификация: telegram-personalization/01..10
   ======================================== */

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

  // ========================
  // КОНФИГУРАЦИЯ
  // ========================

  var KEYS = {
    profile: 'profile_v1',
    progress: 'progress_v1',
    skills: 'skills_v1',
    achievements: 'achievements_v1',
    challenges: 'challenges_v1',
    portfolio: 'portfolio_v1',
    activity: 'activity_v1'
  };

  var CLOUD_VALUE_LIMIT = 4096;   // лимит Telegram CloudStorage на значение
  var ACTIVITY_MAX = 45;          // сколько событий держим в логе
  var PORTFOLIO_MAX = 40;         // сколько треков держим
  var SKILL_HISTORY_MAX = 10;     // история изменений навыков
  var CHALLENGES_COMPLETED_MAX = 20;
  var SAVE_DEBOUNCE_MS = 800;

  // Ранги по totalXP
  var RANKS = [
    { name: 'Новичок', min: 0 },
    { name: 'Битмейкер', min: 300 },
    { name: 'Продюсер', min: 1000 },
    { name: 'Мастер', min: 2500 },
    { name: 'Легенда потока', min: 5000 }
  ];

  // XP за действия системы персонализации
  var XP_REWARDS = {
    quest_task: 15,
    test_pass_80: 40,
    test_pass_50: 20,
    test_fail: 5,
    stage_complete: 50,
    homework_accepted: 30,
    tool_use: 3,
    challenge_base: 30
  };

  // Навыки, которые качает каждый этап (основной + вторичный)
  var STAGE_SKILLS = {
    etap0: [{ skill: 'production', delta: 2 }],
    etap1: [{ skill: 'beatmaking', delta: 4 }, { skill: 'production', delta: 2 }],
    etap2: [{ skill: 'mixing', delta: 5 }, { skill: 'soundDesign', delta: 2 }],
    etap3: [{ skill: 'arrangement', delta: 4 }, { skill: 'soundDesign', delta: 3 }],
    etap4: [{ skill: 'theory', delta: 6 }, { skill: 'arrangement', delta: 2 }],
    etap5: [{ skill: 'soundDesign', delta: 5 }, { skill: 'mixing', delta: 2 }],
    etap6: [{ skill: 'liveInstruments', delta: 5 }, { skill: 'production', delta: 2 }],
    etap7: [{ skill: 'vocals', delta: 5 }, { skill: 'mixing', delta: 3 }],
    etap8: [{ skill: 'arrangement', delta: 4 }, { skill: 'production', delta: 3 }],
    etap9: [{ skill: 'promotion', delta: 6 }]
  };

  var SKILL_LABELS = {
    beatmaking: 'Битмейкинг',
    mixing: 'Сведение',
    soundDesign: 'Саунд-дизайн',
    theory: 'Теория музыки',
    arrangement: 'Аранжировка',
    vocals: 'Вокал',
    liveInstruments: 'Живые инструменты',
    production: 'Продакшн',
    promotion: 'Продвижение'
  };

  var STAGE_LABELS = {
    etap0: 'Этап №0', etap1: 'Этап №1', etap2: 'Этап №2', etap3: 'Этап №3',
    etap4: 'Этап №4', etap5: 'Этап №5', etap6: 'Этап №6', etap7: 'Этап №7',
    etap8: 'Этап №8', etap9: 'Этап №9'
  };

  // Задания IY Quest → этапы (1-5: etap0, далее по 10 на этап)
  function taskToStage(taskId) {
    if (taskId <= 5) return 'etap0';
    var n = Math.min(9, Math.floor((taskId - 6) / 10) + 1);
    return 'etap' + n;
  }

  // ========================
  // УТИЛИТЫ
  // ========================

  function nowISO() { return new Date().toISOString(); }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function shiftDateKey(key, days) {
    var p = key.split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    d.setDate(d.getDate() + days);
    return dateKey(d);
  }

  function weekKey(d) {
    d = d || new Date();
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    return t.getUTCFullYear() + '-W' + pad2(week);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function daysBetween(isoA, isoB) {
    return Math.round((new Date(isoB).getTime() - new Date(isoA).getTime()) / 86400000);
  }

  // ========================
  // ИДЕНТИФИКАЦИЯ (Telegram ID)
  // ========================

  var identity = null;

  function getIdentity() {
    if (identity) return identity;
    var tgUser = null;
    try {
      tgUser = window.Telegram && window.Telegram.WebApp &&
        window.Telegram.WebApp.initDataUnsafe &&
        window.Telegram.WebApp.initDataUnsafe.user;
    } catch (e) { /* не в Telegram */ }

    if (tgUser && tgUser.id) {
      identity = { id: String(tgUser.id), isGuest: false, user: tgUser };
    } else {
      var guestId = null;
      try { guestId = localStorage.getItem('potok_guest_id'); } catch (e) {}
      if (!guestId) {
        guestId = 'g' + Date.now().toString(36);
        try { localStorage.setItem('potok_guest_id', guestId); } catch (e) {}
      }
      identity = { id: guestId, isGuest: true, user: null };
    }
    return identity;
  }

  function cloudAvailable() {
    try {
      var cs = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage;
      return !!(cs && typeof cs.setItem === 'function' && typeof cs.getItem === 'function');
    } catch (e) { return false; }
  }

  // Официальный API CloudStorage — callback-based, оборачиваем в промисы
  function cloudGet(key) {
    return new Promise(function (resolve) {
      try {
        window.Telegram.WebApp.CloudStorage.getItem(key, function (error, value) {
          resolve(error ? null : value);
        });
      } catch (e) { resolve(null); }
    });
  }

  function cloudSet(key, value) {
    return new Promise(function (resolve) {
      try {
        window.Telegram.WebApp.CloudStorage.setItem(key, value, function (error) {
          resolve(!error);
        });
      } catch (e) { resolve(false); }
    });
  }

  // ========================
  // МОДЕЛИ И ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ
  // ========================

  function defaultProfile() {
    var u = getIdentity().user || {};
    return {
      schemaVersion: 1,
      telegramId: getIdentity().isGuest ? null : parseInt(getIdentity().id, 10),
      username: u.username || null,
      firstName: u.first_name || 'Ученик',
      lastName: u.last_name || null,
      photoUrl: u.photo_url || null,
      createdAt: nowISO(),
      lastActiveAt: nowISO(),
      updatedAt: nowISO(),
      currentRank: RANKS[0].name,
      totalXP: 0,
      currentStreak: 0,
      maxStreak: 0,
      lastStreakDate: null,
      streakFreezeWeek: null,
      summary: {
        completedStages: 0,
        completedTasks: 0,
        totalTasks: 100,
        testsPassed: 0,
        averageTestScore: 0,
        homeworkSubmitted: 0,
        homeworkAccepted: 0
      },
      settings: {
        notificationsEnabled: true,
        preferredDAW: null,
        theme: 'auto',
        language: 'ru'
      }
    };
  }

  function defaultProgress() {
    return {
      schemaVersion: 1,
      updatedAt: nowISO(),
      stages: {},
      quest: { completedTaskIds: [], taskResults: {} },
      tests: {},
      toolsUsage: {}
    };
  }

  function defaultSkills() {
    return {
      schemaVersion: 1,
      updatedAt: nowISO(),
      levels: {
        beatmaking: 0, mixing: 0, soundDesign: 0, theory: 0, arrangement: 0,
        vocals: 0, liveInstruments: 0, production: 0, promotion: 0
      },
      history: []
    };
  }

  function defaultAchievements() {
    return { schemaVersion: 1, unlocked: {}, progress: {} };
  }

  function defaultChallenges() {
    return { schemaVersion: 1, active: [], completed: [] };
  }

  function defaultPortfolio() {
    return { schemaVersion: 1, tracks: [] };
  }

  function defaultActivity() {
    return { schemaVersion: 1, events: [] };
  }

  // Миграции: при несовпадении schemaVersion — аккуратно сливаем с дефолтами
  function migrate(name, data) {
    var def = (function () {
      switch (name) {
        case 'profile': return defaultProfile();
        case 'progress': return defaultProgress();
        case 'skills': return defaultSkills();
        case 'achievements': return defaultAchievements();
        case 'challenges': return defaultChallenges();
        case 'portfolio': return defaultPortfolio();
        case 'activity': return defaultActivity();
      }
      return {};
    })();

    if (!data || typeof data !== 'object') return def;
    if (data.schemaVersion === 1) return data;

    // Старая/чужая версия — берём известные поля поверх дефолтов
    var out = JSON.parse(JSON.stringify(def));
    for (var k in data) {
      if (!data.hasOwnProperty(k)) continue;
      if (k === 'schemaVersion') continue;
      if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) &&
          data[k] && typeof data[k] === 'object' && !Array.isArray(data[k])) {
        for (var k2 in data[k]) {
          if (data[k].hasOwnProperty(k2)) out[k][k2] = data[k][k2];
        }
      } else {
        out[k] = data[k];
      }
    }
    out.schemaVersion = 1;
    return out;
  }

  // ========================
  // СОСТОЯНИЕ
  // ========================

  var S = {
    profile: null, progress: null, skills: null,
    achievements: null, challenges: null, portfolio: null, activity: null
  };

  // Были ли локальные данные до loadAll (для синка с CloudStorage на новом устройстве)
  var hadLocal = {};

  function touch(name) { S[name].updatedAt = nowISO(); }

  // ========================
  // ХРАНИЛИЩЕ (CloudStorage + localStorage)
  // ========================

  var lsPrefix = 'tg_' + getIdentity().id + '_';

  function lsRead(key) {
    try {
      var raw = localStorage.getItem(lsPrefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function lsWrite(key, value) {
    try { localStorage.setItem(lsPrefix + key, JSON.stringify(value)); }
    catch (e) { console.warn('[Personalization] Не удалось записать в localStorage:', key, e); }
  }

  var cloudQueue = Promise.resolve();
  var dirtyKeys = {};
  var cloudReady = false;   // CloudStorage сверен с локальным — можно писать

  function markDirty(key) {
    lsWrite(KEYS[key], S[key]);
    if (!cloudAvailable()) return;
    dirtyKeys[key] = true;
    // До завершения сверки не пишем в облако: иначе дефолтные данные
    // с нового устройства могут затереть реальные (гонка при первом входе)
    if (cloudReady) scheduleCloudFlush();
  }

  var flushTimer = null;
  function scheduleCloudFlush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flushToCloud, SAVE_DEBOUNCE_MS);
  }

  // Обрезка данных под лимит CloudStorage (4096 символов)
  function fitForCloud(name, obj) {
    var json = JSON.stringify(obj);
    if (json.length <= CLOUD_VALUE_LIMIT) return json;

    var trimmed = JSON.parse(JSON.stringify(obj));
    if (name === 'activity' && trimmed.events && trimmed.events.length > 20) {
      trimmed.events = trimmed.events.slice(-20);
      json = JSON.stringify(trimmed);
      if (json.length <= CLOUD_VALUE_LIMIT) return json;
    }
    if (name === 'portfolio' && trimmed.tracks && trimmed.tracks.length > 15) {
      trimmed.tracks = trimmed.tracks.slice(0, 15);
      json = JSON.stringify(trimmed);
      if (json.length <= CLOUD_VALUE_LIMIT) return json;
    }
    if (name === 'progress') {
      var ids = trimmed.quest && trimmed.quest.completedTaskIds;
      if (ids && ids.length > 60) trimmed.quest.taskResults = {};
      if (trimmed.tests) {
        for (var t in trimmed.tests) {
          if (trimmed.tests.hasOwnProperty(t)) trimmed.tests[t].answersHistory = undefined;
        }
      }
      json = JSON.stringify(trimmed);
      if (json.length <= CLOUD_VALUE_LIMIT) return json;
    }
    console.warn('[Personalization] Ключ ' + KEYS[name] + ' превышает лимит CloudStorage, синхронизация пропущена');
    return null;
  }

  function flushToCloud() {
    if (!cloudAvailable()) return;
    var keys = Object.keys(dirtyKeys);
    dirtyKeys = {};
    if (!keys.length) return;

    cloudQueue = cloudQueue.then(function () {
      return Promise.all(keys.map(function (name) {
        var json = fitForCloud(name, S[name]);
        if (json == null) return null;
        return cloudSet(KEYS[name], json).then(function (ok) {
          if (!ok) console.warn('[Personalization] Ошибка записи в CloudStorage:', KEYS[name]);
        });
      }));
    }).catch(function (e) {
      console.warn('[Personalization] Ошибка синхронизации с CloudStorage:', e);
    });
  }

  // Фоновая сверка с CloudStorage: берём свежее по updatedAt.
  // Если локальных данных не было вовсе (новое устройство) — облачные wins без сравнения дат.
  function reconcileWithCloud() {
    if (!cloudAvailable()) { cloudReady = true; return Promise.resolve(); }

    var jobs = Object.keys(KEYS).map(function (name) {
      return cloudGet(KEYS[name]).then(function (raw) {
        if (!raw || !S[name]) return;
        var cloudData = null;
        try { cloudData = JSON.parse(raw); } catch (e) { return; }
        if (!cloudData) return;

        if (!hadLocal[name]) {
          S[name] = migrate(name, cloudData);
          if (name === 'profile') S.profile.lastActiveAt = nowISO();
          lsWrite(KEYS[name], S[name]);
          refreshUI();
          return;
        }

        var ct = new Date(cloudData.updatedAt || 0).getTime();
        var lt = new Date(S[name].updatedAt || 0).getTime();
        if (ct > lt + 1000) {
          S[name] = migrate(name, cloudData);
          lsWrite(KEYS[name], S[name]);
          refreshUI();
        }
      }).catch(function () {});
    });

    return Promise.all(jobs).then(function () {
      cloudReady = true;
      flushToCloud(); // сбрасываем накопленные изменения после сверки
    });
  }

  function loadAll() {
    var rawProfile = lsRead(KEYS.profile);
    var rawProgress = lsRead(KEYS.progress);
    var rawSkills = lsRead(KEYS.skills);
    var rawAchievements = lsRead(KEYS.achievements);
    var rawChallenges = lsRead(KEYS.challenges);
    var rawPortfolio = lsRead(KEYS.portfolio);
    var rawActivity = lsRead(KEYS.activity);

    hadLocal = {
      profile: !!rawProfile, progress: !!rawProgress, skills: !!rawSkills,
      achievements: !!rawAchievements, challenges: !!rawChallenges,
      portfolio: !!rawPortfolio, activity: !!rawActivity
    };

    S.profile = migrate('profile', rawProfile);
    S.progress = migrate('progress', rawProgress);
    S.skills = migrate('skills', rawSkills);
    S.achievements = migrate('achievements', rawAchievements);
    S.challenges = migrate('challenges', rawChallenges);
    S.portfolio = migrate('portfolio', rawPortfolio);
    S.activity = migrate('activity', rawActivity);

    // Профиль из Telegram (имя, фото) — обновляем при каждом входе
    var u = getIdentity().user;
    if (u && u.id) {
      S.profile.telegramId = u.id;
      if (u.username) S.profile.username = u.username;
      if (u.first_name) S.profile.firstName = u.first_name;
      S.profile.lastName = u.last_name || null;
      if (u.photo_url) S.profile.photoUrl = u.photo_url;
    }

    // Первичная запись всех ключей в localStorage
    Object.keys(KEYS).forEach(function (name) { lsWrite(KEYS[name], S[name]); });
  }

  function saveAll() {
    Object.keys(KEYS).forEach(function (name) { markDirty(name); });
  }

  // Одноразовый импорт XP из legacy-геймификации, чтобы totalXP был единым
  function importLegacyXp() {
    try {
      var raw = localStorage.getItem('potok_xp');
      if (!raw) return;
      var data = JSON.parse(raw);
      var legacyTotal = (data && data.total) || 0;
      if (legacyTotal > S.profile.totalXP) {
        S.profile.totalXP = legacyTotal;
        recalculateRank();
      }
    } catch (e) { /* ignore */ }
  }

  // Перенос legacy-бейджей в ачивки: единая коллекция, дубли уходят в существующие ачивки
  var LEGACY_BADGE_MAP = {
    first_step: 'first_step', five_lessons: 'five_lessons', ten_lessons: 'ten_lessons',
    quarter_hour: 'quarter_hour', hour_warrior: 'hour_warrior', marathon: 'marathon',
    five_sessions: 'five_sessions', ten_sessions: 'ten_sessions',
    level5: 'level5', level10: 'level10', level20: 'level20', explorer: 'explorer',
    xp_1000: 'xp_1000', xp_5000: 'xp_5000', night_owl: 'night_owl', early_bird: 'early_bird',
    streak3: 'streak_3', streak7: 'streak_7', streak30: 'streak_30'
  };

  function migrateLegacyBadges() {
    try {
      var raw = localStorage.getItem('potok_badges');
      if (!raw) return;
      var ids = JSON.parse(raw);
      if (!ids || !ids.length) return;
      for (var i = 0; i < ids.length; i++) {
        var target = LEGACY_BADGE_MAP[ids[i]];
        if (target && !isUnlocked(target)) unlockAchievement(target, true);
      }
    } catch (e) { /* ignore */ }
  }

  // ========================
  // СТРИК
  // ========================

  function updateStreak() {
    var p = S.profile;
    var today = dateKey();
    if (p.lastStreakDate === today) return false;

    var yesterday = shiftDateKey(today, -1);
    var usedFreeze = false;

    if (p.lastStreakDate === yesterday) {
      p.currentStreak += 1;
    } else {
      // Заморозка стрика — раз в неделю
      if (p.lastStreakDate && p.streakFreezeWeek !== weekKey()) {
        p.streakFreezeWeek = weekKey();
        usedFreeze = true;
      } else {
        p.currentStreak = 1;
      }
    }

    if (!usedFreeze && p.lastStreakDate === null) p.currentStreak = 1;
    p.maxStreak = Math.max(p.maxStreak, p.currentStreak);
    p.lastStreakDate = today;
    touch('profile');
    return true;
  }

  // ========================
  // РАНГИ
  // ========================

  function rankFor(xp) {
    var r = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (xp >= RANKS[i].min) r = RANKS[i];
    }
    return r;
  }

  function nextRank() {
    var xp = S.profile.totalXP;
    for (var i = 0; i < RANKS.length; i++) {
      if (xp < RANKS[i].min) return RANKS[i];
    }
    return null;
  }

  function recalculateRank() {
    S.profile.currentRank = rankFor(S.profile.totalXP).name;
  }

  // ========================
  // АКТИВНОСТЬ (лог событий)
  // ========================

  function logEvent(type, payload) {
    var ev = { id: uid(), type: type, timestamp: nowISO() };
    if (payload && Object.keys(payload).length) ev.payload = payload;
    S.activity.events.push(ev);
    while (S.activity.events.length > ACTIVITY_MAX) S.activity.events.shift();
    touch('activity');

    // Счётчики «сова» / «жаворонок» для ачивок
    var hour = new Date().getHours();
    if (hour >= 0 && hour < 6) {
      S.achievements.progress.night_owl = (S.achievements.progress.night_owl || 0) + 1;
    }
    if (hour >= 5 && hour < 10) {
      S.achievements.progress.early_bird = (S.achievements.progress.early_bird || 0) + 1;
    }
    return ev;
  }

  // ========================
  // НАВЫКИ
  // ========================

  function updateSkill(skill, delta, reason) {
    if (!S.skills.levels.hasOwnProperty(skill)) return;
    var old = S.skills.levels[skill];
    var next = clamp(old + delta, 0, 100);
    if (next === old) return;
    S.skills.levels[skill] = next;
    S.skills.history.push({
      date: nowISO(), skill: skill, oldValue: old, newValue: next, reason: reason || ''
    });
    while (S.skills.history.length > SKILL_HISTORY_MAX) S.skills.history.shift();
    touch('skills');
  }

  function bumpStageSkills(stageId, scale) {
    var map = STAGE_SKILLS[stageId];
    if (!map) return;
    for (var i = 0; i < map.length; i++) {
      updateSkill(map[i].skill, Math.max(1, Math.round(map[i].delta * (scale || 1))), 'stage:' + stageId);
    }
  }

  // ========================
  // XP
  // ========================

  function _award(amount, reason) {
    var p = S.profile;
    var oldRank = rankFor(p.totalXP).name;
    p.totalXP += amount;
    recalculateRank();
    updateStreak();
    p.lastActiveAt = nowISO();
    touch('profile');

    var unlocked = checkAchievements();
    checkChallenges();

    markDirty('profile');
    if (unlocked.length) markDirty('achievements');
    markDirty('activity');

    var rankChanged = rankFor(p.totalXP).name !== oldRank;
    document.dispatchEvent(new CustomEvent('potok:xp-awarded', {
      detail: { amount: amount, reason: reason, total: p.totalXP }
    }));

    if (amount >= 5) showXpToast(amount);
    if (rankChanged) showRankToast(rankFor(p.totalXP).name);

    return { gained: amount, totalXP: p.totalXP, rankChanged: rankChanged, newRank: p.currentRank, unlocked: unlocked };
  }

  function addXP(amount, reason) {
    return _award(Math.max(0, Math.round(amount)), reason || 'manual');
  }

  // ========================
  // ПРОГРЕСС: ЗАДАНИЯ IY QUEST
  // ========================

  function completeTask(taskId, opts) {
    opts = opts || {};
    var q = S.progress.quest;
    if (q.completedTaskIds.indexOf(taskId) !== -1) return null;

    var gain = Math.max(1, Math.round(opts.xpGained || XP_REWARDS.quest_task));
    q.completedTaskIds.push(taskId);
    q.taskResults[taskId] = { completedAt: nowISO(), xpGained: gain };
    // Детали держим только по последним 30 заданиям (лимит CloudStorage)
    var ids = Object.keys(q.taskResults);
    if (ids.length > 30) {
      ids.sort(function (a, b) { return a - b; });
      for (var i = 0; i < ids.length - 30; i++) delete q.taskResults[ids[i]];
    }

    var stageId = taskToStage(taskId);
    bumpStageSkills(stageId, 0.5);
    S.profile.summary.completedTasks = q.completedTaskIds.length;
    touch('progress');

    logEvent('task_completed', { taskId: taskId });
    markDirty('progress');
    markDirty('skills');

    // noAward — XP уже начислен через геймификацию (авто-комплит bridge.js)
    if (opts.noAward) {
      return { gained: 0, totalXP: S.profile.totalXP, rankChanged: false, newRank: S.profile.currentRank, unlocked: [] };
    }
    return _award(gain, 'quest_task_' + taskId);
  }

  // ========================
  // ПРОГРЕСС: ТЕСТЫ
  // ========================

  function recordTestResult(testId, scorePct, opts) {
    opts = opts || {};
    var t = S.progress.tests[testId] || { bestScore: 0, attempts: 0, lastAttemptAt: null };
    t.attempts += 1;
    t.bestScore = Math.max(t.bestScore, scorePct);
    t.lastAttemptAt = nowISO();
    if (opts.weakTopics && opts.weakTopics.length) {
      t.weakTopics = opts.weakTopics.slice(0, 6);
    }
    t.answersHistory = t.answersHistory || [];
    var entry = { score: scorePct, date: nowISO() };
    if (opts.timeSpentSec) entry.timeSpentSec = Math.round(opts.timeSpentSec);
    t.answersHistory.push(entry);
    while (t.answersHistory.length > 3) t.answersHistory.shift();
    S.progress.tests[testId] = t;

    // Пересчёт сводки по тестам
    var sum = 0, count = 0, passed = 0;
    for (var id in S.progress.tests) {
      if (!S.progress.tests.hasOwnProperty(id)) continue;
      sum += S.progress.tests[id].bestScore;
      count++;
      if (S.progress.tests[id].bestScore >= 50) passed++;
    }
    S.profile.summary.testsPassed = passed;
    S.profile.summary.averageTestScore = count ? Math.round(sum / count) : 0;

    // Навыки по теме этапа
    var stageId = testId.match(/^etap\d+$/) ? testId : null;
    if (stageId && STAGE_SKILLS[stageId]) {
      var scale = scorePct >= 90 ? 1.5 : (scorePct >= 80 ? 1 : 0.6);
      bumpStageSkills(stageId, scale);
      // Теория на 90%+ — усиленный бонус
      if (stageId === 'etap4' && scorePct >= 90) updateSkill('theory', 5, 'test:etap4');
    }

    var xp = scorePct >= 80 ? XP_REWARDS.test_pass_80 : (scorePct >= 50 ? XP_REWARDS.test_pass_50 : XP_REWARDS.test_fail);
    logEvent(scorePct >= 50 ? 'test_passed' : 'test_failed', { testId: testId, score: scorePct });
    touch('progress');
    markDirty('progress');
    markDirty('skills');
    return _award(xp, 'test_' + testId);
  }

  // ========================
  // ПРОГРЕСС: ЭТАПЫ И ДОМАШКИ
  // ========================

  function ensureStage(stageId) {
    if (!S.progress.stages[stageId]) {
      S.progress.stages[stageId] = { status: 'available', progressPercent: 0, homework: { status: 'none', attempts: 0 } };
    }
    var st = S.progress.stages[stageId];
    if (!st.homework) st.homework = { status: 'none', attempts: 0 };
    return st;
  }

  function setStageProgress(stageId, percent) {
    var st = ensureStage(stageId);
    if (st.status === 'completed') return;
    st.progressPercent = clamp(Math.round(percent), 0, 100);
    if (st.progressPercent > 0 && !st.startedAt) st.startedAt = nowISO();
    if (st.progressPercent > 0) st.status = 'in_progress';
    touch('progress');
    markDirty('progress');
  }

  function completeStage(stageId, opts) {
    opts = opts || {};
    var st = ensureStage(stageId);
    if (st.status === 'completed') return null;
    st.status = 'completed';
    st.progressPercent = 100;
    st.completedAt = nowISO();
    if (!st.startedAt) st.startedAt = nowISO();

    // Ачивка fast_learner — этап закрыт за 3 дня или быстрее
    var startMs = new Date(st.startedAt).getTime();
    if (!isNaN(startMs) && (Date.now() - startMs) <= 3 * 86400000) {
      unlockAchievement('fast_learner');
    }

    // Сводка по этапам
    var done = 0, total = 0;
    for (var id in S.progress.stages) {
      if (!S.progress.stages.hasOwnProperty(id)) continue;
      total++;
      if (S.progress.stages[id].status === 'completed') done++;
    }
    S.profile.summary.completedStages = done;

    bumpStageSkills(stageId, 1);
    logEvent('stage_completed', { stageId: stageId });
    touch('progress');
    markDirty('progress');
    markDirty('skills');

    // noAward — бонус за этап уже начислен через геймификацию (bridge.js)
    if (opts.noAward) {
      return { gained: 0, totalXP: S.profile.totalXP, rankChanged: false, newRank: S.profile.currentRank, unlocked: [] };
    }
    return _award(XP_REWARDS.stage_complete, 'stage_' + stageId);
  }

  function submitHomework(stageId, meta) {
    meta = meta || {};
    var st = ensureStage(stageId);
    st.homework.status = 'submitted';
    st.homework.submittedAt = nowISO();
    st.homework.attempts += 1;
    S.profile.summary.homeworkSubmitted += 1;

    if (meta.title) {
      addTrack({ title: meta.title, stageId: stageId, status: 'submitted', telegramFileId: meta.telegramFileId || null, externalUrl: meta.externalUrl || null, notes: meta.notes || null });
    }
    logEvent('homework_submitted', { stageId: stageId });
    touch('progress');
    markDirty('profile');
    markDirty('progress');
    checkAchievements(); // first_hw и другие, не привязанные к XP
  }

  function setHomeworkStatus(stageId, status, feedback) {
    var st = ensureStage(stageId);
    st.homework.status = status;
    if (feedback) st.homework.lastFeedback = String(feedback).slice(0, 200);

    if (status === 'accepted') {
      S.profile.summary.homeworkAccepted += 1;
      bumpStageSkills(stageId, 1.5);
      // Бонус за ДЗ с первого раза
      if (st.homework.attempts <= 1) updateSkill('production', 4, 'homework_first_try:' + stageId);

      // Серия «приняты без второго круга»
      var key = 'noSecondRound';
      S.achievements.progress[key] = st.homework.attempts <= 1 ? (S.achievements.progress[key] || 0) + 1 : 0;

      logEvent('homework_accepted', { stageId: stageId });
      touch('progress');
      markDirty('progress');
      markDirty('skills');
      return _award(XP_REWARDS.homework_accepted, 'homework_' + stageId);
    }
    if (status === 'rejected' || status === 'second_round') {
      S.achievements.progress.noSecondRound = 0;
    }
    touch('progress');
    markDirty('progress');
  }

  // ========================
  // ИНСТРУМЕНТЫ
  // ========================

  function recordToolUse(toolId, opts) {
    opts = opts || {};
    var u = S.progress.toolsUsage[toolId] || { opens: 0, lastUsedAt: null };
    u.opens += 1;
    u.lastUsedAt = nowISO();
    if (opts.totalTimeSpentSec) u.totalTimeSpentSec = (u.totalTimeSpentSec || 0) + Math.round(opts.totalTimeSpentSec);
    if (typeof opts.bestScore === 'number') {
      u.bestScore = Math.max(u.bestScore || 0, opts.bestScore);
    }
    // Слепой тест: серия правильных ответов подряд
    if (opts.correct === true) u.blindStreak = (u.blindStreak || 0) + 1;
    else if (opts.correct === false) u.blindStreak = 0;
    S.progress.toolsUsage[toolId] = u;

    // Высокий результат в тренажёре — бонус навыкам
    if (typeof opts.bestScore === 'number' && opts.bestScore >= 80) {
      var skillMap = { compressor: 'mixing', 'eq-trainer': 'mixing', synth: 'soundDesign', reverb: 'mixing', delay: 'mixing' };
      if (skillMap[toolId]) updateSkill(skillMap[toolId], 2, 'tool:' + toolId);
    }

    logEvent('tool_used', { toolId: toolId });
    touch('progress');
    markDirty('progress');
    return _award(XP_REWARDS.tool_use, 'tool_' + toolId);
  }

  // ========================
  // ПОРТФОЛИО
  // ========================

  function addTrack(track) {
    var t = {
      id: uid(),
      title: track.title || 'Без названия',
      stageId: track.stageId || null,
      submittedAt: nowISO(),
      status: track.status || 'submitted'
    };
    if (track.telegramFileId) t.telegramFileId = track.telegramFileId;
    if (track.externalUrl) t.externalUrl = track.externalUrl;
    if (track.notes) t.notes = String(track.notes).slice(0, 300);
    if (track.durationSec) t.durationSec = track.durationSec;
    if (track.bpm) t.bpm = track.bpm;
    if (track.key) t.key = track.key;

    S.portfolio.tracks.unshift(t);
    while (S.portfolio.tracks.length > PORTFOLIO_MAX) S.portfolio.tracks.pop();
    touch('portfolio');
    markDirty('portfolio');
    return t;
  }

  // ========================
  // АЧИВКИ
  // ========================

  // Legacy-статистика из gamification.js (уроки, время, сессии) — для ачивок, перенесённых из бейджей
  function legacyStats() {
    try {
      if (window.PotokGamification && typeof window.PotokGamification.getStats === 'function') {
        return window.PotokGamification.getStats();
      }
    } catch (e) {}
    return {};
  }

  var ACHIEVEMENT_DEFS = [
    // Прогресс
    { id: 'first_steps', name: 'Первые шаги', desc: 'Выполнил первое задание IY Quest', icon: 'footprints', rarity: 'common',
      check: function () { return S.progress.quest.completedTaskIds.length >= 1; } },
    { id: 'xp_100', name: 'Сотня опыта', desc: 'Набрал 100 XP', icon: 'zap', rarity: 'common',
      check: function () { return S.profile.totalXP >= 100; } },
    { id: 'xp_500', name: 'Полтысячи', desc: 'Набрал 500 XP', icon: 'sparkles', rarity: 'uncommon',
      check: function () { return S.profile.totalXP >= 500; } },
    { id: 'xp_1000', name: 'Тысячник', desc: 'Набрал 1000 XP', icon: 'gem', rarity: 'rare',
      check: function () { return S.profile.totalXP >= 1000; } },
    { id: 'stage_1_done', name: 'Первый рубеж', desc: 'Закрыл Этап №1', icon: 'flag', rarity: 'uncommon',
      check: function () { var s = S.progress.stages.etap1; return !!(s && s.status === 'completed'); } },
    { id: 'stage_3_done', name: 'Твёрдая база', desc: 'Закрыл первые 3 этапа', icon: 'flags', rarity: 'rare',
      check: function () {
        var ids = ['etap1', 'etap2', 'etap3'];
        for (var i = 0; i < ids.length; i++) {
          var s = S.progress.stages[ids[i]];
          if (!s || s.status !== 'completed') return false;
        }
        return true;
      } },
    { id: 'all_stages', name: 'Полный поток', desc: 'Прошёл все 10 этапов', icon: 'medal', rarity: 'legendary',
      check: function () {
        for (var i = 0; i <= 9; i++) {
          var s = S.progress.stages['etap' + i];
          if (!s || s.status !== 'completed') return false;
        }
        return true;
      } },
    { id: 'quest_50', name: 'Полсотни', desc: '50 заданий IY Quest', icon: 'list-checks', rarity: 'rare',
      check: function () { return S.progress.quest.completedTaskIds.length >= 50; } },
    { id: 'quest_100', name: 'Сто задач', desc: '100 заданий IY Quest', icon: 'trophy', rarity: 'legendary',
      check: function () { return S.progress.quest.completedTaskIds.length >= 100; } },
    // Стрики и активность
    { id: 'streak_3', name: 'Разогрев', desc: 'Стрик 3 дня подряд', icon: 'flame', rarity: 'common',
      check: function () { return S.profile.maxStreak >= 3; } },
    { id: 'streak_7', name: 'Неделя огня', desc: 'Стрик 7 дней подряд', icon: 'flame', rarity: 'uncommon',
      check: function () { return S.profile.maxStreak >= 7; } },
    { id: 'streak_14', name: 'Две недели', desc: 'Стрик 14 дней подряд', icon: 'flame', rarity: 'rare',
      check: function () { return S.profile.maxStreak >= 14; } },
    { id: 'streak_30', name: 'Месяц в потоке', desc: 'Стрик 30 дней подряд', icon: 'flame', rarity: 'epic',
      check: function () { return S.profile.maxStreak >= 30; } },
    { id: 'night_owl', name: 'Сова', desc: 'Активность после полуночи (5 раз)', icon: 'moon-star', rarity: 'uncommon', progressTarget: 5,
      check: function () { return (S.achievements.progress.night_owl || 0) >= 5; } },
    { id: 'early_bird', name: 'Жаворонок', desc: 'Активность до 10:00 (5 раз)', icon: 'sunrise', rarity: 'uncommon', progressTarget: 5,
      check: function () { return (S.achievements.progress.early_bird || 0) >= 5; } },
    // Навыки и тесты
    { id: 'perfect_test', name: 'Идеальный тест', desc: '100% в любом тесте этапа', icon: 'badge-check', rarity: 'epic',
      check: function () {
        for (var id in S.progress.tests) {
          if (S.progress.tests.hasOwnProperty(id) && S.progress.tests[id].bestScore >= 100) return true;
        }
        return false;
      } },
    { id: 'compressor_master', name: 'Мастер компрессора', desc: '5 раз подряд угадал в слепом тесте компрессора', icon: 'sliders-horizontal', rarity: 'epic',
      check: function () { var u = S.progress.toolsUsage.compressor; return !!(u && (u.blindStreak || 0) >= 5); } },
    { id: 'theory_guru', name: 'Гуру теории', desc: '90%+ в тесте по теории', icon: 'graduation-cap', rarity: 'rare',
      check: function () { var t = S.progress.tests.etap4; return !!(t && t.bestScore >= 90); } },
    { id: 'eq_wizard', name: 'Волшебник EQ', desc: 'Отличный результат в EQ-тренажёре (80+)', icon: 'audio-lines', rarity: 'rare',
      check: function () { var u = S.progress.toolsUsage['eq-trainer']; return !!(u && (u.bestScore || 0) >= 80); } },
    { id: 'synth_lover', name: 'Синтезаторщик', desc: 'Открыл синтезатор 30+ раз', icon: 'music-4', rarity: 'uncommon', progressTarget: 30,
      check: function () { var u = S.progress.toolsUsage.synth; return !!(u && u.opens >= 30); } },
    // Домашки
    { id: 'first_hw', name: 'Первая домашка', desc: 'Сдал первое ДЗ', icon: 'file-text', rarity: 'common',
      check: function () { return S.profile.summary.homeworkSubmitted >= 1; } },
    { id: 'hw_accepted', name: 'Принято!', desc: 'ДЗ принято куратором', icon: 'circle-check', rarity: 'uncommon',
      check: function () { return S.profile.summary.homeworkAccepted >= 1; } },
    { id: 'no_second_round', name: 'С первого раза', desc: '5 ДЗ подряд приняты без второго круга', icon: 'shield-check', rarity: 'epic', progressTarget: 5,
      check: function () { return (S.achievements.progress.noSecondRound || 0) >= 5; } },
    { id: 'hw_collector', name: 'Коллекционер', desc: 'Сдал 10 домашних заданий', icon: 'archive', rarity: 'rare',
      check: function () { return S.profile.summary.homeworkSubmitted >= 10; } },
    // Особые
    { id: 'comeback', name: 'Возвращение', desc: 'Вернулся после 14+ дней отсутствия', icon: 'rotate-ccw', rarity: 'rare',
      check: function () { return false; } }, // проверяется при входе, см. init()
    { id: 'fast_learner', name: 'Быстрый ученик', desc: 'Закрыл этап за 3 дня или быстрее', icon: 'gauge', rarity: 'uncommon',
      check: function () { return false; } }, // проверяется в completeStage()
    { id: 'perfectionist', name: 'Перфекционист', desc: 'Переделывал ДЗ 3+ раза до идеала', icon: 'gem', rarity: 'epic',
      check: function () {
        for (var id in S.progress.stages) {
          if (!S.progress.stages.hasOwnProperty(id)) continue;
          var hw = S.progress.stages[id].homework;
          if (hw && hw.status === 'accepted' && hw.attempts >= 3) return true;
        }
        return false;
      } },
    // Перенесены из legacy-бейджей: уроки, время в курсе, сессии, уровни
    { id: 'first_step', name: 'Первый урок', desc: 'Отметить первый урок как пройденный', icon: 'book-open', rarity: 'common',
      check: function () { return (legacyStats().lessonsDone || 0) >= 1; } },
    { id: 'five_lessons', name: 'Пять уроков', desc: 'Пройти 5 уроков', icon: 'library', rarity: 'common',
      check: function () { return (legacyStats().lessonsDone || 0) >= 5; } },
    { id: 'ten_lessons', name: 'Десять уроков', desc: 'Пройти 10 уроков', icon: 'star', rarity: 'uncommon',
      check: function () { return (legacyStats().lessonsDone || 0) >= 10; } },
    { id: 'quarter_hour', name: '15 минут', desc: 'Потратить 15 минут в курсе', icon: 'timer', rarity: 'common',
      check: function () { return (legacyStats().totalMinutes || 0) >= 15; } },
    { id: 'hour_warrior', name: 'Часовой воин', desc: 'Потратить 60 минут в курсе', icon: 'clock', rarity: 'uncommon',
      check: function () { return (legacyStats().totalMinutes || 0) >= 60; } },
    { id: 'marathon', name: 'Марафонец', desc: 'Потратить 300 минут в курсе', icon: 'hourglass', rarity: 'rare',
      check: function () { return (legacyStats().totalMinutes || 0) >= 300; } },
    { id: 'five_sessions', name: 'Регулярность', desc: '5 учебных сессий', icon: 'calendar-check', rarity: 'uncommon',
      check: function () { return (legacyStats().sessions || 0) >= 5; } },
    { id: 'ten_sessions', name: 'Преданность', desc: '10 учебных сессий', icon: 'repeat', rarity: 'rare',
      check: function () { return (legacyStats().sessions || 0) >= 10; } },
    { id: 'level5', name: 'Ученик', desc: 'Достичь 5 уровня', icon: 'sprout', rarity: 'uncommon',
      check: function () { return (legacyStats().level || 1) >= 5; } },
    { id: 'level10', name: 'Продвинутый', desc: 'Достичь 10 уровня', icon: 'rocket', rarity: 'rare',
      check: function () { return (legacyStats().level || 1) >= 10; } },
    { id: 'level20', name: 'Мастер', desc: 'Достичь 20 уровня', icon: 'crown', rarity: 'epic',
      check: function () { return (legacyStats().level || 1) >= 20; } },
    { id: 'explorer', name: 'Исследователь', desc: 'Посетить все разделы курса', icon: 'compass', rarity: 'rare',
      check: function () { return (legacyStats().sectionsVisited || 0) >= 5; } },
    { id: 'xp_5000', name: 'Легенда', desc: 'Набрать 5000 XP', icon: 'gem', rarity: 'legendary',
      check: function () { return S.profile.totalXP >= 5000; } }
  ];

  function getAchievementDef(id) {
    for (var i = 0; i < ACHIEVEMENT_DEFS.length; i++) {
      if (ACHIEVEMENT_DEFS[i].id === id) return ACHIEVEMENT_DEFS[i];
    }
    return null;
  }

  function isUnlocked(id) {
    return !!S.achievements.unlocked[id];
  }

  function unlockAchievement(id, silent) {
    if (isUnlocked(id)) return null;
    var def = getAchievementDef(id);
    if (!def) return null;
    S.achievements.unlocked[id] = { unlockedAt: nowISO(), seen: false };
    touch('achievements');
    logEvent('achievement_unlocked', { achievementId: id });
    markDirty('achievements');
    if (!silent) showAchievementToast(def);
    return def;
  }

  function checkAchievements() {
    var unlocked = [];
    for (var i = 0; i < ACHIEVEMENT_DEFS.length; i++) {
      var def = ACHIEVEMENT_DEFS[i];
      if (!isUnlocked(def.id) && def.check()) {
        var d = unlockAchievement(def.id, true);
        if (d) unlocked.push(d);
      }
    }
    // Попапы показываем последовательно
    for (var j = 0; j < unlocked.length; j++) showAchievementToast(unlocked[j], j * 4500);
    return unlocked;
  }

  // ========================
  // ЧЕЛЛЕНДЖИ
  // ========================

  function generateChallenges() {
    var c = S.challenges;
    if (c.active.length >= 3) return;

    function addChallenge(ch) {
      for (var i = 0; i < c.active.length; i++) if (c.active[i].id === ch.id) return;
      if (c.completed.indexOf(ch.id) !== -1) return;
      c.active.push(ch);
    }

    var now = Date.now();
    var day3 = new Date(now + 3 * 86400000).toISOString();

    // Слабая теория → пройти тест Этапа 4 на 80%+
    if (S.skills.levels.theory < 40) {
      addChallenge({
        id: 'gap_theory', title: 'Подтянуть теорию', description: 'Пройди тест Этапа №4 на 80%+',
        type: 'skill_gap', skillTarget: 'theory',
        goal: { metric: 'tests', target: 1, current: 0 },
        reward: { xp: 35 }, status: 'active', createdAt: nowISO(), expiresAt: null
      });
    }

    // Слабое сведение + мало практики компрессора → слепые тесты
    var comp = S.progress.toolsUsage.compressor;
    if (S.skills.levels.mixing < 40 && !(comp && comp.opens >= 5)) {
      addChallenge({
        id: 'gap_compression', title: 'Компрессия на слух', description: 'Открой тренажёр компрессора и пройди 3 слепых теста',
        type: 'skill_gap', skillTarget: 'mixing',
        goal: { metric: 'tool_opens', target: 3, current: 0 }, baseline: (comp && comp.opens) || 0,
        reward: { xp: 35 }, status: 'active', createdAt: nowISO(), expiresAt: null
      });
    }

    // Толчок по заданиям IY Quest
    if (S.progress.quest.completedTaskIds.length < 30) {
      addChallenge({
        id: 'quest_push_' + dateKey(), title: 'Серия заданий', description: 'Выполни 5 заданий IY Quest за 3 дня',
        type: 'daily', skillTarget: null,
        goal: { metric: 'tasks', target: 5, current: 0 }, baseline: S.progress.quest.completedTaskIds.length,
        reward: { xp: 40 }, status: 'active', createdAt: nowISO(), expiresAt: day3
      });
    }

    // Стрик-челлендж
    if (S.profile.currentStreak < 5 && S.profile.maxStreak >= 2) {
      addChallenge({
        id: 'streak_5', title: 'Пять дней в потоке', description: 'Зайди в курс 5 дней подряд',
        type: 'special', skillTarget: null,
        goal: { metric: 'custom', target: 5, current: S.profile.currentStreak },
        reward: { xp: 40 }, status: 'active', createdAt: nowISO(), expiresAt: null
      });
    }

    if (c.active.length) markDirty('challenges');
  }

  function challengeProgress(ch) {
    switch (ch.goal.metric) {
      case 'tests':
        return S.progress.tests.etap4 && S.progress.tests.etap4.bestScore >= 80 ? ch.goal.target : 0;
      case 'tool_opens':
        var u = S.progress.toolsUsage.compressor;
        return clamp(((u && u.opens) || 0) - (ch.baseline || 0), 0, ch.goal.target);
      case 'tasks':
        return clamp(S.progress.quest.completedTaskIds.length - (ch.baseline || 0), 0, ch.goal.target);
      case 'custom':
        return clamp(S.profile.currentStreak, 0, ch.goal.target);
    }
    return 0;
  }

  function completeChallenge(id) {
    var c = S.challenges;
    for (var i = 0; i < c.active.length; i++) {
      if (c.active[i].id !== id) continue;
      var ch = c.active[i];
      c.active.splice(i, 1);
      ch.status = 'completed';
      ch.completedAt = nowISO();
      c.completed.push(id);
      while (c.completed.length > CHALLENGES_COMPLETED_MAX) c.completed.shift();
      touch('challenges');
      markDirty('challenges');
      logEvent('challenge_completed', { challengeId: id });
      showChallengeToast(ch);
      _award(ch.reward.xp, 'challenge_' + id);
      return ch;
    }
    return null;
  }

  function checkChallenges() {
    var c = S.challenges;
    for (var i = c.active.length - 1; i >= 0; i--) {
      var ch = c.active[i];
      if (ch.expiresAt && new Date(ch.expiresAt) < new Date()) {
        ch.status = 'expired';
        c.active.splice(i, 1);
        touch('challenges');
        markDirty('challenges');
        continue;
      }
      var p = challengeProgress(ch);
      if (ch.goal.current !== p) {
        ch.goal.current = p;
        touch('challenges');
        markDirty('challenges');
      }
      if (p >= ch.goal.target) completeChallenge(ch.id);
    }
  }

  // ========================
  // ДВИЖОК РЕКОМЕНДАЦИЙ
  // ========================

  function generateRecommendations() {
    var recs = [];
    var now = Date.now();

    // 1. Сохранение стрика — самый приоритетный сигнал
    if (S.profile.currentStreak > 0) {
      var hoursSinceActive = (now - new Date(S.profile.lastActiveAt).getTime()) / 3600000;
      if (hoursSinceActive >= 24) {
        recs.push({
          id: 'streak_save', type: 'continue', priority: 9,
          title: 'Не потеряй стрик',
          description: 'У тебя серия ' + S.profile.currentStreak + ' дн. Сделай одно задание IY Quest, чтобы продлить её.',
          actionUrl: '/tools/iY-quest/index.html', actionLabel: 'К заданиям'
        });
      }
    }

    // 2. Skill gap — слабые навыки
    var weak = [];
    for (var k in S.skills.levels) {
      if (S.skills.levels.hasOwnProperty(k) && S.skills.levels[k] < 40) weak.push({ skill: k, value: S.skills.levels[k] });
    }
    weak.sort(function (a, b) { return a.value - b.value; });

    var gapStage = {
      theory: { url: '/etap4/index.html', label: 'Этап №4: Теория музыки' },
      mixing: { url: '/etap2/index.html', label: 'Этап №2: Сведение и VST' },
      beatmaking: { url: '/etap1/index.html', label: 'Этап №1: Первые Биты' },
      soundDesign: { url: '/etap5/index.html', label: 'Этап №5: EDM и Саунд-дизайн' },
      arrangement: { url: '/etap3/index.html', label: 'Этап №3: Усложненные биты' },
      vocals: { url: '/etap7/index.html', label: 'Этап №7: Сведение Вокала' },
      liveInstruments: { url: '/etap6/index.html', label: 'Этап №6: Живая Музыка' },
      production: { url: '/tools/iY-quest/index.html', label: 'Задания IY Quest' },
      promotion: { url: '/etap9/index.html', label: 'Этап №9: Продвижение' }
    };

    for (var i = 0; i < Math.min(2, weak.length); i++) {
      var w = weak[i];
      var g = gapStage[w.skill] || { url: '/roadmap/', label: 'Маршрут обучения' };
      recs.push({
        id: 'gap_' + w.skill, type: 'skill_gap', priority: 8 - i,
        title: 'Подтянуть: ' + SKILL_LABELS[w.skill],
        description: 'Навык на уровне ' + w.value + '/100. Рекомендуем: ' + g.label + '.',
        actionUrl: g.url, actionLabel: 'Перейти'
      });
    }

    // 3. Практика компрессора при слабом сведении
    var compU = S.progress.toolsUsage.compressor;
    if (S.skills.levels.mixing < 50 && !(compU && compU.opens >= 3)) {
      recs.push({
        id: 'tool_compressor', type: 'tool', priority: 6,
        title: 'Попрактикуй компрессор',
        description: 'Пройди слепой тест компрессора — так быстрее растёт навык сведения.',
        actionUrl: '/tools/compressor/index.html', actionLabel: 'Открыть тренажёр'
      });
    }

    // 4. Продолжение незавершённого этапа
    var inProgress = null;
    for (var n = 0; n <= 9; n++) {
      var st = S.progress.stages['etap' + n];
      if (st && st.status === 'in_progress') { inProgress = 'etap' + n; break; }
    }
    if (!inProgress) {
      for (var m = 0; m <= 9; m++) {
        var s2 = S.progress.stages['etap' + m];
        if (!s2 || s2.status !== 'completed') { inProgress = 'etap' + m; break; }
      }
    }
    if (inProgress) {
      recs.push({
        id: 'continue_' + inProgress, type: 'continue', priority: 7,
        title: 'Продолжить: ' + STAGE_LABELS[inProgress],
        description: 'У тебя есть незакрытый этап — вернись и доведи его до конца.',
        actionUrl: '/' + inProgress + '/index.html', actionLabel: 'К этапу'
      });
    }

    // 5. Мотивация по динамике навыков
    var h = S.skills.history;
    for (var j = h.length - 1; j >= 0; j--) {
      if (h[j].newValue - h[j].oldValue >= 5 && daysBetween(h[j].date, nowISO()) <= 7) {
        recs.push({
          id: 'motivation_' + h[j].skill, type: 'motivation', priority: 4,
          title: 'Отличный темп!',
          description: SKILL_LABELS[h[j].skill] + ': ' + h[j].oldValue + ' → ' + h[j].newValue + ' за последнюю неделю. Так держать!',
          actionUrl: null, actionLabel: null
        });
        break;
      }
    }

    recs.sort(function (a, b) { return b.priority - a.priority; });
    for (var r = 0; r < recs.length; r++) recs[r].createdAt = nowISO();
    return recs.slice(0, 5);
  }

  // ========================
  // УВЕДОМЛЕНИЯ (TOASTS)
  // ========================

  var toastStack = [];

  function pushToast(html, className, duration) {
    var wrap = document.getElementById('potok-pers-toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'potok-pers-toasts';
      document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'potok-pers-toast ' + (className || '');
    el.setAttribute('role', 'status');
    el.innerHTML = html;
    wrap.appendChild(el);

    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 400);
    }, duration || 3500);
  }

  function showXpToast(amount) {
    pushToast(
      '<i data-lucide="zap" class="potok-pers-toast__icon"></i>' +
      '<div><div class="potok-pers-toast__title">+' + amount + ' XP</div>' +
      '<div class="potok-pers-toast__sub">' + S.profile.totalXP + ' всего · ранг «' + esc(S.profile.currentRank) + '»</div></div>',
      'potok-pers-toast--xp', 3000
    );
    initIcons();
  }

  function showRankToast(rankName) {
    pushToast(
      '<i data-lucide="crown" class="potok-pers-toast__icon"></i>' +
      '<div><div class="potok-pers-toast__title">Новый ранг!</div>' +
      '<div class="potok-pers-toast__sub">' + esc(rankName) + '</div></div>',
      'potok-pers-toast--rank', 5000
    );
    initIcons();
  }

  function showAchievementToast(def, delay) {
    setTimeout(function () {
      pushToast(
        '<i data-lucide="' + def.icon + '" class="potok-pers-toast__icon"></i>' +
        '<div><div class="potok-pers-toast__title">Ачивка: ' + esc(def.name) + '</div>' +
        '<div class="potok-pers-toast__sub">' + esc(def.desc) + '</div></div>',
        'potok-pers-toast--achievement potok-pers-toast--' + def.rarity, 5000
      );
      initIcons();
    }, delay || 0);
  }

  function showChallengeToast(ch) {
    pushToast(
      '<i data-lucide="target" class="potok-pers-toast__icon"></i>' +
      '<div><div class="potok-pers-toast__title">Челлендж выполнен: ' + esc(ch.title) + '</div>' +
      '<div class="potok-pers-toast__sub">+' + ch.reward.xp + ' XP</div></div>',
      'potok-pers-toast--challenge', 5000
    );
    initIcons();
  }

  function initIcons() {
    try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {}
  }

  // ========================
  // UI: ПРОФИЛЬ
  // ========================

  function renderProfile(container) {
    var p = S.profile;
    var next = nextRank();
    var prevMin = rankFor(p.totalXP).min;
    var pct = next ? clamp(Math.round((p.totalXP - prevMin) / (next.min - prevMin) * 100), 0, 100) : 100;

    var avatarHtml = p.photoUrl
      ? '<img class="potok-pers-profile__avatar" src="' + esc(p.photoUrl) + '" alt="">'
      : '<div class="potok-pers-profile__avatar potok-pers-profile__avatar--initials">' + esc((p.firstName || 'У').charAt(0).toUpperCase()) + '</div>';

    var sum = p.summary;
    container.innerHTML =
      '<div class="potok-pers-profile">' +
        avatarHtml +
        '<div class="potok-pers-profile__main">' +
          '<div class="potok-pers-profile__name">' + esc(p.firstName) + (p.lastName ? ' ' + esc(p.lastName) : '') + '</div>' +
          '<div class="potok-pers-profile__rank"><i data-lucide="crown"></i><span>' + esc(p.currentRank) + '</span></div>' +
        '</div>' +
        '<div class="potok-pers-profile__xp">' +
          '<div class="potok-pers-profile__xp-num">' + p.totalXP + ' <small>XP</small></div>' +
          (next
            ? '<div class="potok-pers-profile__track"><div class="potok-pers-profile__fill" style="width:' + pct + '%"></div></div>' +
              '<div class="potok-pers-profile__xp-next">' + (p.totalXP - prevMin) + ' / ' + next.min + ' до ранга «' + esc(next.name) + '»</div>'
            : '<div class="potok-pers-profile__xp-next">Максимальный ранг достигнут</div>') +
        '</div>' +
      '</div>' +
      '<div class="potok-pers-summary">' +
        '<div class="potok-pers-summary__item"><i data-lucide="flame"></i><b>' + p.currentStreak + '</b><span>дней подряд</span></div>' +
        '<div class="potok-pers-summary__item"><i data-lucide="layers"></i><b>' + sum.completedStages + '/10</b><span>этапов</span></div>' +
        '<div class="potok-pers-summary__item"><i data-lucide="list-checks"></i><b>' + sum.completedTasks + '/100</b><span>заданий</span></div>' +
        '<div class="potok-pers-summary__item"><i data-lucide="badge-check"></i><b>' + sum.testsPassed + '</b><span>тестов сдано</span></div>' +
        '<div class="potok-pers-summary__item"><i data-lucide="file-text"></i><b>' + sum.homeworkAccepted + '/' + sum.homeworkSubmitted + '</b><span>ДЗ принято/сдано</span></div>' +
      '</div>';
    initIcons();
  }

  // ========================
  // UI: РАДАР НАВЫКОВ (SVG)
  // ========================

  var RADAR_AXES = [
    { key: 'beatmaking', label: 'Битмейкинг' },
    { key: 'mixing', label: 'Сведение' },
    { key: 'soundDesign', label: 'Саунд-дизайн' },
    { key: 'theory', label: 'Теория' },
    { key: 'arrangement', label: 'Аранжировка' },
    { key: 'vocals', label: 'Вокал' },
    { key: 'liveInstruments', label: 'Инструменты' },
    { key: 'production', label: 'Продакшн' },
    { key: 'promotion', label: 'Продвижение' }
  ];

  function radarPoint(cx, cy, radius, i, total) {
    var angle = -Math.PI / 2 + (i * 2 * Math.PI) / total;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }

  function buildRadarSVG() {
    var W = 480, H = 330, cx = 240, cy = 160, R = 105;
    var n = RADAR_AXES.length;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="potok-pers-radar__svg" role="img" aria-label="Радар навыков">';

    // Кольца
    for (var ring = 1; ring <= 5; ring++) {
      var rr = R * ring / 5;
      var pts = [];
      for (var i = 0; i < n; i++) {
        var pt = radarPoint(cx, cy, rr, i, n);
        pts.push(pt[0].toFixed(1) + ',' + pt[1].toFixed(1));
      }
      svg += '<polygon class="potok-pers-radar__ring" points="' + pts.join(' ') + '"></polygon>';
    }

    // Оси
    for (var a = 0; a < n; a++) {
      var pa = radarPoint(cx, cy, R, a, n);
      svg += '<line class="potok-pers-radar__axis" x1="' + cx + '" y1="' + cy + '" x2="' + pa[0].toFixed(1) + '" y2="' + pa[1].toFixed(1) + '"></line>';
    }

    // Данные
    var dataPts = [];
    for (var d = 0; d < n; d++) {
      var val = S.skills.levels[RADAR_AXES[d].key] || 0;
      var pd = radarPoint(cx, cy, R * val / 100, d, n);
      dataPts.push(pd[0].toFixed(1) + ',' + pd[1].toFixed(1));
    }
    svg += '<polygon class="potok-pers-radar__data" points="' + dataPts.join(' ') + '"></polygon>';

    // Подписи
    for (var l = 0; l < n; l++) {
      var pl = radarPoint(cx, cy, R + 22, l, n);
      var anchor = Math.abs(pl[0] - cx) < 12 ? 'middle' : (pl[0] > cx ? 'start' : 'end');
      svg += '<text class="potok-pers-radar__label" x="' + pl[0].toFixed(1) + '" y="' + (pl[1] + 4).toFixed(1) + '" text-anchor="' + anchor + '">' +
        RADAR_AXES[l].label + ' · ' + (S.skills.levels[RADAR_AXES[l].key] || 0) + '</text>';
    }

    svg += '</svg>';
    return svg;
  }

  function renderRadar(container) {
    var weak = [];
    for (var k in S.skills.levels) {
      if (S.skills.levels.hasOwnProperty(k) && S.skills.levels[k] < 40) weak.push(SKILL_LABELS[k]);
    }
    container.innerHTML =
      '<div class="potok-pers-radar">' + buildRadarSVG() + '</div>' +
      (weak.length
        ? '<div class="potok-pers-radar__gaps"><i data-lucide="trending-up"></i><span>Слабые места: ' + esc(weak.join(', ')) + ' — начни с рекомендаций ниже</span></div>'
        : '');
    initIcons();
  }

  // ========================
  // UI: АЧИВКИ
  // ========================

  function renderAchievements(container) {
    var html = '<div class="potok-pers-ach-grid">';
    for (var i = 0; i < ACHIEVEMENT_DEFS.length; i++) {
      var def = ACHIEVEMENT_DEFS[i];
      var un = S.achievements.unlocked[def.id];
      if (un) {
        html += '<div class="potok-pers-ach potok-pers-ach--' + def.rarity + '">' +
          '<i data-lucide="' + def.icon + '"></i>' +
          '<div class="potok-pers-ach__name">' + esc(def.name) + '</div>' +
          '<div class="potok-pers-ach__desc">' + esc(def.desc) + '</div>' +
          '<div class="potok-pers-ach__date">' + new Date(un.unlockedAt).toLocaleDateString('ru-RU') + '</div>' +
        '</div>';
      } else {
        var progHtml = '';
        if (def.progressTarget) {
          var cur = S.achievements.progress[def.id] || 0;
          // Для synth_lover прогресс берём из toolsUsage
          if (def.id === 'synth_lover') {
            var u = S.progress.toolsUsage.synth;
            cur = (u && u.opens) || 0;
          }
          var pct = clamp(Math.round(cur / def.progressTarget * 100), 0, 100);
          progHtml = '<div class="potok-pers-ach__track"><div class="potok-pers-ach__fill" style="width:' + pct + '%"></div></div>' +
            '<div class="potok-pers-ach__prog">' + Math.min(cur, def.progressTarget) + '/' + def.progressTarget + '</div>';
        }
        html += '<div class="potok-pers-ach potok-pers-ach--locked potok-pers-ach--' + def.rarity + '">' +
          '<i data-lucide="' + def.icon + '"></i>' +
          '<div class="potok-pers-ach__name">' + esc(def.name) + '</div>' +
          '<div class="potok-pers-ach__desc">' + esc(def.desc) + '</div>' +
          progHtml +
        '</div>';
      }
    }
    html += '</div>';
    container.innerHTML = html;
    initIcons();
  }

  // ========================
  // UI: РЕКОМЕНДАЦИИ И ЧЕЛЛЕНДЖИ
  // ========================

  var REC_ICONS = { skill_gap: 'trending-up', continue: 'play-circle', challenge: 'target', motivation: 'sparkles', tool: 'wrench' };

  function renderRecommendations(container) {
    var recs = generateRecommendations();
    if (!recs.length) {
      container.innerHTML = '<div class="potok-pers-empty">Пока нет рекомендаций — начни выполнять задания, и они появятся здесь.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      html += '<div class="potok-pers-rec">' +
        '<i data-lucide="' + (REC_ICONS[r.type] || 'lightbulb') + '" class="potok-pers-rec__icon"></i>' +
        '<div class="potok-pers-rec__body">' +
          '<div class="potok-pers-rec__title">' + esc(r.title) + '</div>' +
          '<div class="potok-pers-rec__desc">' + esc(r.description) + '</div>' +
        '</div>' +
        (r.actionUrl ? '<a class="potok-pers-rec__action" href="' + esc(/^https?:\/\//.test(r.actionUrl) ? r.actionUrl : ASSET_BASE + r.actionUrl) + '">' + esc(r.actionLabel || 'Перейти') + '</a>' : '') +
      '</div>';
    }
    container.innerHTML = html;
    initIcons();
  }

  function renderChallenges(container) {
    var c = S.challenges;
    if (!c.active.length) {
      container.innerHTML = '<div class="potok-pers-empty">Активных челленджей нет. Новые появятся на основе твоего прогресса.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < c.active.length; i++) {
      var ch = c.active[i];
      var p = challengeProgress(ch);
      var pct = clamp(Math.round(p / ch.goal.target * 100), 0, 100);
      html += '<div class="potok-pers-chal">' +
        '<i data-lucide="target" class="potok-pers-chal__icon"></i>' +
        '<div class="potok-pers-chal__body">' +
          '<div class="potok-pers-chal__title">' + esc(ch.title) + '</div>' +
          '<div class="potok-pers-chal__desc">' + esc(ch.description) + '</div>' +
          '<div class="potok-pers-chal__track"><div class="potok-pers-chal__fill" style="width:' + pct + '%"></div></div>' +
          '<div class="potok-pers-chal__meta">' + p + ' / ' + ch.goal.target + (ch.expiresAt ? ' · до ' + new Date(ch.expiresAt).toLocaleDateString('ru-RU') : '') + '</div>' +
        '</div>' +
        '<div class="potok-pers-chal__reward"><i data-lucide="zap"></i>+' + ch.reward.xp + '</div>' +
      '</div>';
    }
    container.innerHTML = html;
    initIcons();
  }

  // ========================
  // РЕНДЕР ВСЕХ КОНТЕЙНЕРОВ
  // ========================

  function refreshUI() {
    var map = {
      'potok-profile-container': renderProfile,
      'potok-radar-container': renderRadar,
      'potok-achievements-container': renderAchievements,
      'potok-recommendations-container': renderRecommendations,
      'potok-challenges-container': renderChallenges
    };
    for (var id in map) {
      if (!map.hasOwnProperty(id)) continue;
      var el = document.getElementById(id);
      if (el) map[id](el);
    }
  }

  // ========================
  // ПУБЛИЧНЫЙ API
  // ========================

  var API = {
    addXP: addXP,
    completeTask: completeTask,
    recordTestResult: recordTestResult,
    setStageProgress: setStageProgress,
    completeStage: completeStage,
    submitHomework: submitHomework,
    setHomeworkStatus: setHomeworkStatus,
    recordToolUse: recordToolUse,
    addTrack: addTrack,
    updateSkill: function (skill, delta, reason) { updateSkill(skill, delta, reason); markDirty('skills'); },
    unlockAchievement: function (id) { return unlockAchievement(id); },
    checkAchievements: checkAchievements,
    generateRecommendations: generateRecommendations,
    generateChallenges: generateChallenges,
    getState: function () { return S; },
    getIdentity: getIdentity,
    saveAll: saveAll,
    refreshUI: refreshUI,
    RANKS: RANKS,
    ACHIEVEMENT_DEFS: ACHIEVEMENT_DEFS,
    XP_REWARDS: XP_REWARDS
  };

  window.PotokPersonalization = API;

  // ========================
  // МОСТ С LEGACY ГЕЙМИФИКАЦИЕЙ
  // ========================
  // gamification.js шлёт potok:xp — зеркалим в профиль (единый totalXP)

  document.addEventListener('potok:xp', function (e) {
    var d = e.detail || {};
    if (!d.amount) return;
    _award(d.amount, d.reason || 'legacy');
  });

  // ========================
  // ИНИЦИАЛИЗАЦИЯ
  // ========================

  function init() {
    loadAll();
    importLegacyXp();
    migrateLegacyBadges();

    // Ачивка «comeback» — проверили ДО обновления lastActiveAt
    var p = S.profile;
    if (p.lastActiveAt && daysBetween(p.lastActiveAt, nowISO()) >= 14) {
      unlockAchievement('comeback');
    }

    updateStreak();
    p.lastActiveAt = nowISO();
    touch('profile');

    // Событие входа — раз в день
    var lastLoginDay = null;
    for (var i = S.activity.events.length - 1; i >= 0; i--) {
      if (S.activity.events[i].type === 'login') { lastLoginDay = dateKey(new Date(S.activity.events[i].timestamp)); break; }
    }
    if (lastLoginDay !== dateKey()) logEvent('login', {});

    checkAchievements();
    generateChallenges();
    checkChallenges();

    markDirty('profile');
    refreshUI();
    reconcileWithCloud();
  }

  // SPA-навигация MkDocs Material
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(refreshUI);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
