// Анимированный фон: step sequencer (только для etap1)
(function () {
  var canvas, ctx, w, h, animId, running = false;
  var isEtap1 = location.pathname.includes('etap1');

  var seqRows = [
    { label: 'KICK', pattern: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,1] },
    { label: 'SNARE', pattern: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0] },
    { label: 'HIHAT', pattern: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0] },
    { label: 'CLAP',  pattern: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,1,0] },
    { label: 'TOM',   pattern: [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0] },
    { label: 'BASS',  pattern: [1,0,0,1, 0,0,1,0, 0,0,0,0, 1,0,0,0] },
    { label: 'PERC',  pattern: [0,0,1,0, 0,0,0,0, 1,0,1,0, 0,0,0,0] },
    { label: 'FX',    pattern: [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,1,0,0] }
  ];

  var seqCols = 16;
  var seqRowsHeight = 180;
  var seqBottomPad = 60;
  var seqLeftPad = 60;
  var seqRightPad = 30;
  var t = 0;
  var playhead = 0;
  var bpm = 140;
  var stepDuration = 60000 / bpm / 4; // 16th notes
  var lastStepTime = 0;

  function getColors() {
    var isDark = document.documentElement.getAttribute('data-md-color-scheme') === 'slate';
    return {
      grid: isDark ? '255, 255, 255' : '50, 50, 50',
      seqOn: isDark ? '220, 130, 40' : '200, 115, 30',
      seqOff: isDark ? '80, 50, 20' : '160, 100, 50',
      playhead: isDark ? '255, 160, 50' : '230, 140, 40',
      glow: isDark ? '255, 180, 60' : '240, 155, 50'
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

  function drawStepSequencer() {
    var colors = getColors();
    var now = performance.now();

    // Playhead update
    if (now - lastStepTime >= stepDuration) {
      playhead = (playhead + 1) % seqCols;
      lastStepTime = now;
    }

    // Sequencer area — bottom of page
    var seqAreaBottom = h - seqBottomPad;
    var seqAreaHeight = seqRowsHeight;
    var seqAreaTop = seqAreaBottom - seqAreaHeight;
    var seqAreaLeft = seqLeftPad;
    var seqAreaRight = w - seqRightPad;
    var seqAreaWidth = seqAreaRight - seqAreaLeft;

    var cellW = seqAreaWidth / seqCols;
    var cellH = seqAreaHeight / seqRows.length;
    var cellPad = 2;

    // Draw cell labels on the left
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (var r = 0; r < seqRows.length; r++) {
      var row = seqRows[r];
      var cellY = seqAreaTop + r * cellH;

      // Label
      ctx.fillStyle = 'rgba(' + colors.grid + ', 0.15)';
      ctx.fillText(row.label, seqAreaLeft - 8, cellY + cellH / 2);

      // Cells
      for (var c = 0; c < seqCols; c++) {
        var cellX = seqAreaLeft + c * cellW;
        var isOn = row.pattern[c];
        var isPlayhead = c === playhead;

        // Glow for playhead column
        if (isPlayhead) {
          var glowGrad = ctx.createLinearGradient(cellX, seqAreaTop, cellX, seqAreaBottom);
          glowGrad.addColorStop(0, 'rgba(' + colors.playhead + ', 0.06)');
          glowGrad.addColorStop(0.5, 'rgba(' + colors.playhead + ', 0.03)');
          glowGrad.addColorStop(1, 'rgba(' + colors.playhead + ', 0)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(cellX - 1, seqAreaTop, cellW + 2, seqAreaHeight);
        }

        // Cell background
        if (isOn) {
          // Active cell with glow
          var alpha = isPlayhead ? 0.85 : 0.45 + Math.sin(t * 0.03 + c * 0.5 + r * 0.3) * 0.15;
          var glowSize = isPlayhead ? 8 : 4;

          // Glow
          ctx.shadowColor = 'rgba(' + colors.glow + ', ' + alpha * 0.6 + ')';
          ctx.shadowBlur = glowSize;

          var cellGrad = ctx.createLinearGradient(cellX, cellY, cellX, cellY + cellH);
          cellGrad.addColorStop(0, 'rgba(' + colors.seqOn + ', ' + alpha + ')');
          cellGrad.addColorStop(1, 'rgba(' + colors.seqOff + ', ' + (alpha * 0.5) + ')');
          ctx.fillStyle = cellGrad;

          var cornerR = Math.min(cellW / 4, 3);
          ctx.beginPath();
          ctx.roundRect(cellX + cellPad, cellY + cellPad, cellW - cellPad * 2, cellH - cellPad * 2, cornerR);
          ctx.fill();

          ctx.shadowBlur = 0;
        } else {
          // Inactive cell
          ctx.fillStyle = 'rgba(' + colors.seqOff + ', 0.08)';
          var cornerR = Math.min(cellW / 4, 2);
          ctx.beginPath();
          ctx.roundRect(cellX + cellPad, cellY + cellPad, cellW - cellPad * 2, cellH - cellPad * 2, cornerR);
          ctx.fill();
        }
      }
    }

    // Playhead indicator at top
    var playX = seqAreaLeft + playhead * cellW + cellW / 2;
    ctx.fillStyle = 'rgba(' + colors.playhead + ', 0.5)';
    ctx.beginPath();
    ctx.moveTo(playX, seqAreaTop - 6);
    ctx.lineTo(playX - 4, seqAreaTop - 12);
    ctx.lineTo(playX + 4, seqAreaTop - 12);
    ctx.closePath();
    ctx.fill();

    // Step numbers at bottom
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(' + colors.grid + ', 0.12)';
    for (var n = 0; n < seqCols; n++) {
      var nx = seqAreaLeft + n * cellW + cellW / 2;
      ctx.fillText(n + 1, nx, seqAreaBottom + 6);
    }
  }

  function draw() {
    if (!isEtap1 || !ctx) return;
    ctx.clearRect(0, 0, w, h);

    drawGrid();
    drawStepSequencer();

    t++;
    animId = requestAnimationFrame(draw);
  }

  function start() {
    if (running) return;
    running = true;
    lastStepTime = performance.now();
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
