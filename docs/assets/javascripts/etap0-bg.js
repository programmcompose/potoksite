// Анимированный фон: волны + эквалайзер (только для etap0)
(function () {
  if (!location.pathname.includes('etap0')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'etap0-viz-canvas';
  canvas.style.alpha = 'true';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  let w, h, animId;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  window.addEventListener('scroll', function () {
    canvas.classList.toggle('scrolled', window.scrollY > 100);
  }, { passive: true });

  function getColors() {
    var isDark = document.documentElement.getAttribute('data-md-color-scheme') === 'slate';
    return {
      wave1: isDark ? '30, 200, 220' : '0, 150, 180',
      wave2: isDark ? '171, 71, 188' : '150, 50, 160',
      wave3: isDark ? '255, 112, 67' : '230, 80, 50',
      eq: isDark ? '0, 188, 212' : '0, 150, 170'
    };
  }

  var waves = [
    { amp: 40, freq: 0.003, speed: 0.0008, yOff: 0.25 },
    { amp: 30, freq: 0.005, speed: -0.0012, yOff: 0.35 },
    { amp: 20, freq: 0.007, speed: 0.0015, yOff: 0.45 }
  ];

  var eqBars = 48;
  var eqHeight = 120;
  var t = 0;

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var colors = getColors();

    for (var i = 0; i < waves.length; i++) {
      var wa = waves[i];
      var colorKey = 'wave' + (i + 1);
      var baseY = h * wa.yOff;

      ctx.beginPath();
      ctx.moveTo(0, h);

      for (var x = 0; x <= w; x += 2) {
        var y = baseY + Math.sin(x * wa.freq + t * wa.speed * 1000) * wa.amp
                       + Math.sin(x * wa.freq * 2.3 + t * 0.001) * wa.amp * 0.3;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();

      var grad = ctx.createLinearGradient(0, baseY - wa.amp, 0, baseY + wa.amp * 2);
      grad.addColorStop(0, 'rgba(' + colors[colorKey] + ', 0.5)');
      grad.addColorStop(1, 'rgba(' + colors[colorKey] + ', 0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    var barW = w / eqBars;
    for (var j = 0; j < eqBars; j++) {
      var val = (Math.sin(t * 0.003 + j * 0.3) * 0.5 + 0.5)
                * (Math.sin(t * 0.005 + j * 0.15) * 0.3 + 0.7);
      var barH = val * eqHeight;
      var bx = j * barW;
      var by = h - barH;

      var eqGrad = ctx.createLinearGradient(bx, by, bx, h);
      eqGrad.addColorStop(0, 'rgba(' + colors.eq + ', 0.6)');
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

  draw();

  document.addEventListener('mouseleave', function () {
    cancelAnimationFrame(animId);
    canvas.remove();
  }, { once: true });
})();
