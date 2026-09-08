/**
 * @typedef {{ min: number, max: number }} Range
 */

/**
 * Map linear t in [0,1] logarithmically to frequency in Hz.
 * @param {number} t
 * @param {Range} range
 * @returns {number}
 */
export function tToFreq(t, range) {
  const { min: fMin, max: fMax } = range;
  if (t <= 0) return fMin;
  if (t >= 1) return fMax;
  const l0 = Math.log10(fMin);
  const l1 = Math.log10(fMax);
  return Math.pow(10, l0 + t * (l1 - l0));
}

/**
 * @param {number} freq Hz
 * @param {Range} range
 * @returns {number} t in [0,1]
 */
export function freqToT(freq, range) {
  const { min: fMin, max: fMax } = range;
  const l0 = Math.log10(fMin);
  const l1 = Math.log10(fMax);
  return Math.max(0, Math.min(1, (Math.log10(freq) - l0) / (l1 - l0)));
}

/**
 * @param {number} db
 * @returns {number}
 */
export function dbToGain(db) {
  return Math.pow(10, db / 20);
}

/**
 * @param {number} gain linear
 * @returns {number} dB
 */
export function gainToDb(gain) {
  if (gain <= 0) return -120;
  return 20 * Math.log10(gain);
}

/** @typedef {{ hz20: Float32Array, nyquist: Float32Array }} HzGridResult */

/**
 * Log-spaced FFT bin frequency grid capped at Nyquist.
 * @param {number} fftSize
 * @param {number} sampleRate
 * @returns {HzGridResult}
 */
export function fftBinFreqsHz(fftSize, sampleRate) {
  const n = fftSize >>> 1;
  const hz = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    hz[k] = (k * sampleRate) / fftSize;
  }
  return { hz20: hz, nyquist: hz.slice(0, Math.min(n, hz.length)) };
}
