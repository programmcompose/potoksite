/* ========================================
   Potok Reverb Widget
   Встраивается в статьи через <div class="potok-reverb"></div>
   DSP: Web Audio API — ConvolverNode + сгенерированный импульс.
   Цепочка: Source → Dry/Wet; Source → PreDelay → HPF → LPF → Convolver.
   Источники: синтезированный бит 80 BPM и pluck-тон (арпеджио).
   В standalone-режиме (data-standalone) добавляются загрузка файла и микрофон.
   ======================================== */

(function () {
  'use strict';

  var BPM = 80;
  var BEAT_SEC = 60 / BPM;
  var STEP_SEC = BEAT_SEC / 4;
  var BARS = 2;
  var STEPS = BARS * 16;
  var LOOP_SEC = STEPS * STEP_SEC;

  var IR_DEBOUNCE_MS = 120;
  var MASTER_GAIN = 0.8;

  var DEFAULTS = { decay: 2.5, predelay: 30, mix: 35, dry: 100, hpf: 300, lpf: 8000 };

  var PRESETS = [
    { id: 'room',      label: 'Room (комната)',     values: { decay: 0.9, predelay: 15, mix: 25, dry: 100, hpf: 250, lpf: 9000 } },
    { id: 'hall',      label: 'Hall (зал)',         values: { decay: 2.5, predelay: 30, mix: 35, dry: 100, hpf: 300, lpf: 8000 } },
    { id: 'plate',     label: 'Plate (плита)',      values: { decay: 1.6, predelay: 10, mix: 40, dry: 90,  hpf: 400, lpf: 11000 } },
    { id: 'cathedral', label: 'Cathedral (собор)',  values: { decay: 5.5, predelay: 55, mix: 50, dry: 85,  hpf: 200, lpf: 6500 } },
    { id: 'ambient',   label: 'Ambient (атмосфера)', values: { decay: 7.0, predelay: 80, mix: 65, dry: 70,  hpf: 180, lpf: 5000 } }
  ];

  var SOURCES = [
    { id: 'beat', label: 'Бит' },
    { id: 'tone', label: 'Тон' }
  ];

  // ===== DSP helpers (синтез источников, тот же бит что в delay/compressor) =====
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

  function toStereoBuffer(ctx, out) {
    var sr = ctx.sampleRate;
    var buffer = ctx.createBuffer(2, out.length, sr);
    if (buffer.copyToChannel) {
      buffer.copyToChannel(out, 0);
      buffer.copyToChannel(out, 1);
    } else {
      buffer.getChannelData(0).set(out);
      buffer.getChannelData(1).set(out);
    }
    return buffer;
  }

  function normalizePeak(out) {
    var peak = 0;
    for (var i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0.01) {
      var g = 0.8 / peak;
      for (var j = 0; j < out.length; j++) out[j] *= g;
    }
  }

  // Драм-луп: kick + snare + hat, 2 такта @ 80 BPM — тот же сигнал, что в инструменте Delay
  function synthBeat(ctx) {
    var sr = ctx.sampleRate;
    var len = Math.ceil(LOOP_SEC * sr);
    var out = new Float32Array(len);

    var kicks  = [0, 8, 16, 24];
    var snares = [4, 12, 20, 28];
    var hats   = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];

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

    kicks.forEach(addKick);
    snares.forEach(addSnare);
    hats.forEach(function (s, i) { addHat(s, (i % 2 === 0) ? 0.55 : 0.28); });

    normalizePeak(out);
    return toStereoBuffer(ctx, out);
  }

  // Pluck-арпеджио (A минор): чёткая атака + затухание — pre-delay и хвост слышны отчётливо
  function synthTone(ctx) {
    var sr = ctx.sampleRate;
    var len = Math.ceil(LOOP_SEC * sr);
    var out = new Float32Array(len);

    var notes = [220.0, 261.63, 329.63, 440.0, 329.63, 261.63, 220.0, 174.61];
    var stepDur = Math.floor(4 * STEP_SEC * sr); // четверть

    for (var n = 0; n < notes.length; n++) {
      var t0 = n * stepDur;
      if (t0 >= len) break;
      var dur = Math.min(len - t0, Math.floor(0.55 * sr));
      var phase = 0;
      for (var i = 0; i < dur; i++) {
        var t = i / sr;
        phase += 2 * Math.PI * notes[n] / sr;
        var p = (phase / (2 * Math.PI)) % 1;
        if (p < 0) p += 1;
        var tri = 4 * Math.abs(p - 0.5) - 1; // треугольник
        out[t0 + i] += tri * Math.exp(-t / 0.13) * 0.8;
      }
    }

    normalizePeak(out);
    return toStereoBuffer(ctx, out);
  }

  // Импульс для ConvolverNode: шум с экспоненциальным огибающим + усиленные ранние отражения (первые 80 мс)
  function makeImpulse(ctx, decay) {
    var rate = ctx.sampleRate;
    var length = Math.max(Math.floor(rate * 0.05), Math.floor(rate * decay));
    var impulse = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = impulse.getChannelData(ch);
      for (var i = 0; i < length; i++) {
        var t = i / rate;
        var envelope = Math.exp(-t * (6.0 / decay));
        var noise = Math.random() * 2 - 1;
        var early = i < rate * 0.08 ? 1.2 : 1.0;
        data[i] = noise * envelope * early * (ch === 0 ? 1 : 0.92 + Math.random() * 0.08);
      }
    }
    return impulse;
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
    this.standalone = !!root.getAttribute('data-standalone');
  }

  Widget.prototype.start = function () {
    var self = this;
    this.params = {};
    for (var k in DEFAULTS) this.params[k] = DEFAULTS[k];
    this.ctx = null;
    this.dryGain = null;
    this.wetGain = null;
    this.master = null;
    this.preDelay = null;
    this.hpf = null;
    this.lpf = null;
    this.convolver = null;
    this.analyser = null;
    this.bufferSource = null;
    this.mediaStreamSrc = null;
    this.micStream = null;
    this.fileBuffer = null;
    this.playing = false;
    this.bypass = false;
    this.sourceMode = 'beat';
    this.rafId = 0;
    this.irTimer = 0;

    this.buildDom();
    for (var d in DEFAULTS) this.setParam(d, DEFAULTS[d]);
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
    root.classList.add('prv');
    if (this.standalone) root.classList.add('prv--full');

    var html = '';
    html += '<div class="prv-head">';
    html += '<button type="button" class="prv-btn prv-play"><span class="prv-ic">&#9654;</span><span class="prv-play-label">Play</span></button>';
    html += '<button type="button" class="prv-bypass" aria-pressed="false" title="Горячая клавиша B"><span class="prv-bypass-t">BYPASS</span><span class="prv-bypass-s">A/B · B</span></button>';
    html += '<div class="prv-presets">';
    for (var i = 0; i < PRESETS.length; i++) {
      html += '<button type="button" class="prv-preset" data-id="' + PRESETS[i].id + '">' + PRESETS[i].label + '</button>';
    }
    html += '</div></div>';

    html += '<div class="prv-row">';
    html += '<span class="prv-row-label">Сигнал</span>';
    for (var s = 0; s < SOURCES.length; s++) {
      html += '<button type="button" class="prv-src' + (SOURCES[s].id === 'beat' ? ' is-active' : '') + '" data-src="' + SOURCES[s].id + '">' + SOURCES[s].label + '</button>';
    }
    if (this.standalone) {
      html += '<span class="prv-filewrap"><button type="button" class="prv-src" data-src="file">&#128193; Файл</button><input type="file" accept="audio/*"></span>';
      html += '<button type="button" class="prv-src" data-src="mic">&#127908; Мик</button>';
    }
    html += '</div>';

    html += '<div class="prv-viz">';
    html += '<canvas class="prv-wave"></canvas>';
    html += '<div class="prv-tail-wrap"><div class="prv-tail-bar" style="height: 4px;"></div><div class="prv-tail-label">wet<br><span class="prv-tail-val">0%</span></div></div>';
    html += '</div>';

    var paramsDef = [
      { key: 'decay',    label: 'Decay' },
      { key: 'predelay', label: 'Pre-Delay' },
      { key: 'mix',      label: 'Mix / Wet' },
      { key: 'dry',      label: 'Dry' },
      { key: 'hpf',      label: 'HPF (низ)' },
      { key: 'lpf',      label: 'LPF (верх)' }
    ];
    html += '<div class="prv-params">';
    for (var p = 0; p < paramsDef.length; p++) {
      var d = paramsDef[p];
      html += '<label class="prv-param" data-key="' + d.key + '">';
      html += '<span class="prv-plabel">' + d.label + '</span>';
      html += '<input type="range">';
      html += '<span class="prv-pval"></span>';
      html += '</label>';
    }
    html += '</div>';

    root.innerHTML = html;

    var self = this;
    var ranges = {
      decay:    { min: 0.2, max: 12 },
      predelay: { min: 0,   max: 150 },
      mix:      { min: 0,   max: 100 },
      dry:      { min: 0,   max: 100 },
      hpf:      { min: 20,  max: 1000 },
      lpf:      { min: 2000, max: 16000 }
    };

    for (var r = 0; r < paramsDef.length; r++) {
      var def = paramsDef[r];
      var cfg = ranges[def.key];
      var input = root.querySelector('.prv-param[data-key="' + def.key + '"] input');
      input.min = cfg.min;
      input.max = cfg.max;
      (function (key, input) {
        input.addEventListener('input', function () {
          self.setParam(key, parseFloat(input.value));
        });
      })(def.key, input);
    }

    var presetBtns = root.querySelectorAll('.prv-preset');
    for (var pb = 0; pb < presetBtns.length; pb++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.applyPreset(btn.getAttribute('data-id')); });
      })(presetBtns[pb]);
    }

    var srcBtns = root.querySelectorAll('.prv-src');
    for (var sb = 0; sb < srcBtns.length; sb++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.setSource(btn.getAttribute('data-src')); });
      })(srcBtns[sb]);
    }

    if (this.standalone) {
      var fileInput = root.querySelector('.prv-filewrap input');
      fileInput.addEventListener('change', function () { self.loadFile(fileInput); });
    }

    this.elPlay = root.querySelector('.prv-play');
    this.elBypass = root.querySelector('.prv-bypass');
    this.elWave = root.querySelector('.prv-wave');
    this.elTailBar = root.querySelector('.prv-tail-bar');
    this.elTailVal = root.querySelector('.prv-tail-val');

    var self2 = this;
    this.elPlay.addEventListener('click', function () {
      if (self2.playing) self2.stop(); else self2.startPlayback();
    });
    this.elBypass.addEventListener('click', function () { self2.toggleBypass(); });

    this.syncSliders();
  };

  Widget.prototype.syncSliders = function () {
    var keys = ['decay', 'predelay', 'mix', 'dry', 'hpf', 'lpf'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var input = this.root.querySelector('.prv-param[data-key="' + k + '"] input');
      if (!input) continue;
      input.value = Math.round(this.params[k] * 10) / 10;
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
    var ctx = this.ctx;

    this.stopSourceNodes();

    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.master = ctx.createGain();
    this.preDelay = ctx.createDelay(1.0);
    this.hpf = ctx.createBiquadFilter();
    this.lpf = ctx.createBiquadFilter();
    this.convolver = ctx.createConvolver();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;

    this.hpf.type = 'highpass';
    this.hpf.Q.value = 0.7;
    this.lpf.type = 'lowpass';
    this.lpf.Q.value = 0.7;
    this.master.gain.value = MASTER_GAIN;

    // Source → Dry/Wet; Source → PreDelay → HPF → LPF → Convolver
    var src = ctx.createBufferSource();
    if (this.sourceMode === 'beat' || this.sourceMode === 'tone') {
      src.buffer = this.sourceMode === 'beat' ? synthBeat(ctx) : synthTone(ctx);
      src.loop = true;
      this.bufferSource = src;
    } else if (this.sourceMode === 'file' && this.fileBuffer) {
      src.buffer = this.fileBuffer;
      src.loop = true;
      this.bufferSource = src;
    }

    if (src.buffer) {
      src.connect(this.dryGain);
      src.connect(this.preDelay);
      this.preDelay.connect(this.hpf);
      this.hpf.connect(this.lpf);
      this.lpf.connect(this.convolver);
      this.convolver.connect(this.wetGain);
    }

    if (this.sourceMode === 'mic' && this.micStream) {
      var micSrc = ctx.createMediaStreamSource(this.micStream);
      this.mediaStreamSrc = micSrc;
      micSrc.connect(this.dryGain);
      micSrc.connect(this.preDelay);
    }

    this.convolver.buffer = makeImpulse(ctx, this.params.decay);

    this.dryGain.connect(this.master);
    this.wetGain.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.applyParams();
    this.updateBypassUi();
  };

  Widget.prototype.stopSourceNodes = function () {
    if (this.bufferSource) {
      try { this.bufferSource.stop(); } catch (e) {}
      try { this.bufferSource.disconnect(); } catch (e) {}
      this.bufferSource = null;
    }
    if (this.mediaStreamSrc) {
      try { this.mediaStreamSrc.disconnect(); } catch (e) {}
      this.mediaStreamSrc = null;
    }
  };

  Widget.prototype.applyParams = function () {
    if (!this.ctx) return;
    var ctx = this.ctx;

    this.preDelay.delayTime.setTargetAtTime(this.params.predelay / 1000, ctx.currentTime, 0.01);
    this.hpf.frequency.setTargetAtTime(this.params.hpf, ctx.currentTime, 0.02);
    this.lpf.frequency.setTargetAtTime(this.params.lpf, ctx.currentTime, 0.02);

    var wet = this.bypass ? 0 : this.params.mix / 100;
    var dry = this.bypass ? 1 : this.params.dry / 100;
    this.wetGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.02);
    this.dryGain.gain.setTargetAtTime(dry, ctx.currentTime, 0.02);

    if (this.elTailVal) this.elTailVal.textContent = Math.round(wet * 100) + '%';
    if (this.elTailBar) this.elTailBar.style.height = Math.max(2, wet * 110) + 'px';
  };

  Widget.prototype.scheduleImpulse = function () {
    var self = this;
    if (!this.ctx) return;
    clearTimeout(this.irTimer);
    this.irTimer = setTimeout(function () {
      if (self.convolver && self.ctx) {
        self.convolver.buffer = makeImpulse(self.ctx, self.params.decay);
      }
    }, IR_DEBOUNCE_MS);
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
    this.elPlay.querySelector('.prv-ic').innerHTML = '&#9632;';
    this.elPlay.querySelector('.prv-play-label').textContent = 'Stop';

    if (this.bufferSource) {
      try {
        this.bufferSource.start(0);
      } catch (e) {
        this.buildGraph();
        if (this.bufferSource) this.bufferSource.start(0);
      }
    }
    function loop() { self.drawWaveFrame(loop); }
    this.drawWaveFrame(loop);
  };

  Widget.prototype.stopInternal = function () {
    // остановка воспроизведения без убийства mic-потока (для переключения источников)
    this.playing = false;
    clearTimeout(this.irTimer);
    this.stopSourceNodes();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  };

  Widget.prototype.stop = function () {
    this.playing = false;
    this.elPlay.classList.remove('is-playing');
    this.elPlay.querySelector('.prv-ic').innerHTML = '&#9654;';
    this.elPlay.querySelector('.prv-play-label').textContent = 'Play';
    clearTimeout(this.irTimer);
    if (this.bufferSource) {
      try { this.bufferSource.stop(); } catch (e) {}
      try { this.bufferSource.disconnect(); } catch (e) {}
      this.bufferSource = null;
    }
    if (this.mediaStreamSrc) {
      try { this.mediaStreamSrc.disconnect(); } catch (e) {}
      this.mediaStreamSrc = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(function (t) { t.stop(); });
      this.micStream = null;
    }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    // rebuild so next play is clean
    if (this.ctx) this.buildGraph();
    this.drawWaveStatic();
  };

  Widget.prototype.setSource = function (mode) {
    var btns = this.root.querySelectorAll('.prv-src');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('is-active');
    var active = this.root.querySelector('.prv-src[data-src="' + mode + '"]');
    if (active) active.classList.add('is-active');

    if (mode === 'mic') {
      var selfMic = this;
      this.ensureCtx();
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        selfMic.micStream = stream;
        selfMic.sourceMode = 'mic';
        var wasPlaying = selfMic.playing;
        if (wasPlaying) selfMic.stopInternal(); // не убиваем новый mic-поток
        selfMic.buildGraph();
        if (!selfMic.playing) selfMic.startPlayback();
      }).catch(function (err) {
        alert('Микрофон: ' + err.message);
      });
      return;
    }

    this.sourceMode = mode;
    var wasPlaying = this.playing;
    if (this.micStream) {
      this.micStream.getTracks().forEach(function (t) { t.stop(); });
      this.micStream = null;
    }
    if (wasPlaying) this.stop();
    if (this.ctx) this.buildGraph();
    if (wasPlaying) this.startPlayback();
  };

  Widget.prototype.loadFile = function (input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var self = this;
    this.ensureCtx();
    var reader = new FileReader();
    reader.onload = function () {
      self.ctx.decodeAudioData(reader.result, function (buffer) {
        self.fileBuffer = buffer;
        self.setSource('file');
        if (!self.playing) self.startPlayback();
      }, function () {
        alert('Не удалось декодировать файл: ' + file.name);
      });
    };
    reader.readAsArrayBuffer(file);
  };

  // ===== Params API =====
  Widget.prototype.setParam = function (key, value) {
    this.params[key] = value;
    var el = this.root.querySelector('.prv-param[data-key="' + key + '"] .prv-pval');
    if (el) {
      if (key === 'decay') el.textContent = value.toFixed(1) + ' s';
      else if (key === 'predelay') el.textContent = Math.round(value) + ' ms';
      else if (key === 'mix' || key === 'dry') el.textContent = Math.round(value) + '%';
      else if (key === 'hpf') el.textContent = Math.round(value) + ' Hz';
      else if (key === 'lpf') el.textContent = value >= 1000 ? (value / 1000).toFixed(1) + ' kHz' : Math.round(value) + ' Hz';
    }
    this.applyParams();
    if (key === 'decay') this.scheduleImpulse();
  };

  Widget.prototype.applyPreset = function (id) {
    for (var i = 0; i < PRESETS.length; i++) {
      var p = PRESETS[i];
      if (p.id !== id) continue;
      this.setParam('decay', p.values.decay);
      this.setParam('predelay', p.values.predelay);
      this.setParam('mix', p.values.mix);
      this.setParam('dry', p.values.dry);
      this.setParam('hpf', p.values.hpf);
      this.setParam('lpf', p.values.lpf);
      var input = this.root.querySelector('.prv-param[data-key="decay"] input');
      if (input) input.value = p.values.decay;
      var pdInput = this.root.querySelector('.prv-param[data-key="predelay"] input');
      if (pdInput) pdInput.value = p.values.predelay;
      var mixInput = this.root.querySelector('.prv-param[data-key="mix"] input');
      if (mixInput) mixInput.value = p.values.mix;
      var dryInput = this.root.querySelector('.prv-param[data-key="dry"] input');
      if (dryInput) dryInput.value = p.values.dry;
      var hpfInput = this.root.querySelector('.prv-param[data-key="hpf"] input');
      if (hpfInput) hpfInput.value = p.values.hpf;
      var lpfInput = this.root.querySelector('.prv-param[data-key="lpf"] input');
      if (lpfInput) lpfInput.value = p.values.lpf;
      var presetBtns = this.root.querySelectorAll('.prv-preset');
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

    // subtle wet overlay when reverb is active
    if (!this.bypass && this.params.mix > 5) {
      g.beginPath();
      g.strokeStyle = 'rgba(61, 232, 255, 0.35)';
      g.lineWidth = 1;
      for (var j = 0; j < data.length; j++) {
        var v2 = (data[j] / 128) - 1;
        var y2 = h / 2 + v2 * (h * 0.28) * (this.params.mix / 100);
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
    var roots = document.querySelectorAll('.potok-reverb');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (!root.__prvInited) {
        root.__prvInited = true;
        var w = new Widget(root);
        w.start();
        widgets.push(w);
      }
    }
    for (var k = 0; k < widgets.length; k++) {
      if (!document.contains(widgets[k].root) && widgets[k].playing) widgets[k].stop();
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
