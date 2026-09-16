/* ========================================
   Potok Delay Widget
   Встраивается в статьи через <div class="potok-delay"></div>
   DSP: Web Audio API (delay L/R + feedback, ping-pong cross-feedback,
   highpass/lowpass на повторах), синтезированный бит 80 BPM.
   ======================================== */

(function () {
  'use strict';

  var BPM = 80;
  var BEAT_SEC = 60 / BPM;
  var STEP_SEC = BEAT_SEC / 4;
  var BARS = 2;
  var STEPS = BARS * 16;
  var LOOP_SEC = STEPS * STEP_SEC;

  var PRESETS = [
    { id: 'slap',   label: 'Slap (вокал)', values: { time: 90,  feedback: 15, mix: 25, lowcut: 300, highcut: 10000, pingpong: false } },
    { id: 'snare',  label: 'Snare 1/16',   values: { time: 94,  feedback: 25, mix: 30, lowcut: 400, highcut: 9000,  pingpong: false } },
    { id: 'eighth', label: 'Мелодия 1/8',  values: { time: 188, feedback: 40, mix: 35, lowcut: 250, highcut: 7000,  pingpong: true  } },
    { id: 'quarter',label: '¼ + space',    values: { time: 375, feedback: 45, mix: 40, lowcut: 200, highcut: 6000,  pingpong: true  } },
    { id: 'long',   label: 'Долгий ½',     values: { time: 750, feedback: 55, mix: 45, lowcut: 150, highcut: 5000,  pingpong: true  } }
  ];

  var SOURCES = [
    { id: 'beat',  label: 'Бит' },
    { id: 'kick',  label: 'Kick' },
    { id: 'snare', label: 'Snare' },
    { id: 'hat',   label: 'Hat' }
  ];

  var SYNC_STEPS = [
    { ms: 94,  label: '1/16' },
    { ms: 188, label: '1/8' },
    { ms: 375, label: '1/4' },
    { ms: 250, label: '1/8T' },
    { ms: 750, label: '1/2' }
  ];

  var DEFAULTS = { time: 375, feedback: 0.35, mix: 0.40, lowcut: 200, highcut: 8000 };

  // ===== DSP helpers (синтез бита) =====
  function biquadCoeffs(type, freq, Q, sr) {
    var w0 = 2 * Math.PI * freq / sr;
    var alpha = Math.sin(w0) / (2 * Q);
    var cosw = Math.cos(w0);
    var b0, b1, b2, a0, a1, a2;
    if (type === 'highpass') {
      b0 = (1 + Math.sin(w0)) / 2; b1 = -cosw; b2 = (1 - Math.sin(w0)) / 2;
    } else if (type === 'lowpass') {
      b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = (1 - cosw) / 2;
    } else { // bandpass
      b0 = alpha; b1 = 0; b2 = -alpha;
    }
    a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }

  function applyBiquad(x, c) {
    var z1 = 0, z2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var xi = x[i];
      var yi = c[0] * xi + c[1] * z1 + c[2] * z2 - c[3] * y1 - c[4] * y2;
      z2 = z1; z1 = xi; y2 = y1; y1 = yi;
      x[i] = yi;
    }
  }

  function synthLoop(ctx, mode) {
    var sr = ctx.sampleRate;
    var len = Math.ceil(LOOP_SEC * sr);
    var out = new Float32Array(len);

    var kicks  = [0, 8, 16, 24];
    var snares = [4, 12, 20, 28];
    var hats   = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];

    var doKick  = mode === 'beat' || mode === 'kick';
    var doSnare = mode === 'beat' || mode === 'snare';
    var doHat   = mode === 'beat' || mode === 'hat';

    function addKick(step) {
      var t0 = Math.floor(step * STEP_SEC * sr);
      if (t0 >= len) return;
      var dur = Math.min(len - t0, Math.floor(0.28 * sr));
      var phase = 0;
      for (var i = 0; i < dur; i++) {
        var t = i / sr;
        var f = 48 + 90 * Math.exp(-t / 0.035);
        phase += 2 * Math.PI * f / sr;
        out[t0 + i] += Math.sin(phase) * Math.exp(-t / 0.08);
      }
      var clickDur = Math.min(len - t0, Math.floor(0.003 * sr));
      for (var j = 0; j < clickDur; j++) {
        out[t0 + j] += (Math.random() * 2 - 1) * Math.exp(-j / (sr * 0.0008)) * 0.45;
      }
    }

    function addSnare(step) {
      var t0 = Math.floor(step * STEP_SEC * sr);
      if (t0 >= len) return;
      var bodyDur = Math.min(len - t0, Math.floor(0.11 * sr));
      var phase = 0;
      for (var i = 0; i < bodyDur; i++) {
        var t = i / sr;
        phase += 2 * Math.PI * 185 / sr;
        out[t0 + i] += Math.sin(phase) * Math.exp(-t / 0.03) * 0.65;
      }
      var nDur = Math.min(len - t0, Math.floor(0.18 * sr));
      var noise = new Float32Array(nDur);
      for (var k = 0; k < nDur; k++) noise[k] = (Math.random() * 2 - 1) * Math.exp(-(k / sr) / 0.045);
      applyBiquad(noise, biquadCoeffs('bandpass', 1700, 0.85, sr));
      for (var m = 0; m < nDur; m++) out[t0 + m] += noise[m] * 1.25;
    }

    function addHat(step, vel) {
      var t0 = Math.floor(step * STEP_SEC * sr);
      if (t0 >= len) return;
      var hDur = Math.min(len - t0, Math.floor(0.045 * sr));
      var noise = new Float32Array(hDur);
      for (var i = 0; i < hDur; i++) noise[i] = (Math.random() * 2 - 1) * Math.exp(-(i / sr) / 0.01);
      applyBiquad(noise, biquadCoeffs('highpass', 7000, 0.7, sr));
      for (var j = 0; j < hDur; j++) out[t0 + j] += noise[j] * vel;
    }

    if (doKick) kicks.forEach(addKick);
    if (doSnare) snares.forEach(addSnare);
    if (doHat) {
      hats.forEach(function (s, i) { addHat(s, (i % 2 === 0) ? 0.55 : 0.28); });
    }

    // normalize peak
    var peak = 0;
    for (var i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0.01) {
      var g = 0.85 / peak;
      for (var j = 0; j < len; j++) out[j] *= g;
    }

    var buffer = ctx.createBuffer(2, len, sr);
    if (buffer.copyToChannel) {
      buffer.copyToChannel(out, 0);
      buffer.copyToChannel(out, 1);
    } else {
      buffer.getChannelData(0).set(out);
      buffer.getChannelData(1).set(out);
    }
    return buffer;
  }

  function setupCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return null;
    var W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: g, w: w, h: h };
  }

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  // ===== Widget =====
  function Widget(root) {
    this.root = root;
  }

  Widget.prototype.start = function () {
    var self = this;
    this.params = {};
    for (var k in DEFAULTS) this.params[k] = DEFAULTS[k];
    this.ctx = null;
    this.dryGain = null;
    this.wetGain = null;
    this.delayL = null;
    this.delayR = null;
    this.feedbackGainL = null;
    this.feedbackGainR = null;
    this.highpass = null;
    this.lowpass = null;
    this.merger = null;
    this.splitter = null;
    this.analyser = null;
    this.bufferSource = null;
    this.dryBuffer = null;
    this.playing = false;
    this.bypass = false;
    this.sourceMode = 'beat';
    this.pingPong = false;
    this.rafId = 0;

    this.buildDom();
    this.bindEvents();
    this.setParam('time', DEFAULTS.time);
    this.setParam('feedback', DEFAULTS.feedback);
    this.setParam('mix', DEFAULTS.mix);
    this.setParam('lowcut', DEFAULTS.lowcut);
    this.setParam('highcut', DEFAULTS.highcut);
    this.drawWaveStatic();

    this._onKey = function (e) {
      if (e.key === 'b' || e.key === 'B') {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        self.toggleBypass();
      }
    };
    window.addEventListener('keydown', this._onKey);

    this._onResize = function () { self.drawWaveStatic(); };
    window.addEventListener('resize', this._onResize);
  };

  Widget.prototype.buildDom = function () {
    var root = this.root;
    root.classList.add('pdy');

    var html = '';
    html += '<div class="pdy-head">';
    html += '<button type="button" class="pdy-btn pdy-play"><span class="pdy-ic">&#9654;</span><span class="pdy-play-label">Play</span></button>';
    html += '<button type="button" class="pdy-bypass" aria-pressed="false" title="Горячая клавиша B"><span class="pdy-bypass-t">BYPASS</span><span class="pdy-bypass-s">A/B · B</span></button>';
    html += '<div class="pdy-presets">';
    for (var i = 0; i < PRESETS.length; i++) {
      html += '<button type="button" class="pdy-preset" data-id="' + PRESETS[i].id + '">' + PRESETS[i].label + '</button>';
    }
    html += '</div></div>';

    html += '<div class="pdy-row">';
    html += '<span class="pdy-row-label">Сигнал</span>';
    for (var s = 0; s < SOURCES.length; s++) {
      html += '<button type="button" class="pdy-src' + (SOURCES[s].id === 'beat' ? ' is-active' : '') + '" data-src="' + SOURCES[s].id + '">' + SOURCES[s].label + '</button>';
    }
    html += '<button type="button" class="pdy-toggle" title="Чётные/нечётные повторы влево-вправо">Ping-Pong</button>';
    html += '</div>';

    html += '<div class="pdy-viz">';
    html += '<canvas class="pdy-wave"></canvas>';
    html += '<div class="pdy-echo-wrap"><div class="pdy-echo-bar" style="height: 4px;"></div><div class="pdy-echo-label">wet<br><span class="pdy-echo-val">0%</span></div></div>';
    html += '</div>';

    var paramsDef = [
      { key: 'time',     label: 'Time' },
      { key: 'feedback', label: 'Feedback' },
      { key: 'mix',      label: 'Mix / Wet' },
      { key: 'lowcut',   label: 'Low-cut' },
      { key: 'highcut',  label: 'High-cut' }
    ];
    html += '<div class="pdy-params">';
    for (var p = 0; p < paramsDef.length; p++) {
      var d = paramsDef[p];
      html += '<label class="pdy-param" data-key="' + d.key + '">';
      html += '<span class="pdy-plabel">' + d.label + '</span>';
      html += '<input type="range">';
      html += '<span class="pdy-pval"></span>';
      if (d.key === 'time') {
        html += '<div class="pdy-sync-row">';
        for (var q = 0; q < SYNC_STEPS.length; q++) {
          var st = SYNC_STEPS[q];
          html += '<button type="button" class="pdy-sync' + (st.ms === DEFAULTS.time ? ' is-active' : '') + '" data-ms="' + st.ms + '">' + st.label + '</button>';
        }
        html += '</div>';
      }
      html += '</label>';
    }
    html += '</div>';

    root.innerHTML = html;

    // ranges
    var self = this;
    function fmt(key, v) {
      if (key === 'time') return Math.round(v) + ' ms';
      if (key === 'feedback' || key === 'mix') return Math.round(v * 100) + '%';
      if (key === 'lowcut') return Math.round(v) + ' Hz';
      if (key === 'highcut') return v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz';
      return String(v);
    }

    var ranges = {
      time:     { min: 1,    max: 1000, toParam: function (v) { return v; } },
      feedback: { min: 0,    max: 95,   toParam: function (v) { return v / 100; } },
      mix:      { min: 0,    max: 100,  toParam: function (v) { return v / 100; } },
      lowcut:   { min: 20,   max: 800,  toParam: function (v) { return v; } },
      highcut:  { min: 2000, max: 16000, toParam: function (v) { return v; } }
    };

    for (var r = 0; r < paramsDef.length; r++) {
      var def = paramsDef[r];
      var cfg = ranges[def.key];
      var input = root.querySelector('.pdy-param[data-key="' + def.key + '"] input');
      input.min = cfg.min;
      input.max = cfg.max;
      (function (key, cfg) {
        input.addEventListener('input', function () {
          self.setParam(key, cfg.toParam(parseFloat(input.value)));
        });
      })(def.key, cfg);
    }

    // sync buttons
    var syncBtns = root.querySelectorAll('.pdy-sync');
    for (var sb = 0; sb < syncBtns.length; sb++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.setTime(+btn.getAttribute('data-ms'));
        });
      })(syncBtns[sb]);
    }

    // presets
    var presetBtns = root.querySelectorAll('.pdy-preset');
    for (var pb = 0; pb < presetBtns.length; pb++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.applyPreset(btn.getAttribute('data-id')); });
      })(presetBtns[pb]);
    }

    // sources + ping-pong
    var srcBtns = root.querySelectorAll('.pdy-src');
    for (var s2 = 0; s2 < srcBtns.length; s2++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.setSource(btn.getAttribute('data-src')); });
      })(srcBtns[s2]);
    }

    this.elPlay = root.querySelector('.pdy-play');
    this.elBypass = root.querySelector('.pdy-bypass');
    this.elWave = root.querySelector('.pdy-wave');
    this.elEchoBar = root.querySelector('.pdy-echo-bar');
    this.elEchoVal = root.querySelector('.pdy-echo-val');
    this.elPingPong = root.querySelector('.pdy-toggle');

    var self2 = this;
    this.elPlay.addEventListener('click', function () {
      if (self2.playing) self2.stop(); else self2.startPlayback();
    });
    this.elBypass.addEventListener('click', function () { self2.toggleBypass(); });
    this.elPingPong.addEventListener('click', function () {
      self2.pingPong = !self2.pingPong;
      self2.elPingPong.classList.toggle('is-active', self2.pingPong);
      self2.applyParams();
    });

    // init slider positions + labels
    this.syncSliders();
  };

  Widget.prototype.syncSliders = function () {
    var map = { time: 'time', feedback: 'feedback', mix: 'mix', lowcut: 'lowcut', highcut: 'highcut' };
    for (var k in map) {
      var input = this.root.querySelector('.pdy-param[data-key="' + k + '"] input');
      if (!input) continue;
      var v = this.params[k];
      if (k === 'feedback' || k === 'mix') input.value = Math.round(v * 100);
      else input.value = Math.round(v);
    }
  };

  // ===== Audio graph =====
  Widget.prototype.ensureCtx = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  };

  Widget.prototype.buildGraph = function () {
    if (!this.ctx) return;

    if (this.bufferSource) {
      try { this.bufferSource.stop(); } catch (e) {}
      try { this.bufferSource.disconnect(); } catch (e) {}
      this.bufferSource = null;
    }

    this.dryBuffer = synthLoop(this.ctx, this.sourceMode);

    var ctx = this.ctx;
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.delayL = ctx.createDelay(2.0);
    this.delayR = ctx.createDelay(2.0);
    this.feedbackGainL = ctx.createGain();
    this.feedbackGainR = ctx.createGain();
    this.highpass = ctx.createBiquadFilter();
    this.lowpass = ctx.createBiquadFilter();
    this.splitter = ctx.createChannelSplitter(2);
    this.merger = ctx.createChannelMerger(2);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;

    this.highpass.type = 'highpass';
    this.highpass.Q.value = 0.7;
    this.lowpass.type = 'lowpass';
    this.lowpass.Q.value = 0.7;

    var src = ctx.createBufferSource();
    src.buffer = this.dryBuffer;
    src.loop = true;
    this.bufferSource = src;

    src.connect(this.dryGain);
    src.connect(this.highpass);
    this.highpass.connect(this.lowpass);

    // mono into stereo delay paths
    this.lowpass.connect(this.delayL);
    this.lowpass.connect(this.delayR);

    this.delayL.connect(this.feedbackGainL);
    this.feedbackGainL.connect(this.delayL);
    this.delayR.connect(this.feedbackGainR);
    this.feedbackGainR.connect(this.delayR);

    this.delayL.connect(this.merger, 0, 0);
    this.delayR.connect(this.merger, 0, 1);

    this.merger.connect(this.wetGain);
    this.dryGain.connect(this.analyser);
    this.wetGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.applyParams();
    this.updateBypassUi();
  };

  Widget.prototype.applyParams = function () {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var t = this.params.time / 1000;
    this.delayL.delayTime.setTargetAtTime(t, ctx.currentTime, 0.01);
    // slight offset for stereo width even without ping-pong
    var offset = this.pingPong ? t * 0.5 : t * 0.02;
    this.delayR.delayTime.setTargetAtTime(Math.min(1.95, t + offset), ctx.currentTime, 0.01);

    this.feedbackGainL.gain.setTargetAtTime(this.params.feedback, ctx.currentTime, 0.02);
    this.feedbackGainR.gain.setTargetAtTime(this.params.feedback, ctx.currentTime, 0.02);

    if (this.pingPong) {
      // cross feedback for classic ping-pong
      try {
        this.feedbackGainL.disconnect();
        this.feedbackGainR.disconnect();
        this.delayL.connect(this.feedbackGainL);
        this.feedbackGainL.connect(this.delayR);
        this.delayR.connect(this.feedbackGainR);
        this.feedbackGainR.connect(this.delayL);
      } catch (e) {}
    } else {
      try {
        this.feedbackGainL.disconnect();
        this.feedbackGainR.disconnect();
        this.delayL.connect(this.feedbackGainL);
        this.feedbackGainL.connect(this.delayL);
        this.delayR.connect(this.feedbackGainR);
        this.feedbackGainR.connect(this.delayR);
      } catch (e) {}
    }

    this.highpass.frequency.setTargetAtTime(this.params.lowcut, ctx.currentTime, 0.02);
    this.lowpass.frequency.setTargetAtTime(this.params.highcut, ctx.currentTime, 0.02);

    var wet = this.bypass ? 0 : this.params.mix;
    var dry = this.bypass ? 1 : (1 - this.params.mix * 0.7); // keep some dry headroom
    this.dryGain.gain.setTargetAtTime(dry, ctx.currentTime, 0.02);
    this.wetGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.02);

    if (this.elEchoVal) this.elEchoVal.textContent = Math.round(wet * 100) + '%';
    if (this.elEchoBar) this.elEchoBar.style.height = Math.max(2, wet * 110) + 'px';
  };

  Widget.prototype.toggleBypass = function () {
    this.bypass = !this.bypass;
    this.updateBypassUi();
    if (this.ctx && this.playing) this.applyParams();
  };

  Widget.prototype.updateBypassUi = function () {
    if (!this.elBypass) return;
    this.elBypass.classList.toggle('is-on', this.bypass);
    this.elBypass.setAttribute('aria-pressed', String(this.bypass));
    if (this.ctx && this.playing) this.applyParams();
  };

  // ===== Playback =====
  Widget.prototype.startPlayback = function () {
    var self = this;
    this.ensureCtx();
    if (this.playing) return;
    this.playing = true;
    this.elPlay.classList.add('is-playing');
    this.elPlay.querySelector('.pdy-ic').innerHTML = '&#9632;';
    this.elPlay.querySelector('.pdy-play-label').textContent = 'Stop';
    if (this.bufferSource) {
      try {
        this.bufferSource.start(0);
      } catch (e) {
        this.buildGraph();
        this.bufferSource.start(0);
      }
    }
    function loop() { self.drawWaveFrame(loop); }
    this.drawWaveFrame(loop);
  };

  Widget.prototype.stop = function () {
    this.playing = false;
    this.elPlay.classList.remove('is-playing');
    this.elPlay.querySelector('.pdy-ic').innerHTML = '&#9654;';
    this.elPlay.querySelector('.pdy-play-label').textContent = 'Play';
    if (this.bufferSource) {
      try { this.bufferSource.stop(); } catch (e) {}
      try { this.bufferSource.disconnect(); } catch (e) {}
      this.bufferSource = null;
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    // rebuild so next play is clean
    if (this.ctx) this.buildGraph();
    this.drawWaveStatic();
  };

  Widget.prototype.setSource = function (mode) {
    var btns = this.root.querySelectorAll('.pdy-src');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('is-active');
    var active = this.root.querySelector('.pdy-src[data-src="' + mode + '"]');
    if (active) active.classList.add('is-active');
    this.sourceMode = mode;
    var wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    if (this.ctx) this.buildGraph();
    if (wasPlaying) this.startPlayback();
  };

  // ===== Params API =====
  Widget.prototype.setParam = function (key, value) {
    this.params[key] = value;
    var el = this.root.querySelector('.pdy-param[data-key="' + key + '"] .pdy-pval');
    if (el) {
      if (key === 'time') el.textContent = Math.round(value) + ' ms';
      else if (key === 'feedback' || key === 'mix') el.textContent = Math.round(value * 100) + '%';
      else if (key === 'lowcut') el.textContent = Math.round(value) + ' Hz';
      else if (key === 'highcut') el.textContent = value >= 1000 ? (value / 1000).toFixed(1) + ' kHz' : Math.round(value) + ' Hz';
    }
    if (key === 'time') {
      var syncBtns = this.root.querySelectorAll('.pdy-sync');
      for (var i = 0; i < syncBtns.length; i++) {
        syncBtns[i].classList.toggle('is-active', Math.abs(+syncBtns[i].getAttribute('data-ms') - value) < 8);
      }
    }
    this.applyParams();
  };

  Widget.prototype.setTime = function (ms) {
    var input = this.root.querySelector('.pdy-param[data-key="time"] input');
    if (input) input.value = ms;
    this.setParam('time', ms);
  };

  Widget.prototype.applyPreset = function (id) {
    for (var i = 0; i < PRESETS.length; i++) {
      var p = PRESETS[i];
      if (p.id !== id) continue;
      this.setTime(p.values.time);
      this.setParam('feedback', p.values.feedback / 100);
      this.setParam('mix', p.values.mix / 100);
      this.setParam('lowcut', p.values.lowcut);
      this.setParam('highcut', p.values.highcut);
      this.pingPong = !!p.values.pingpong;
      if (this.elPingPong) this.elPingPong.classList.toggle('is-active', this.pingPong);
      var fbInput = this.root.querySelector('.pdy-param[data-key="feedback"] input');
      if (fbInput) fbInput.value = p.values.feedback;
      var mixInput = this.root.querySelector('.pdy-param[data-key="mix"] input');
      if (mixInput) mixInput.value = p.values.mix;
      var lcInput = this.root.querySelector('.pdy-param[data-key="lowcut"] input');
      if (lcInput) lcInput.value = p.values.lowcut;
      var hcInput = this.root.querySelector('.pdy-param[data-key="highcut"] input');
      if (hcInput) hcInput.value = p.values.highcut;
      this.applyParams();
      var presetBtns = this.root.querySelectorAll('.pdy-preset');
      for (var b = 0; b < presetBtns.length; b++) {
        presetBtns[b].classList.toggle('is-active', presetBtns[b].getAttribute('data-id') === id);
      }
      break;
    }
  };

  // ===== Visual =====
  Widget.prototype.drawWaveStatic = function () {
    var s = setupCanvas(this.elWave);
    if (!s) return;
    var g = s.ctx, w = s.w, h = s.h;
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(128,128,128,.12)';
    g.lineWidth = 1;
    for (var y = 0; y < h; y += 28) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    g.strokeStyle = 'rgba(156,156,176,.5)';
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  };

  Widget.prototype.drawWaveFrame = function (next) {
    var self = this;
    if (!this.analyser || !this.playing) return;
    var s = setupCanvas(this.elWave);
    if (!s) { this.rafId = requestAnimationFrame(next); return; }
    var g = s.ctx, w = s.w, h = s.h;
    var data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);

    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(0, 0, w, h);

    // grid
    g.strokeStyle = 'rgba(128,128,128,.10)';
    g.lineWidth = 1;
    for (var y = 0; y < h; y += 28) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }

    var accent = cssVar('--accent-orange', '#F2994A');
    g.beginPath();
    g.strokeStyle = this.bypass ? 'rgba(156,156,176,.8)' : accent;
    g.lineWidth = 1.6;
    var slice = w / data.length;
    for (var i = 0; i < data.length; i++) {
      var v = (data[i] / 128) - 1;
      var yy = h / 2 + v * (h * 0.42);
      if (i === 0) g.moveTo(0, yy);
      else g.lineTo(i * slice, yy);
    }
    g.stroke();

    // subtle wet overlay when delay is active
    if (!this.bypass && this.params.mix > 0.05) {
      g.beginPath();
      g.strokeStyle = 'rgba(61, 232, 255, 0.35)';
      g.lineWidth = 1;
      for (var j = 0; j < data.length; j++) {
        var v2 = (data[j] / 128) - 1;
        var y2 = h / 2 + v2 * (h * 0.28) * this.params.mix;
        if (j === 0) g.moveTo(0, y2);
        else g.lineTo(j * slice, y2);
      }
      g.stroke();
    }

    this.rafId = requestAnimationFrame(next);
  };

  // ===== Boot =====
  var widgets = [];
  function boot() {
    var roots = document.querySelectorAll('.potok-delay');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (!root.__pdyInited) {
        root.__pdyInited = true;
        var w = new Widget(root);
        w.start();
        widgets.push(w);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // Material: пересборка DOM при ленивой загрузке контента
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () { setTimeout(boot, 0); });
  }
})();
