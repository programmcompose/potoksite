// Анимированный фон: волны + эквалайзер (только для etap0)
(function () {
  var canvas, ctx, w, h, animId, running = false;
  var isEtap0 = location.pathname.includes('etap0');

  function getColors() {
    var isDark = document.documentElement.getAttribute('data-md-color-scheme') === 'slate';
    return {
      wave1: isDark ? '30, 220, 240' : '0, 160, 200',
      wave2: isDark ? '180, 80, 200' : '160, 60, 180',
      wave3: isDark ? '255, 120, 70' : '240, 90, 50',
      eq: isDark ? '0, 200, 230' : '0, 160, 190'
    };
  }

  var waves = [
    { amp: 50, freq: 0.003, speed: 0.0008, yOff: 0.25 },
    { amp: 38, freq: 0.005, speed: -0.0012, yOff: 0.35 },
    { amp: 25, freq: 0.007, speed: 0.0015, yOff: 0.45 }
  ];

  var eqBars = 56;
  var eqHeight = 160;
  var t = 0;

  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'etap0-viz-canvas';
    // Вставляем в .md-container чтобы быть поверх фона но под контентом
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
      if (canvas) canvas.style.opacity = window.scrollY > 80 ? '0.07' : '0.25';
    }, { passive: true });
  }

  function draw() {
    if (!isEtap0 || !ctx) return;
    ctx.clearRect(0, 0, w, h);
    var colors = getColors();

    // Волны
    for (var i = 0; i < waves.length; i++) {
      var wa = waves[i];
      var colorKey = 'wave' + (i + 1);
      var baseY = h * wa.yOff;

      ctx.beginPath();
      ctx.moveTo(0, h);

      for (var x = 0; x <= w; x += 2) {
        var y = baseY
          + Math.sin(x * wa.freq + t * wa.speed * 1000) * wa.amp
          + Math.sin(x * wa.freq * 2.3 + t * 0.001) * wa.amp * 0.3;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      var grad = ctx.createLinearGradient(0, baseY - wa.amp, 0, baseY + wa.amp * 2);
      grad.addColorStop(0, 'rgba(' + colors[colorKey] + ', 0.6)');
      grad.addColorStop(1, 'rgba(' + colors[colorKey] + ', 0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Эквалайзер
    var barW = w / eqBars;
    for (var j = 0; j < eqBars; j++) {
      var val = (Math.sin(t * 0.003 + j * 0.3) * 0.5 + 0.5)
                * (Math.sin(t * 0.005 + j * 0.15) * 0.3 + 0.7);
      var barH = val * eqHeight;
      var bx = j * barW;
      var by = h - barH;

      var eqGrad = ctx.createLinearGradient(bx, by, bx, h);
      eqGrad.addColorStop(0, 'rgba(' + colors.eq + ', 0.7)');
      eqGrad.addColorStop(1, 'rgba(' + colors.eq + ', 0.1)');
      ctx.fillStyle = eqGrad;

      var r = Math.min(barW / 2 - 1, 4);
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

  // Запуск при старте, если мы уже на etap0
  if (isEtap0) start();

  // Слушаем SPA-навигацию MkDocs Material
  document.addEventListener('navigation', function () {
    isEtap0 = location.pathname.includes('etap0');
    if (isEtap0) start();
    else stop();
  });

  // Fallback: hashchange / popstate
  window.addEventListener('hashchange', function () {
    var shouldRun = location.pathname.includes('etap0');
    if (shouldRun && !isEtap0) { isEtap0 = true; start(); }
    else if (!shouldRun && isEtap0) { isEtap0 = false; stop(); }
  });
})();
