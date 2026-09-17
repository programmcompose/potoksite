/* ========================================
   Potok Compressor — слепой тест A/B
   Один звук сухой, второй с компрессией.
   Слушатель угадывает, какой без эффекта.
   Без визуализации: ни волны, ни GR, ни кривой.
   ======================================== */

(function () {
  'use strict';

  // Радикальные настройки для заметного, но не карикатурного эффекта
  var RADICAL = { threshold: -20, ratio: 8, attack: 5, release: 120, makeup: 6, knee: 3, mix: 100 };
  var CROSSFADE_SEC = 0.01;
  var LOOP_STEPS = 32; // 2 такта по 16 шагов — точка входа квантуется по шагам

  function BlindTest(root) {
    this.root = root;
    this.ctx = null;
    this.master = null;
    this.dryBuf = null;
    this.wetBuf = null;
    this.src = null;
    this.gainNode = null;
    this.playingSlot = -1;
    this.round = 0;
    this.correctCount = 0;
    this.totalCount = 0;
    this.drySlot = 0;
    this.offset = 0;
    this.answered = false;
  }

  BlindTest.prototype.start = function () {
    this.buildDom();
    this.bindEvents();
    this.newRound();
  };

  BlindTest.prototype.buildDom = function () {
    var root = this.root;
    root.classList.add('cbt');
    root.innerHTML = '' +
      '<div class="cbt-head">' +
        '<span class="cbt-round">Раунд <b>1</b></span>' +
        '<span class="cbt-score"><i data-lucide="target" class="cbt-ic"></i><span class="cbt-score-val">0 / 0</span></span>' +
      '</div>' +
      '<p class="cbt-task">Один из звуков — <b>без компрессии</b>, второй сжат. Послушай оба и выбери, какой звучит без эффекта.</p>' +
      '<div class="cbt-pads">' +
        padHtml(0) +
        padHtml(1) +
      '</div>' +
      '<div class="cbt-guess">' +
        '<button type="button" class="cbt-answer" data-slot="0"><i data-lucide="ear" class="cbt-ic"></i>Звук 1 — без компрессии</button>' +
        '<button type="button" class="cbt-answer" data-slot="1"><i data-lucide="ear" class="cbt-ic"></i>Звук 2 — без компрессии</button>' +
      '</div>' +
      '<div class="cbt-result" hidden>' +
        '<span class="cbt-result-msg"></span>' +
        '<button type="button" class="cbt-next">Следующий раунд →</button>' +
      '</div>';

    function padHtml(slot) {
      return '<button type="button" class="cbt-pad" data-slot="' + slot + '">' +
        '<span class="cbt-eq" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<span class="cbt-pad-label">Звук ' + (slot + 1) + '</span>' +
        '<span class="cbt-pad-hint">нажми, чтобы слушать</span>' +
      '</button>';
    }

    this.elRound = root.querySelector('.cbt-round b');
    this.elScore = root.querySelector('.cbt-score-val');
    this.elResult = root.querySelector('.cbt-result');
    this.elResultMsg = root.querySelector('.cbt-result-msg');
    this.elNext = root.querySelector('.cbt-next');
    this.padBtns = Array.prototype.slice.call(root.querySelectorAll('.cbt-pad'));
    this.answerBtns = Array.prototype.slice.call(root.querySelectorAll('.cbt-answer'));

    var self = this;
    for (var i = 0; i < this.padBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.playSlot(parseInt(btn.getAttribute('data-slot'), 10));
        });
      })(this.padBtns[i]);
    }
    for (var j = 0; j < this.answerBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.answer(parseInt(btn.getAttribute('data-slot'), 10));
        });
      })(this.answerBtns[j]);
    }
    this.elNext.addEventListener('click', function () { self.newRound(); });

    refreshIcons();
  };

  BlindTest.prototype.ensureAudio = function () {
    if (!this.ctx) {
      var PC = window.PotokCompressor;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!PC || !AC) {
        this.elResultMsg.textContent = 'Не удалось инициализировать звук (Web Audio API недоступен).';
        this.elResult.hidden = false;
        return false;
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.dryBuf = PC.synthLoop(this.ctx, 'beat');
      this.wetBuf = PC.processLoop(this.ctx, this.dryBuf, RADICAL).buffer;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  };

  BlindTest.prototype.playSlot = function (slot) {
    if (this.answered) return;
    if (!this.ensureAudio()) return;
    var ctx = this.ctx;
    if (this.playingSlot === slot) {
      this.stopSound();
      return;
    }
    var buf = slot === this.drySlot ? this.dryBuf : this.wetBuf;
    var tNow = ctx.currentTime + 0.02;
    this.killSource(0);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(1, tNow + CROSSFADE_SEC);
    src.connect(g);
    g.connect(this.master);
    src.start(tNow, this.offset % window.PotokCompressor.LOOP_SEC);
    this.src = src;
    this.gainNode = g;
    this.playingSlot = slot;
    this.updatePads();
  };

  BlindTest.prototype.killSource = function (fadeSec) {
    if (!this.src || !this.ctx) return;
    var ctx = this.ctx, src = this.src, g = this.gainNode;
    try {
      if (fadeSec > 0) {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeSec);
        src.stop(ctx.currentTime + fadeSec + 0.02);
      } else {
        src.stop();
      }
    } catch (e) { /* уже остановлен */ }
    this.src = null;
    this.gainNode = null;
  };

  BlindTest.prototype.stopSound = function () {
    this.killSource(CROSSFADE_SEC);
    this.playingSlot = -1;
    this.updatePads();
  };

  BlindTest.prototype.stop = function () {
    this.stopSound();
  };

  BlindTest.prototype.newRound = function () {
    var PC = window.PotokCompressor;
    this.round += 1;
    this.drySlot = Math.random() < 0.5 ? 0 : 1;
    // Одинаковая случайная точка входа для обоих звуков раунда — без позиционных подсказок
    this.offset = (Math.floor(Math.random() * LOOP_STEPS) / LOOP_STEPS) * PC.LOOP_SEC;
    this.answered = false;
    this.stopSound();

    this.elRound.textContent = String(this.round);
    for (var i = 0; i < this.padBtns.length; i++) this.padBtns[i].disabled = false;
    for (var j = 0; j < this.answerBtns.length; j++) {
      this.answerBtns[j].disabled = false;
      this.answerBtns[j].classList.remove('is-correct', 'is-wrong');
    }
    this.elResult.hidden = true;
    this.updateScore();
  };

  BlindTest.prototype.answer = function (slot) {
    if (this.answered) return;
    this.answered = true;
    this.stopSound();
    var ok = slot === this.drySlot;
    this.totalCount += 1;
    if (ok) this.correctCount += 1;

    for (var i = 0; i < this.answerBtns.length; i++) {
      var b = this.answerBtns[i];
      var s = parseInt(b.getAttribute('data-slot'), 10);
      b.disabled = true;
      if (s === this.drySlot) b.classList.add('is-correct');
      else if (s === slot && !ok) b.classList.add('is-wrong');
    }
    for (var p = 0; p < this.padBtns.length; p++) this.padBtns[p].disabled = true;

    var dryLabel = 'Звук ' + (this.drySlot + 1);
    this.elResultMsg.innerHTML = ok
      ? '<b>Верно!</b> Без компрессии звучал ' + dryLabel + '.'
      : '<b>Неверно.</b> Без компрессии звучал ' + dryLabel + ', а ты выбрал Звук ' + (slot + 1) + '.';
    this.elResult.hidden = false;
    this.updateScore();
  };

  BlindTest.prototype.updatePads = function () {
    for (var i = 0; i < this.padBtns.length; i++) {
      var s = parseInt(this.padBtns[i].getAttribute('data-slot'), 10);
      this.padBtns[i].classList.toggle('is-playing', s === this.playingSlot);
    }
  };

  BlindTest.prototype.updateScore = function () {
    this.elScore.textContent = this.correctCount + ' / ' + this.totalCount;
  };

  function refreshIcons() {
    try {
      if (window.lucide && lucide.createIcons) {
        lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
      }
    } catch (e) { /* */ }
  }

  var instances = [];
  function boot() {
    var roots = document.querySelectorAll('.potok-compressor-blind');
    for (var i = 0; i < roots.length; i++) {
      if (!roots[i].__cbtInited) {
        roots[i].__cbtInited = true;
        var t = new BlindTest(roots[i]);
        t.start();
        instances.push(t);
      }
    }
  }

  function initTabs() {
    var tabs = document.querySelectorAll('[data-pcp-tab]');
    if (!tabs.length) return;
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          var mode = tab.getAttribute('data-pcp-tab');
          var activeTab = document.querySelector('[data-pcp-tab].is-active');
          if (activeTab === tab) return;
          for (var k = 0; k < tabs.length; k++) {
            tabs[k].classList.toggle('is-active', tabs[k] === tab);
          }
          var panels = document.querySelectorAll('[data-pcp-panel]');
          for (var m = 0; m < panels.length; m++) {
            panels[m].hidden = panels[m].getAttribute('data-pcp-panel') !== mode;
          }
          // Один режим — один звук: глушим аудио другого режима
          if (mode === 'blind' && window.PotokCompressor) window.PotokCompressor.stopAll();
          if (mode === 'compressor') {
            for (var n = 0; n < instances.length; n++) instances[n].stop();
          }
        });
      })(tabs[i]);
    }
  }

  function ready() {
    boot();
    initTabs();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
