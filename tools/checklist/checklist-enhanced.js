/**
 * checklist-enhanced.js
 * Улучшения геймификации для страницы чеклиста музыкального курса.
 * Подключается после основного скрипта, не ломает существующую логику.
 *
 * Отключение: window.DISABLE_ENHANCEMENTS = true (до подключения скрипта)
 */
(function () {
  'use strict';

  // ============================================================
  //  ГЛОБАЛЬНЫЙ ФЛАГ ОТКЛЮЧЕНИЯ
  // ============================================================
  if (typeof window.DISABLE_ENHANCEMENTS !== 'undefined' && window.DISABLE_ENHANCEMENTS) {
    return;
  }

  // ============================================================
  //  КОНСТАНТЫ
  // ============================================================
  var NS = 'cl-enhanced';
  var STORAGE_PREFIX = 'potok_cl_';
  var SOUND_KEY = NS + '_sound_on';
  var GUIDE_KEY = NS + '_guide_seen';

  // ============================================================
  //  КАРТА КЛЮЧЕВЫХ СЛОВ → ЭМОДЗИ
  // ============================================================
  var KEYWORD_ICONS = [
    { keywords: ['чат', 'telegram', 'discord'], icon: '💬' },
    { keywords: ['программ', 'daw', 'плагины'], icon: '💻' },
    { keywords: ['бит', 'трек', 'мелодию'], icon: '🥁' },
    { keywords: ['свести', 'рендер', 'wav', 'mp3'], icon: '🎚️' },
    { keywords: ['bpm', 'тональность', 'темпом'], icon: '🎵' },
    { keywords: ['эквалайзер', 'eq'], icon: '🎛️' },
    { keywords: ['компресс', 'компрессия'], icon: '🗜️' },
    { keywords: ['reverb', 'delay', 'эффекты'], icon: '🌊' }
  ];
  var DEFAULT_ICON = '✨';



  // ============================================================
  //  УТИЛИТЫ LOCALSTORAGE
  // ============================================================
  function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) !== null ? JSON.parse(localStorage.getItem(key)) : fallback; }
    catch { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }



  // ============================================================
  //  ИНЪЕКЦИЯ CSS
  // ============================================================
  function injectCSS() {
    var style = document.createElement('style');
    style.setAttribute('data-enhanced', 'true');
    style.textContent =
      /* ---- Иконки пунктов ---- */
      '.' + NS + '-icon {' +
      '  display: inline-block;' +
      '  margin-right: 8px;' +
      '  font-size: 1.1em;' +
      '  flex-shrink: 0;' +
      '  width: 1.4em;' +
      '  text-align: center;' +
      '}' +

      /* ---- Анимация выполнения ---- */
      '@keyframes ' + NS + '-glow {' +
      '  0%   { box-shadow: 0 0 0 0 rgba(255,215,0,0); }' +
      '  50%  { box-shadow: 0 0 24px 4px rgba(255,215,0,0.45); }' +
      '  100% { box-shadow: 0 0 0 0 rgba(255,215,0,0); }' +
      '}' +
      '@keyframes ' + NS + '-pulse {' +
      '  0%   { transform: scale(1); }' +
      '  50%  { transform: scale(1.02); }' +
      '  100% { transform: scale(1); }' +
      '}' +
      '.' + NS + '-animate-check {' +
      '  animation: ' + NS + '-glow 0.6s ease, ' + NS + '-pulse 0.4s ease;' +
      '}' +

      /* ---- Зачёркивание (усиление существующего) ---- */
      '.' + NS + '-strikethrough .item-text {' +
      '  text-decoration: line-through;' +
      '  transition: all 0.3s ease;' +
      '  opacity: 0.6;' +
      '}' +

      /* ---- Улучшенный прогресс-бар уровня ---- */
      '.' + NS + '-level-upgrade .level-track {' +
      '  height: 10px;' +
      '  background: rgba(255,255,255,0.1);' +
      '  border-radius: 5px;' +
      '}' +
      '.' + NS + '-level-upgrade .level-fill {' +
      '  background: linear-gradient(90deg, #5D4037, #3E2723);' +
      '  border-radius: 5px;' +
      '  transition: width 0.5s ease;' +
      '}' +
      '.' + NS + '-level-upgrade .level-bar-label {' +
      '  font-size: 0.8em;' +
      '  font-weight: 700;' +
      '}' +
      '.' + NS + '-level-upgrade #level-current {' +
      '  color: #5D4037;' +
      '}' +
      '.' + NS + '-level-upgrade #level-next-label {' +
      '  color: #4e342e;' +
      '}' +

      /* ---- XP текст поверх бара ---- */
      '.' + NS + '-xp-overlay {' +
      '  position: absolute;' +
      '  top: 0; left: 0; right: 0; bottom: 0;' +
      '  display: flex;' +
      '  align-items: center;' +
      '  justify-content: center;' +
      '  font-size: 0.65em;' +
      '  font-weight: 900;' +
      '  color: #5D4037;' +
      '  text-shadow: 0 1px 4px rgba(255,255,255,0.5);' +
      '  pointer-events: none;' +
      '  opacity: 0;' +
      '  transition: opacity 0.3s;' +
      '}' +
      '.' + NS + '-xp-overlay.show {' +
      '  opacity: 1;' +
      '}' +

      /* ---- Всплеск при повышении уровня ---- */
      '@keyframes ' + NS + '-levelup {' +
      '  0%   { box-shadow: 0 0 0 0 rgba(255,193,7,0); }' +
      '  40%  { box-shadow: 0 0 40px 10px rgba(255,193,7,0.5); }' +
      '  100% { box-shadow: 0 0 0 0 rgba(255,193,7,0); }' +
      '}' +
      '.' + NS + '-levelup-burst {' +
      '  animation: ' + NS + '-levelup 0.8s ease;' +
      '}' +

      /* ---- Тултипы ---- */
      '.' + NS + '-tooltip {' +
      '  position: absolute;' +
      '  bottom: calc(100% + 10px);' +
      '  left: 50%;' +
      '  transform: translateX(-50%);' +
      '  background: #2d2d2d;' +
      '  color: #fff;' +
      '  padding: 8px 12px;' +
      '  border-radius: 8px;' +
      '  font-size: 0.78em;' +
      '  white-space: nowrap;' +
      '  box-shadow: 0 4px 16px rgba(0,0,0,0.5);' +
      '  z-index: 1000;' +
      '  opacity: 0;' +
      '  pointer-events: none;' +
      '  transition: opacity 0.2s ease;' +
      '}' +
      '.' + NS + '-tooltip::after {' +
      '  content: \'\';' +
      '  position: absolute;' +
      '  top: 100%;' +
      '  left: 50%;' +
      '  transform: translateX(-50%);' +
      '  border: 6px solid transparent;' +
      '  border-top-color: #2d2d2d;' +
      '}' +
      '.' + NS + '-tooltip.show {' +
      '  opacity: 1;' +
      '}' +

      /* ---- Заблокированные пункты ---- */
      '.' + NS + '-locked {' +
      '  opacity: 0.45;' +
      '  pointer-events: none;' +
      '  position: relative;' +
      '}' +

      /* ---- Переключатель звуков ---- */
      '.' + NS + '-sound-toggle {' +
      '  position: fixed;' +
      '  top: 12px;' +
      '  right: 12px;' +
      '  background: rgba(54,54,54,0.9);' +
      '  border: 1px solid #404040;' +
      '  border-radius: 8px;' +
      '  padding: 6px 12px;' +
      '  color: #FDFBDF;' +
      '  font-size: 0.8em;' +
      '  cursor: pointer;' +
      '  z-index: 9999;' +
      '  font-family: inherit;' +
      '  transition: all 0.2s;' +
      '}' +
      '.' + NS + '-sound-toggle:hover {' +
      '  border-color: #00bcd4;' +
      '}' +
      '.' + NS + '-sound-toggle.muted {' +
      '  opacity: 0.4;' +
      '}' +

      /* ---- Конфетти-частицы ---- */
      '.' + NS + '-confetti-piece {' +
      '  position: fixed;' +
      '  width: 8px;' +
      '  height: 8px;' +
      '  border-radius: 2px;' +
      '  pointer-events: none;' +
      '  z-index: 10000;' +
      '  animation: ' + NS + '-confettiFall 1.2s ease-out forwards;' +
      '}' +
      '@keyframes ' + NS + '-confettiFall {' +
      '  0%   { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }' +
      '  100% { opacity: 0; transform: translateY(120px) rotate(360deg) scale(0.3); }' +
      '}' +

      /* ---- Тултип-гайд первого посещения ---- */
      '.' + NS + '-guide-overlay {' +
      '  position: fixed;' +
      '  inset: 0;' +
      '  background: rgba(0,0,0,0.6);' +
      '  z-index: 10000;' +
      '  display: flex;' +
      '  align-items: center;' +
      '  justify-content: center;' +
      '  opacity: 0;' +
      '  transition: opacity 0.3s;' +
      '  pointer-events: none;' +
      '}' +
      '.' + NS + '-guide-overlay.show {' +
      '  opacity: 1;' +
      '  pointer-events: auto;' +
      '}' +
      '.' + NS + '-guide-box {' +
      '  background: #363636;' +
      '  border: 1px solid #404040;' +
      '  border-radius: 16px;' +
      '  padding: 28px;' +
      '  max-width: 380px;' +
      '  width: 90%;' +
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.5);' +
      '  text-align: center;' +
      '}' +
      '.' + NS + '-guide-box h3 {' +
      '  margin-bottom: 12px;' +
      '  font-size: 1.1em;' +
      '}' +
      '.' + NS + '-guide-box p {' +
      '  font-size: 0.85em;' +
      '  opacity: 0.7;' +
      '  line-height: 1.5;' +
      '  margin-bottom: 8px;' +
      '}' +
      '.' + NS + '-guide-close {' +
      '  margin-top: 16px;' +
      '  padding: 8px 24px;' +
      '  background: #00bcd4;' +
      '  border: none;' +
      '  border-radius: 8px;' +
      '  color: #fff;' +
      '  font-weight: 700;' +
      '  cursor: pointer;' +
      '  font-family: inherit;' +
      '  font-size: 0.9em;' +
      '}' +

      /* ---- Адаптив ---- */
      '@media (max-width: 600px) {' +
      '  .' + NS + '-sound-toggle { top: auto; bottom: 12px; right: 12px; font-size: 1.2em; padding: 8px 14px; }' +
      '  .' + NS + '-guide-box { padding: 20px; }' +
      '}';
    document.head.appendChild(style);
  }

  // ============================================================
  //  1. ВИЗУАЛЬНЫЕ ИКОНКИ К ПУНКТАМ
  // ============================================================
  function matchIcon(text) {
    var lower = text.toLowerCase();
    for (var i = 0; i < KEYWORD_ICONS.length; i++) {
      var rule = KEYWORD_ICONS[i];
      for (var j = 0; j < rule.keywords.length; j++) {
        if (lower.indexOf(rule.keywords[j]) !== -1) {
          return rule.icon;
        }
      }
    }
    return DEFAULT_ICON;
  }

  function addIcons() {
    var items = document.querySelectorAll('.checklist-item');
    items.forEach(function (item) {
      // Не дублируем, если иконка уже добавлена
      if (item.querySelector('.' + NS + '-icon')) return;

      var textEl = item.querySelector('.item-text');
      if (!textEl) return;

      var fullText = textEl.textContent || textEl.innerText || '';
      var icon = matchIcon(fullText);

      var iconSpan = document.createElement('span');
      iconSpan.className = NS + '-icon';
      iconSpan.textContent = icon;

      // Вставляем иконку перед текстом внутри item-content
      var content = item.querySelector('.item-content');
      if (content) {
        content.insertBefore(iconSpan, textEl);
      }
    });
  }

  // ============================================================
  //  2. АНИМАЦИЯ ПРИ ВЫПОЛНЕНИИ
  // ============================================================
  function setupAnimations() {
    // Перехватываем клики через делегирование на body
    // (работает поверх существующих обработчиков)
    document.addEventListener('click', function (e) {
      var item = e.target.closest('.checklist-item');
      if (!item) return;

      var wasChecked = item.classList.contains('checked');

      // Ждём, пока основной скрипт обновит состояние
      setTimeout(function () {
        var isChecked = item.classList.contains('checked');
        if (isChecked && !wasChecked) {
          // Добавляем анимацию
          item.classList.add(NS + '-animate-check');
          item.classList.add(NS + '-strikethrough');

          playSound('click');

          // Удаляем класс анимации после завершения
          setTimeout(function () {
            item.classList.remove(NS + '-animate-check');
          }, 700);
        } else if (!isChecked) {
          item.classList.remove(NS + '-strikethrough');
        }
      }, 50);
    }, true); // capture phase — сработает до основного обработчика

    // Анимация для уже выполненных пунктов при загрузке
    setTimeout(function () {
      var checkedItems = document.querySelectorAll('.checklist-item.checked');
      checkedItems.forEach(function (item) {
        item.classList.add(NS + '-strikethrough');
      });
    }, 100);
  }

  // ============================================================
  //  3. ПРОГРЕСС УРОВНЯ С ВИЗУАЛИЗАЦИЕЙ
  // ============================================================
  function upgradeProgressBar() {
    var scoreCard = document.querySelector('.score-card');
    if (!scoreCard) return;
    scoreCard.classList.add(NS + '-level-upgrade');

    // Делаем level-track position: relative для overlay
    var track = document.getElementById('level-fill');
    if (track) {
      track.parentElement.style.position = 'relative';

      // Добавляем XP-overlay
      var overlay = document.createElement('div');
      overlay.className = NS + '-xp-overlay';
      overlay.id = NS + '-xp-overlay';
      track.parentElement.appendChild(overlay);

      // Обновляем overlay при каждом изменении счёта
      // Используем MutationObserver для отслеживания изменений
      var scoreEl = document.getElementById('score-value');
      if (scoreEl) {
        var observer = new MutationObserver(function () {
          updateXpOverlay();
        });
        observer.observe(scoreEl, { childList: true, characterData: false, subtree: false });
      }

      // Периодическое обновление
      setInterval(updateXpOverlay, 500);
    }
  }

  function updateXpOverlay() {
    var overlay = document.getElementById(NS + '-xp-overlay');
    if (!overlay) return;

    var scoreEl = document.getElementById('score-value');
    if (!scoreEl) return;

    var score = parseInt(scoreEl.textContent) || 0;

    // Находим текущий и следующий ранг
    var ranks = window.potokRanks || [];
    if (ranks.length === 0) {
      // Пытаемся получить из существующего кода через вычисление
      // Используем встроенные значения (дублируем для самодостаточности)
      ranks = [
        { name: 'Новичок', min: 0 },
        { name: 'Ученик', min: 100 },
        { name: 'Практикант', min: 250 },
        { name: 'Продюсер', min: 400 },
        { name: 'Миксер', min: 600 },
        { name: 'Мастер', min: 800 },
        { name: 'Легенда потока', min: 1000 }
      ];
    }

    var currentRank = ranks[0];
    var nextRank = null;
    for (var i = ranks.length - 1; i >= 0; i--) {
      if (score >= ranks[i].min) {
        currentRank = ranks[i];
        break;
      }
    }
    for (var i = 0; i < ranks.length; i++) {
      if (score < ranks[i].min) {
        nextRank = ranks[i];
        break;
      }
    }

    if (nextRank) {
      var inLevel = score - currentRank.min;
      var needed = nextRank.min - currentRank.min;
      overlay.textContent = inLevel + ' / ' + needed + ' XP';
      overlay.classList.add('show');
    } else {
      overlay.textContent = 'MAX LEVEL';
      overlay.classList.add('show');
    }
  }

  // ============================================================
  //  4. ВСПЛЫВАЮЩИЕ ПОДСКАЗКИ ДЛЯ ЗАПЕРТЫХ ПУНКТОВ
  // ============================================================
  function setupTooltips() {
    // Определяем зависимости между пунктами внутри каждой вкладки
    // Пункт заблокирован, если предыдущий в той же вкладке не выполнен
    var panels = document.querySelectorAll('.checklist-panel');

    panels.forEach(function (panel) {
      var tab = panel.id.replace('panel-', '');
      var state = loadTabState(tab);
      var items = panel.querySelectorAll('.checklist-item');

      items.forEach(function (item, idx) {
        if (idx === 0) return; // Первый пункт всегда доступен

        var prevItem = items[idx - 1];
        var prevId = prevItem.getAttribute('data-id');

        if (!state[prevId]) {
          // Пункт заблокирован — добавляем тултип
          item.classList.add(NS + '-locked');

          var prevText = prevItem.querySelector('.item-text');
          var prevName = prevText ? prevText.textContent : 'предыдущий пункт';

          var tooltip = document.createElement('div');
          tooltip.className = NS + '-tooltip';
          tooltip.textContent = '🔒 Выполните «' + prevName + '», чтобы разблокировать';
          item.appendChild(tooltip);

          // Навешиваем события для тултипа
          setupTooltipEvents(item, tooltip);
        }
      });
    });
  }

  function setupTooltipEvents(item, tooltip) {
    var timer = null;

    // Desktop: hover
    item.addEventListener('mouseenter', function () {
      tooltip.classList.add('show');
    });
    item.addEventListener('mouseleave', function () {
      tooltip.classList.remove('show');
    });

    // Mobile: tap with delay
    item.addEventListener('touchstart', function (e) {
      timer = setTimeout(function () {
        tooltip.classList.add('show');
      }, 500);
    }, { passive: true });

    item.addEventListener('touchend', function () {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      // Скрываем через 1.5s
      setTimeout(function () {
        tooltip.classList.remove('show');
      }, 1500);
    }, { passive: true });
  }

  function loadTabState(tab) {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PREFIX + tab)) || {};
    } catch {
      return {};
    }
  }

  // Обновляем тултипы при изменении чекбоксов
  function refreshTooltips() {
    // Удаляем старые заблокированные состояния
    var lockedItems = document.querySelectorAll('.' + NS + '-locked');
    lockedItems.forEach(function (item) {
      var tooltip = item.querySelector('.' + NS + '-tooltip');
      if (tooltip) tooltip.remove();
      item.classList.remove(NS + '-locked');
    });

    // Перестраиваем
    var panels = document.querySelectorAll('.checklist-panel');
    panels.forEach(function (panel) {
      var tab = panel.id.replace('panel-', '');
      var state = loadTabState(tab);
      var items = panel.querySelectorAll('.checklist-item');

      items.forEach(function (item, idx) {
        if (idx === 0) return;

        var prevItem = items[idx - 1];
        var prevId = prevItem.getAttribute('data-id');

        if (!state[prevId]) {
          item.classList.add(NS + '-locked');

          var prevText = prevItem.querySelector('.item-text');
          var prevName = prevText ? prevText.textContent : 'предыдущий пункт';

          var tooltip = document.createElement('div');
          tooltip.className = NS + '-tooltip';
          tooltip.textContent = '🔒 Выполните «' + prevName + '», чтобы разблокировать';
          item.appendChild(tooltip);

          setupTooltipEvents(item, tooltip);
        }
      });
    });
  }

  // Периодически обновляем тултипы
  setInterval(refreshTooltips, 1000);

  // ---- Конфетти (CSS-частицы, без canvas) ----
  function spawnConfetti() {
    var colors = ['#ffd740', '#ff7043', '#66bb6a', '#4facfe', '#ab47bc', '#00f2fe'];
    var count = 30;

    for (var i = 0; i < count; i++) {
      var piece = document.createElement('div');
      piece.className = NS + '-confetti-piece';
      piece.style.left = (Math.random() * window.innerWidth) + 'px';
      piece.style.top = (Math.random() * window.innerHeight * 0.5) + 'px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      piece.style.animationDuration = (0.8 + Math.random() * 0.6) + 's';
      document.body.appendChild(piece);
      setTimeout(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }(piece), 2000);
    }
  }

  // ============================================================
  //  6. ЗВУКОВЫЕ ЭФФЕКТЫ
  // ============================================================
  var audioCtx = null;
  var soundEnabled = false;

  function initAudio() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      // Web Audio не поддерживается
    }
  }

  function playSound(type) {
    if (!soundEnabled || !audioCtx) return;

    // Восстанавливаем контекст если он был приостановлен
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    var now = audioCtx.currentTime;

    if (type === 'click') {
      // Короткий клик — 200ms, 800Hz
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
    else if (type === 'levelup') {
      // Фанфары — восходящая мелодия
      [392, 440, 523.25, 659.25, 783.99].forEach(function (freq, idx) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        var t = now + idx * 0.1;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    }
  }

  function setupSoundToggle() {
    soundEnabled = lsGet(SOUND_KEY, false);

    var btn = document.createElement('button');
    btn.className = NS + '-sound-toggle' + (soundEnabled ? '' : ' muted');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    btn.title = 'Включить/выключить звуки';
    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
      soundEnabled = !soundEnabled;
      lsSet(SOUND_KEY, soundEnabled);
      btn.textContent = soundEnabled ? '🔊' : '🔇';
      btn.classList.toggle('muted', !soundEnabled);

      // Инициализируем AudioContext при первом включении
      if (soundEnabled && !audioCtx) {
        initAudio();
      }
      if (soundEnabled && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    });
  }

  // ============================================================
  //  БОНУС: Тултип-гайд первого посещения
  // ============================================================
  function showFirstVisitGuide() {
    if (lsGet(GUIDE_KEY, false)) return;

    setTimeout(function () {
      var overlay = document.createElement('div');
      overlay.className = NS + '-guide-overlay';

      var box = document.createElement('div');
      box.className = NS + '-guide-box';

      box.innerHTML =
        '<h3>🎮 Как работает геймификация</h3>' +
        '<p>Отмечай пункты чеклистов и получай <b>XP</b>. Набрал достаточно — повысил <b>уровень</b>!</p>' +
        '<p>🔊 Включи звуки в правом верхнем углу для полного погружения.</p>' +
        '<button class="' + NS + '-guide-close">Понятно!</button>';

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Fade in
      requestAnimationFrame(function () {
        overlay.classList.add('show');
      });

      var closeBtn = box.querySelector('.' + NS + '-guide-close');
      closeBtn.addEventListener('click', function () {
        overlay.classList.remove('show');
        setTimeout(function () {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 350);
        lsSet(GUIDE_KEY, true);
      });

      // Закрытие по клику на оверлей
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          closeBtn.click();
        }
      });
    }, 1500);
  }

  // ============================================================
  //  БОНУС: Плавный скролл к новому разблокированному пункту
  // ============================================================
  var lastUnlockedItem = null;
  function trackLastUnlocked() {
    document.addEventListener('click', function (e) {
      var item = e.target.closest('.checklist-item');
      if (!item) return;

      setTimeout(function () {
        if (item.classList.contains('checked')) {
          lastUnlockedItem = item;
        }
      }, 100);
    }, true);
  }

  // ============================================================
  //  ОБНАРУЖЕНИЕ ПОВЫШЕНИЯ УРОВНЯ
  // ============================================================
  var lastRankIndex = -1;
  function checkLevelUp() {
    var scoreEl = document.getElementById('score-value');
    if (!scoreEl) return;

    var score = parseInt(scoreEl.textContent) || 0;
    var rankEls = document.getElementById('score-rank');
    if (!rankEls) return;

    var ranks = [
      { name: 'Новичок', min: 0 },
      { name: 'Ученик', min: 100 },
      { name: 'Практикант', min: 250 },
      { name: 'Продюсер', min: 400 },
      { name: 'Миксер', min: 600 },
      { name: 'Мастер', min: 800 },
      { name: 'Легенда потока', min: 1000 }
    ];

    var currentRankIdx = 0;
    for (var i = ranks.length - 1; i >= 0; i--) {
      if (score >= ranks[i].min) {
        currentRankIdx = i;
        break;
      }
    }

    if (currentRankIdx > lastRankIndex && lastRankIndex >= 0) {
      // Уровень повышен!
      var scoreCard = document.querySelector('.score-card');
      if (scoreCard) {
        scoreCard.classList.add(NS + '-levelup-burst');
        setTimeout(function () {
          scoreCard.classList.remove(NS + '-levelup-burst');
        }, 1000);
      }

      playSound('levelup');
      spawnConfetti();
    }

    if (currentRankIdx > lastRankIndex) {
      lastRankIndex = currentRankIdx;
    }
  }
  setInterval(checkLevelUp, 300);

  // ============================================================
  //  ИНИЦИАЛИЗАЦИЯ
  // ============================================================
  function initEnhancements() {
    // 1. Инъекция стилей
    injectCSS();

    // 2. Иконки к пунктам
    addIcons();

    // 3. Анимации при выполнении
    setupAnimations();

    // 4. Улучшенный прогресс-бар уровня
    upgradeProgressBar();

    // 5. Тултипы для заблокированных пунктов
    setupTooltips();

    // 6. Звуки
    setupSoundToggle();

    // 7. Гайд первого посещения
    showFirstVisitGuide();

    // 8. Трекинг последнего разблокированного
    trackLastUnlocked();

    // 10. Инициализируем AudioContext при первом взаимодействии
    document.addEventListener('click', function initAudioOnce() {
      initAudio();
      document.removeEventListener('click', initAudioOnce);
    }, { once: true });

    console.log('[checklist-enhanced] Все улучшения инициализированы ✓');
  }

  // Экспортируем функцию для ручного вызова
  window.initEnhancements = initEnhancements;

  // Автоматическая инициализация после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Небольшая задержка, чтобы основной скрипт успел отработать
      setTimeout(initEnhancements, 200);
    });
  } else {
    setTimeout(initEnhancements, 200);
  }
})();
