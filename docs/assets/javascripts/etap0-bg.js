// Анимированный фон: волны + эквалайзер (только для etap0)
(function () {
  var canvas, ctx, w, h, animId, running = false;
  var isEtap0 = location.pathname.includes('etap0');

  function getColors() {
    var isDark = document.documentElement.getAttribute('data-md-color-scheme') === 'slate';
    return {
      grid: isDark ? '255, 255, 255' : '50, 50, 50',
      waveLine: isDark ? '255, 160, 50' : '200, 120, 30',
      eq: isDark ? '200, 110, 30' : '180, 100, 20'
    };
  }

  var eqBars = 64;
  var eqHeight = 140;
  var t = 0;

  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'etap0-viz-canvas';
    var container = document.querySelector('.md-container');
    if (container) container.appendChild(canvas);
    else document.body.appendChild(canvas);
    ctx = canvas.getContext('2d', { alpha: true });
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;

    window.addEventListener('resize', function () {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    window.addEventListener('scroll', function () {
      if (canvas) canvas.style.opacity = window.scrollY > 80 ? '0.05' : '0.2';
    }, { passive: true });
  }

  function draw() {
    if (!isEtap0 || !ctx) return;
    ctx.clearRect(0, 0, w, h);
    var colors = getColors();

    // --- Верх: математическая сетка + плавные линии ---
    var gridTop = h * 0.55;
    var gridLines = 8;
    var gridSpacing = gridTop / gridLines;

    // Горизонтальные линии сетки
    ctx.strokeStyle = 'rgba(' + colors.grid + ', 0.06)';
    ctx.lineWidth = 1;
    for (var gy = 0; gy <= gridLines; gy++) {
      var y = gy * gridSpacing;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Вертикальные линии сетки
    var vGridLines = 16;
    var vGridSpacing = w / vGridLines;
    for (var gx = 0; gx <= vGridLines; gx++) {
      var x = gx * vGridSpacing;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridTop);
      ctx.stroke();
    }

    // Числа на вертикальной оси (dB-шкала)
    ctx.fillStyle = 'rgba(' + colors.grid + ', 0.08)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (var db = 0; db <= gridLines; db++) {
      var val = (gridLines - db) * 3;
      var dy = db * gridSpacing;
      ctx.fillText(val + 'dB', 30, dy + 12);
    }

    // Частоты на горизонтальной оси
    var freqs = ['20', '40', '80', '150', '300', '600', '1k', '2k', '4k', '8k', '16k'];
    ctx.textAlign = 'center';
    var freqSpacing = w / (freqs.length - 1);
    for (var fi = 0; fi < freqs.length; fi++) {
      ctx.fillText(freqs[fi], fi * freqSpacing, gridTop + 16);
    }

    // Плавные синусоидальные линии (очень медленно)
    var waveConfigs = [
      { amp: 18, freq: 0.002, speed: 0.00015, color: colors.waveLine, alpha: 0.12 },
      { amp: 12, freq: 0.0035, speed: -0.0001, color: colors.waveLine, alpha: 0.08 },
      { amp: 8, freq: 0.005, speed: 0.00008, color: colors.waveLine, alpha: 0.05 }
    ];

    for (var wi = 0; wi < waveConfigs.length; wi++) {
      var wc = waveConfigs[wi];
      var midY = h * 0.28;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(' + wc.color + ', ' + wc.alpha + ')';
      ctx.lineWidth = 1.5;

      for (var wx = 0; wx <= w; wx += 2) {
        var wy = midY
          + Math.sin(wx * wc.freq + t * wc.speed) * wc.amp
          + Math.sin(wx * wc.freq * 1.7 + t * wc.speed * 0.6) * wc.amp * 0.4;
        if (wx === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }

    // --- Низ: эквалайзер (тёмно-оранжевый) ---
    var barW = w / eqBars;
    for (var j = 0; j < eqBars; j++) {
      var val = (Math.sin(t * 0.002 + j * 0.25) * 0.5 + 0.5)
                * (Math.sin(t * 0.003 + j * 0.12) * 0.3 + 0.7);
      var barH = val * eqHeight;
      var bx = j * barW;
      var by = h - barH;

      var eqGrad = ctx.createLinearGradient(bx, by, bx, h);
      eqGrad.addColorStop(0, 'rgba(' + colors.eq + ', 0.5)');
      eqGrad.addColorStop(1, 'rgba(' + colors.eq + ', 0.08)');
      ctx.fillStyle = eqGrad;

      var r = Math.min(barW / 2 - 1, 3);
      ctx.beginPath();
      ctx.moveTo(bx + 1, h);
      ctx.lineTo(bx + 1, by + r);
      ctx.quadraticCurveTo(bx + 1, by, bx + 1 + r, by);
      ctx.lineTo(bx + barW - 1 - r, by);
      ctx.quadraticCurveTo(bx + barW - 1, by, bx + barW - 1, by + r);
      ctx.lineTo(bx + barW - 1, h);
      ctx.fill();
    }

    t++;
    animId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    initCanvas();
    draw();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animId);
    if (canvas) {
      canvas.remove();
      canvas = null;
      ctx = null;
    }
  }

  if (isEtap0) start();

  document.addEventListener('navigation', function () {
    isEtap0 = location.pathname.includes('etap0');
    if (isEtap0) start();
    else stop();
  });

  window.addEventListener('hashchange', function () {
    var shouldRun = location.pathname.includes('etap0');
    if (shouldRun && !isEtap0) { isEtap0 = true; start(); }
    else if (!shouldRun && isEtap0) { isEtap0 = false; stop(); }
  });
})();
