/** @typedef {import('../utils/events.js').EventEmitter} Emitter */

/**
 * @typedef {'peaking' | 'lowshelf' | 'highshelf' | 'lowpass' | 'highpass'} EqFilterType
 */

/**
 * @typedef {{
 *   frequency: number,
 *   gain: number,
 *   q: number,
 *   type: EqFilterType,
 * }} EqBandParams
 */

const DEFAULT_BANDS /** @type {EqBandParams[]} */ = [
  { frequency: 120, gain: 0, q: 1, type: "peaking" },
  { frequency: 400, gain: 0, q: 1, type: "peaking" },
  { frequency: 1000, gain: 0, q: 1, type: "peaking" },
  { frequency: 3500, gain: 0, q: 1, type: "peaking" },
  { frequency: 10000, gain: 0, q: 1, type: "peaking" },
];

/**
 * Cascaded parametric EQ using BiquadFilterNode chain.
 */
export class EQProcessor {
  /**
   * @param {AudioContext} audioContext
   * @param {number} bands
   * @param {Emitter|null} [events]
   */
  constructor(audioContext, bands = 5, events = null) {
    /** @readonly */ this.ctx = audioContext;
    this.events = events;
    this.input = audioContext.createGain();
    this.output = audioContext.createGain();

    const n = Math.min(16, Math.max(1, Math.floor(bands)));
    /** @type {BiquadFilterNode[]} */
    this._filters = [];

    let prev /** @type {AudioNode} */ = this.input;
    for (let i = 0; i < n; i++) {
      const bp = DEFAULT_BANDS[Math.min(i, DEFAULT_BANDS.length - 1)];
      const f = audioContext.createBiquadFilter();
      f.type = bp.type;
      f.frequency.value = clampFreq(bp.frequency, audioContext.sampleRate);
      f.Q.value = clampQ(bp.q);
      f.gain.value = clampGain(bp.gain);
      this._filters.push(f);
      prev.connect(f);
      prev = f;
    }
    prev.connect(this.output);

    /** @readonly */ this.numBands = n;
  }

  dispose() {
    try {
      this.input.disconnect();
      this.output.disconnect();
      for (const f of this._filters) {
        try {
          f.disconnect();
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {number} i
   * @returns {EqBandParams}
   */
  getBandParams(i) {
    const f = this._filters[i];
    if (!f)
      throw new Error(`EQ band ${i} out of range`);
    /** @type {EqFilterType} */
    const t = /** @type {EqFilterType} */ (
      typeof f.type === "string"
        ? f.type
        : "peaking"
    );
    return {
      frequency: f.frequency.value,
      gain: f.gain.value,
      q: f.Q.value,
      type: t,
    };
  }

  /** @returns {EqBandParams[]} */
  exportAllBands() {
    const out /** @type {EqBandParams[]} */ = [];
    for (let i = 0; i < this._filters.length; i++) out.push(this.getBandParams(i));
    return out;
  }

  /**
   * @param {number} bandIndex
   * @param {Partial<EqBandParams>} params
   */
  setBandParams(bandIndex, params) {
    const f = this._filters[bandIndex];
    if (!f) return;
    const { frequency, gain, q, type } = params;
    if (frequency != null) {
      const hz = clampFreq(frequency, this.ctx.sampleRate);
      f.frequency.setValueAtTime(hz, this.ctx.currentTime);
    }
    if (gain != null) f.gain.setValueAtTime(clampGain(gain), this.ctx.currentTime);
    if (q != null) f.Q.setValueAtTime(clampQ(q), this.ctx.currentTime);
    if (type != null) {
      const allowed = new Set(["peaking", "lowshelf", "highshelf", "lowpass", "highpass"]);
      if (allowed.has(type)) f.type = type;
    }
    this.events?.emit("eqchange", { bandIndex, params: this.getBandParams(bandIndex) });
  }

  resetFlat() {
    for (let i = 0; i < this._filters.length; i++) {
      const def = DEFAULT_BANDS[Math.min(i, DEFAULT_BANDS.length - 1)];
      const f = this._filters[i];
      f.type = def.type;
      f.frequency.setValueAtTime(clampFreq(def.frequency, this.ctx.sampleRate), this.ctx.currentTime);
      f.gain.setValueAtTime(0, this.ctx.currentTime);
      f.Q.setValueAtTime(clampQ(def.q), this.ctx.currentTime);
    }
  }

  /**
   * Cascaded magnitude response across all bands at given frequencies (Hz).
   * @param {Float32Array} frequenciesHz linear frequency array
   * @param {Float32Array} magOut magnitude (linear scale) same length as frequenciesHz
   */
  getCombinedMagnitudeAt(frequenciesHz, magOut) {
    const n = frequenciesHz.length;
    const tmpMag = new Float32Array(n);
    const tmpPhase = new Float32Array(n);
    /** @type {Float32Array} */
    const acc = new Float32Array(n);
    acc.fill(1);
    for (const filter of this._filters) {
      filter.getFrequencyResponse(frequenciesHz, tmpMag, tmpPhase);
      for (let i = 0; i < n; i++) acc[i] *= tmpMag[i];
    }
    for (let i = 0; i < n; i++) magOut[i] = acc[i];
  }
}

/**
 * @param {number} hz
 * @param {number} sampleRate
 */
function clampFreq(hz, sampleRate) {
  const max = Math.min(20000, sampleRate * 0.49);
  return Math.max(20, Math.min(max, hz));
}

/**
 * @param {number} g
 */
function clampGain(g) {
  return Math.max(-24, Math.min(24, g));
}

/**
 * @param {number} q
 */
function clampQ(q) {
  return Math.max(0.1, Math.min(10, q));
}
