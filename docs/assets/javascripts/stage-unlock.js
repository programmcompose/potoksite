/* ========================================
   Stage Unlock — Поэтапная разблокировка контента
   Статический JS для GitHub Pages
   ======================================== */

(function () {
  'use strict';

  // ========================
  // КОНФИГУРАЦИЯ РАСПИСАНИЯ
  // ========================
  // Измените даты здесь. Формат: 'YYYY-MM-DD'
  // alwaysUnlocked: true — этап всегда доступен (для Этапа №0)
  const STAGE_SCHEDULE = {
    0: { unlockDate: '2024-01-01', alwaysUnlocked: true, label: 'Этап №0' },
    1: { unlockDate: '2026-06-19', alwaysUnlocked: false, label: 'Этап №1' },
    2: { unlockDate: '2026-06-26', alwaysUnlocked: false, label: 'Этап №2' },
    3: { unlockDate: '2026-07-03', alwaysUnlocked: false, label: 'Этап №3' },
    4: { unlockDate: '2026-07-10', alwaysUnlocked: false, label: 'Этап №4' },
    5: { unlockDate: '2026-07-17', alwaysUnlocked: false, label: 'Этап №5' },
    6: { unlockDate: '2026-07-31', alwaysUnlocked: false, label: 'Этап №6' },
    7: { unlockDate: '2026-08-07', alwaysUnlocked: false, label: 'Этап №7' },
    8: { unlockDate: '2026-08-14', alwaysUnlocked: false, label: 'Этап №8' },
    9: { unlockDate: '2026-08-21', alwaysUnlocked: false, label: 'Этап №9' },
  };

  // Смещение дат для тестирования (в днях).
  // Положительное — сдвиг в прошлое (разблокирует больше).
  // Отрицательное — сдвиг в будущее (блокирует больше).
  // Установите 0 в продакшене.
  const DATE_OFFSET_DAYS = 0;

  // ========================
  // Утилиты
  // ========================

  function parseDate(dateStr) {
    var parts = dateStr.split('-');
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
  }

  function getNowDate() {
    var now = new Date();
    now.setDate(now.getDate() - DATE_OFFSET_DAYS);
    now.setHours(0, 0, 0, 0);
    return now;
  }

  function formatDateRu(dateStr) {
    var d = parseDate(dateStr);
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function isStageUnlocked(stageNum) {
    var config = STAGE_SCHEDULE[stageNum];
    if (!config) return true;
    if (config.alwaysUnlocked) return true;
    return getNowDate() >= parseDate(config.unlockDate);
  }

  function getStageFromHref(href) {
    var match = (href || '').match(/etap(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  function getCurrentStage() {
    var match = window.location.pathname.match(/etap(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // ========================
  // Debug-режим
  // ========================

  var debugAllUnlocked = false;

  function initDebug() {
    var params = new URLSearchParams(window.location.search);
    var debugParam = params.get('debug-unlock');

    if (debugParam === 'all') {
      debugAllUnlocked = true;
      console.log('[StageUnlock] DEBUG: все этапы разблокированы');
    } else if (debugParam === 'none') {
      console.log('[StageUnlock] DEBUG: принудительная блокировка всех этапов');
    } else if (debugParam) {
      console.log('[StageUnlock] DEBUG-режим: параметр="' + debugParam + '"');
    }

    if (debugParam) {
      var badge = document.createElement('div');
      badge.className = 'stage-debug-badge';
      badge.textContent = debugParam === 'all'
        ? '[DEBUG] ALL UNLOCKED'
        : '[DEBUG] mode=' + debugParam;
      document.body.appendChild(badge);
    }
  }

  // ========================
  // Определение этапа навигационного элемента
  // ========================

  /**
   * Возвращает номер этапа, которому принадлежит navItem,
   * или null, если элемент не относится к конкретному этапу.
   *
   * Логика: собираем все уникальные номера этапов из ссылок элемента.
   * Если все ссылки относятся к одному этапу — это его navItem.
   * Если ссылки относятся к разным этапам — это родительский контейнер (не блокируем).
   */
  function detectStageForNavItem(navItem) {
    var links = navItem.querySelectorAll('a[href]');
    var stages = {};

    links.forEach(function (link) {
      var s = getStageFromHref(link.getAttribute('href'));
      if (s !== null) stages[s] = true;
    });

    var stageKeys = Object.keys(stages);
    if (stageKeys.length === 1) {
      return parseInt(stageKeys[0], 10);
    }
    return null; // смешанный контейнер (например, "Этапы" родитель)
  }

  // ========================
  // Блокировка навигации
  // ========================

  function lockNavigation() {
    var now = getNowDate();
    console.log('[StageUnlock] Дата:', now.toISOString().slice(0, 10), '(смещение:', DATE_OFFSET_DAYS, 'дней)');

    // Проверяем статус каждого этапа
    Object.keys(STAGE_SCHEDULE).forEach(function (key) {
      var cfg = STAGE_SCHEDULE[key];
      var unlocked = debugAllUnlocked || isStageUnlocked(parseInt(key, 10));
      console.log(
        '[StageUnlock]', cfg.label,
        unlocked ? '✅ открыт' : '🔒 до ' + formatDateRu(cfg.unlockDate)
      );
    });

    // Если всё разблокировано — выходим
    if (debugAllUnlocked) {
      console.log('[StageUnlock] Навигация: блокировка не нужна');
      return;
    }

    // Находим все вложенные элементы навигации
    var nestedItems = document.querySelectorAll('.md-nav__item--nested');

    nestedItems.forEach(function (navItem) {
      var stageNum = detectStageForNavItem(navItem);
      if (stageNum === null) return; // не этап, пропускаем

      if (isStageUnlocked(stageNum)) return; // этап уже открыт

      var config = STAGE_SCHEDULE[stageNum];
      if (!config) return;

      lockNavItem(navItem, stageNum, config);
    });
  }

  /** Применяет блокировку к navItem */
  function lockNavItem(liElement, stageNum, config) {
    if (liElement.classList.contains('stage-locked')) return;

    liElement.classList.add('stage-locked');
    liElement.setAttribute('data-stage-locked', String(stageNum));

    // Блокируем чекбокс-тоггл (раскрытие подменю)
    var toggle = liElement.querySelector(':scope > .md-nav__toggle');
    if (toggle) toggle.disabled = true;

    // Блокируем label (заголовок этапа)
    var label = liElement.querySelector(':scope > .md-nav__link');
    if (label) label.style.pointerEvents = 'none';

    // Блокируем все ссылки внутри
    var links = liElement.querySelectorAll('a');
    links.forEach(function (link) {
      link.style.pointerEvents = 'none';
    });

    // Добавляем бейдж с замком и датой
    var badge = document.createElement('div');
    badge.className = 'stage-lock-badge';
    badge.innerHTML =
      '<span class="lock-icon">🔒</span>' +
      '<span class="unlock-date">Откроется: ' + formatDateRu(config.unlockDate) + '</span>';

    if (label && label.parentNode) {
      label.parentNode.insertBefore(badge, label.nextSibling);
    }
  }

  // ========================
  // Блокировка текущей страницы
  // ========================

  function lockCurrentPage() {
    var currentStage = getCurrentStage();
    if (currentStage === null) return;

    if (debugAllUnlocked || isStageUnlocked(currentStage)) return;

    var config = STAGE_SCHEDULE[currentStage];
    if (!config) return;

    console.log('[StageUnlock] Страница заблокирована:', config.label);

    var overlay = document.createElement('div');
    overlay.className = 'stage-page-overlay';

    overlay.innerHTML =
      '<div class="stage-page-overlay__content">' +
        '<div class="stage-page-overlay__icon">🔒</div>' +
        '<div class="stage-page-overlay__title">' + config.label + ' пока недоступен</div>' +
        '<div class="stage-page-overlay__text">' +
          'Этот раздел откроется в ближайшее время. Следите за обновлениями!' +
        '</div>' +
        '<div class="stage-page-overlay__date">📅 ' + formatDateRu(config.unlockDate) + '</div>' +
        '<a href="/" class="stage-page-overlay__btn">← На главную</a>' +
        '<span class="stage-page-overlay__hint">Контент разблокируется автоматически по расписанию</span>' +
      '</div>';

    document.body.appendChild(overlay);
    document.title = '🔒 ' + config.label + ' — Скоро! | 18 ПОТОК';
  }

  // ========================
  // Инициализация
  // ========================

  function init() {
    // Удаляем старые оверлеи при SPA-навигации
    var oldOverlay = document.querySelector('.stage-page-overlay');
    if (oldOverlay) oldOverlay.remove();

    var oldBadges = document.querySelectorAll('.stage-lock-badge');
    oldBadges.forEach(function (b) { b.remove(); });

    var oldLocked = document.querySelectorAll('.stage-locked');
    oldLocked.forEach(function (el) {
      el.classList.remove('stage-locked');
      el.removeAttribute('data-stage-locked');
      var t = el.querySelector(':scope > .md-nav__toggle');
      if (t) t.disabled = false;
      var l = el.querySelector(':scope > .md-nav__link');
      if (l) l.style.pointerEvents = '';
      var links = el.querySelectorAll('a');
      links.forEach(function (a) { a.style.pointerEvents = ''; });
    });

    lockNavigation();
    lockCurrentPage();
  }

  // MkDocs Material SPA
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(init);
  }

  // Обычная загрузка
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
