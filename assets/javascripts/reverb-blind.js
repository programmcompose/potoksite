/* ========================================
   Potok Reverb — слепой тест A/B
   Один звук сухой, второй с реверберацией
   (небольшое примешивание wet).
   Слушатель угадывает, какой без эффекта.
   Без визуализации: ни волны, ни метра.
   Настройки реверба меняются каждый раунд;
   после ответа показаны применённые параметры.
   ======================================== */

(function () {
  'use strict';

  var CROSSFADE_SEC = 0.01;
  var LOOP_STEPS = 32; // точка входа квантуется долями лупа — без позиционных подсказок
  var MAX_TRACK_SEC_BLIND = 60; // лимит своего трека (стоимость оффлайн-рендера)

  // Четыре «характера» реверба: каждый раунд берётся случайный профиль,
  // значения дёргаются внутри диапазона — раунды не повторяются.
  var PROFILES = [
    { decay: [0.6, 1.3], predelay: [5, 20],   hpf: [200, 400], lpf: [8000, 12000], mix: [15, 30] }, // комната
    { decay: [1.2, 2.2], predelay: [5, 15],   hpf: [350, 700], lpf: [9000, 12000], mix: [20, 40] }, // плита
    { decay: [1.8, 3.5], predelay: [20, 50],  hpf: [250, 500], lpf: [6000, 9000],  mix: [20, 40] }, // зал
    { decay: [3.5, 6.0], predelay: [40, 90],  hpf: [180, 350], lpf: [4000, 7000],  mix: [25, 45] }  // собор
  ];

  function randIn(range) { return range[0] + Math.random() * (range[1] - range[0]); }

  function randomParams() {
    var prof = PROFILES[Math.floor(Math.random() * PROFILES.length)];
    return {
      decay: Math.round(randIn(prof.decay) * 10) / 10,
      predelay: Math.round(randIn(prof.predelay)),
      hpf: Math.round(randIn(prof.hpf) / 50) * 50,
      lpf: Math.round(randIn(prof.lpf) / 250) * 250,
      mix: Math.round(randIn(prof.mix))
    };
  }

  function fmtHz(v) { return v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + ' кГц' : String(Math.round(v)) + ' Гц'; }

  // Короткое объяснение, что делает этот набор параметров со звуком.
  function describeParams(p) {
    var dec = p.decay < 1.2
      ? 'короткий хвост (' + p.decay.toFixed(1) + ' с) — маленькая комната, реверб едва заметен'
      : p.decay <= 3
        ? 'средний хвост (' + p.decay.toFixed(1) + ' с) — пространство размером с зал'
        : 'длинный хвост (' + p.decay.toFixed(1) + ' с) — собор: звук «растворяется» в пространстве';
    var pd = p.predelay < 15
      ? 'короткий pre-delay (' + Math.round(p.predelay) + ' мс) — реверб начинается сразу после удара, атака слегка размывается'
      : p.predelay >= 40
        ? 'длинный pre-delay (' + Math.round(p.predelay) + ' мс) — сухой удар слышен чётко, хвост отставает'
        : '';
    var flt = p.lpf < 6500
      ? 'LPF ' + fmtHz(p.lpf) + ' режет верх хвоста — пространство темнее и теплее'
      : p.hpf > 350
        ? 'HPF ' + fmtHz(p.hpf) + ' убирает низ из хвоста — меньше «грязи» под ударами'
        : '';
    var mx = p.mix <= 25
      ? 'небольшое примешивание (' + Math.round(p.mix) + '%) — пространство добавлено деликатно'
      : 'заметное примешивание (' + Math.round(p.mix) + '%) — хвост слышен отчётливо';
    var parts = [dec, pd, flt, mx];
    return parts.filter(function (s) { return !!s; }).join('; ');
  }

  function rmsOf(buf) {
    var x = buf.getChannelData(0), s = 0;
    for (var i = 0; i < x.length; i++) s += x[i] * x[i];
    return Math.sqrt(s / x.length);
  }

  // Auto makeup: масштабируем wet так, чтобы его RMS совпал с RMS dry —
  // разница между звуками только в характере пространства, а не в громкости.
  function matchRmsInPlace(dryBuf, wetBuf) {
    var d = rmsOf(dryBuf), w = rmsOf(wetBuf);
    if (d < 1e-9 || w < 1e-9) return;
    var db = Math.max(-12, Math.min(12, 20 * Math.log10(d / w)));
    var g = Math.pow(10, db / 20);
    for (var ch = 0; ch < wetBuf.numberOfChannels; ch++) {
      var x = wetBuf.getChannelData(ch);
      for (var i = 0; i < x.length; i++) x[i] *= g;
    }
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
    this.sourceId = 'beat';
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
    this.wetReady = false;
    this.rendering = false;
    this.wantPlay = -1;
    this.wetPromise = null;
    this.renderToken = 0; // защита от «протухшего» рендера при быстрой смене раунда
  }

  BlindTest.prototype.start = function () {
    this.buildDom();
    this.newRound();
  };

  BlindTest.prototype.buildDom = function () {
    var root = this.root;
    root.classList.add('rbt');
    root.innerHTML = '' +
      '<div class="rbt-head">' +
        '<span class="rbt-round">Раунд <b>1</b></span>' +
        '<span class="rbt-score"><i data-lucide="target" class="rbt-ic"></i><span class="rbt-score-val">0 / 0</span></span>' +
      '</div>' +
      '<p class="rbt-task">Один из звуков — <b>сухой</b>, второй с реверберацией (небольшое примешивание). Настройки реверба <b>меняются каждый раунд</b> — после ответа покажем, что именно было применено. Послушай оба и выбери, какой звучит без эффекта.</p>' +
      '<div class="rbt-row rbt-srcrow">' +
        '<span class="rbt-row-label">Сигнал</span>' +
        '<button type="button" class="rbt-src is-active" data-rbt-src="beat">Бит</button>' +
        '<button type="button" class="rbt-src" data-rbt-src="tone">Тон</button>' +
        '<button type="button" class="rbt-src rbt-src--file" data-rbt-src="custom"><i data-lucide="upload"></i>Свой трек</button>' +
        '<span class="rbt-trackname" title="Загрузить свой луп (WAV, MP3, OGG) — до 1 минуты"></span>' +
      '</div>' +
      '<input type="file" accept="audio/*,.wav,.mp3,.ogg,.oga,.m4a,.flac,.aiff,.aif" class="rbt-file" hidden>' +
      '<div class="rbt-pads">' +
        padHtml(0) +
        padHtml(1) +
      '</div>' +
      '<div class="rbt-status" hidden>Готовим раунд…</div>' +
      '<div class="rbt-guess">' +
        '<button type="button" class="rbt-answer" data-slot="0"><i data-lucide="ear" class="rbt-ic"></i>Звук 1 — без реверба</button>' +
        '<button type="button" class="rbt-answer" data-slot="1"><i data-lucide="ear" class="rbt-ic"></i>Звук 2 — без реверба</button>' +
      '</div>' +
      '<div class="rbt-result" hidden>' +
        '<div class="rbt-result-body">' +
          '<span class="rbt-result-msg"></span>' +
          '<div class="rbt-result-params" hidden></div>' +
          '<p class="rbt-result-desc"></p>' +
        '</div>' +
        '<button type="button" class="rbt-next">Следующий раунд →</button>' +
      '</div>';

    function padHtml(slot) {
      return '<button type="button" class="rbt-pad" data-slot="' + slot + '">' +
        '<span class="rbt-eq" aria-hidden="true"><span></span><span></span><span></span></span>' +
        '<span class="rbt-pad-label">Звук ' + (slot + 1) + '</span>' +
        '<span class="rbt-pad-hint">нажми, чтобы слушать</span>' +
      '</button>';
    }

    this.elRound = root.querySelector('.rbt-round b');
    this.elScore = root.querySelector('.rbt-score-val');
    this.elResult = root.querySelector('.rbt-result');
    this.elResultMsg = root.querySelector('.rbt-result-msg');
    this.elResultParams = root.querySelector('.rbt-result-params');
    this.elResultDesc = root.querySelector('.rbt-result-desc');
    this.elNext = root.querySelector('.rbt-next');
    this.elStatus = root.querySelector('.rbt-status');
    this.padBtns = Array.prototype.slice.call(root.querySelectorAll('.rbt-pad'));
    this.answerBtns = Array.prototype.slice.call(root.querySelectorAll('.rbt-answer'));

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

    this.srcBtns = Array.prototype.slice.call(root.querySelectorAll('.rbt-src'));
    for (var k = 0; k < this.srcBtns.length; k++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-rbt-src');
          if (id === 'custom') self.openFilePicker();
          else self.setSource(id);
        });
      })(this.srcBtns[k]);
    }
    this.elFile = root.querySelector('.rbt-file');
    this.elTrackName = root.querySelector('.rbt-trackname');
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

  BlindTest.prototype.ensureAudio = function () {
    var PR = window.PotokReverb;
    if (!this.ensureCtx()) return false;
    if (!PR) {
      this.elResultMsg.textContent = 'Не удалось инициализировать звук (модуль реверба не загружен).';
      this.elResult.hidden = false;
      return false;
    }
    if (!this.dryBuf) {
      this.dryBuf = PR.synthLoop(this.ctx, this.sourceId);
      this.loopSec = this.dryBuf.duration;
    }
    return true;
  };

  // Рендер wet-варианта раунда (оффлайн-конволюция — асинхронно).
  BlindTest.prototype.renderWet = function () {
    var self = this;
    if (this.wetPromise) return this.wetPromise;
    var PR = window.PotokReverb;
    if (!PR || typeof PR.processLoop !== 'function') {
      this.showError('Не удалось сгенерировать реверб (модуль не загружен).');
      return null;
    }
    this.rendering = true;
    this.updateStatus();
    var token = ++this.renderToken; // если раунд сменился до готовности — результат отбрасываем
    this.wetPromise = PR.processLoop(this.ctx, this.dryBuf, this.roundParams).then(function (res) {
      if (token !== self.renderToken) return false;
      matchRmsInPlace(self.dryBuf, res.buffer);
      self.wetBuf = res.buffer;
      self.wetReady = true;
      self.rendering = false;
      self.updateStatus();
      if (!self.answered && self.wantPlay >= 0) {
        var slot = self.wantPlay;
        self.wantPlay = -1;
        self.startSlot(slot);
      }
      return true;
    }).catch(function () {
      if (token !== self.renderToken) return false;
      self.rendering = false;
      self.wetPromise = null;
      self.updateStatus();
      self.showError('Не удалось сгенерировать реверб. Попробуй ещё раз.');
      return false;
    });
    return this.wetPromise;
  };

  BlindTest.prototype.openFilePicker = function () {
    if (this.elFile) this.elFile.click();
  };

  BlindTest.prototype.setSource = function (id) {
    var PR = window.PotokReverb;
    if (!this.ensureCtx() || !PR) return;
    this.stopSound();
    this.sourceId = id;
    this.dryBuf = PR.synthLoop(this.ctx, id);
    this.loopSec = this.dryBuf.duration;
    this.customBuf = null;
    this.trackName = null;
    this.markSourceUi(id, '');
    this.newRound(); // новые настройки раунда + рендер wet
  };

  BlindTest.prototype.loadCustomTrack = function (file) {
    var self = this;
    var PR = window.PotokReverb;
    if (!this.ensureCtx() || !PR || typeof PR.prepareTrack !== 'function') return;
    PR.prepareTrack(this.ctx, file, MAX_TRACK_SEC_BLIND).then(function (buf) {
      self.stopSound();
      self.sourceId = 'custom';
      self.customBuf = buf;
      self.trackName = file.name;
      self.dryBuf = buf;
      self.loopSec = buf.duration;
      self.markSourceUi('custom', file.name + ' · ' + PR.fmtDur(buf.duration));
      self.newRound(); // новые настройки раунда + рендер wet
    }).catch(function (err) {
      self.showTrackError(err);
    });
  };

  BlindTest.prototype.markSourceUi = function (id, label) {
    for (var i = 0; i < this.srcBtns.length; i++) {
      this.srcBtns[i].classList.toggle('is-active', this.srcBtns[i].getAttribute('data-rbt-src') === id);
    }
    if (!this.elTrackName) return;
    this.elTrackName.classList.remove('is-error');
    this.elTrackName.textContent = label || '';
    this.elTrackName.title = label ? (label + ' — нажми, чтобы заменить') : 'Загрузить свой луп (WAV, MP3, OGG) — до 1 минуты';
  };

  BlindTest.prototype.showTrackError = function (err) {
    if (!this.elTrackName) return;
    this.elTrackName.classList.add('is-error');
    var m = err && err.message || '';
    this.elTrackName.textContent = m === 'too big' ? 'Файл больше 30 МБ — выбери покороче' : 'Не удалось прочитать файл. Подойдут WAV, MP3, OGG, FLAC.';
    this.elTrackName.title = '';
  };

  BlindTest.prototype.showError = function (msg) {
    if (!this.elResultMsg || !this.elResult) return;
    this.elResultMsg.textContent = msg;
    this.elResult.hidden = false;
  };

  BlindTest.prototype.playSlot = function (slot) {
    if (this.answered) return;
    if (!this.ensureAudio()) return;
    if (this.wetReady && !this.rendering) {
      if (this.playingSlot === slot) {
        this.stopSound();
        return;
      }
      this.startSlot(slot);
      return;
    }
    // Wet ещё рендерится — запомним нажатый пад, запустим после готовности
    this.wantPlay = slot;
    this.renderWet();
  };

  BlindTest.prototype.startSlot = function (slot) {
    var ctx = this.ctx;
    if (!ctx || !this.dryBuf) return;
    if (this.playingSlot === slot) return;
    var buf = slot === this.drySlot ? this.dryBuf : this.wetBuf;
    if (!buf) return;
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
    src.start(tNow, this.offset % (this.loopSec || buf.duration));
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
    this.round += 1;
    this.drySlot = Math.random() < 0.5 ? 0 : 1;
    // Одинаковая случайная точка входа для обоих звуков раунда — без позиционных подсказок
    var loopSec = this.loopSec || (window.PotokReverb && window.PotokReverb.LOOP_SEC) || 6;
    this.offset = (Math.floor(Math.random() * LOOP_STEPS) / LOOP_STEPS) * loopSec;
    this.answered = false;
    this.wantPlay = -1;
    this.stopSound();

    // Новые настройки реверба каждый раунд — слушатель слышит разное пространство.
    this.roundParams = randomParams();
    this.wetReady = false;
    this.wetBuf = null;
    this.renderToken += 1; // протухший рендер предыдущего раунда отбрасывается
    this.wetPromise = null;
    if (this.ctx && this.dryBuf) {
      this.renderWet(); // асинхронно: статус «Готовим раунд…» до готовности
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
    this.wantPlay = -1;
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
      ? '<b>Верно!</b> Без реверба звучал ' + dryLabel + '.'
      : '<b>Неверно.</b> Без реверба звучал ' + dryLabel + ', а ты выбрал Звук ' + (slot + 1) + '.';

    // Показываем настройки, которыми был сделан звук с ревербом этого раунда.
    var p = this.roundParams;
    if (p && this.elResultParams) {
      this.elResultParams.innerHTML =
        'Decay <b>' + p.decay.toFixed(1) + ' s</b> · Pre-Delay <b>' + Math.round(p.predelay) + ' мс</b>' +
        ' · HPF/LPF <b>' + fmtHz(p.hpf) + ' / ' + fmtHz(p.lpf) + '</b>' +
        ' · Wet <b>' + Math.round(p.mix) + '%</b>';
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

  BlindTest.prototype.updateStatus = function () {
    if (this.elStatus) this.elStatus.hidden = !this.rendering;
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
    var roots = document.querySelectorAll('.potok-reverb-blind');
    for (var i = 0; i < roots.length; i++) {
      if (!roots[i].__rbtInited) {
        roots[i].__rbtInited = true;
        var t = new BlindTest(roots[i]);
        t.start();
        instances.push(t);
      }
    }
  }

  function initTabs() {
    var tabs = document.querySelectorAll('[data-prv-tab]');
    if (!tabs.length) return;
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.addEventListener('click', function () {
          var mode = tab.getAttribute('data-prv-tab');
          var activeTab = document.querySelector('[data-prv-tab].is-active');
          if (activeTab === tab) return;
          for (var k = 0; k < tabs.length; k++) {
            tabs[k].classList.toggle('is-active', tabs[k] === tab);
          }
          var panels = document.querySelectorAll('[data-prv-panel]');
          for (var m = 0; m < panels.length; m++) {
            panels[m].hidden = panels[m].getAttribute('data-prv-panel') !== mode;
          }
          // Один режим — один звук: глушим аудио другого режима
          if (mode === 'blind' && window.PotokReverb) window.PotokReverb.stopAll();
          if (mode === 'reverb') {
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
