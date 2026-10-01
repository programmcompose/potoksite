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

  // Lucide-иконки (страницы курса и standalone подключают lucide глобально)
  function refreshIcons() {
    try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch (e) {}
  }

  // Упрощённые SVG-сцены для карточек пресетов (вместо фото из макета)
  var SCENES = {
    room: '<svg class="prv-scene" viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
      + '<rect width="120" height="64" fill="#2A1E14"/>'
      + '<line x1="0" y1="40" x2="120" y2="40" stroke="#5A4630" stroke-width="1.5"/>'
      + '<path d="M0 64 L48 40 M120 64 L72 40 M30 64 L52 40 M90 64 L68 40" stroke="#4A3A28" stroke-width="1"/>'
      + '<rect x="46" y="14" width="28" height="20" fill="#FFC97A" opacity=".5"/>'
      + '<path d="M60 14 V34 M46 24 H74" stroke="#2A1E14" stroke-width="1.5"/>'
      + '<circle cx="20" cy="30" r="3" fill="#FFB37A"/><circle cx="20" cy="30" r="8" fill="#FFB37A" opacity=".22"/>'
      + '<circle cx="100" cy="30" r="3" fill="#FFB37A"/><circle cx="100" cy="30" r="8" fill="#FFB37A" opacity=".22"/>'
      + '</svg>',
    hall: '<svg class="prv-scene" viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
      + '<rect width="120" height="64" fill="#0E1522"/>'
      + '<path d="M0 64 L60 34 M120 64 L60 34 M0 0 L60 34 M120 0 L60 34" stroke="#2A3A52" stroke-width="1"/>'
      + '<path d="M38 64 V22 Q60 8 82 22 V64" fill="none" stroke="#4DA3FF" opacity=".45" stroke-width="1.5"/>'
      + '<path d="M46 64 V27 Q60 17 74 27 V64" fill="none" stroke="#4DA3FF" opacity=".7" stroke-width="1.5"/>'
      + '<path d="M53 64 V31 Q60 25 67 31 V64" fill="none" stroke="#8FD0FF" opacity=".9" stroke-width="1.5"/>'
      + '</svg>',
    plate: '<svg class="prv-scene" viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
      + '<rect width="120" height="64" fill="#0D1320"/>'
      + '<defs><linearGradient id="prv-plate-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8FA3BF"/><stop offset=".5" stop-color="#4A5A74"/><stop offset="1" stop-color="#2A3648"/></linearGradient></defs>'
      + '<ellipse cx="60" cy="47" rx="34" ry="5" fill="#000" opacity=".4"/>'
      + '<rect x="26" y="16" width="68" height="26" rx="4" fill="url(#prv-plate-g)" stroke="#9FB4D4" stroke-width="1"/>'
      + '<path d="M32 20 L58 38 M44 18 L74 40" stroke="#C9D8EE" opacity=".5" stroke-width="1.5"/>'
      + '</svg>',
    cathedral: '<svg class="prv-scene" viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
      + '<rect width="120" height="64" fill="#0D1220"/>'
      + '<circle cx="60" cy="19" r="8.5" fill="none" stroke="#8FA3FF" opacity=".7" stroke-width="1.5"/>'
      + '<path d="M60 10.5 V27.5 M51.5 19 H68.5 M54 13 L66 25 M66 13 L54 25" stroke="#8FA3FF" opacity=".5" stroke-width="1"/>'
      + '<path d="M24 64 V30 Q24 14 42 10 Q52 8 56 18 V64" fill="none" stroke="#4DA3FF" opacity=".5" stroke-width="1.5"/>'
      + '<path d="M96 64 V30 Q96 14 78 10 Q68 8 64 18 V64" fill="none" stroke="#4DA3FF" opacity=".5" stroke-width="1.5"/>'
      + '<path d="M42 64 V34 Q42 22 60 18 Q78 22 78 34 V64" fill="none" stroke="#8FD0FF" opacity=".8" stroke-width="1.5"/>'
      + '</svg>',
    ambient: '<svg class="prv-scene" viewBox="0 0 120 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
      + '<rect width="120" height="64" fill="#0B1420"/>'
      + '<circle cx="92" cy="13" r="5" fill="#DCE8FF" opacity=".8"/>'
      + '<path d="M0 44 L26 22 L48 40 L70 18 L96 42 L120 30 V64 H0 Z" fill="#1B2A40"/>'
      + '<path d="M0 52 L30 34 L58 50 L84 32 L120 48 V64 H0 Z" fill="#24374F"/>'
      + '<rect x="0" y="46" width="120" height="3" fill="#9FC4E8" opacity=".18"/>'
      + '<rect x="0" y="54" width="120" height="3" fill="#9FC4E8" opacity=".12"/>'
      + '</svg>'
  };

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

  // ---------- Кноб (крутилка): drag / wheel / клавиатура / dblclick-reset ----------
  var KNOB_SWEEP_DEG = 270;   // ход по окружности
  var KNOB_START_DEG = 135;   // canvas-угол начала хода (левый нижний)
  var KNOB_TICKS = 11;

  function knobAngle(t) { return (KNOB_START_DEG + KNOB_SWEEP_DEG * t) * Math.PI / 180; }

  function Knob(opts) {
    this.el = opts.el;
    this.canvas = opts.canvas;
    this.min = opts.min;
    this.max = opts.max;
    this.log = !!opts.log;
    this.fmt = opts.fmt || function (v) { return String(v); };
    this.color = opts.color || null;
    this.defaultValue = opts.defaultValue != null ? opts.defaultValue : opts.value;
    this.value = opts.value != null ? opts.value : opts.defaultValue;
    this.onChange = opts.onChange || function () {};
    this.dragging = false;
    this._lastY = 0;
    this._bind();
    this.draw();
  }

  Knob.prototype.tOf = function (v) {
    v = Math.max(this.min, Math.min(this.max, v));
    if (!this.log) return (v - this.min) / (this.max - this.min);
    var t = (Math.log(v) - Math.log(this.min)) / (Math.log(this.max) - Math.log(this.min));
    return Math.max(0, Math.min(1, t));
  };

  Knob.prototype.valueOfT = function (t) {
    t = Math.max(0, Math.min(1, t));
    if (!this.log) return this.min + t * (this.max - this.min);
    return Math.exp(Math.log(this.min) + t * (Math.log(this.max) - Math.log(this.min)));
  };

  Knob.prototype.setValue = function (v, fire) {
    v = Math.max(this.min, Math.min(this.max, v));
    if (v === this.value && !fire) return;
    this.value = v;
    this._updateAria();
    this.draw();
    if (fire) this.onChange(v);
  };

  Knob.prototype.setValueSilent = function (v) {
    this.value = Math.max(this.min, Math.min(this.max, v));
    this._updateAria();
    this.draw();
  };

  Knob.prototype.reset = function () {
    this.setValue(this.defaultValue, true);
  };

  Knob.prototype._updateAria = function () {
    var el = this.el;
    el.setAttribute('aria-valuemin', String(this.min));
    el.setAttribute('aria-valuemax', String(this.max));
    el.setAttribute('aria-valuenow', String(Math.round(this.value * 100) / 100));
    el.setAttribute('aria-valuetext', this.fmt(this.value));
  };

  Knob.prototype._bind = function () {
    var self = this;
    var el = this.el;

    el.addEventListener('pointerdown', function (e) {
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) {} }
      self.dragging = true;
      self._lastY = e.clientY;
      el.classList.add('is-dragging');
      el.focus();
      e.preventDefault();
    });

    el.addEventListener('pointermove', function (e) {
      if (!self.dragging) return;
      var dy = self._lastY - e.clientY;
      self._lastY = e.clientY;
      var step = dy / 160;
      if (e.shiftKey) step /= 8;
      self.setValue(self.valueOfT(self.tOf(self.value) + step), true);
    });

    function endDrag() {
      if (!self.dragging) return;
      self.dragging = false;
      el.classList.remove('is-dragging');
      self.draw();
    }
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 32;
      var step = (d > 0 ? -1 : 1) * (e.shiftKey ? 0.004 : 0.02);
      self.setValue(self.valueOfT(self.tOf(self.value) + step), true);
    }, { passive: false });

    el.addEventListener('dblclick', function () { self.reset(); });

    el.addEventListener('keydown', function (e) {
      var t = self.tOf(self.value);
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') t += 0.01;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') t -= 0.01;
      else if (e.key === 'PageUp') t += 0.1;
      else if (e.key === 'PageDown') t -= 0.1;
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = 1;
      else return;
      e.preventDefault();
      self.setValue(self.valueOfT(t), true);
    });
  };

  Knob.prototype.draw = function () {
    var s = setupCanvas(this.canvas);
    if (!s) return;
    var g = s.ctx, w = s.w, h = s.h;
    var cx = w / 2, cy = h / 2;
    var rOuter = Math.min(w, h) / 2 - 2;
    var accent = this.color || cssVar('--accent-orange', '#F2994A');
    var t = this.tOf(this.value);

    g.clearRect(0, 0, w, h);

    // деления по окружности
    g.lineWidth = 1.5;
    for (var i = 0; i < KNOB_TICKS; i++) {
      var tt = i / (KNOB_TICKS - 1);
      var a = knobAngle(tt);
      g.strokeStyle = 'rgba(148, 155, 170, .32)';
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
      g.lineTo(cx + Math.cos(a) * (rOuter - 4), cy + Math.sin(a) * (rOuter - 4));
      g.stroke();
    }

    // корпус
    var bodyR = rOuter - 10.5;
    g.beginPath();
    g.arc(cx, cy, bodyR, 0, Math.PI * 2);
    g.fillStyle = 'rgba(128, 128, 128, .07)';
    g.fill();
    g.strokeStyle = cssVar('--border-default', 'rgba(255, 255, 255, .1)');
    g.lineWidth = 1;
    g.stroke();

    // дуга значения
    var arcR = rOuter - 7.5;
    if (this.dragging) { g.shadowColor = accent; g.shadowBlur = 9; }
    g.strokeStyle = accent;
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, cy, arcR, knobAngle(0), knobAngle(t));
    g.stroke();

    // указатель
    var a2 = knobAngle(t);
    if (this.dragging) { g.shadowColor = accent; g.shadowBlur = 6; }
    g.strokeStyle = accent;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx + Math.cos(a2) * bodyR * 0.38, cy + Math.sin(a2) * bodyR * 0.38);
    g.lineTo(cx + Math.cos(a2) * bodyR * 0.82, cy + Math.sin(a2) * bodyR * 0.82);
    g.stroke();
    g.shadowBlur = 0;
  };

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
    this.drawIR();

    this._onKey = function (e) {
      if (e.key === 'b' || e.key === 'B') {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        self.toggleBypass();
      }
    };
    window.addEventListener('keydown', this._onKey);

    this._onResize = function () { self.drawIR(); self.drawKnobs(); };
    window.addEventListener('resize', this._onResize);
  };

  Widget.prototype.buildDom = function () {
    var root = this.root;
    root.classList.add('prv');
    if (this.standalone) root.classList.add('prv--full');

    var html = '';
    // Head (plugin-style): бренд + короткое описание
    html += '<div class="prv-head">';
    html += '<div class="prv-brand"><span class="prv-brand-ic"><i data-lucide="waves"></i></span><span class="prv-brand-t">Reverb</span><span class="prv-brand-s">Space / Ambience / Depth</span></div>';
    html += '<p class="prv-desc">Пространство и глубина звука: от сухой комнаты до большой атмосферы. Крути параметры — следи за хвостом реверба.</p>';
    html += '</div>';

    // Transport: Play + Bypass
    html += '<div class="prv-transport">';
    html += '<button type="button" class="prv-btn prv-play"><span class="prv-ic"><i data-lucide="play"></i></span><span class="prv-play-label">Play</span></button>';
    html += '<button type="button" class="prv-bypass" aria-pressed="false" title="Горячая клавиша B"><span class="prv-bypass-t">BYPASS</span><span class="prv-bypass-s">A/B · B</span></button>';
    html += '</div>';

    // MODE: карточки пресетов + SIGNAL (segmented)
    html += '<div class="prv-mode-row">';
    html += '<div class="prv-mode-block"><span class="prv-sec-label">Mode</span><div class="prv-presets">';
    for (var i = 0; i < PRESETS.length; i++) {
      var shortName = PRESETS[i].label.split(' ')[0];
      html += '<button type="button" class="prv-preset" data-id="' + PRESETS[i].id + '" title="' + PRESETS[i].label + '">' + SCENES[PRESETS[i].id] + '<span class="prv-preset-label">' + shortName + '</span></button>';
    }
    html += '</div></div>';
    html += '<div class="prv-signal-block"><span class="prv-sec-label">Signal</span><div class="prv-srcseg">';
    for (var s = 0; s < SOURCES.length; s++) {
      html += '<button type="button" class="prv-src' + (SOURCES[s].id === 'beat' ? ' is-active' : '') + '" data-src="' + SOURCES[s].id + '">' + SOURCES[s].label + '</button>';
    }
    html += '<span class="prv-filewrap"><button type="button" class="prv-src prv-src--file" data-src="file" title="Загрузить свой звук"><i data-lucide="upload"></i>Сэмпл</button><input type="file" accept="audio/*"></span>';
    if (this.standalone) {
      html += '<button type="button" class="prv-src prv-src--icon" data-src="mic" title="Микрофон"><i data-lucide="mic"></i></button>';
    }
    html += '</div></div>';
    html += '</div>';

    // Визуализация: огибающая импульса (IR decay) + wet-метр
    html += '<div class="prv-viz">';
    html += '<canvas class="prv-wave"></canvas>';
    html += '<div class="prv-tail-wrap"><div class="prv-tail-track"><div class="prv-tail-bar" style="height: 4px;"></div></div><div class="prv-tail-label">Wet<br><span class="prv-tail-val">0%</span></div></div>';
    html += '</div>';

    // Кнобы: иконка + подпись, цвет дуги у каждого свой (data-viz)
    var paramsDef = [
      { key: 'decay',    label: 'Decay',     icon: 'timer',        color: '#FF6B1A', min: 0.2, max: 12,   log: true,  fmt: function (v) { return v.toFixed(1) + ' s'; } },
      { key: 'predelay', label: 'Pre-Delay', icon: 'clock',        color: '#4DA3FF', min: 0,   max: 150,  log: false, fmt: function (v) { return Math.round(v) + ' ms'; } },
      { key: 'mix',      label: 'Mix / Wet', icon: 'droplets',     color: '#3DE8FF', min: 0,   max: 100,  log: false, fmt: function (v) { return Math.round(v) + '%'; } },
      { key: 'dry',      label: 'Dry',       icon: 'volume-x',     color: '#9CA3AF', min: 0,   max: 100,  log: false, fmt: function (v) { return Math.round(v) + '%'; } },
      { key: 'hpf',      label: 'HPF (низ)', icon: 'activity',     color: '#A78BFA', min: 20,  max: 1000, log: true,  fmt: function (v) { return Math.round(v) + ' Hz'; } },
      { key: 'lpf',      label: 'LPF (верх)',icon: 'activity',     color: '#E879F9', min: 2000,max: 16000,log: true,  fmt: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + ' kHz' : Math.round(v) + ' Hz'; } }
    ];
    html += '<div class="prv-params">';
    for (var p = 0; p < paramsDef.length; p++) {
      var d = paramsDef[p];
      html += '<div class="prv-param" data-key="' + d.key + '" style="--knob-c:' + d.color + '">';
      html += '<span class="prv-plabel"><i data-lucide="' + d.icon + '"></i>' + d.label + '</span>';
      html += '<div class="prv-knob" tabindex="0" role="slider" aria-orientation="vertical" aria-label="' + d.label + '"><canvas class="prv-knob-canvas"></canvas></div>';
      html += '<span class="prv-pval"></span>';
      html += '</div>';
    }
    html += '</div>';

    root.innerHTML = html;
    refreshIcons();

    var self = this;
    this.paramsDef = paramsDef;
    this.knobs = {};

    for (var r = 0; r < paramsDef.length; r++) {
      var def = paramsDef[r];
      var knobEl = root.querySelector('.prv-param[data-key="' + def.key + '"] .prv-knob');
      this.knobs[def.key] = new Knob({
        el: knobEl,
        canvas: knobEl.querySelector('canvas'),
        min: def.min,
        max: def.max,
        log: def.log,
        fmt: def.fmt,
        color: def.color,
        defaultValue: DEFAULTS[def.key],
        value: this.params[def.key],
        onChange: (function (key) { return function (v) { self.setParam(key, v); }; })(def.key)
      });
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

    var fileInput = root.querySelector('.prv-filewrap input');
    if (fileInput) fileInput.addEventListener('change', function () { self.loadFile(fileInput); });

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

    for (var n = 0; n < paramsDef.length; n++) this.syncKnob(paramsDef[n]);
  };

  Widget.prototype.syncKnob = function (def) {
    var knob = this.knobs && this.knobs[def.key];
    if (knob) knob.setValueSilent(this.params[def.key]);
    var valEl = this.root.querySelector('.prv-param[data-key="' + def.key + '"] .prv-pval');
    if (valEl) valEl.textContent = def.fmt(this.params[def.key]);
  };

  Widget.prototype.drawKnobs = function () {
    for (var k in this.knobs) this.knobs[k].draw();
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
    this.drawIR();
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
    this.elPlay.querySelector('.prv-ic').innerHTML = '<i data-lucide="pause"></i>';
    refreshIcons();
    this.elPlay.querySelector('.prv-play-label').textContent = 'Stop';

    if (this.bufferSource) {
      try {
        this.bufferSource.start(0);
      } catch (e) {
        this.buildGraph();
        if (this.bufferSource) this.bufferSource.start(0);
      }
    }
    this.drawIR();
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
    this.elPlay.querySelector('.prv-ic').innerHTML = '<i data-lucide="play"></i>';
    refreshIcons();
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
    this.drawIR();
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
    if (key === 'decay') { this.scheduleImpulse(); this.drawIR(); }
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
      for (var j = 0; j < this.paramsDef.length; j++) this.syncKnob(this.paramsDef[j]);
      var presetBtns = this.root.querySelectorAll('.prv-preset');
      for (var b = 0; b < presetBtns.length; b++) {
        presetBtns[b].classList.toggle('is-active', presetBtns[b].getAttribute('data-id') === id);
      }
      break;
    }
  };

  // ===== Visual: огибающая импульса (IR decay), как в макете =====
  function irHash(t, seed) {
    var x = Math.sin(t * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  Widget.prototype.drawIR = function () {
    if (!this.elWave || !this.params) return;
    var s = setupCanvas(this.elWave);
    if (!s) return;
    var g = s.ctx, w = s.w, h = s.h;
    var decay = this.params.decay;
    var tMax = Math.max(1, Math.ceil(decay * 1.25));

    var padL = 6, padR = 6, padT = 10, padB = 20;
    var pw = w - padL - padR, ph = h - padT - padB;
    var mid = padT + ph / 2;

    // фон + вертикальная сетка (по секундам)
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(128,128,128,.10)';
    g.lineWidth = 1;
    for (var sec = 1; sec < tMax; sec++) {
      var gx = padL + (sec / tMax) * pw;
      g.beginPath(); g.moveTo(gx, padT); g.lineTo(gx, padT + ph); g.stroke();
    }

    // огибающая: exp-затухание с детерминированным шумовым текстом
    // (та же форма, что у makeImpulse: 6/decay + ранние отражения первые 80 мс)
    var seed = Math.round(decay * 10);
    var grad = g.createLinearGradient(padL, 0, padL + pw, 0);
    grad.addColorStop(0, 'rgba(61, 232, 255, .8)');
    grad.addColorStop(0.45, 'rgba(61, 232, 255, .35)');
    grad.addColorStop(1, 'rgba(61, 232, 255, .06)');

    var cols = Math.max(64, Math.floor(pw / 2));
    function ampAt(t) {
      var env = Math.exp(-t * (6.0 / decay)) * (t < 0.08 ? 1.2 : 1);
      return env;
    }

    g.beginPath();
    for (var i = 0; i <= cols; i++) {
      var t = (i / cols) * tMax;
      var n = 0.3 + 0.7 * irHash(t, seed);
      var x = padL + (i / cols) * pw;
      if (i === 0) g.moveTo(x, mid - ampAt(t) * n * (ph / 2 - 4));
      else g.lineTo(x, mid - ampAt(t) * n * (ph / 2 - 4));
    }
    for (var j = cols; j >= 0; j--) {
      var t2 = (j / cols) * tMax;
      var n2 = 0.3 + 0.7 * irHash(t2, seed + 5.5);
      g.lineTo(padL + (j / cols) * pw, mid + ampAt(t2) * n2 * (ph / 2 - 4));
    }
    g.closePath();
    g.fillStyle = grad;
    g.fill();

    // центральная линия
    g.strokeStyle = 'rgba(156,156,176,.35)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL, mid); g.lineTo(padL + pw, mid); g.stroke();

    // подписи оси времени
    g.fillStyle = 'rgba(156,156,176,.8)';
    g.font = '10px "JetBrains Mono", monospace';
    g.textBaseline = 'bottom';
    g.textAlign = 'left';
    g.fillText('0.0 s', padL + 2, h - 4);
    g.textAlign = 'right';
    g.fillText(tMax.toFixed(1) + ' s', w - padR - 2, h - 4);
    g.textAlign = 'left';

    // приглушаем, когда реверб выключен (bypass)
    if (this.bypass) {
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(156,156,176,.9)';
      g.font = '11px "JetBrains Mono", monospace';
      g.textBaseline = 'middle';
      g.fillText('BYPASS', padL + 8, mid);
    }
  };

  // ===== Публичный API (слепой тест A/B и другие потребители) =====
  var MAX_TRACK_SEC = 120;
  var MAX_FILE_BYTES = 30 * 1024 * 1024;
  var DRY_PEAK_DBFS = -6;

  function dbToLin(db) { return Math.pow(10, db / 20); }

  // Моно-импульс для оффлайн-рендера (та же форма, что у makeImpulse)
  function makeImpulseMono(ctx, decay) {
    var rate = ctx.sampleRate;
    var length = Math.max(Math.floor(rate * 0.05), Math.floor(rate * decay));
    var buf = ctx.createBuffer(1, length, rate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < length; i++) {
      var t = i / rate;
      var envelope = Math.exp(-t * (6.0 / decay));
      var early = i < rate * 0.08 ? 1.2 : 1.0;
      data[i] = (Math.random() * 2 - 1) * envelope * early;
    }
    return buf;
  }

  // Оффлайн-реверб: dry + wet, хвост «заворачивается» в начало следующего такта —
  // как реальный реверб на лупящемся треке. Возвращает Promise<{ buffer }> длиной
  // ровно как dryBuf (можно играть с loop=true). Цепочка wet та же, что в виджете:
  // Source → PreDelay → HPF → LPF → Convolver → WetGain; параллельно Source → DryGain.
  function processLoop(ctx, dryBuf, p) {
    var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC) return Promise.reject(new Error('offline audio not supported'));
    var sr = dryBuf.sampleRate;
    var L = dryBuf.length;
    var decay = Math.max(0.2, p.decay);
    var irLen = Math.max(Math.floor(sr * 0.05), Math.floor(sr * decay));
    // Копий лупа в входе: хвост из предыдущей итерации должен целиком уместиться
    // до начала окна вывода (иначе wrap-хвост на границе будет обрезан).
    var copies = Math.max(2, Math.ceil(irLen / L) + 1);
    var inLen = copies * L;

    var offCtx = new AC(1, inLen, sr);
    var inputBuf = offCtx.createBuffer(1, inLen, sr);
    var idata = inputBuf.getChannelData(0);
    var ddata = dryBuf.getChannelData(0);
    for (var c = 0; c < copies; c++) idata.set(ddata, c * L);

    var src = offCtx.createBufferSource();
    src.buffer = inputBuf;

    var dryGain = offCtx.createGain();
    dryGain.gain.value = (p.dry != null ? p.dry : 100) / 100;

    var preDelay = offCtx.createDelay(2.0);
    preDelay.delayTime.value = Math.max(0, p.predelay || 0) / 1000;
    var hpf = offCtx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.Q.value = 0.7;
    hpf.frequency.value = p.hpf != null ? p.hpf : 300;
    var lpf = offCtx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.Q.value = 0.7;
    lpf.frequency.value = p.lpf != null ? p.lpf : 8000;
    var conv = offCtx.createConvolver();
    conv.buffer = makeImpulseMono(offCtx, decay);
    var wetGain = offCtx.createGain();
    wetGain.gain.value = (p.mix != null ? p.mix : 35) / 100;

    src.connect(dryGain);
    dryGain.connect(offCtx.destination);
    src.connect(preDelay);
    preDelay.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(conv);
    conv.connect(wetGain);
    wetGain.connect(offCtx.destination);
    src.start(0);

    return offCtx.startRendering().then(function (rendered) {
      var out = rendered.getChannelData(0);
      var loopOut = new Float32Array(L);
      for (var i = 0; i < L; i++) loopOut[i] = out[(copies - 1) * L + i];
      // Мягкий лимитер: сумма dry+wet может выбить пик
      for (var j = 0; j < L; j++) {
        var v = loopOut[j];
        if (v > 0.98) v = 0.98 + 0.02 * Math.tanh((v - 0.98) / 0.02);
        else if (v < -0.98) v = -0.98 - 0.02 * Math.tanh((-0.98 - v) / 0.02);
        loopOut[j] = v;
      }
      var buf = ctx.createBuffer(1, L, sr);
      if (buf.copyToChannel) buf.copyToChannel(loopOut, 0); else buf.getChannelData(0).set(loopOut);
      return { buffer: buf };
    });
  }

  // Загрузка пользовательского трека: decode → mono → trim → normalize peak (как в компрессоре)
  function prepareTrack(ctx, file, maxSec) {
    var P = window.Promise;
    if (!P) return null;
    if (!file || !file.size) return P.reject(new Error('empty'));
    if (file.size > MAX_FILE_BYTES) return P.reject(new Error('too big'));
    return new P(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(reader.error || new Error('read error')); };
      reader.onload = function () {
        try { ctx.decodeAudioData(reader.result, resolve, reject); }
        catch (e) { reject(e); }
      };
      reader.readAsArrayBuffer(file);
    }).then(function (buf) {
      var sr = buf.sampleRate;
      var n = Math.min(buf.length, Math.floor((maxSec || MAX_TRACK_SEC) * sr));
      var chs = buf.numberOfChannels;
      var out = new Float32Array(n);
      for (var c = 0; c < chs; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < n; i++) out[i] += d[i];
      }
      if (chs > 1) for (var j = 0; j < n; j++) out[j] /= chs;
      var peak = 0;
      for (var k = 0; k < n; k++) { var a = Math.abs(out[k]); if (a > peak) peak = a; }
      if (peak > 1e-9) {
        var g = dbToLin(DRY_PEAK_DBFS) / peak;
        for (var m = 0; m < n; m++) out[m] *= g;
      }
      var mono = ctx.createBuffer(1, n, sr);
      if (mono.copyToChannel) mono.copyToChannel(out, 0); else mono.getChannelData(0).set(out);
      return mono;
    });
  }

  function fmtDur(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

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

  // Публичный API для слепого теста A/B и других потребителей
  window.PotokReverb = {
    synthLoop: function (ctx, mode) { return mode === 'tone' ? synthTone(ctx) : synthBeat(ctx); },
    processLoop: processLoop,
    prepareTrack: prepareTrack,
    fmtDur: fmtDur,
    MAX_TRACK_SEC: MAX_TRACK_SEC,
    LOOP_SEC: LOOP_SEC,
    dbToLin: dbToLin,
    stopAll: function () {
      for (var i = 0; i < widgets.length; i++) {
        if (widgets[i].playing) widgets[i].stop();
      }
    }
  };
})();
