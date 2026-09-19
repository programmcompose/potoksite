/* ========================================
   EQ Mini — визуализация кривой EQ + A/B
   Без Web Audio (только canvas). Легко
   расширить до реального звука позже.
   18 ПОТОК
   ======================================== */

(function () {
  'use strict';

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /** Простая колоколообразная (bell) кривая в dB по частоте */
  function bellGain(freq, center, q, gainDb) {
    if (Math.abs(gainDb) < 0.01) return 0;
    var ratio = freq / center;
    var logRatio = Math.log(ratio);
    var sigma = 1 / (q * 2.2);
    return gainDb * Math.exp(-(logRatio * logRatio) / (2 * sigma * sigma));
  }

  function highPassGain(freq, cutoff, order) {
    order = order || 2;
    if (freq >= cutoff) return 0;
    var x = freq / cutoff;
    // упрощённо: спад ниже cutoff
    var db = 20 * order * Math.log(Math.max(x, 0.001)) / Math.LN10;
    return clamp(db, -48, 0);
  }

  function lowPassGain(freq, cutoff, order) {
    order = order || 2;
    if (freq <= cutoff) return 0;
    var x = cutoff / freq;
    var db = 20 * order * Math.log(Math.max(x, 0.001)) / Math.LN10;
    return clamp(db, -48, 0);
  }

  function shelfGain(freq, edge, gainDb, isHigh) {
    if (Math.abs(gainDb) < 0.01) return 0;
    var t = isHigh
      ? (Math.log(freq / edge) / Math.log(20000 / edge))
      : (Math.log(edge / freq) / Math.log(edge / 20));
    t = clamp(t, 0, 1);
    // smoothstep
    t = t * t * (3 - 2 * t);
    return isHigh ? gainDb * t : gainDb * t;
  }

  function freqAtX(x, width) {
    // 20 Hz … 20 kHz log
    var t = x / width;
    return 20 * Math.pow(1000, t);
  }

  function xAtFreq(freq, width) {
    return (Math.log(freq / 20) / Math.log(1000)) * width;
  }

  function yAtDb(db, height, minDb, maxDb) {
    minDb = minDb || -18;
    maxDb = maxDb || 18;
    var t = (db - minDb) / (maxDb - minDb);
    return height - t * height;
  }

  function computeCurve(params, width) {
    var points = [];
    var n = Math.max(64, Math.floor(width));
    for (var i = 0; i <= n; i++) {
      var x = (i / n) * width;
      var f = freqAtX(x, width);
      var db = 0;
      if (params.hp) db += highPassGain(f, params.hp, 2);
      if (params.lp) db += lowPassGain(f, params.lp, 2);
      if (params.bell) {
        db += bellGain(f, params.bell.freq, params.bell.q || 1.2, params.bell.gain);
      }
      if (params.highShelf) {
        db += shelfGain(f, params.highShelf.freq, params.highShelf.gain, true);
      }
      if (params.lowShelf) {
        db += shelfGain(f, params.lowShelf.freq, params.lowShelf.gain, false);
      }
      points.push({ x: x, db: db });
    }
    return points;
  }

  function drawGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    var freqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
    freqs.forEach(function (f) {
      var x = xAtFreq(f, w);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });
    // 0 dB
    var y0 = yAtDb(0, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(w, y0);
    ctx.stroke();
    ctx.restore();
  }

  function drawCurve(ctx, points, h, color, fill) {
    if (!points.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, yAtDb(points[0].db, h));
    for (var i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, yAtDb(points[i].db, h));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (fill) {
      ctx.lineTo(points[points.length - 1].x, yAtDb(0, h));
      ctx.lineTo(points[0].x, yAtDb(0, h));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.restore();
  }

  function parsePreset(el) {
    // data-preset="mud-cut" | "air" | "lofi" | "custom"
    var name = el.getAttribute('data-preset') || 'mud-cut';
    var presets = {
      'mud-cut': {
        label: 'Срез мутности 250 Гц',
        caption: 'Bell −4 dB @ 250 Hz, Q ≈ 1.2 — классический «разгруз» середины.',
        after: { bell: { freq: 250, q: 1.2, gain: -4 } },
      },
      air: {
        label: 'Air / верх',
        caption: 'High shelf +3 dB от ~8 кГц — «воздух» на вокале и мелодии.',
        after: { highShelf: { freq: 8000, gain: 3 } },
      },
      lofi: {
        label: 'Lo-fi',
        caption: 'HP ~280 Hz + LP ~9 kHz — звук «из радио».',
        after: { hp: 280, lp: 9000 },
      },
      presence: {
        label: 'Presence',
        caption: 'Bell +3 dB @ 3 kHz — инструмент «ближе».',
        after: { bell: { freq: 3000, q: 1.4, gain: 3 } },
      },
      sub: {
        label: 'Саб-срез',
        caption: 'High-pass ~35 Hz — убрать ненужный суб, не трогая бас.',
        after: { hp: 35 },
      },
    };
    return presets[name] || presets['mud-cut'];
  }

  function initWidget(root) {
    if (root.__eqMiniInit) return;
    root.__eqMiniInit = true;

    var preset = parsePreset(root);
    var mode = 'after'; // before | after | both

    var titleEl = root.querySelector('[data-eq-title]');
    if (titleEl) titleEl.textContent = preset.label;

    var captionEl = root.querySelector('[data-eq-caption]');
    if (captionEl) captionEl.textContent = preset.caption;

    var canvas = root.querySelector('canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    function resize() {
      var wrap = canvas.parentElement;
      var dpr = window.devicePixelRatio || 1;
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      var w = canvas.parentElement.clientWidth;
      var h = canvas.parentElement.clientHeight;
      ctx.clearRect(0, 0, w, h);
      drawGrid(ctx, w, h);

      var flat = computeCurve({}, w);
      var shaped = computeCurve(preset.after || {}, w);

      if (mode === 'before') {
        drawCurve(ctx, flat, h, '#7ec8e3', 'rgba(126,200,227,0.12)');
      } else if (mode === 'after') {
        drawCurve(ctx, shaped, h, getComputedStyle(root).getPropertyValue('--eq-after').trim() || '#ff9800', 'rgba(255,152,0,0.12)');
      } else {
        drawCurve(ctx, flat, h, '#7ec8e3', null);
        drawCurve(ctx, shaped, h, getComputedStyle(root).getPropertyValue('--eq-after').trim() || '#ff9800', 'rgba(255,152,0,0.1)');
      }
    }

    root.querySelectorAll('[data-eq-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        mode = btn.getAttribute('data-eq-mode');
        root.querySelectorAll('[data-eq-mode]').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        draw();
      });
    });

    // Live controls (optional)
    var gainInput = root.querySelector('[data-eq-gain]');
    var freqInput = root.querySelector('[data-eq-freq]');
    if (gainInput && preset.after && preset.after.bell) {
      gainInput.value = preset.after.bell.gain;
      gainInput.addEventListener('input', function () {
        preset.after.bell.gain = parseFloat(gainInput.value);
        var val = root.querySelector('[data-eq-gain-val]');
        if (val) val.textContent = (preset.after.bell.gain >= 0 ? '+' : '') + preset.after.bell.gain.toFixed(1) + ' dB';
        draw();
      });
    }
    if (freqInput && preset.after && preset.after.bell) {
      freqInput.value = preset.after.bell.freq;
      freqInput.addEventListener('input', function () {
        preset.after.bell.freq = parseFloat(freqInput.value);
        var val = root.querySelector('[data-eq-freq-val]');
        if (val) val.textContent = Math.round(preset.after.bell.freq) + ' Hz';
        draw();
      });
    }

    resize();
    window.addEventListener('resize', resize);
  }

  function initAll() {
    document.querySelectorAll('.eq-mini').forEach(initWidget);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(initAll);
  }
})();
