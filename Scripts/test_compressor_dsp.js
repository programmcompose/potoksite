// Headless-проверка DSP компрессора (вырезает функции из compressor-widget.js)
'use strict';
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'docs', 'assets', 'javascripts', 'compressor-widget.js');
let src = fs.readFileSync(srcPath, 'utf8');

// Экспортируем внутренние функции для теста
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__pcpTest = { dbToLin, linToDb, softKneeOut, tri, biquadCoeffs, applyBiquad, synthLoop, processLoop, LOOP_SEC };\n})();');

// Стыбы для IIFE
const sandbox = {
  window: { devicePixelRatio: 1 },
  document: { readyState: 'complete', querySelectorAll: () => [], addEventListener() {}, contains: () => false },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout, clearTimeout, console,
};

const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const T = sandbox.__pcpTest;

// Фейковый AudioContext
const SR = 48000;
function makeCtx() {
  return {
    sampleRate: SR,
    state: 'running',
    currentTime: 0,
    createBuffer(ch, len) {
      const data = new Float32Array(len);
      return {
        sampleRate: SR, length: len, numberOfChannels: ch,
        getChannelData: () => data,
        copyToChannel(d) { data.set(d); },
      };
    },
    resume() {},
  };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

console.log('== synthLoop ==');
const ctx = makeCtx();
const dry = T.synthLoop(ctx);
check('длина лупа ≈ LOOP_SEC*sr', Math.abs(dry.length - T.LOOP_SEC * SR) < SR, `len=${dry.length}`);
let peak = 0, nan = false;
const dx = dry.getChannelData(0);
for (let i = 0; i < dx.length; i++) { const a = Math.abs(dx[i]); if (!isFinite(a)) nan = true; if (a > peak) peak = a; }
check('нет NaN/Inf', !nan);
check('пик ≈ -6 dBFS (0.5)', Math.abs(peak - 0.5) < 0.02, `peak=${peak.toFixed(4)}`);

console.log('== softKneeOut ==');
const th = -24, ratio = 4;
// Ниже колена — идентичность
check('ниже колена: out == in', Math.abs(T.softKneeOut(th - 10, th, ratio) - (th - 10)) < 1e-9);
// Выше колена: наклон 1/ratio (линия проходит через точку (T, T))
const hi = th + 20;
const expectedHi = th + (hi - th) / ratio;
check('выше колена: наклон 1/ratio', Math.abs(T.softKneeOut(hi, th, ratio) - expectedHi) < 1e-9);
// Непрерывность всей кривой (свип с шагом 0.001 дБ)
let maxJump = 0;
for (let db = -60; db <= 0; db += 0.001) {
  const a = T.softKneeOut(db, th, ratio);
  const b = T.softKneeOut(Math.min(0, db + 0.001), th, ratio);
  maxJump = Math.max(maxJump, Math.abs(b - a));
}
check('кривая непрерывна (max jump < 0.02 дБ)', maxJump < 0.02, `maxJump=${maxJump.toFixed(5)}`);

console.log('== processLoop ==');
// ratio=1, makeup=0 → идентичность
const id = T.processLoop(ctx, dry, { threshold: -40, ratio: 1, attack: 5, release: 200, makeup: 0 });
let maxDiff = 0;
for (let i = 0; i < dx.length; i++) maxDiff = Math.max(maxDiff, Math.abs(id.buffer.getChannelData(0)[i] - dx[i]));
check('ratio=1 → выход ≈ вход', maxDiff < 1e-6, `maxDiff=${maxDiff}`);

// Сильная компрессия: GR > 0 и пик снижен
const comp = T.processLoop(ctx, dry, { threshold: -30, ratio: 8, attack: 5, release: 200, makeup: 0 });
let maxGr = 0;
for (let i = 0; i < id.gr.length; i++) if (comp.gr[i] > maxGr) maxGr = comp.gr[i];
check('GR > 3 дБ при threshold -30 / ratio 8', maxGr > 3, `maxGr=${maxGr.toFixed(2)}`);
let wetPeak = 0;
const wx = comp.buffer.getChannelData(0);
for (let i = 0; i < wx.length; i++) { const a = Math.abs(wx[i]); if (!isFinite(a)) nan = true; if (a > wetPeak) wetPeak = a; }
check('пик после компрессии < пика до', wetPeak < peak, `wet=${wetPeak.toFixed(3)} dry=${peak.toFixed(3)}`);

// Makeup +12 не клиппит за 0.985
const mk = T.processLoop(ctx, dry, { threshold: -24, ratio: 4, attack: 10, release: 200, makeup: 12 });
let mkPeak = 0;
for (let i = 0; i < dx.length; i++) mkPeak = Math.max(mkPeak, Math.abs(mk.buffer.getChannelData(0)[i]));
check('makeup +12 → нет жёсткого клиппинга (≤ 1.0)', mkPeak <= 1.0, `peak=${mkPeak.toFixed(4)}`);

// Быстрый attack vs медленный: быстрый даёт больший GR на транзиентах
const fast = T.processLoop(ctx, dry, { threshold: -24, ratio: 4, attack: 1, release: 200, makeup: 0 });
const slow = T.processLoop(ctx, dry, { threshold: -24, ratio: 4, attack: 80, release: 200, makeup: 0 });
let grFast = 0, grSlow = 0;
for (let i = 0; i < dx.length; i++) { if (fast.gr[i] > grFast) grFast = fast.gr[i]; if (slow.gr[i] > grSlow) grSlow = slow.gr[i]; }
check('быстрый attack → больший GR', grFast > grSlow, `fast=${grFast.toFixed(2)} slow=${grSlow.toFixed(2)}`);

// Скорость пере-рендера
const t0 = Date.now();
T.processLoop(ctx, dry, { threshold: -24, ratio: 4, attack: 10, release: 200, makeup: 0 });
const ms = Date.now() - t0;
check('пере-рендер < 300 мс', ms < 300, `${ms} мс`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
