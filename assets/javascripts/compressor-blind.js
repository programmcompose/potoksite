/* ========================================
   Potok Compressor — слепой тест A/B
   Один звук сухой, второй с компрессией.
   Слушатель угадывает, какой без эффекта.
   Без визуализации: ни волны, ни GR, ни кривой.
   Настройки компрессора меняются каждый раунд;
   после ответа показаны применённые параметры.
   ======================================== */

(function () {
  'use strict';

  // Запасные настройки — если случайный набор дал слишком слабое сжатие.
  var FALLBACK = { threshold: -20, ratio: 8, attack: 5, release: 120, knee: 6, mix: 100 };
  var CROSSFADE_SEC = 0.01;
  var LOOP_STEPS = 32; // 2 такта по 16 шагов — точка входа квантуется по шагам
  var MIN_AVG_GR = 2;   // dB — минимально заметное среднее сжатие
  var MAX_ROLLS = 10;   // сколько раз перекатываем случайные настройки

  // Четыре «характера» компрессии: каждый раунд берётся случайный профиль,
  // значения дёргаются внутри диапазона — раунды не повторяются.
  var PROFILES = [
    { threshold: [-30, -22], ratio: [6, 12],   attack: [1, 8],   release: [150, 400] }, // плотное сжатие
    { threshold: [-26, -18], ratio: [3, 6],    attack: [30, 90], release: [80, 220]  }, // punch: медленный attack
    { threshold: [-28, -20], ratio: [4, 8],    attack: [5, 15],  release: [400, 700] }, // «дыхание»: длинный release
    { threshold: [-22, -16], ratio: [2, 3.5],  attack: [20, 60], release: [200, 500] }  // лёгкий glue
  ];

  function randIn(range) { return range[0] + Math.random() * (range[1] - range[0]); }

  function randomParams() {
    var prof = PROFILES[Math.floor(Math.random() * PROFILES.length)];
    var atk = randIn(prof.attack);
    return {
      threshold: Math.round(randIn(prof.threshold)),
      ratio: Math.round(randIn(prof.ratio) * 2) / 2,
      attack: atk < 10 ? Math.round(atk * 10) / 10 : Math.round(atk),
      release: Math.round(randIn(prof.release)),
      knee: 6,
      mix: 100
    };
  }

  function fmtMs(v) { return (v < 10 ? v.toFixed(1) : String(Math.round(v))) + ' мс'; }
  function fmtRatio(v) { return (v % 1 === 0 ? String(v) : v.toFixed(1)) + ':1'; }

  // Короткое объяснение, что делает этот набор параметров со звуком.
  function describeParams(p) {
    var atk = p.attack < 8
      ? 'быстрый attack (' + fmtMs(p.attack) + ') срезает атаку ударов — звук стал плотнее и суше'
      : p.attack >= 30
        ? 'медленный attack (' + fmtMs(p.attack) + ') пропускает транзиенты — punch сохранён, сжимается только тело звука'
        : 'средний attack (' + fmtMs(p.attack) + ') мягко сглаживает атаки';
    var rel = p.release > 400
      ? 'длинный release (' + Math.round(p.release) + ' мс) даёт слышимое «дыхание» в паузах'
      : p.release < 120
        ? 'короткий release (' + Math.round(p.release) + ' мс) быстро отпускает сигнал — динамика остаётся живой'
        : '';
    var thr = p.threshold <= -26
      ? 'низкий порог (' + p.threshold + ' dB) — компрессор работает почти всё время'
      : p.threshold >= -18
        ? 'высокий порог (' + p.threshold + ' dB) — сжимаются только самые громкие пики'
        : '';
    var parts = [atk];
    if (rel) parts.push(rel);
    if (thr) parts.push(thr);
    return parts.join('; ');
  }

  function rmsOf(buf) {
    var x = buf.getChannelData(0), s = 0;
    for (var i = 0; i < x.length; i++) s += x[i] * x[i];
    return Math.sqrt(s / x.length);
  }

  // Gain в дБ, при котором RMS wet совпадает с RMS dry (ограничение — диапазон makeup)
  function matchRmsMakeup(dryBuf, wetBuf) {
    var dryRms = rmsOf(dryBuf), wetRms = rmsOf(wetBuf);
    if (dryRms < 1e-9 || wetRms < 1e-9) return 0;
    var db = 20 * Math.log10(dryRms / wetRms);
    return Math.max(-12, Math.min(12, db));
  }

  function BlindTest(root) {
    this.root = root;
    this.ctx = null;
    this.master = null;
    this.dryBuf = null;
    this.wetBuf = null;
    this.loopSec = null;
    this.customBuf = null;
    this.trackName = null;
    this.src = null;
    this.gainNode = null;
    this.playingSlot = -1;
    this.round = 0;
    this.correctCount = 0;
    this.totalCount = 0;
    this.drySlot = 0;
    this.offset = 0;
    this.answered = false;
    this.roundParams = null;
    this.wetDirty = true;
  }

  BlindTest.prototype.start = function () {
    this.buildDom();
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
      '<p class="cbt-task">Один из звуков — <b>без компрессии</b>, второй сжат. Настройки компрессора <b>меняются каждый раунд</b> — после ответа покажем, что именно было применено. Послушай оба и выбери, какой звучит без эффекта.</p>' +
      '<div class="pcp-row cbt-srcrow">' +
        '<span class="pcp-row-label">Сигнал</span>' +
        '<button type="button" class="pcp-src is-active" data-cbt-src="beat">Бит</button>' +
        '<button type="button" class="pcp-src pcp-src--file" data-cbt-src="custom"><i data-lucide="upload"></i>Свой трек</button>' +
        '<span class="cbt-trackname" title="Загрузить свой луп (WAV, MP3, OGG) — до 2 минут"></span>' +
      '</div>' +
      '<input type="file" accept="audio/*,.wav,.mp3,.ogg,.oga,.m4a,.flac,.aiff,.aif" class="cbt-file" hidden>' +
      '<div class="cbt-pads">' +
        padHtml(0) +
        padHtml(1) +
      '</div>' +
      '<div class="cbt-guess">' +
        '<button type="button" class="cbt-answer" data-slot="0"><i data-lucide="ear" class="cbt-ic"></i>Звук 1 — без компрессии</button>' +
        '<button type="button" class="cbt-answer" data-slot="1"><i data-lucide="ear" class="cbt-ic"></i>Звук 2 — без компрессии</button>' +
      '</div>' +
      '<div class="cbt-result" hidden>' +
        '<div class="cbt-result-body">' +
          '<span class="cbt-result-msg"></span>' +
          '<div class="cbt-result-params" hidden></div>' +
          '<p class="cbt-result-desc"></p>' +
        '</div>' +
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
    this.elResultParams = root.querySelector('.cbt-result-params');
    this.elResultDesc = root.querySelector('.cbt-result-desc');
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

    this.srcBtns = Array.prototype.slice.call(root.querySelectorAll('.pcp-src'));
    for (var k = 0; k < this.srcBtns.length; k++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          if (btn.getAttribute('data-cbt-src') === 'custom') self.openFilePicker();
          else self.useBeat();
        });
      })(this.srcBtns[k]);
    }
    this.elFile = root.querySelector('.cbt-file');
    this.elTrackName = root.querySelector('.cbt-trackname');
    if (this.elFile) {
      this.elFile.addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (f) self.loadCustomTrack(f);
        this.value = '';
      });
    }
    if (this.elTrackName) {
      this.elTrackName.addEventListener('click', function () { self.openFilePicker(); });
    }

    refreshIcons();
  };

  BlindTest.prototype.ensureCtx = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.elResultMsg.textContent = 'Не удалось инициализировать звук (Web Audio API недоступен).';
        this.elResult.hidden = false;
        return false;
      }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  };

  // Собирает сжатый вариант раунда: случайные настройки (перекатываем, пока
  // среднее сжатие не станет заметным) + auto makeup — RMS подгоняется под сухой,
  // чтобы разница была в характере компрессии, а не в громкости.
  BlindTest.prototype.makeWet = function (dryBuf) {
    var PC = window.PotokCompressor;
    var p = null, wet0 = null, attempt;
    for (attempt = 0; attempt < MAX_ROLLS; attempt++) {
      p = randomParams();
      p.makeup = 0;
      wet0 = PC.processLoop(this.ctx, dryBuf, p);
      if ((wet0.avgGr || 0) >= MIN_AVG_GR) break;
    }
    if (!p || (wet0.avgGr || 0) < MIN_AVG_GR) {
      p = {};
      for (var k in FALLBACK) p[k] = FALLBACK[k];
      p.makeup = 0;
      wet0 = PC.processLoop(this.ctx, dryBuf, p);
    }
    p.makeup = matchRmsMakeup(dryBuf, wet0.buffer);
    this.wetBuf = PC.processLoop(this.ctx, dryBuf, p).buffer;
    this.roundParams = p;
    this.wetDirty = false;
  };

  BlindTest.prototype.ensureAudio = function () {
    if (!this.ensureCtx()) return false;
    var PC = window.PotokCompressor;
    if (!PC) {
      this.elResultMsg.textContent = 'Не удалось инициализировать звук (модуль компрессора не загружен).';
      this.elResult.hidden = false;
      return false;
    }
    if (!this.dryBuf) {
      this.dryBuf = PC.synthLoop(this.ctx, 'beat');
      this.loopSec = PC.LOOP_SEC;
    }
    if (this.wetDirty || !this.wetBuf) this.makeWet(this.dryBuf);
    return true;
  };

  BlindTest.prototype.openFilePicker = function () {
    if (this.elFile) this.elFile.click();
  };

  BlindTest.prototype.useBeat = function () {
    var PC = window.PotokCompressor;
    if (!this.ensureCtx() || !PC) return;
    this.stopSound();
    this.dryBuf = PC.synthLoop(this.ctx, 'beat');
    this.loopSec = PC.LOOP_SEC;
    this.customBuf = null;
    this.trackName = null;
    this.markSourceUi('beat', '');
    this.newRound(); // соберёт wet с новыми настройками раунда
  };

  BlindTest.prototype.loadCustomTrack = function (file) {
    var self = this;
    var PC = window.PotokCompressor;
    if (!this.ensureCtx() || !PC || typeof PC.prepareTrack !== 'function') return;
    PC.prepareTrack(this.ctx, file).then(function (buf) {
      self.stopSound();
      self.customBuf = buf;
      self.trackName = file.name;
      self.dryBuf = buf;
      self.loopSec = buf.duration;
      self.markSourceUi('custom', file.name + ' · ' + PC.fmtDur(buf.duration));
      self.newRound(); // соберёт wet с новыми настройками раунда
    }).catch(function (err) {
      self.showTrackError(err);
    });
  };

  BlindTest.prototype.markSourceUi = function (id, label) {
    for (var i = 0; i < this.srcBtns.length; i++) {
      this.srcBtns[i].classList.toggle('is-active', this.srcBtns[i].getAttribute('data-cbt-src') === id);
    }
    if (!this.elTrackName) return;
    this.elTrackName.classList.remove('is-error');
    this.elTrackName.textContent = label || '';
    this.elTrackName.title = label ? (label + ' — нажми, чтобы заменить') : 'Загрузить свой луп (WAV, MP3, OGG) — до 2 минут';
  };

  BlindTest.prototype.showTrackError = function (err) {
    if (!this.elTrackName) return;
    this.elTrackName.classList.add('is-error');
    var m = err && err.message || '';
    this.elTrackName.textContent = m === 'too big' ? 'Файл больше 30 МБ — выбери покороче' : 'Не удалось прочитать файл. Подойдут WAV, MP3, OGG, FLAC.';
    this.elTrackName.title = '';
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
    src.start(tNow, this.offset % (this.loopSec || window.PotokCompressor.LOOP_SEC));
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
    var loopSec = this.loopSec || PC.LOOP_SEC;
    this.offset = (Math.floor(Math.random() * LOOP_STEPS) / LOOP_STEPS) * loopSec;
    this.answered = false;
    this.stopSound();

    // Новые настройки компрессора каждый раунд — слушатель слышит разные характеры сжатия.
    if (this.ctx && this.dryBuf) {
      this.makeWet(this.dryBuf);
    } else {
      this.wetDirty = true; // соберём при первом запуске звука
    }

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

    // Показываем настройки, которыми был сделан сжатый звук этого раунда.
    var p = this.roundParams;
    if (p && this.elResultParams) {
      this.elResultParams.innerHTML =
        'Threshold <b>' + p.threshold + ' dB</b> · Ratio <b>' + fmtRatio(p.ratio) + '</b>' +
        ' · Attack <b>' + fmtMs(p.attack) + '</b> · Release <b>' + Math.round(p.release) + ' мс</b>';
      this.elResultParams.hidden = false;
    } else if (this.elResultParams) {
      this.elResultParams.hidden = true;
    }
    if (this.elResultDesc) {
      this.elResultDesc.textContent = p ? describeParams(p) : '';
      this.elResultDesc.hidden = !p;
    }

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
