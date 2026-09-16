/* ========================================
   Potok Compressor Widget v2
   + knee, dry/wet, auto-makeup, sources
   + GR peak-hold, colour meter, curve tip
   + active presets, hotkey B = bypass
   ======================================== */

(function () {
  'use strict';

  var BPM = 90;
  var BARS = 2;
  var STEPS_PER_BAR = 16;
  var BEAT_SEC = 60 / BPM;
  var STEP_SEC = BEAT_SEC / 4;
  var LOOP_SEC = BARS * STEPS_PER_BAR * STEP_SEC;

  var CROSSFADE_SEC = 0.01;
  var RERENDER_DEBOUNCE_MS = 150;
  var DRY_PEAK_DBFS = -6;
  var PEAK_HOLD_MS = 900;

  var DEFAULTS = {
    threshold: -24, ratio: 4, attack: 10, release: 200,
    makeup: 0, knee: 6, mix: 100
  };

  var PRESETS = [
    { id: 'melody', label: 'Мелодия 2:1 slow', values: { threshold: -24, ratio: 2, attack: 60, release: 300, makeup: 3, knee: 12, mix: 100 } },
    { id: 'snare',  label: 'Snare punch fast', values: { threshold: -18, ratio: 4, attack: 5,  release: 120, makeup: 4, knee: 3,  mix: 100 } },
    { id: 'bus',    label: 'Bus 1.5:1',        values: { threshold: -30, ratio: 1.5, attack: 80, release: 600, makeup: 1, knee: 10, mix: 100 } }
  ];

  var SOURCES = [
    { id: 'beat',  label: 'Бит' },
    { id: 'kick',  label: 'Kick' },
    { id: 'snare', label: 'Snare' }
  ];

  function dbToLin(db) { return Math.pow(10, db / 20); }
  function linToDb(x) { x = Math.abs(x); if (x < 1e-7) x = 1e-7; return 20 * Math.log10(x); }

  function softKneeOut(db, thresh, ratio, kneeDb) {
    var k = Math.max(0.01, kneeDb == null ? 6 : kneeDb);
    if (db <= thresh - k / 2) return db;
    if (db >= thresh + k / 2) return thresh + (db - thresh) / ratio;
    var u = db - thresh + k / 2;
    return db - (1 - 1 / ratio) * u * u / (2 * k);
  }

  function tri(phase) {
    var p = (phase / (2 * Math.PI)) % 1;
    if (p < 0) p += 1;
    return 4 * Math.abs(p - 0.5) - 1;
  }

  function biquadCoeffs(type, freq, Q, sr) {
    var w0 = 2 * Math.PI * freq / sr;
    var alpha = Math.sin(w0) / (2 * Q);
    var cosw = Math.cos(w0), sinw = Math.sin(w0);
    var b0, b1, b2, a0, a1, a2;
    if (type === 'highpass') {
      b0 = (1 + sinw) / 2; b1 = -cosw; b2 = (1 - sinw) / 2;
    } else {
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
    mode = mode || 'beat';
    var sr = ctx.sampleRate;
    var len = Math.ceil(LOOP_SEC * sr);
    var out = new Float32Array(len);

    var kicks = [0, 8, 16, 24];
    var snares = [4, 12, 20, 28];
    var doKick = mode === 'beat' || mode === 'kick';
    var doSnare = mode === 'beat' || mode === 'snare';
    var doHat = mode === 'beat';

    function addKick(step) {
      var t0 = Math.floor(step * STEP_SEC * sr);
      if (t0 >= len) return;
      var dur = Math.min(len - t0, Math.floor(0.30 * sr));
      var phase = 0;
      for (var i = 0; i < dur; i++) {
        var t = i / sr;
        var f = 50 + 100 * Math.exp(-t / 0.04);
        phase += 2 * Math.PI * f / sr;
        out[t0 + i] += Math.sin(phase) * Math.exp(-t / 0.09);
      }
      var clickDur = Math.min(len - t0, Math.floor(0.004 * sr));
      for (var j = 0; j < clickDur; j++) {
        out[t0 + j] += (Math.random() * 2 - 1) * Math.exp(-j / (sr * 0.001)) * 0.5;
      }
    }

    function addSnare(step) {
      var t0 = Math.floor(step * STEP_SEC * sr);
      if (t0 >= len) return;
      var bodyDur = Math.min(len - t0, Math.floor(0.12 * sr));
      var phase = 0;
      for (var i = 0; i < bodyDur; i++) {
        var t = i / sr;
        phase += 2 * Math.PI * 195 / sr;
        out[t0 + i] += tri(phase) * Math.exp(-t / 0.035) * 0.7;
      }
      var nDur = Math.min(len - t0, Math.floor(0.20 * sr));
      var noise = new Float32Array(nDur);
      for (var k = 0; k < nDur; k++) {
        noise[k] = (Math.random() * 2 - 1) * Math.exp(-(k / sr) / 0.05);
      }
      applyBiquad(noise, biquadCoeffs('bandpass', 1800, 0.9, sr));
      for (var m = 0; m < nDur; m++) out[t0 + m] += noise[m] * 1.4;
    }

    function addHat(step, vel) {
      var t0 = Math.floor(step * STEP_SEC * sr);
      if (t0 >= len) return;
      var hDur = Math.min(len - t0, Math.floor(0.05 * sr));
      var noise = new Float32Array(hDur);
      for (var i = 0; i < hDur; i++) {
        noise[i] = (Math.random() * 2 - 1) * Math.exp(-(i / sr) / 0.012);
      }
      applyBiquad(noise, biquadCoeffs('highpass', 7500, 0.8, sr));
      for (var j = 0; j < hDur; j++) out[t0 + j] += noise[j] * vel;
    }

    var s;
    if (doKick) for (s = 0; s < kicks.length; s++) addKick(kicks[s]);
    if (doSnare) for (s = 0; s < snares.length; s++) addSnare(snares[s]);
    if (doHat) {
      for (s = 0; s < STEPS_PER_BAR * BARS; s += 2) {
        addHat(s, (s % 4 === 2) ? 0.28 : 0.38);
      }
    }

    var peak = 0;
    for (var i = 0; i < len; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 1e-9) {
      var g = dbToLin(DRY_PEAK_DBFS) / peak;
      for (var j = 0; j < len; j++) out[j] *= g;
    }

    var buf = ctx.createBuffer(1, len, sr);
    if (buf.copyToChannel) buf.copyToChannel(out, 0); else buf.getChannelData(0).set(out);
    return buf;
  }

  function processLoop(ctx, dryBuf, p) {
    var sr = dryBuf.sampleRate;
    var x = dryBuf.getChannelData(0);
    var n = x.length;
    var out = new Float32Array(n);
    var grArr = new Float32Array(n);
    var envDbArr = new Float32Array(n);

    var atkTC = Math.max(p.attack, 0.1) / 1000;
    var relTC = Math.max(p.release, 5) / 1000;
    var dt = 1 / sr;
    var atkCoef = 1 - Math.exp(-dt / atkTC);
    var relCoef = 1 - Math.exp(-dt / relTC);
    var makeupLin = dbToLin(p.makeup);
    var knee = p.knee != null ? p.knee : 6;

    var env = 0;
    var grSum = 0, grCnt = 0;
    for (var i = 0; i < n; i++) {
      var a = Math.abs(x[i]);
      if (a > env) env += (a - env) * atkCoef;
      else env -= (env - a) * relCoef;

      var inDb = linToDb(env);
      var outDb = softKneeOut(inDb, p.threshold, p.ratio, knee);
      var gr = Math.max(0, inDb - outDb);
      var gain = dbToLin(-gr) * makeupLin;

      var v = x[i] * gain;
      if (v > 0.98) v = 0.98 + 0.02 * Math.tanh((v - 0.98) / 0.02);
      else if (v < -0.98) v = -0.98 - 0.02 * Math.tanh((-0.98 - v) / 0.02);

      out[i] = v;
      grArr[i] = gr;
      envDbArr[i] = inDb;
      if (gr > 0.5) { grSum += gr; grCnt++; }
    }

    var avgGr = grCnt ? grSum / grCnt : 0;
    var buf = ctx.createBuffer(1, n, sr);
    if (buf.copyToChannel) buf.copyToChannel(out, 0); else buf.getChannelData(0).set(out);
    return { buffer: buf, gr: grArr, envDb: envDbArr, avgGr: avgGr };
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

  function Widget(root) {
    this.root = root;
    this.standalone = !!root.getAttribute('data-standalone');
  }

  Widget.prototype.start = function () {
    this.params = {};
    for (var k in DEFAULTS) this.params[k] = DEFAULTS[k];
    this.ctx = null;
    this.master = null;
    this.dryGain = null;
    this.wetGain = null;
    this.drySrc = null;
    this.wetSrc = null;
    this.t0 = 0;
    this.playing = false;
    this.bypass = false;
    this.autoMakeup = false;
    this.source = 'beat';
    this.activePreset = null;
    this.dryBuf = null;
    this.wet = null;
    this.rafId = 0;
    this.renderTimer = 0;
    this.grPeak = 0;
    this.grPeakUntil = 0;
    this.buildDom();
    this.bindEvents();
    this.refreshIcons();
    this.onResize();
  };

  Widget.prototype.buildDom = function () {
    var self = this;
    var root = this.root;
    root.classList.add('pcp');
    if (this.standalone) root.classList.add('pcp--full');

    var paramsDef = [
      { key: 'threshold', label: 'Threshold', min: -40, max: 0,   log: false, fmt: function (v) { return Math.round(v) + ' dB'; } },
      { key: 'ratio',     label: 'Ratio',     min: 1,   max: 20,  log: true,  fmt: function (v) { return v.toFixed(1) + ' : 1'; } },
      { key: 'knee',      label: 'Knee',      min: 0,   max: 24,  log: false, fmt: function (v) { return Math.round(v) + ' dB'; } },
      { key: 'attack',    label: 'Attack',    min: 0.1, max: 100, log: true,  fmt: function (v) { return (v < 10 ? v.toFixed(1) : Math.round(v)) + ' мс'; } },
      { key: 'release',   label: 'Release',   min: 10,  max: 1000, log: true, fmt: function (v) { return Math.round(v) + ' мс'; } },
      { key: 'makeup',    label: 'Makeup',    min: -12, max: 12, log: false, fmt: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1).replace('.0', '') + ' dB'; } },
      { key: 'mix',       label: 'Dry/Wet',   min: 0,   max: 100, log: false, fmt: function (v) { return Math.round(v) + '%'; } }
    ];

    var html = '';
    html += '<div class="pcp-head">';
    html += '<button type="button" class="pcp-btn pcp-play"><span class="pcp-ic"><i data-lucide="play"></i></span><span class="pcp-play-label">Play</span></button>';
    html += '<button type="button" class="pcp-bypass" aria-pressed="false" title="Клавиша B"><span class="pcp-bypass-t">BYPASS</span><span class="pcp-bypass-s">A/B · B</span></button>';
    html += '<div class="pcp-presets">';
    for (var i = 0; i < PRESETS.length; i++) {
      html += '<button type="button" class="pcp-preset" data-preset="' + PRESETS[i].id + '">' + PRESETS[i].label + '</button>';
    }
    html += '</div></div>';

    html += '<div class="pcp-row">';
    html += '<span class="pcp-row-label">Сигнал</span>';
    for (var s = 0; s < SOURCES.length; s++) {
      html += '<button type="button" class="pcp-src' + (SOURCES[s].id === 'beat' ? ' is-active' : '') + '" data-src="' + SOURCES[s].id + '">' + SOURCES[s].label + '</button>';
    }
    html += '<button type="button" class="pcp-toggle" data-auto="1" title="Компенсировать среднюю громкость">Auto makeup</button>';
    html += '</div>';

    html += '<div class="pcp-viz">';
    html += '<canvas class="pcp-wave"></canvas>';
    html += '<div class="pcp-grwrap"><canvas class="pcp-gr"></canvas><span class="pcp-grval">0.0 dB</span><span class="pcp-grpeak">peak 0.0</span></div>';
    html += '</div>';

    html += '<div class="pcp-curve-wrap"><canvas class="pcp-curve"></canvas><div class="pcp-curve-tip"></div></div>';

    html += '<div class="pcp-params">';
    for (var j = 0; j < paramsDef.length; j++) {
      var d = paramsDef[j];
      html += '<label class="pcp-param" data-key="' + d.key + '">';
      html += '<span class="pcp-plabel">' + d.label + '</span>';
      html += '<input type="range" min="0" max="1000" value="500">';
      html += '<span class="pcp-pval"></span></label>';
    }
    html += '</div>';

    root.innerHTML = html;
    this.paramsDef = paramsDef;

    for (var m = 0; m < paramsDef.length; m++) {
      var def = paramsDef[m];
      var input = root.querySelector('.pcp-param[data-key="' + def.key + '"] input');
      this.syncSlider(def);
      (function (def, input) {
        input.addEventListener('input', function () {
          var t = parseFloat(input.value) / 1000;
          var v = def.log
            ? sliderToParam(t * 1000, def.min, def.max)
            : def.min + t * (def.max - def.min);
          self.setParam(def.key, v);
        });
      })(def, input);
    }

    var presetBtns = root.querySelectorAll('.pcp-preset');
    for (var p = 0; p < presetBtns.length; p++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.applyPreset(btn.getAttribute('data-preset')); });
      })(presetBtns[p]);
    }

    var srcBtns = root.querySelectorAll('.pcp-src');
    for (var q = 0; q < srcBtns.length; q++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.setSource(btn.getAttribute('data-src')); });
      })(srcBtns[q]);
    }

    this.elPlay = root.querySelector('.pcp-play');
    this.elBypass = root.querySelector('.pcp-bypass');
    this.elAuto = root.querySelector('.pcp-toggle');
    this.elWave = root.querySelector('.pcp-wave');
    this.elGr = root.querySelector('.pcp-gr');
    this.elGrVal = root.querySelector('.pcp-grval');
    this.elGrPeak = root.querySelector('.pcp-grpeak');
    this.elCurve = root.querySelector('.pcp-curve');
    this.elCurveTip = root.querySelector('.pcp-curve-tip');

    this.elPlay.addEventListener('click', function () { self.togglePlay(); });
    this.elBypass.addEventListener('click', function () { self.toggleBypass(); });
    this.elAuto.addEventListener('click', function () { self.toggleAutoMakeup(); });
  };

  Widget.prototype.bindEvents = function () {
    var self = this;
    this._onResize = function () { self.onResize(); };
    window.addEventListener('resize', this._onResize);
    this._onKey = function (e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === 'b' || e.key === 'B') {
        if (!document.contains(self.root)) return;
        e.preventDefault();
        self.toggleBypass();
      }
    };
    window.addEventListener('keydown', this._onKey);
  };

  function sliderToParam(t, min, max) {
    t = Math.min(1000, Math.max(0, t)) / 1000;
    return Math.exp(Math.log(min) + t * (Math.log(max) - Math.log(min)));
  }
  function paramToSlider(v, min, max) {
    var t = (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min));
    return Math.round(t * 1000);
  }

  Widget.prototype.syncSlider = function (def) {
    var input = this.root.querySelector('.pcp-param[data-key="' + def.key + '"] input');
    var valEl = this.root.querySelector('.pcp-param[data-key="' + def.key + '"] .pcp-pval');
    if (!def.log) {
      var t = (this.params[def.key] - def.min) / (def.max - def.min);
      input.value = Math.round(Math.max(0, Math.min(1, t)) * 1000);
    } else {
      input.value = paramToSlider(Math.max(def.min, this.params[def.key]), def.min, def.max);
    }
    if (valEl) valEl.textContent = def.fmt(this.params[def.key]);
  };

  Widget.prototype.setParam = function (key, value) {
    this.params[key] = value;
    this.activePreset = null;
    this.markPresets();
    var def = null;
    for (var i = 0; i < this.paramsDef.length; i++) if (this.paramsDef[i].key === key) def = this.paramsDef[i];
    if (!def) return;
    this.syncSlider(def);
    if (key === 'mix') {
      this.applyMixGains();
      return;
    }
    this.scheduleRerender();
  };

  Widget.prototype.markPresets = function () {
    var btns = this.root.querySelectorAll('.pcp-preset');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-preset') === this.activePreset);
    }
  };

  Widget.prototype.applyPreset = function (id) {
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id !== id) continue;
      var v = PRESETS[i].values;
      for (var k in v) this.params[k] = v[k];
      this.activePreset = id;
      this.markPresets();
      for (var j = 0; j < this.paramsDef.length; j++) this.syncSlider(this.paramsDef[j]);
      this.scheduleRerender();
      return;
    }
  };

  Widget.prototype.setSource = function (id) {
    if (this.source === id) return;
    this.source = id;
    var btns = this.root.querySelectorAll('.pcp-src');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-src') === id);
    }
    if (!this.ctx) return;
    this.dryBuf = synthLoop(this.ctx, this.source);
    this.wet = processLoop(this.ctx, this.dryBuf, this.params);
    this.maybeAutoMakeup();
    if (this.playing) {
      this.stop();
      this.play();
    } else {
      this.onResize();
    }
  };

  Widget.prototype.toggleAutoMakeup = function () {
    this.autoMakeup = !this.autoMakeup;
    this.elAuto.classList.toggle('is-on', this.autoMakeup);
    if (this.autoMakeup && this.wet) this.maybeAutoMakeup(true);
    else this.scheduleRerender();
  };

  Widget.prototype.maybeAutoMakeup = function (force) {
    if (!this.autoMakeup || !this.wet) return;
    var target = this.wet.avgGr || 0;
    var next = Math.round(target * 10) / 10;
    if (force || Math.abs(next - this.params.makeup) > 0.15) {
      this.params.makeup = Math.max(-12, Math.min(12, next));
      for (var j = 0; j < this.paramsDef.length; j++) {
        if (this.paramsDef[j].key === 'makeup') this.syncSlider(this.paramsDef[j]);
      }
      this.wet = processLoop(this.ctx, this.dryBuf, this.params);
    }
  };

  Widget.prototype.applyMixGains = function () {
    if (!this.ctx || !this.playing) return;
    var mix = (this.params.mix != null ? this.params.mix : 100) / 100;
    if (this.bypass) {
      this.dryGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
      this.wetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    } else {
      this.dryGain.gain.setTargetAtTime(1 - mix, this.ctx.currentTime, 0.01);
      this.wetGain.gain.setTargetAtTime(mix, this.ctx.currentTime, 0.01);
    }
  };

  Widget.prototype.ensureAudio = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn('[compressor] Web Audio API не поддерживается'); return false; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.dryGain = this.ctx.createGain();
      this.wetGain = this.ctx.createGain();
      this.dryGain.connect(this.master);
      this.wetGain.connect(this.master);
      this.dryBuf = synthLoop(this.ctx, this.source);
      this.wet = processLoop(this.ctx, this.dryBuf, this.params);
      this.maybeAutoMakeup(true);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  };

  Widget.prototype.togglePlay = function () {
    if (this.playing) this.stop(); else this.play();
  };

  Widget.prototype.play = function () {
    if (!this.ensureAudio()) return;
    var ctx = this.ctx;
    this.killSources(0);
    var tNow = ctx.currentTime + 0.03;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0.9, tNow + CROSSFADE_SEC);
    this.drySrc = this.makeSource(this.dryBuf, tNow, 0);
    this.wetSrc = this.makeSource(this.wet.buffer, tNow, 0);
    this.t0 = tNow;
    var mix = (this.params.mix != null ? this.params.mix : 100) / 100;
    var dryTarget = this.bypass ? 1 : (1 - mix);
    var wetTarget = this.bypass ? 0 : mix;
    this.dryGain.gain.setValueAtTime(0, ctx.currentTime);
    this.wetGain.gain.setValueAtTime(0, ctx.currentTime);
    this.dryGain.gain.linearRampToValueAtTime(dryTarget, tNow + CROSSFADE_SEC);
    this.wetGain.gain.linearRampToValueAtTime(wetTarget, tNow + CROSSFADE_SEC);
    this.playing = true;
    this.setPlayUi(true);
    this.drawWaveStatic();
    this.frame();
  };

  Widget.prototype.makeSource = function (buf, when, offset) {
    var s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.connect(this._gainFor(buf));
    s.start(when, offset % LOOP_SEC);
    return s;
  };

  Widget.prototype._gainFor = function (buf) {
    return buf === this.dryBuf ? this.dryGain : this.wetGain;
  };

  Widget.prototype.stop = function () {
    var self = this;
    if (!this.ctx) return;
    var ctx = this.ctx;
    this.playing = false;
    this.setPlayUi(false);
    cancelAnimationFrame(this.rafId);
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    setTimeout(function () { self.killSources(0); }, 80);
    this.drawGr(0);
    this.drawCurve(null);
    if (this.elCurveTip) this.elCurveTip.classList.remove('is-on');
  };

  Widget.prototype.killSources = function (fadeSec) {
    var ctx = this.ctx;
    if (!ctx) return;
    [this.drySrc, this.wetSrc].forEach(function (s) {
      if (!s) return;
      try {
        if (fadeSec > 0) s.stop(ctx.currentTime + fadeSec); else s.stop();
      } catch (e) { /* */ }
    });
    this.drySrc = null;
    this.wetSrc = null;
  };

  Widget.prototype.toggleBypass = function () {
    this.bypass = !this.bypass;
    this.elBypass.classList.toggle('is-on', this.bypass);
    this.elBypass.setAttribute('aria-pressed', String(this.bypass));
    if (!this.ctx || !this.playing) return;
    this.applyMixGains();
  };

  Widget.prototype.scheduleRerender = function () {
    var self = this;
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(function () { self.rerenderWet(); }, RERENDER_DEBOUNCE_MS);
  };

  Widget.prototype.rerenderWet = function () {
    if (!this.ctx) return;
    this.wet = processLoop(this.ctx, this.dryBuf, this.params);
    this.maybeAutoMakeup(true);
    this.wet = processLoop(this.ctx, this.dryBuf, this.params);

    if (this.playing) {
      var ctx = this.ctx;
      var pos = ((ctx.currentTime - this.t0) % LOOP_SEC + LOOP_SEC) % LOOP_SEC;
      var oldSrc = this.wetSrc;
      var tNow = ctx.currentTime;
      var newSrc = ctx.createBufferSource();
      newSrc.buffer = this.wet.buffer;
      newSrc.loop = true;
      newSrc.connect(this.wetGain);
      this.wetGain.gain.cancelScheduledValues(tNow);
      var mix = (this.params.mix != null ? this.params.mix : 100) / 100;
      var target = this.bypass ? 0 : mix;
      this.wetGain.gain.setValueAtTime(0, tNow);
      this.wetGain.gain.linearRampToValueAtTime(target, tNow + CROSSFADE_SEC);
      newSrc.start(tNow, pos % LOOP_SEC);
      if (oldSrc) {
        var og = ctx.createGain();
        try { oldSrc.disconnect(); } catch (e) {}
        oldSrc.connect(og);
        og.gain.setValueAtTime(1, tNow);
        og.gain.linearRampToValueAtTime(0, tNow + CROSSFADE_SEC);
        og.connect(this.master);
        try { oldSrc.stop(tNow + CROSSFADE_SEC + 0.02); } catch (e) {}
      }
      this.wetSrc = newSrc;
      this.applyMixGains();
    }

    this.onResize();
    if (!this.playing) { this.drawGr(0); this.drawCurve(null); }
  };

  Widget.prototype.refreshIcons = function () {
    try {
      if (window.lucide && lucide.createIcons) {
        lucide.createIcons({ attrs: { 'stroke-width': 1.8, width: 16, height: 16 } });
      }
    } catch (e) { /* */ }
  };

  Widget.prototype.setPlayUi = function (playing) {
    var ic = this.elPlay.querySelector('.pcp-ic');
    var label = this.elPlay.querySelector('.pcp-play-label');
    if (ic) ic.innerHTML = '<i data-lucide="' + (playing ? 'pause' : 'play') + '"></i>';
    if (label) label.textContent = playing ? 'Stop' : 'Play';
    this.elPlay.classList.toggle('is-playing', playing);
    this.refreshIcons();
  };

  Widget.prototype.onResize = function () {
    var self = this;
    if (this._resizeTimer) clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(function () {
      self.drawWaveStatic();
      if (!self.playing) { self.drawGr(0); self.drawCurve(null); }
    }, 60);
  };

  Widget.prototype.drawWaveStatic = function () {
    var s = setupCanvas(this.elWave);
    if (!s || !this.dryBuf) return;
    var g = s.ctx, w = s.w, h = s.h;
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w * (window.devicePixelRatio || 1)));
    off.height = Math.max(1, Math.round(h * (window.devicePixelRatio || 1)));
    var og = off.getContext('2d');
    og.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    this._waveOff = off;
    this.drawWaveInto(og, w, h);
  };

  Widget.prototype.drawWaveInto = function (g, w, h) {
    var dryX = this.dryBuf.getChannelData(0);
    var wetX = this.wet ? this.wet.buffer.getChannelData(0) : null;
    var n = dryX.length;
    var mid = h / 2;
    g.clearRect(0, 0, w, h);
    g.strokeStyle = cssVar('--border-subtle', 'rgba(128,128,128,.15)');
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, mid); g.lineTo(w, mid);
    for (var b = 1; b < BARS * 4; b++) {
      var x = w * (b / (BARS * 4));
      g.moveTo(x, 0); g.lineTo(x, h);
    }
    g.stroke();
    function drawWave(data, color) {
      g.strokeStyle = color;
      g.lineWidth = 1;
      g.beginPath();
      for (var px = 0; px < w; px++) {
        var i0 = Math.floor(px / w * n);
        var i1 = Math.max(i0 + 1, Math.floor((px + 1) / w * n));
        var mn = 1, mx = -1;
        for (var i = i0; i < i1 && i < n; i++) {
          var v = data[i];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        g.moveTo(px + 0.5, mid - mx * (mid - 2));
        g.lineTo(px + 0.5, mid - mn * (mid - 2));
      }
      g.stroke();
    }
    drawWave(dryX, 'rgba(148, 155, 170, 0.45)');
    if (wetX) drawWave(wetX, cssVar('--accent-orange', '#F2994A'));
  };

  Widget.prototype.drawWaveFrame = function (posSec) {
    var s = setupCanvas(this.elWave);
    if (!s || !this._waveOff) return;
    var g = s.ctx, w = s.w, h = s.h;
    g.clearRect(0, 0, w, h);
    g.drawImage(this._waveOff, 0, 0, w, h);
    var x = Math.round(posSec / LOOP_SEC * w) + 0.5;
    g.strokeStyle = cssVar('--accent-orange', '#F2994A');
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x, h);
    g.stroke();
  };

  Widget.prototype.drawGr = function (grDb) {
    var s = setupCanvas(this.elGr);
    if (!s) return;
    var g = s.ctx, w = s.w, h = s.h;
    var MAX_GR = 24;
    var frac = Math.min(1, grDb / MAX_GR);
    var now = performance.now();
    if (grDb >= this.grPeak || now > this.grPeakUntil) {
      this.grPeak = grDb;
      this.grPeakUntil = now + PEAK_HOLD_MS;
    } else if (now > this.grPeakUntil - 200) {
      this.grPeak *= 0.92;
    }
    g.clearRect(0, 0, w, h);
    var horizontal = w > h * 2;
    g.fillStyle = 'rgba(128,128,128,.18)';
    if (horizontal) g.fillRect(0, h / 2 - 5, w, 10);
    else g.fillRect(w / 2 - 5, 0, 10, h);
    var color = grDb < 3 ? '#34d399' : grDb < 8 ? '#fbbf24' : '#f87171';
    if (frac > 0.004) {
      g.fillStyle = color;
      if (horizontal) g.fillRect(0, h / 2 - 5, Math.max(2, w * frac), 10);
      else g.fillRect(w / 2 - 5, 0, 10, Math.max(2, h * frac));
    }
    var pf = Math.min(1, this.grPeak / MAX_GR);
    g.fillStyle = '#fff';
    if (horizontal) g.fillRect(Math.max(0, w * pf - 1), h / 2 - 7, 2, 14);
    else g.fillRect(w / 2 - 7, Math.max(0, h * pf - 1), 14, 2);
    if (this.elGrVal) {
      this.elGrVal.textContent = grDb.toFixed(1) + ' dB';
      this.elGrVal.style.color = color;
    }
    if (this.elGrPeak) this.elGrPeak.textContent = 'peak ' + this.grPeak.toFixed(1);
  };

  Widget.prototype.drawCurve = function (inDbNow) {
    var s = setupCanvas(this.elCurve);
    if (!s) return;
    var g = s.ctx, w = s.w, h = s.h;
    var accent = cssVar('--accent-orange', '#F2994A');
    var muted = cssVar('--text-secondary', '#9CA3AF');
    var p = this.params;
    var knee = p.knee != null ? p.knee : 6;
    var DB_MIN = -60, DB_MAX = 0;
    function xOf(db) { return (db - DB_MIN) / (DB_MAX - DB_MIN) * w; }
    function yOf(db) { return h - (db - DB_MIN) / (DB_MAX - DB_MIN) * h; }
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(128,128,128,.14)';
    g.lineWidth = 1;
    g.beginPath();
    for (var db = DB_MIN; db <= DB_MAX; db += 15) {
      g.moveTo(xOf(db), 0); g.lineTo(xOf(db), h);
      g.moveTo(0, yOf(db)); g.lineTo(w, yOf(db));
    }
    g.stroke();
    g.fillStyle = muted;
    g.font = '10px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('вход, дБ →', 6, h - 6);
    g.textAlign = 'right';
    g.fillText('↑ выход, дБ', w - 6, 12);
    g.strokeStyle = 'rgba(148,155,170,.35)';
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(xOf(DB_MIN), yOf(DB_MIN));
    g.lineTo(xOf(DB_MAX), yOf(DB_MAX));
    g.stroke();
    g.setLineDash([]);
    if (knee > 0.5) {
      var k0 = p.threshold - knee / 2;
      var k1 = p.threshold + knee / 2;
      g.fillStyle = 'rgba(61, 232, 255, 0.08)';
      g.fillRect(xOf(k0), 0, xOf(k1) - xOf(k0), h);
    }
    g.strokeStyle = 'rgba(61, 232, 255, 0.45)';
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(xOf(p.threshold), 0);
    g.lineTo(xOf(p.threshold), h);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = accent;
    g.lineWidth = 2.2;
    g.beginPath();
    for (var px = 0; px <= w; px++) {
      var inDb = DB_MIN + px / w * (DB_MAX - DB_MIN);
      var outDb = softKneeOut(inDb, p.threshold, p.ratio, knee);
      if (px === 0) g.moveTo(px, yOf(outDb)); else g.lineTo(px, yOf(outDb));
    }
    g.stroke();
    if (inDbNow != null && isFinite(inDbNow)) {
      var outNow = softKneeOut(inDbNow, p.threshold, p.ratio, knee);
      var grNow = Math.max(0, inDbNow - outNow);
      var mx = xOf(Math.max(DB_MIN, Math.min(DB_MAX, inDbNow)));
      var my = yOf(outNow);
      if (grNow > 0.3) { g.shadowColor = accent; g.shadowBlur = 12; }
      g.fillStyle = accent;
      g.beginPath();
      g.arc(mx, my, 5, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = 'rgba(242,153,74,.4)';
      g.lineWidth = 1;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(mx, my); g.lineTo(mx, h);
      g.moveTo(mx, my); g.lineTo(0, my);
      g.stroke();
      g.setLineDash([]);
      if (this.elCurveTip) {
        this.elCurveTip.textContent = 'in ' + inDbNow.toFixed(1) + ' → out ' + outNow.toFixed(1) + '  GR ' + grNow.toFixed(1);
        this.elCurveTip.classList.add('is-on');
      }
    } else if (this.elCurveTip) {
      this.elCurveTip.classList.remove('is-on');
    }
  };

  Widget.prototype.frame = function () {
    var self = this;
    if (!this.playing || !this.ctx) return;
    var ctx = this.ctx;
    var pos = ((ctx.currentTime - this.t0) % LOOP_SEC + LOOP_SEC) % LOOP_SEC;
    var n = this.dryBuf.length;
    var idx = Math.min(n - 1, Math.floor(pos / LOOP_SEC * n));
    var win = Math.max(1, Math.floor(ctx.sampleRate * 0.003));
    var gr = 0;
    for (var i = idx - win; i <= idx + win; i++) {
      var j = ((i % n) + n) % n;
      if (this.wet.gr[j] > gr) gr = this.wet.gr[j];
    }
    this.drawWaveFrame(pos);
    this.drawCurve(this.wet.envDb[idx]);
    this.drawGr(gr);
    this.rafId = requestAnimationFrame(function () { self.frame(); });
  };

  var widgets = [];
  function boot() {
    var roots = document.querySelectorAll('.potok-compressor');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (!root.__pcpInited) {
        root.__pcpInited = true;
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
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () { setTimeout(boot, 0); });
  }
})();
