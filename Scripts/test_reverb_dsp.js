// Headless-проверка DSP реверба (вырезает функции из reverb-widget.js)
// Ключевое: processLoop рендерит через OfflineAudioContext — в стабе наивная
// конволюция/биквады, а для click-теста считается точный эталон (круговая
// свёртка = steady-state реверб на лупящемся треке) → проверяется wrap-хвост.
'use strict';
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', 'docs', 'assets', 'javascripts', 'reverb-widget.js');
let src = fs.readFileSync(srcPath, 'utf8');

// Экспортируем внутренние функции для теста
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__prvTest = { synthBeat, synthTone, processLoop, makeImpulseMono, biquadCoeffs, applyBiquad, prepareTrack, fmtDur, LOOP_SEC, dbToLin, MAX_FILE_BYTES };\n})();');

// ===== Стаб OfflineAudioContext с наивной DSP (delay/biquad/convolution) =====
let T = null; // экспорты из reverb-widget.js (заполняется после vm.runInContext)
const oacRegistry = []; // все созданные OAC — чтобы захватить IR из createConvolver

function makeNode(kind) {
  const n = { kind: kind, _in: [], _out: [] };
  n.connect = function (t) { this._out.push(t); t._in.push(this); return t; };
  return n;
}

function naiveConv(a, b) {
  const out = new Float32Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    if (ai === 0) continue;
    for (let j = 0; j < b.length; j++) out[i + j] += ai * b[j];
  }
  return out;
}

function OAC(channels, length, sampleRate) {
  const sr = sampleRate;
  const self = {
    sampleRate: sr, length: length, channels: channels,
    destination: makeNode('dest'),
    _lastIR: null,
    createBuffer: function (ch, len) {
      const data = [];
      for (let c = 0; c < ch; c++) data.push(new Float32Array(len));
      return {
        sampleRate: sr, length: len, numberOfChannels: ch,
        getChannelData: function (i) { return data[i]; },
        copyToChannel: function (d, i) { data[i].set(d); }
      };
    },
    createBufferSource: function () { const n = makeNode('src'); n.buffer = null; n.start = function () {}; return n; },
    createGain: function () { const n = makeNode('gain'); n.gain = { value: 1 }; return n; },
    createDelay: function (max) { const n = makeNode('delay'); n.delayTime = { value: 0 }; return n; },
    createBiquadFilter: function () { const n = makeNode('biquad'); n.type = 'lowpass'; n.Q = { value: 1 }; n.frequency = { value: 350 }; return n; },
    createConvolver: function () { const n = makeNode('conv'); n.buffer = null; return n; }
  };
  self.startRendering = function () {
    function addArr(a, b) {
      const len = Math.max(a.length, b.length), o = new Float32Array(len);
      for (let i = 0; i < a.length; i++) o[i] += a[i];
      for (let i = 0; i < b.length; i++) o[i] += b[i];
      return o;
    }
    function evalNode(n) {
      if (n._done) return n._res;
      let sum = null;
      for (const inp of n._in) {
        const o = evalNode(inp);
        sum = sum ? addArr(sum, o) : o;
      }
      let out;
      switch (n.kind) {
        case 'src': out = Float32Array.from(n.buffer.getChannelData(0)); break;
        case 'gain': { const g = n.gain.value; out = new Float32Array(sum.length); for (let i = 0; i < sum.length; i++) out[i] = sum[i] * g; break; }
        case 'delay': { const d = Math.round(n.delayTime.value * sr); out = new Float32Array(sum.length); for (let i = d; i < sum.length; i++) out[i] = sum[i - d]; break; }
        case 'biquad': { const c = T.biquadCoeffs(n.type, n.frequency.value, n.Q.value, sr); out = Float32Array.from(sum); T.applyBiquad(out, c); break; }
        case 'conv': { self._lastIR = n.buffer.getChannelData(0); out = naiveConv(sum, self._lastIR); break; }
        case 'dest': out = sum; break;
        default: throw new Error('unknown node kind ' + n.kind);
      }
      n._done = true; n._res = out; return out;
    }
    const destOut = evalNode(self.destination);
    return Promise.resolve({ sampleRate: sr, length: destOut.length, numberOfChannels: 1, getChannelData: () => destOut });
  };
  oacRegistry.push(self);
  return self;
}

function lastIR() {
  const o = oacRegistry[oacRegistry.length - 1];
  if (!o || !o._lastIR) throw new Error('convolver не вызван');
  return o._lastIR;
}

// Стыбы для IIFE
const sandbox = {
  window: { devicePixelRatio: 1, Promise: Promise },
  document: { readyState: 'complete', querySelectorAll: () => [], addEventListener() {}, contains: () => false },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout, clearTimeout, console,
};

const vm = require('vm');
vm.createContext(sandbox);
sandbox.window.OfflineAudioContext = OAC;
vm.runInContext(src, sandbox);
T = sandbox.__prvTest;

// Фейковый AudioContext (живой) — как в test_compressor_dsp.js
let decodedBuf = null; // что вернёт decodeAudioData
function makeCtx(sr) {
  return {
    sampleRate: sr,
    state: 'running',
    currentTime: 0,
    createBuffer(ch, len) {
      const data = new Float32Array(len);
      return {
        sampleRate: sr, length: len, numberOfChannels: ch,
        getChannelData: () => data,
        copyToChannel(d) { data.set(d); }
      };
    },
    decodeAudioData(ab, ok) { ok(decodedBuf); },
    resume() {}
  };
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? ' — ' + extra : '')); }
}

// ===== Эталонные расчёты (steady-state = круговая свёртка по лупу) =====
const SR = 1000; // низкий sr для быстрой наивной конволюции в стабе
const L = Math.ceil(T.LOOP_SEC * SR);

function circConv(a, b) { // (a ⊛ b)[i] = Σ_k a[k]·b[(i−k) mod L], len(b) ≤ L
  const out = new Float64Array(L);
  for (let k = 0; k < Math.min(b.length, L); k++) {
    const bk = b[k];
    if (bk === 0) continue;
    for (let i = k; i < L; i++) out[i] += a[i - k] * bk;
    for (let i = 0; i < k; i++) out[i] += a[L + i - k] * bk;
  }
  return out;
}

function biquadIR(type, freq, Q, N) {
  const x = new Float32Array(N);
  x[0] = 1;
  T.applyBiquad(x, T.biquadCoeffs(type, freq, Q, SR));
  return x;
}

function limit(v) {
  if (v > 0.98) v = 0.98 + 0.02 * Math.tanh((v - 0.98) / 0.02);
  else if (v < -0.98) v = -0.98 - 0.02 * Math.tanh((-0.98 - v) / 0.02);
  return v;
}

// Точный эталон processLoop для click-входа:
// delay → HPF → LPF (steady-state = круговая свёртка с ИХ биквада, обрезанного до N_TR —
// хвост ИХ затухает за << L сэмплов при SR=1000) → конволюция с IR (захвачен из стаба).
function referenceClick(p, amp, params, ir) {
  const d = Math.round((params.predelay || 0) / 1000 * SR);
  const N_TR = 2000;
  const shifted = new Float64Array(L);
  shifted[(p + d) % L] = amp;
  const f1 = circConv(shifted, biquadIR('highpass', params.hpf != null ? params.hpf : 300, 0.7, N_TR));
  const f2 = circConv(f1, biquadIR('lowpass', params.lpf != null ? params.lpf : 8000, 0.7, N_TR));
  const wetG = (params.mix != null ? params.mix : 35) / 100;
  const dryG = (params.dry != null ? params.dry : 100) / 100;
  const irLen = ir.length;
  const raw = new Float64Array(L);
  for (let n = 0; n < L; n++) {
    let w = 0;
    for (let k = 0; k < irLen; k++) w += ir[k] * f2[((n - k) % L + L) % L];
    raw[n] = dryG * amp * (n === p ? 1 : 0) + wetG * w;
  }
  return { raw: raw, d: d };
}

const P = L - 100; // клик у конца лупа: хвост заворачивается через границу (wrap)

function clickBuf(amp, pos) {
  const buf = makeCtx(SR).createBuffer(1, L, SR);
  buf.getChannelData(0)[pos] = amp;
  return buf;
}

async function main() {
  console.log('== synthLoop (sr=48000) ==');
  const ctxHi = makeCtx(48000);
  for (const mode of ['beat', 'tone']) {
    const fn = mode === 'tone' ? T.synthTone : T.synthBeat;
    const b = fn(ctxHi);
    check(mode + ': длина ≈ LOOP_SEC·sr', Math.abs(b.length - T.LOOP_SEC * 48000) < 48000, `len=${b.length}`);
    let peak = 0, nan = false;
    const x = b.getChannelData(0);
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (!isFinite(a)) nan = true; if (a > peak) peak = a; }
    check(mode + ': нет NaN/Inf', !nan);
    check(mode + ': пик ≈ 0.8 (normalizePeak)', Math.abs(peak - 0.8) < 0.01, `peak=${peak.toFixed(4)}`);
  }

  console.log('== processLoop: идентичность (mix=0) ==');
  const ctx = makeCtx(SR);
  {
    // амплитуда 0.5 — ниже порога лимитера (0.98), чтобы выход был строго равен входу
    const dry = clickBuf(0.5, P);
    const res = await T.processLoop(ctx, dry, { decay: 2, predelay: 30, hpf: 300, lpf: 8000, mix: 0, dry: 100 });
    check('длина выхода == длине лупа', res.buffer.length === L, `len=${res.buffer.length}`);
    let maxDiff = 0;
    const out = res.buffer.getChannelData(0), dx = dry.getChannelData(0);
    for (let i = 0; i < L; i++) maxDiff = Math.max(maxDiff, Math.abs(out[i] - dx[i]));
    check('mix=0 → выход == вход', maxDiff < 1e-9, `maxDiff=${maxDiff}`);
  }

  console.log('== processLoop: точный эталон (wrap-хвост), decay=3 (irLen ≤ L) ==');
  {
    const dry = clickBuf(1, P); // клик у конца лупа — хвост заворачивается через границу
    const params = { decay: 3, predelay: 37, hpf: 60, lpf: 420, mix: 35, dry: 100 };
    const res = await T.processLoop(ctx, dry, params);
    const ir = lastIR();
    check('irLen == floor(sr·decay)', ir.length === Math.floor(SR * 3), `len=${ir.length}`);
    const ref = referenceClick(P, 1, params, ir);
    // wrap реально exercised: энергия ДО позиции клика возможна только через заворот хвоста
    let wrapSamples = 0;
    for (let n = 0; n < P; n++) if (Math.abs(ref.raw[n]) > 1e-6) wrapSamples++;
    check('wrap-хвост не пуст (тест дискриминирует)', wrapSamples > 50, `n=${wrapSamples}`);
    let maxDiff = 0;
    const out = res.buffer.getChannelData(0);
    for (let i = 0; i < L; i++) { const r = limit(ref.raw[i]); maxDiff = Math.max(maxDiff, Math.abs(out[i] - r)); }
    check('выход == эталон круговой свёртки', maxDiff < 2e-3, `maxDiff=${maxDiff.toExponential(2)}`);
  }

  console.log('== processLoop: длинный decay (irLen > L → copies=3) ==');
  {
    const dry = clickBuf(1, P);
    const params = { decay: 7, predelay: 50, hpf: 80, lpf: 420, mix: 40, dry: 100 };
    const res = await T.processLoop(ctx, dry, params);
    check('длина выхода == длине лупа', res.buffer.length === L, `len=${res.buffer.length}`);
    const ir = lastIR();
    check('irLen > L (режим wrap)', ir.length > L, `irLen=${ir.length}, L=${L}`);
    const ref = referenceClick(P, 1, params, ir);
    let maxDiff = 0;
    const out = res.buffer.getChannelData(0);
    for (let i = 0; i < L; i++) { const r = limit(ref.raw[i]); maxDiff = Math.max(maxDiff, Math.abs(out[i] - r)); }
    check('выход == эталон круговой свёртки', maxDiff < 2e-3, `maxDiff=${maxDiff.toExponential(2)}`);
  }

  console.log('== processLoop: мягкий лимитер ==');
  {
    const dry = clickBuf(3, P); // амплитуда 3 → raw >> 0.98, лимитер обязан сработать
    const params = { decay: 2, predelay: 10, hpf: 60, lpf: 420, mix: 50, dry: 100 };
    const res = await T.processLoop(ctx, dry, params);
    const ir = lastIR();
    const ref = referenceClick(P, 3, params, ir);
    let rawPeak = 0;
    for (let i = 0; i < L; i++) rawPeak = Math.max(rawPeak, Math.abs(ref.raw[i]));
    check('raw-пик > 0.98 (лимитер задействован)', rawPeak > 0.98, `raw=${rawPeak.toFixed(3)}`);
    let outPeak = 0;
    const out = res.buffer.getChannelData(0);
    for (let i = 0; i < L; i++) { const a = Math.abs(out[i]); if (!isFinite(a)) throw new Error('NaN'); if (a > outPeak) outPeak = a; }
    // tanh-асимптота в float32 округляется ровно до 1.0 — жёсткого клиппинга (>1) быть не должно
    check('пик после лимитера ≤ 1.0 и ≥ 0.98', outPeak <= 1.0 + 1e-6 && outPeak >= 0.98, `peak=${outPeak.toFixed(4)}`);
  }

  console.log('== processLoop: тон (структурно) ==');
  {
    // tone вместо beat: у бита HPF хэтов 7 кГц > Nyquist при SR=1000 → неустойчивый биквад.
    // Частоты фильтров в params — в полосе (Nyquist = 500 Гц).
    const tone = T.synthTone(ctx);
    check('тон: длина == L', tone.length === L, `len=${tone.length}`);
    const params = { decay: 2.5, predelay: 30, hpf: 60, lpf: 420, mix: 35, dry: 100 };
    const res = await T.processLoop(ctx, tone, params);
    check('выход: длина == L', res.buffer.length === L, `len=${res.buffer.length}`);
    let nan = false, peak = 0;
    const out = res.buffer.getChannelData(0), dx = tone.getChannelData(0);
    for (let i = 0; i < L; i++) { const a = Math.abs(out[i]); if (!isFinite(a)) nan = true; if (a > peak) peak = a; }
    check('нет NaN/Inf', !nan);
    check('пик ≤ 1.0 (лимитер)', peak <= 1.0 + 1e-6, `peak=${peak.toFixed(4)}`);
    let sd = 0, s = 0;
    for (let i = 0; i < L; i++) { const d = out[i] - dx[i]; sd += d * d; s += dx[i] * dx[i]; }
    const rmsDiff = Math.sqrt(sd / L), rmsDry = Math.sqrt(s / L);
    check('реверб слышен: RMS(out−dry) > 5%·RMS(dry)', rmsDiff > 0.05 * rmsDry, `diff=${rmsDiff.toFixed(4)} dry=${rmsDry.toFixed(4)}`);
  }

  console.log('== prepareTrack ==');
  {
    // decodeAudioData → стерео 3·sr с пиком ~0.25; maxSec=2 → обрезка до 2·sr, пик → −6 dBFS
    const n = 3 * SR;
    const chs = [new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) { const v = 0.25 * Math.sin(2 * Math.PI * 440 * i / SR); chs[0][i] = v; chs[1][i] = v; }
    decodedBuf = { sampleRate: SR, length: n, numberOfChannels: 2, getChannelData: (c) => chs[c] };
    sandbox.FileReader = function () {
      this.readAsArrayBuffer = function () { this.result = new ArrayBuffer(8); if (this.onload) this.onload(); };
    };
    const file = { name: 'test.wav', size: 100 };
    const mono = await T.prepareTrack(ctx, file, 2);
    check('mono: длина == maxSec·sr (обрезка)', mono.length === 2 * SR, `len=${mono.length}`);
    let peak = 0;
    const x = mono.getChannelData(0);
    for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
    // −6 dBFS = dbToLin(-6) ≈ 0.5012 (не ровно 0.5)
    check('пик нормализован до −6 dBFS', Math.abs(peak - T.dbToLin(-6)) < 1e-4, `peak=${peak.toFixed(5)} expect=${T.dbToLin(-6).toFixed(5)}`);

    const bigFile = { name: 'big.wav', size: T.MAX_FILE_BYTES + 1 };
    let rejected = false;
    await T.prepareTrack(ctx, bigFile).catch((e) => { rejected = e.message === 'too big'; });
    check('файл > 30 МБ → reject "too big"', rejected);
  }

  console.log('== fmtDur ==');
  check('fmtDur(65) === "1:05"', T.fmtDur(65) === '1:05', T.fmtDur(65));
  check('fmtDur(59) === "0:59"', T.fmtDur(59) === '0:59', T.fmtDur(59));
  check('fmtDur(0) === "0:00"', T.fmtDur(0) === '0:00', T.fmtDur(0));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
