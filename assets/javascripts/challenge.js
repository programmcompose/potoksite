/* ========================================
   Micro-challenges — localStorage + optional XP
   18 ПОТОК
   ======================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'potok_challenges';

  function loadDone() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveDone(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('[Challenge] save failed', e);
    }
  }

  function awardXP(amount, reason) {
    // Подключение к вашей геймификации, если она экспортирует API
    if (window.PotokGamification && typeof window.PotokGamification.addXP === 'function') {
      window.PotokGamification.addXP(amount, reason);
      return;
    }
    // Fallback: событие, которое gamification.js может слушать
    try {
      document.dispatchEvent(
        new CustomEvent('potok:challenge-done', {
          detail: { amount: amount || 15, reason: reason || 'challenge' },
        })
      );
    } catch (e) { /* ignore */ }
  }

  function markDone(el, doneMap, id) {
    el.classList.add('is-done');
    var btn = el.querySelector('[data-challenge-toggle]');
    if (btn) {
      btn.classList.add('potok-challenge__btn--done');
      btn.textContent = btn.getAttribute('data-done-label') || 'Сделано';
      btn.setAttribute('aria-pressed', 'true');
    }
    var meta = el.querySelector('[data-challenge-meta]');
    if (meta && doneMap[id]) {
      var d = new Date(doneMap[id]);
      meta.textContent = 'Отмечено ' + d.toLocaleDateString('ru-RU');
    }
  }

  function markUndone(el) {
    el.classList.remove('is-done');
    var btn = el.querySelector('[data-challenge-toggle]');
    if (btn) {
      btn.classList.remove('potok-challenge__btn--done');
      btn.textContent = btn.getAttribute('data-todo-label') || 'Отметить выполненным';
      btn.setAttribute('aria-pressed', 'false');
    }
    var meta = el.querySelector('[data-challenge-meta]');
    if (meta) meta.textContent = '';
  }

  function initOne(el) {
    var id = el.getAttribute('data-challenge-id');
    if (!id) {
      // генерируем id из заголовка + pathname
      var title = (el.querySelector('.potok-challenge__title') || {}).textContent || 'challenge';
      id = (location.pathname + '::' + title).slice(0, 120);
      el.setAttribute('data-challenge-id', id);
    }

    var doneMap = loadDone();
    if (doneMap[id]) markDone(el, doneMap, id);

    var btn = el.querySelector('[data-challenge-toggle]');
    if (!btn) return;

    btn.addEventListener('click', function () {
      doneMap = loadDone();
      if (doneMap[id]) {
        delete doneMap[id];
        saveDone(doneMap);
        markUndone(el);
      } else {
        doneMap[id] = Date.now();
        saveDone(doneMap);
        markDone(el, doneMap, id);
        var xp = parseInt(el.getAttribute('data-xp') || '15', 10);
        awardXP(xp, 'challenge_' + id);
      }
    });
  }

  function initAll() {
    document.querySelectorAll('.potok-challenge').forEach(initOne);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Material instant navigation
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(initAll);
  }
})();
