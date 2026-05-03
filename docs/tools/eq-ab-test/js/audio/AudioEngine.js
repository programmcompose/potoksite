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
 * Parallel dry + EQ wet paths with gain crossfade, single shared buffer playback.
 */
export class AudioEngine {
  /** @type {Emitter | null} */
  events;

  constructor() {
    /** @private */ this._loop = true;
    /** @private */ this._srcUrl = "";
    /** @private @type {AudioBuffer | null} */ this._buffer = null;

    /** @type {AudioContext | null} */ this.ctx = null;
    /** @type {EQProcessor | null} */ this.eq = null;
    /** @readonly */ this.eqBands = 5;

    /** @type {SpectrumAnalyser | null} */ this.spectrum = null;

    /** @private @type {GainNode | null} */ this._dryGain = null;
    /** @private @type {GainNode | null} */ this._wetGain = null;
    /** @private @type {GainNode | null} */ this._mergeOut = null;
    /** @private @type {DynamicsCompressorNode | null} */ this._comp = null;
    /** @private @type {AnalyserNode | null} */ this._outAnalyser = null;

    /** @private 0=dry … 1=wet */
    this._wet = 0.5;
    /** @private */ this._dryPeak = 0.5;
    /** @private */ this._wetPeak = 0.5;

    /** @private @type {AudioBufferSourceNode | null} */ this._source = null;
    /** @private */ this._playing = false;
    /** @private */ this._pauseOffset = 0;
    /** @private */ this._scheduledStart = 0;
    /** @private */ this._bufferOffsetAtStart = 0;
  }

  /**
   * Wire graph after user gesture AudioContext resume.
   * @param {AudioContext} ctx
   * @param {AttachOpts} [opts]
   */
  attachContext(ctx, opts = {}) {
    this.dispose(false);
    this.ctx = ctx;
    this.eqBands = Math.min(16, Math.max(1, opts.eqBands ?? 5));
    this.events = opts.events ?? null;

    this.eq = new EQProcessor(ctx, this.eqBands, this.events);
    this._dryGain = ctx.createGain();
    this._wetGain = ctx.createGain();
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

    this.eq.output.connect(this._wetGain);
    this._dryGain.connect(this._mergeOut);
    this._wetGain.connect(this._mergeOut);
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
    this._dryPeak = peak;
    this._wetPeak = peak;
  }

  /**
   * @param {boolean} full if true, close context-related nodes
   */
  dispose(full = true) {
    this.stopImmediate();
    if (this.eq) {
      try {
        this.eq.dispose();
      } catch {
        /* noop */
      }
      this.eq = null;
    }
    try {
      this._dryGain?.disconnect();
      this._wetGain?.disconnect();
      this._mergeOut?.disconnect();
      this._comp?.disconnect();
      this._outAnalyser?.disconnect();
    } catch {
      /* noop */
    }
    this._dryGain = null;
    this._wetGain = null;
    this._mergeOut = null;
    this._comp = null;
    this._outAnalyser = null;
    this.spectrum = null;
    if (full) this.ctx = null;
  }

  /**
   * @param {string} audioSrc
   */
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

  /**
   * Use an existing buffer (e.g. generated demo).
   * @param {AudioBuffer} buf
   */
  setExternalBuffer(buf) {
    this._buffer = buf;
    this._estimateNormalization();
  }

  /**
   * @param {boolean} [ramp]
   */
  updateCrossfadeGains(ramp = true) {
    const ctx = this.ctx;
    const d = this._dryGain;
    const w = this._wetGain;
    if (!ctx || !d || !w) return;

    const wet = Math.max(0, Math.min(1, this._wet));
    const dry = 1 - wet;

    const dryGain = (dry / this._dryPeak) * 0.85;
    const wetGain = (wet / this._wetPeak) * 0.85;

    const t = ctx.currentTime;
    const rampT = ramp ? 0.02 : 0;
    if (rampT > 0) {
      d.gain.cancelScheduledValues(t);
      w.gain.cancelScheduledValues(t);
      d.gain.setValueAtTime(d.gain.value, t);
      w.gain.setValueAtTime(w.gain.value, t);
      d.gain.linearRampToValueAtTime(dryGain, t + rampT);
      w.gain.linearRampToValueAtTime(wetGain, t + rampT);
    } else {
      d.gain.setValueAtTime(dryGain, t);
      w.gain.setValueAtTime(wetGain, t);
    }
  }

  /** @param {number} ratio 0..1 */
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
    if (!ctx || !buf || !this.eq || !this._dryGain || !this._wetGain) return;
    this.stopImmediate();

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = this._loop;

    src.connect(this._dryGain);
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

  /** @param {number} t seconds */
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
    if (!this.eq) return;
    const bands = this.eq.exportAllBands();
    let sumDb = 0;
    for (const b of bands) {
      if (b.type === "peaking" || b.type === "lowshelf" || b.type === "highshelf") sumDb += b.gain;
    }
    const trim = Math.max(-6, Math.min(6, -sumDb * 0.15));
    this._wetPeak = this._dryPeak * Math.pow(10, -trim / 20);
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
