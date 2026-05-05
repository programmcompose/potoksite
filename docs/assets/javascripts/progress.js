/* ========================================
   Progress Tracker — Отслеживание прогресса обучения
   Статический JS для GitHub Pages (LocalStorage)
   ======================================== */

(function () {
  'use strict';

  // ========================
  // КОНСТАНТЫ
  // ========================
  var STORAGE_KEY = 'potok_progress_v1';
  var COURSE_KEY = '18potok';

  // ========================
  // LocalStorage (с fallback)
  // ========================

  function loadProgress() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (!data) return {};
      var parsed = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      console.warn('[PotokProgress] Ошибка чтения LocalStorage:', e);
      return {};
    }
  }

  function saveProgress(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[PotokProgress] Ошибка записи LocalStorage:', e);
    }
  }

  function getCourseProgress() {
    var all = loadProgress();
    return all[COURSE_KEY] || {};
  }

  function setLessonDone(lessonId, done) {
    var all = loadProgress();
    if (!all[COURSE_KEY]) all[COURSE_KEY] = {};
    all[COURSE_KEY][lessonId] = done;
    saveProgress(all);
  }

  // ========================
  // Прогресс-бар в сайдбаре
  // ========================

  var progressBarEl = null;

  function createProgressBar() {
    // Удаляем старый бар при SPA-навигации
    var old = document.querySelector('.potok-progress-bar');
    if (old) old.remove();

    var sidebar = document.querySelector('.md-sidebar--primary');
    if (!sidebar) {
      console.warn('[PotokProgress] Сайдбар не найден');
      return;
    }

    // Находим навигационный список для вставки после него
    var nav = sidebar.querySelector('.md-nav--primary');

    var bar = document.createElement('div');
    bar.className = 'potok-progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Прогресс обучения');

    var courseLessons = getAllLessonIds();
    var doneCount = countDoneLessons(courseLessons);
    var totalCount = courseLessons.length;
    var percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    bar.setAttribute('aria-valuenow', String(percent));
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');

    bar.innerHTML =
      '<div class="potok-progress-bar__header">' +
        '<span class="potok-progress-bar__title">📊 Прогресс</span>' +
        '<span class="potok-progress-bar__stat">' + doneCount + ' / ' + totalCount + '</span>' +
      '</div>' +
      '<div class="potok-progress-bar__track">' +
        '<div class="potok-progress-bar__fill" style="width:' + percent + '%"></div>' +
      '</div>' +
      '<div class="potok-progress-bar__percent">' + percent + '%</div>' +
      '<button class="potok-progress-reset" type="button" aria-label="Сбросить весь прогресс">🔄 Сброс</button>';

    bar.querySelector('.potok-progress-reset').addEventListener('click', handleReset);

    if (nav) {
      nav.parentNode.insertBefore(bar, nav.nextSibling);
    } else {
      sidebar.appendChild(bar);
    }

    progressBarEl = bar;
  }

  function updateProgressBar() {
    if (!progressBarEl) return;

    var courseLessons = getAllLessonIds();
    var doneCount = countDoneLessons(courseLessons);
    var totalCount = courseLessons.length;
    var percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    progressBarEl.setAttribute('aria-valuenow', String(percent));

    var statEl = progressBarEl.querySelector('.potok-progress-bar__stat');
    if (statEl) statEl.textContent = doneCount + ' / ' + totalCount;

    var fillEl = progressBarEl.querySelector('.potok-progress-bar__fill');
    if (fillEl) fillEl.style.width = percent + '%';

    var percentEl = progressBarEl.querySelector('.potok-progress-bar__percent');
    if (percentEl) percentEl.textContent = percent + '%';

    // Показываем toast при 100%
    if (percent === 100 && totalCount > 0) {
      showToast('🎉 Курс пройден!');
    }
  }

  // ========================
  // Чекбоксы уроков
  // ========================

  function getAllLessonIds() {
    var checkboxes = document.querySelectorAll('input.potok-lesson');
    var ids = [];
    checkboxes.forEach(function (cb) {
      var id = cb.getAttribute('data-lesson');
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
    return ids;
  }

  function countDoneLessons(lessonIds) {
    var progress = getCourseProgress();
    var count = 0;
    lessonIds.forEach(function (id) {
      if (progress[id]) count++;
    });
    return count;
  }

  function restoreCheckboxes() {
    var progress = getCourseProgress();
    var checkboxes = document.querySelectorAll('input.potok-lesson');

    checkboxes.forEach(function (cb) {
      var lessonId = cb.getAttribute('data-lesson');
      if (!lessonId) return;

      // Восстанавливаем состояние из LocalStorage
      if (progress[lessonId]) {
        cb.checked = true;
      } else {
        cb.checked = false;
      }

      // Обновляем стиль лейбла
      updateLabelStyle(cb);

      // Слушаем изменения
      cb.addEventListener('change', function () {
        var isChecked = cb.checked;
        setLessonDone(lessonId, isChecked);
        updateLabelStyle(cb);
        updateProgressBar();

        if (isChecked) {
          showToast('✅ Урок отмечен!');
        }
      });
    });
  }

  function updateLabelStyle(checkbox) {
    var wrapper = checkbox.closest('.potok-lesson-wrapper');
    if (!wrapper) return;
    var label = wrapper.querySelector('.potok-lesson-label');
    if (!label) return;

    if (checkbox.checked) {
      label.classList.add('done');
    } else {
      label.classList.remove('done');
    }
  }

  // ========================
  // Сброс прогресса
  // ========================

  function handleReset() {
    if (!confirm('Сбросить весь прогресс обучения? Это действие нельзя отменить.')) return;

    var all = loadProgress();
    delete all[COURSE_KEY];
    saveProgress(all);

    // Снимаем все чекбоксы
    var checkboxes = document.querySelectorAll('input.potok-lesson');
    checkboxes.forEach(function (cb) {
      cb.checked = false;
      updateLabelStyle(cb);
    });

    updateProgressBar();
    showToast('🔄 Прогресс сброшен');
  }

  // ========================
  // Toast-уведомления
  // ========================

  var toastEl = null;
  var toastTimeout = null;

  function showToast(message) {
    // Удаляем старый toast
    if (toastEl) {
      toastEl.remove();
      toastEl = null;
    }
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }

    var toast = document.createElement('div');
    toast.className = 'potok-toast';
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
    toastEl = toast;

    // Показ
    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    // Скрытие через 2 сек
    toastTimeout = setTimeout(function () {
      toast.classList.remove('show');
      toastTimeout = setTimeout(function () {
        if (toast.parentNode) toast.remove();
        toastEl = null;
      }, 300);
    }, 2000);
  }

  // ========================
  // Инициализация
  // ========================

  function init() {
    createProgressBar();
    restoreCheckboxes();
    updateProgressBar();
  }

  // MkDocs Material SPA-навигация
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(init);
  }

  // Обычная загрузка страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
