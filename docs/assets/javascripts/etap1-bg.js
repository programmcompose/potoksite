// Фоновая сетка частот (только для etap1)
(function () {
  var canvas, ctx, w, h, animId, running = false;
  var isEtap1 = location.pathname.includes('etap1');

  function getColors() {
    var scheme = (document.body && document.body.getAttribute('data-md-color-scheme')) ||
      document.documentElement.getAttribute('data-md-color-scheme');
    var isDark = scheme === 'slate';
    return {
      grid: isDark ? '255, 255, 255' : '50, 50, 50'
    };
  }

  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'etap1-viz-canvas';
    var container = document.querySelector('.md-container');
    if (container) container.appendChild(canvas);
    else document.body.appendChild(canvas);
    ctx = canvas.getContext('2d', { alpha: true });
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;

    window.addEventListener('resize', function () {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }, { passive: true });

    window.addEventListener('scroll', function () {
      if (!canvas) return;
      var scroll = window.scrollY;
      if (scroll < 50) {
        canvas.style.opacity = '0.2';
      } else if (scroll < 300) {
        canvas.style.opacity = String(0.2 - (scroll - 50) / 250 * 0.18);
      } else {
        canvas.style.opacity = '0.01';
      }
    }, { passive: true });
  }

  function drawGrid() {
    var colors = getColors();
    var gridTop = h * 0.55;
    var gridLines = 8;
    var gridSpacing = gridTop / gridLines;

    // Горизонтальные линии
    ctx.strokeStyle = 'rgba(' + colors.grid + ', 0.06)';
    ctx.lineWidth = 1;
    for (var gy = 0; gy <= gridLines; gy++) {
      var y = gy * gridSpacing;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Вертикальные линии
    var vGridLines = 16;
    var vGridSpacing = w / vGridLines;
    for (var gx = 0; gx <= vGridLines; gx++) {
      var x = gx * vGridSpacing;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, gridTop);
      ctx.stroke();
    }

    // dB-шкала
    ctx.fillStyle = 'rgba(' + colors.grid + ', 0.08)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for (var db = 0; db <= gridLines; db++) {
      var val = (gridLines - db) * 3;
      var dy = db * gridSpacing;
      ctx.fillText(val + 'dB', 30, dy + 12);
    }

    // Частоты
    var freqs = ['20', '40', '80', '150', '300', '600', '1k', '2k', '4k', '8k', '16k'];
    ctx.textAlign = 'center';
    var freqSpacing = w / (freqs.length - 1);
    for (var fi = 0; fi < freqs.length; fi++) {
      ctx.fillText(freqs[fi], fi * freqSpacing, gridTop + 16);
    }
  }

  function draw() {
    if (!isEtap1 || !ctx) return;
    ctx.clearRect(0, 0, w, h);

    drawGrid();

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

  if (isEtap1) start();

  document.addEventListener('navigation', function () {
    isEtap1 = location.pathname.includes('etap1');
    if (isEtap1) start();
    else stop();
  });

  window.addEventListener('hashchange', function () {
    var shouldRun = location.pathname.includes('etap1');
    if (shouldRun && !isEtap1) { isEtap1 = true; start(); }
    else if (!shouldRun && isEtap1) { isEtap1 = false; stop(); }
  });
})();
