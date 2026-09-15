/**
 * FFT helper for optional spectrum visualization.
 */
export class SpectrumAnalyser {
  /**
   * @param {AudioContext} ctx
   * @param {AnalyserNode|null} [node]
   */
  constructor(ctx, node = null) {
    this.ctx = ctx;
    /** @type {AnalyserNode|null} */
    this.analyser = node;
    /** @type {Uint8Array<ArrayBufferLike>|null} */
    this.freqData = null;
    if (node) this.attach(node);
  }

  /** @param {AnalyserNode} node */
  attach(node) {
    this.analyser = node;
    node.fftSize = Math.max(node.fftSize || 2048, 1024);
    node.smoothingTimeConstant = 0.75;
    this.freqData = new Uint8Array(node.frequencyBinCount);
  }

  detach() {
    this.analyser = null;
    this.freqData = null;
  }

  /**
   * @param {Float32Array|null} [dest]
   * @returns {Float32Array|null}
   */
  readSpectrum(dest) {
    const a = this.analyser;
    if (!a || !this.freqData) return dest ?? null;
    const n = a.frequencyBinCount;
    if (this.freqData.length !== n) this.freqData = new Uint8Array(n);
    a.getByteFrequencyData(this.freqData);
    const out = dest && dest.length >= n ? dest : new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = this.freqData[i] / 255;
    return out;
  }
}
