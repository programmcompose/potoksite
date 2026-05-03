import { gainToDb } from "../utils/math.js";

/** @typedef {import('../audio/EQProcessor.js').EQProcessor} EQProcessor */
/** @typedef {import('../audio/Analyser.js').SpectrumAnalyser} SpectrumAnalyser */

/**
 * Canvas EQ curve + optional spectrum underlay.
 */
export class EQVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => EQProcessor | null} getEq
   * @param {() => SpectrumAnalyser | null} [getSpectrum]
   */
  constructor(canvas, getEq, getSpectrum) {
    this.canvas = canvas;
    this.getEq = getEq;
    this.getSpectrum = getSpectrum ?? (() => null);
    /** @private */ this._raf = 0;
    /** @private */ this._freqs = new Float32Array(360);
    /** @private */ this._mags = new Float32Array(360);
    this._buildLogGrid();
  }

  _buildLogGrid() {
    const n = this._freqs.length;
    const fMin = 20;
    const fMax = 20000;
    const l0 = Math.log10(fMin);
    const l1 = Math.log10(fMax);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this._freqs[i] = Math.pow(10, l0 + t * (l1 - l0));
    }
  }

  start() {
    if (this._raf) return;
    const tick = () => {
      this.draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  draw() {
    const canvas = this.canvas;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth | 0;
    const h = canvas.clientHeight | 0;
    if (w < 2 || h < 2) return;
    const tw = Math.max(1, Math.floor(w * dpr));
    const th = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, w, h);

    const bg = "#12121a";
    const grid = "rgba(255,255,255,0.07)";
    const curve = "#00d4ff";
    const fill = "rgba(0,212,255,0.12)";

    ctx2d.fillStyle = bg;
    ctx2d.fillRect(0, 0, w, h);

    const padL = 44;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xForHz = (hz) => padL + (Math.log10(hz / 20) / Math.log10(20000 / 20)) * plotW;
    const yForDb = (db) => padT + ((12 - db) / 36) * plotH;

    ctx2d.strokeStyle = grid;
    ctx2d.lineWidth = 1;
    for (const hz of [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
      const x = xForHz(hz);
      ctx2d.beginPath();
      ctx2d.moveTo(x, padT);
      ctx2d.lineTo(x, padT + plotH);
      ctx2d.stroke();
    }
    for (const db of [-24, -12, 0, 12, 24]) {
      const y = yForDb(db);
      ctx2d.beginPath();
      ctx2d.moveTo(padL, y);
      ctx2d.lineTo(padL + plotW, y);
      ctx2d.stroke();
    }

    const spec = this.getSpectrum();
    const specData = spec?.readSpectrum();
    if (specData && specData.length > 4 && spec.analyser) {
      const sr = spec.analyser.context.sampleRate;
      const fft = spec.analyser.fftSize;
      const n = specData.length;
      ctx2d.beginPath();
      ctx2d.fillStyle = "rgba(171,71,188,0.15)";
      for (let i = 0; i < n; i++) {
        const hz = (i * sr) / fft;
        if (hz < 20 || hz > 20000) continue;
        const x = xForHz(hz);
        const amp = specData[i];
        const y = padT + plotH - amp * plotH * 0.45;
        if (i === 0) ctx2d.moveTo(x, padT + plotH);
        ctx2d.lineTo(x, y);
      }
      ctx2d.lineTo(padL + plotW, padT + plotH);
      ctx2d.closePath();
      ctx2d.fill();
    }

    const eq = this.getEq();
    if (!eq) return;
    eq.getCombinedMagnitudeAt(this._freqs, this._mags);
    const pts /** @type {number[]} */ = [];
    for (let i = 0; i < this._mags.length; i++) {
      const db = gainToDb(this._mags[i]);
      const clamped = Math.max(-24, Math.min(24, db));
      pts.push(xForHz(this._freqs[i]), yForDb(clamped));
    }

    ctx2d.beginPath();
    ctx2d.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx2d.lineTo(pts[i], pts[i + 1]);
    ctx2d.strokeStyle = curve;
    ctx2d.lineWidth = 2;
    ctx2d.stroke();

    ctx2d.beginPath();
    ctx2d.moveTo(pts[0], yForDb(0));
    for (let i = 0; i < pts.length; i += 2) ctx2d.lineTo(pts[i], pts[i + 1]);
    ctx2d.lineTo(pts[pts.length - 2], yForDb(0));
    ctx2d.closePath();
    ctx2d.fillStyle = fill;
    ctx2d.fill();

    ctx2d.fillStyle = "rgba(255,255,255,0.45)";
    ctx2d.font = "10px system-ui,sans-serif";
    ctx2d.fillText("20 Hz", padL, h - 8);
    ctx2d.fillText("20 kHz", padL + plotW - 36, h - 8);
    ctx2d.fillText("+24 dB", 4, padT + 8);
    ctx2d.fillText("0 dB", 4, yForDb(0) + 3);
    ctx2d.fillText("−24 dB", 4, padT + plotH - 2);
  }
}
