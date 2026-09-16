/* ============================================================
   POTOK · SVG-генераторы для визуальных вопросов квиза
   Общий файл: standalone-страница tools/quiz + инлайн-виджет.
   Экспорт: window.POTOK_QUIZ_SVG = { channelRackSVG, waveformsSVG,
     adsrSVG, pianoKeysSVG, swingRollSVG }
   ============================================================ */
(function () {
function channelRackSVG() {
  var rows = [
    { name: "KICK", color: "#ff7043", on: [1, 10] },
    { name: "SNARE", color: "#00bcd4", on: [5, 13] },
    { name: "HAT", color: "#ffd740", on: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16] },
    { name: "808", color: "#ab47bc", on: [1, 11] }
  ];
  var cell = 32, gap = 4, labelW = 64, topPad = 24;
  var W = labelW + 16 * (cell + gap) - gap;
  var H = topPad + rows.length * (cell + gap);
  var s = '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg">';
  for (var i = 1; i <= 16; i++) {
    var x = labelW + (i - 1) * (cell + gap);
    s += '<text x="' + (x + cell / 2) + '" y="13" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.45">' + i + "</text>";
  }
  rows.forEach(function (r, ri) {
    var y = topPad + ri * (cell + gap);
    s += '<text x="2" y="' + (y + cell / 2 + 4) + '" font-size="10" font-weight="700" fill="currentColor">' + r.name + "</text>";
    for (var i = 1; i <= 16; i++) {
      var x = labelW + (i - 1) * (cell + gap);
      var on = r.on.indexOf(i) !== -1;
      s += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" rx="5" fill="' + (on ? r.color : "currentColor") + '" opacity="' + (on ? 0.95 : 0.1) + '"/>';
    }
  });
  return s + "</svg>";
}

function wavePath(gen, W, mid, amp) {
  var d = "";
  for (var x = 0; x <= W; x += 2) {
    var t = x / W;
    var y = mid + gen(t) * amp;
    d += (x === 0 ? "M" : " L") + x + " " + y.toFixed(1);
  }
  return d;
}

function waveformsSVG() {
  var panels = [
    { label: "A", color: "#ff7043", gen: function (t) { return Math.sin(t * Math.PI * 5) * Math.exp(-t * 2.0); } },
    { label: "B", color: "#00bcd4", gen: function (t) { var env = t < 0.04 ? t / 0.04 : Math.exp(-(t - 0.04) * 5.5); return (Math.sin(t * Math.PI * 26) * 0.55 + Math.sin(t * 871) * 0.45) * env; } },
    { label: "C", color: "#ffd740", gen: function (t) { var env = t < 0.09 ? 1 - t / 0.09 : 0; return Math.sin(t * Math.PI * 260) * env; } }
  ];
  var W = 560, H = 74, labelW = 44, gapY = 14;
  var totalH = panels.length * H + (panels.length - 1) * gapY;
  var s = '<svg viewBox="0 0 ' + (labelW + W) + " " + totalH + '" xmlns="http://www.w3.org/2000/svg">';
  panels.forEach(function (p, i) {
    var y0 = i * (H + gapY);
    s += '<rect x="0" y="' + y0 + '" width="' + (labelW + W) + '" height="' + H + '" rx="10" fill="currentColor" opacity="0.06"/>';
    s += '<text x="' + (labelW / 2) + '" y="' + (y0 + H / 2 + 8) + '" font-size="20" font-weight="900" text-anchor="middle" fill="currentColor">' + p.label + "</text>";
    s += '<path d="' + wavePath(p.gen, W, y0 + H / 2, H / 2 - 8) + '" transform="translate(' + labelW + ',0)" stroke="' + p.color + '" stroke-width="1.6" fill="none"/>';
  });
  return s + "</svg>";
}

function adsrSVG() {
  var W = 560, H = 92, labelW = 44, gapY = 14;
  var totalH = 2 * H + gapY;
  // A — плак/стаб: быстрая атака, спад до низкого sustain, короткий release
  var pathA = "M30 74 L62 20 Q110 52 168 62 L392 62 Q404 66 416 74";
  // B — пэд: медленная атака, высокий sustain, длинный release
  var pathB = "M30 74 Q130 68 214 22 L430 22 Q500 34 540 74";
  var s = '<svg viewBox="0 0 ' + (labelW + W) + " " + totalH + '" xmlns="http://www.w3.org/2000/svg">';
  for (var i = 0; i < 2; i++) {
    var y0 = i * (H + gapY);
    s += '<rect x="0" y="' + y0 + '" width="' + (labelW + W) + '" height="' + H + '" rx="10" fill="currentColor" opacity="0.06"/>';
    s += '<text x="' + (labelW / 2) + '" y="' + (y0 + H / 2 + 8) + '" font-size="20" font-weight="900" text-anchor="middle" fill="currentColor">' + (i === 0 ? "A" : "B") + "</text>";
    s += '<path d="' + (i === 0 ? pathA : pathB) + '" transform="translate(' + labelW + ',' + y0 + ')" stroke="' + (i === 0 ? "#ff7043" : "#00bcd4") + '" stroke-width="1.8" fill="none"/>';
  }
  return s + "</svg>";
}

function pianoKeysSVG(hl) {
  var whiteW = 30, blackW = 18, H = 96;
  var whites = ["C4","D4","E4","F4","G4","A4","B4","C5"];
  var blacks = [
    { id: "C#4", after: 0 },
    { id: "D#4", after: 1 },
    { id: "F#4", after: 3 },
    { id: "G#4", after: 4 },
    { id: "A#4", after: 5 }
  ];
  var W = whites.length * whiteW;
  function isOn(id) {
    if (hl.indexOf(id) !== -1) return true;
    if (id === "D#4" && hl.indexOf("Eb") !== -1) return true;
    return false;
  }
  var s = '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg">';
  for (var i = 0; i < whites.length; i++) {
    var x = i * whiteW;
    var on = isOn(whites[i]);
    s += '<rect x="' + (x + 1) + '" y="0" width="' + (whiteW - 2) + '" height="' + (H - 24) + '" rx="3" fill="' + (on ? "#ffd740" : "currentColor") + '" opacity="' + (on ? 0.95 : 0.12) + '"/>';
    s += '<text x="' + (x + whiteW / 2) + '" y="' + (H - 8) + '" font-size="10" text-anchor="middle" fill="currentColor" opacity="0.6">' + whites[i] + "</text>";
  }
  blacks.forEach(function (b) {
    var x = (b.after + 1) * whiteW - blackW / 2;
    var on = isOn(b.id);
    s += '<rect x="' + x + '" y="0" width="' + blackW + '" height="' + ((H - 24) * 0.62).toFixed(1) + '" rx="3" fill="' + (on ? "#ffd740" : "currentColor") + '" opacity="' + (on ? 0.95 : 0.3) + '"/>';
  });
  return s + "</svg>";
}

function swingRollSVG() {
  var cell = 30, gap = 4, labelW = 64, topPad = 22;
  var W = labelW + 16 * (cell + gap) - gap;
  var H = topPad + 2 * (cell + gap);
  var s = '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg">';
  for (var i = 1; i <= 16; i++) {
    var x = labelW + (i - 1) * (cell + gap);
    s += '<text x="' + (x + cell / 2) + '" y="13" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.45">' + i + "</text>";
  }
  var rows = [
    { label: "A", color: "#ff7043", shift: 0 },
    { label: "B", color: "#00bcd4", shift: 0.45 }
  ];
  rows.forEach(function (r, ri) {
    var y = topPad + ri * (cell + gap);
    s += '<text x="2" y="' + (y + cell / 2 + 4) + '" font-size="10" font-weight="700" fill="currentColor">' + r.label + "</text>";
    for (var i = 1; i <= 16; i++) {
      var x = labelW + (i - 1) * (cell + gap);
      s += '<rect x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" rx="5" fill="currentColor" opacity="0.1"/>';
    }
    for (var n = 1; n <= 16; n += 2) {
      var offbeat = (n % 4 === 3);
      var dx = offbeat ? r.shift * (cell + gap) : 0;
      var x2 = labelW + (n - 1) * (cell + gap) + dx;
      s += '<rect x="' + (x2 + 3).toFixed(1) + '" y="' + (y + 4) + '" width="' + (cell - 6) + '" height="' + (cell - 8) + '" rx="5" fill="' + r.color + '" opacity="0.95"/>';
    }
  });
  return s + "</svg>";
}

window.POTOK_QUIZ_SVG = {
  channelRackSVG: channelRackSVG,
  waveformsSVG: waveformsSVG,
  adsrSVG: adsrSVG,
  pianoKeysSVG: pianoKeysSVG,
  swingRollSVG: swingRollSVG,
};
})();
