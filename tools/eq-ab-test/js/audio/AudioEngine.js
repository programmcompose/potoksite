import { EQProcessor } from "./EQProcessor.js";
import { SpectrumAnalyser } from "./Analyser.js";

/** @typedef {import('../utils/events.js').EventEmitter} Emitter */

/**
 * @typedef {{
 *   eqBands?: number,
 *   events?: Emitter | null,
 * }} AttachOpts
 */

/**
 * Две параллельные цепочки из одного буфера:
 * канал A — целевой (скрытый) EQ, канал B — EQ пользователя.
 * Переключение / кроссфейд между A и B.
 */
export class AudioEngine {
  /** @type {Emitter | null} */
  events;

  constructor() {
    /** @private */ this._loop = true;
    /** @private */ this._srcUrl = "";
    /** @private @type {AudioBuffer | null} */ this._buffer = null;

    /** @type {AudioContext | null} */ this.ctx = null;
    /** Целевая эквализация «на угадывание». */
    /** @type {EQProcessor | null} */ this.eqTarget = null;
    /** Эквалайзер пользователя (режим B). */
    /** @type {EQProcessor | null} */ this.eq = null;

    /** @readonly */ this.eqBands = 5;

    /** @type {SpectrumAnalyser | null} */ this.spectrum = null;

    /** @private @type {GainNode | null} */ this._gainA = null;
    /** @private @type {GainNode | null} */ this._gainB = null;
    /** @private @type {GainNode | null} */ this._mergeOut = null;
    /** @private @type {DynamicsCompressorNode | null} */ this._comp = null;
    /** @private @type {AnalyserNode | null} */ this._outAnalyser = null;

    /** @private 1 = услышать только B (пользователя), 0 = только A (цель) */
    this._wet = 0;
    /** @private базовый пик буфера */
    this._bufferPeak = 0.45;
    /** @private множитель нормализации после цели / пользователя */
    this._peakMulA = 0.45;
    /** @private */
    this._peakMulB = 0.45;

    /** @private @type {AudioBufferSourceNode | null} */ this._source = null;
    /** @private */ this._playing = false;
    /** @private */ this._pauseOffset = 0;
    /** @private */ this._scheduledStart = 0;
    /** @private */ this._bufferOffsetAtStart = 0;
  }

  /**
   * @param {AudioContext} ctx
   * @param {AttachOpts} [opts]
   */
  attachContext(ctx, opts = {}) {
    this.dispose(false);
    this.ctx = ctx;
    this.eqBands = Math.min(16, Math.max(1, opts.eqBands ?? 5));
    this.events = opts.events ?? null;

    this.eqTarget = new EQProcessor(ctx, this.eqBands, null);
    this.eq = new EQProcessor(ctx, this.eqBands, this.events);
    this._gainA = ctx.createGain();
    this._gainB = ctx.createGain();
    this._mergeOut = ctx.createGain();
    this._mergeOut.gain.value = 0.95;

    this._comp = ctx.createDynamicsCompressor();
    this._comp.threshold.value = -18;
    this._comp.knee.value = 12;
    this._comp.ratio.value = 2.5;
    this._comp.attack.value = 0.004;
    this._comp.release.value = 0.2;

    this._outAnalyser = ctx.createAnalyser();
    this._outAnalyser.fftSize = 2048;
    this._outAnalyser.smoothingTimeConstant = 0.65;

    this.eqTarget.output.connect(this._gainA);
    this.eq.output.connect(this._gainB);
    this._gainA.connect(this._mergeOut);
    this._gainB.connect(this._mergeOut);
    this._mergeOut.connect(this._comp);
    this._comp.connect(this._outAnalyser);
    this._outAnalyser.connect(ctx.destination);

    this.spectrum = new SpectrumAnalyser(ctx, this._outAnalyser);

    this.updateCrossfadeGains(false);
    this._estimateNormalization();
  }

  /** @private */
  _estimateNormalization() {
    const buf = this._buffer;
    if (!buf) return;
    const chData = buf.getChannelData(0);
    let peak = 0;
    const step = Math.max(1, Math.floor(chData.length / 20000));
    for (let i = 0; i < chData.length; i += step) {
      const x = Math.abs(chData[i]);
      if (x > peak) peak = x;
    }
    peak = Math.max(peak, 0.001);
    this._bufferPeak = peak;
    this._peakMulA = peak;
    this._peakMulB = peak;
  }

  dispose(full = true) {
    this.stopImmediate();
    if (this.eqTarget) {
      try {
        this.eqTarget.dispose();
      } catch {
        /* noop */
      }
      this.eqTarget = null;
    }
    if (this.eq) {
      try {
        this.eq.dispose();
      } catch {
        /* noop */
      }
      this.eq = null;
    }
    try {
      this._gainA?.disconnect();
      this._gainB?.disconnect();
      this._mergeOut?.disconnect();
      this._comp?.disconnect();
      this._outAnalyser?.disconnect();
    } catch {
      /* noop */
    }
    this._gainA = null;
    this._gainB = null;
    this._mergeOut = null;
    this._comp = null;
    this._outAnalyser = null;
    this.spectrum = null;
    if (full) this.ctx = null;
  }

  async loadBuffer(audioSrc) {
    const url = audioSrc ?? this._srcUrl;
    if (!url || !this.ctx) throw new Error("AudioEngine: missing URL or context");
    this._srcUrl = url;

    const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.setExternalBuffer(buf);
    return buf;
  }

  setExternalBuffer(buf) {
    this._buffer = buf;
    this._estimateNormalization();
  }

  updateCrossfadeGains(ramp = true) {
    const ctx = this.ctx;
    const ga = this._gainA;
    const gb = this._gainB;
    if (!ctx || !ga || !gb) return;

    const bAmt = Math.max(0, Math.min(1, this._wet));
    const aAmt = 1 - bAmt;

    const gAlinear = (aAmt / Math.max(this._peakMulA, 1e-6)) * 0.85;
    const gBlinear = (bAmt / Math.max(this._peakMulB, 1e-6)) * 0.85;

    const t = ctx.currentTime;
    const rampT = ramp ? 0.02 : 0;
    if (rampT > 0) {
      ga.gain.cancelScheduledValues(t);
      gb.gain.cancelScheduledValues(t);
      ga.gain.setValueAtTime(ga.gain.value, t);
      gb.gain.setValueAtTime(gb.gain.value, t);
      ga.gain.linearRampToValueAtTime(gAlinear, t + rampT);
      gb.gain.linearRampToValueAtTime(gBlinear, t + rampT);
    } else {
      ga.gain.setValueAtTime(gAlinear, t);
      gb.gain.setValueAtTime(gBlinear, t);
    }
  }

  /** @param {number} ratio 0 = только A (цель), 1 = только B (пользователь), между — микс */
  setDryWet(ratio) {
    this._wet = Math.max(0, Math.min(1, ratio));
    this.updateCrossfadeGains(true);
  }

  getDryWet() {
    return this._wet;
  }

  play() {
    const ctx = this.ctx;
    const buf = this._buffer;
    if (!ctx || !buf || !this.eq || !this.eqTarget || !this._gainA || !this._gainB) return;
    this.stopImmediate();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = this._loop;

    src.connect(this.eqTarget.input);
    src.connect(this.eq.input);

    this._scheduledStart = ctx.currentTime + 0.02;
    this._bufferOffsetAtStart = Math.max(0, Math.min(buf.duration - 0.001, this._pauseOffset));
    src.start(this._scheduledStart, this._bufferOffsetAtStart);
    this._source = src;
    this._playing = true;

    src.onended = () => {
      if (!this._loop && this._source === src) {
        this._playing = false;
        this._pauseOffset = 0;
        this._source = null;
      }
    };
    this.updateCrossfadeGains(false);
  }

  pause() {
    const ctx = this.ctx;
    if (!ctx || !this._playing || !this._source) return;
    const elapsed = ctx.currentTime - this._scheduledStart;
    this._pauseOffset = Math.max(
      0,
      Math.min((this._buffer?.duration ?? 0) - 0.01, this._bufferOffsetAtStart + elapsed),
    );
    try {
      this._source.stop();
    } catch {
      /* noop */
    }
    try {
      this._source.disconnect();
    } catch {
      /* noop */
    }
    this._source = null;
    this._playing = false;
  }

  stop() {
    this._pauseOffset = 0;
    this.pause();
  }

  stopImmediate() {
    if (this._source) {
      try {
        this._source.stop();
      } catch {
        /* noop */
      }
      try {
        this._source.disconnect();
      } catch {
        /* noop */
      }
      this._source = null;
    }
    this._playing = false;
  }

  seek(t) {
    const buf = this._buffer;
    if (!buf) return;
    const wasPlaying = this._playing;
    this.pause();
    this._pauseOffset = Math.max(0, Math.min(buf.duration - 0.001, t));
    if (wasPlaying) this.play();
  }

  getCurrentTime() {
    const ctx = this.ctx;
    if (!ctx || !this._buffer) return this._pauseOffset;
    if (!this._playing) return this._pauseOffset;
    const elapsed = ctx.currentTime - this._scheduledStart;
    return Math.max(0, Math.min(this._buffer.duration, this._bufferOffsetAtStart + elapsed));
  }

  getDuration() {
    return this._buffer?.duration ?? 0;
  }

  isPlaying() {
    return this._playing;
  }

  setLoop(loop) {
    this._loop = !!loop;
  }

  refreshAutoGain() {
    if (!this.eq || !this.eqTarget) return;

    let sumA = 0;
    let sumB = 0;
    for (const b of this.eqTarget.exportAllBands()) {
      if (b.type === "peaking" || b.type === "lowshelf" || b.type === "highshelf") sumA += b.gain;
    }
    for (const b of this.eq.exportAllBands()) {
      if (b.type === "peaking" || b.type === "lowshelf" || b.type === "highshelf") sumB += b.gain;
    }
    const trimA = Math.max(-8, Math.min(8, -sumA * 0.14));
    const trimB = Math.max(-8, Math.min(8, -sumB * 0.14));
    const base = Math.max(this._bufferPeak, 0.001);
    this._peakMulA = base * Math.pow(10, -trimA / 20);
    this._peakMulB = base * Math.pow(10, -trimB / 20);
    this.updateCrossfadeGains(true);
  }

  reduceHeadroomIfClipping() {
    const data = this.spectrum?.readSpectrum();
    if (!data || !this._mergeOut || !this.ctx) return;
    let peak = 0;
    for (let i = 0; i < data.length; i++) if (data[i] > peak) peak = data[i];
    if (peak > 0.98) {
      const g = this._mergeOut.gain.value * 0.92;
      this._mergeOut.gain.setValueAtTime(g, this.ctx.currentTime);
    }
  }
}
