#!/usr/bin/env node
/* ============================================================
   Mix Detective — калибровка DSP и метрик (Node, без браузера)

   Извлекает основной <script> из docs/tools/mix-detective/index.html,
   пересобирает синтезированные источники и проверяет:
     1. точность FFT;
     2. что старт fix-it (FIX_START) даёт низкий итог метрик,
        а эталон (BASE_MIX) — высокий;
     3. направление метрик на кейсах (bad vs fixed).

   Запуск: node tests/mix-detective-calib.js
   При изменении источников (synth*), PEAK_FREQ, полос analyzeBuffer,
   BASE_MIX или FIX_START
   прогнать этот скрипт и при необходимости поправить CAL в index.html.

   ВАЖНО: без 'use strict' — прямой eval должен выносить var/function
   во внешнюю область видимости (sloppy mode).
   ============================================================ */
var fs = require('fs');
var path = require('path');

var HTML_PATH = path.join(__dirname, '..', 'docs', 'tools', 'mix-detective', 'index.html');
var html = fs.readFileSync(HTML_PATH, 'utf8');
var scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
// основной скрипт — самый длинный блок без src
var mainSrc = '';
scripts.forEach(function (s) {
  var m = s.replace(/^<script>/, '').replace(/<\/script>$/, '');
  if (m.length > mainSrc.length && !/src=/.test(s.slice(0, 30))) mainSrc = m;
});
if (!mainSrc) throw new Error('не найден основной <script> в ' + HTML_PATH);

function grab(name) {
  var i = mainSrc.indexOf('function ' + name);
  if (i < 0) throw new Error('not found: ' + name);
  var j = mainSrc.indexOf('{', i), depth = 0, k = j;
  for (; k < mainSrc.length; k++) {
    if (mainSrc[k] === '{') depth++;
    else if (mainSrc[k] === '}') { depth--; if (!depth) break; }
  }
  return mainSrc.slice(i, k + 1);
}

global.window = {};
var code = 'var SR=44100, BPM=84, BEAT=60/BPM, STEPS=32, STEP=BEAT/4, LOOP_SEC=STEPS*STEP, TAIL_SEC=0.9;\n';
code += 'var N_TOTAL = Math.round((LOOP_SEC + TAIL_SEC) * SR);\n';
// CAL из самого файла
var iCal = mainSrc.indexOf('var CAL');
if (iCal < 0) throw new Error('не найден var CAL');
var jCal = mainSrc.indexOf('};', iCal);
code += mainSrc.slice(iCal, jCal + 2) + '\n';
code += grab('dbToLin') + '\n' + grab('normalizeArr') + '\n';
// makeBiquad с peaking — те же RBJ cookbook-формулы, что Web Audio BiquadFilter
code += "function makeBiquad(type, freq, q, gainDb) {\n" +
  "  var w0 = 2*Math.PI*freq/SR, cosw=Math.cos(w0), sinw=Math.sin(w0);\n" +
  "  var b0,b1,b2,a0,a1,a2,alpha;\n" +
  "  if (type==='lowpass') { alpha=sinw/(2*q); b0=(1-cosw)/2; b1=1-cosw; b2=(1-cosw)/2; a0=1+alpha; a1=-2*cosw; a2=1-alpha; }\n" +
  "  else if (type==='highpass') { alpha=sinw/(2*q); b0=(1+cosw)/2; b1=-(1+cosw); b2=(1+cosw)/2; a0=1+alpha; a1=-2*cosw; a2=1-alpha; }\n" +
  "  else if (type==='bandpass') { alpha=sinw/q; b0=sinw; b1=0; b2=-sinw; a0=1+alpha; a1=-2*cosw; a2=1-alpha; }\n" +
  "  else { var A=Math.pow(10,Math.abs(gainDb)/40); alpha=sinw/(2*q);\n" +
  "    if (gainDb>=0) { b0=(1+alpha*A); b1=-2*cosw; b2=(1-alpha*A); a0=1+alpha/A; a1=-2*cosw; a2=1-alpha/A; }\n" +
  "    else { b0=(1+A*alpha); b1=-2*cosw; b2=(1-A*alpha); a0=1+A*alpha; a1=-2*cosw; a2=1-A*alpha; } }\n" +
  "  var x1=0,x2=0,y1=0,y2=0;\n" +
  "  return { process: function(x){ var y=(b0*x+b1*x1+b2*x2-a1*y1-a2*y2)/a0; x2=x1;x1=x;y2=y1;y1=y; return y; } };\n" +
  "}\n";
code += grab('synthDrums') + '\n' + grab('synthBass') + '\n' + grab('synthPad') + '\n' + grab('synthVocal') + '\n';
code += grab('cloneMix') + '\n';
eval(code);

var code2 = 'var FFT_N=4096, HANN_N=null;\n' + grab('hannWindow') + '\n' + grab('fft') + '\n' + grab('clamp01') + '\n';
eval(code2);
// analyzeBuffer и computeMetrics — из файла как есть
eval(grab('analyzeBuffer') + '\n' + grab('computeMetrics') + '\n');

var PEAK_FREQ = { vocal: 3200, bass: 80, drums: 6000, synth: 400 };
var TRACK_ORDER = ['vocal', 'bass', 'drums', 'synth'];
var SOURCES = { drums: synthDrums(), bass: synthBass(), synth: synthPad(), vocal: synthVocal() };

// Симуляция рендера: hpf → peaking → gain (comp/reverb/shaper не моделируются)
function renderSim(params, onlyTrack) {
  var mix = new Float32Array(N_TOTAL);
  TRACK_ORDER.forEach(function (t) {
    if (onlyTrack && onlyTrack !== t) return;
    var p = params[t];
    var hpf = makeBiquad('highpass', p.hpfHz, 0.71);
    var peak = makeBiquad('peaking', PEAK_FREQ[t], 1.2, p.peakDb || 0);
    var g = dbToLin(p.levelDb);
    for (var i = 0; i < N_TOTAL; i++) mix[i] += hpf.process(peak.process(SOURCES[t][i])) * g;
  });
  return { numberOfChannels: 1, getChannelData: function () { return mix; } };
}

function metricsOf(params) {
  var m = computeMetrics(renderSim(params, null), renderSim(params, 'vocal'));
  if (!m) throw new Error('computeMetrics вернул null');
  m.total = Math.round((m.vp + m.lb + m.cl) / 3);
  return m;
}

// Данные из файла: BASE_MIX, FIX_START, CASES
function grabVar(name) {
  var i = mainSrc.indexOf('var ' + name);
  if (i < 0) throw new Error('nf: ' + name);
  var j = mainSrc.indexOf('};', i);
  eval(mainSrc.slice(i, j + 2));
  return eval(name);
}
var BASE_MIX = grabVar('BASE_MIX');
var FIX_START = grabVar('FIX_START');
var iC = mainSrc.indexOf('var CASES');
var jC = mainSrc.indexOf('];', iC);
eval(mainSrc.slice(iC, jC + 1));

// ---------- ПРОВЕРКИ ----------
var failures = [];
function check(name, cond, detail) {
  var ok = !!cond;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  [' + detail + ']' : ''));
  if (!ok) failures.push(name);
}

// 1. FFT: синус 100 Гц → пик в бине ~9 (разрешение SR/FFT_N ≈ 10.8 Гц)
(function () {
  var f = new Float32Array(FFT_N), im = new Float32Array(FFT_N);
  for (var i = 0; i < FFT_N; i++) f[i] = Math.sin(2 * Math.PI * 100 * i / SR);
  fft(f, im);
  var best = 0, bestK = -1;
  for (i = 1; i < FFT_N / 2; i++) {
    var m = f[i] * f[i] + im[i] * im[i];
    if (m > best) { best = m; bestK = i; }
  }
  var hz = bestK * SR / FFT_N;
  check('FFT: пик синуса 100 Гц', Math.abs(hz - 100) < 20, hz.toFixed(1) + ' Гц');
})();

// 2. Fix-it: старт плохой, эталон хороший
var startM = metricsOf(FIX_START);
var idealM = metricsOf(BASE_MIX);
console.log('\nFIX_START : VP=' + startM.vp + ' LB=' + startM.lb + ' CL=' + startM.cl +
  ' total=' + startM.total + ' (vpShare=' + startM.raw.vpShare.toFixed(3) +
  ' mudShare=' + startM.raw.mudShare.toFixed(4) + ' highShare=' + startM.raw.highShare.toFixed(4) + ')');
console.log('BASE_MIX  : VP=' + idealM.vp + ' LB=' + idealM.lb + ' CL=' + idealM.cl +
  ' total=' + idealM.total + ' (vpShare=' + idealM.raw.vpShare.toFixed(3) +
  ' mudShare=' + idealM.raw.mudShare.toFixed(4) + ' highShare=' + idealM.raw.highShare.toFixed(4) + ')');

check('fix-it: старт total < 40%', startM.total < 40, 'total=' + startM.total);
check('fix-it: эталон total > 80%', idealM.total > 80, 'total=' + idealM.total);
check('fix-it: VP растёт к эталону', idealM.vp - startM.vp >= 40, startM.vp + ' → ' + idealM.vp);
check('fix-it: LB растёт к эталону', idealM.lb - startM.lb >= 30, startM.lb + ' → ' + idealM.lb);
check('fix-it: CL растёт к эталону', idealM.cl - startM.cl >= 30, startM.cl + ' → ' + idealM.cl);

// 3. Кейсы: направление метрик на bad/fixed
console.log('\nКейсы (bad → fixed):');
CASES.forEach(function (c) {
  var b = metricsOf(c.mixBad), f = metricsOf(c.mixFixed);
  console.log('  ' + c.id.padEnd(16) + ' VP ' + String(b.vp).padStart(3) + '→' + String(f.vp).padStart(3) +
    '  LB ' + String(b.lb).padStart(3) + '→' + String(f.lb).padStart(3) +
    '  CL ' + String(b.cl).padStart(3) + '→' + String(f.cl).padStart(3));
});

var byId = {};
CASES.forEach(function (c) { byId[c.id] = c; });
var vtlB = metricsOf(byId['vocal-too-low'].mixBad), vtlF = metricsOf(byId['vocal-too-low'].mixFixed);
check('vocal-too-low: VP падает в bad', vtlF.vp - vtlB.vp >= 30, vtlB.vp + ' → ' + vtlF.vp);

var mudB = metricsOf(byId['muddy-mix'].mixBad), mudF = metricsOf(byId['muddy-mix'].mixFixed);
check('muddy-mix: LB падает в bad', mudF.lb - mudB.lb >= 15, mudB.lb + ' → ' + mudF.lb);
check('muddy-mix: CL падает в bad', mudF.cl - mudB.cl >= 10, mudB.cl + ' → ' + mudF.cl);

var wkB = metricsOf(byId['weak-kick'].mixBad), wkF = metricsOf(byId['weak-kick'].mixFixed);
check('weak-kick: CL падает в bad (тихие барабаны)', wkF.cl - wkB.cl >= 20, wkB.cl + ' → ' + wkF.cl);

console.log('\n' + (failures.length ? 'FAILED: ' + failures.join(', ') : 'ALL CHECKS PASSED'));
process.exit(failures.length ? 1 : 0);
