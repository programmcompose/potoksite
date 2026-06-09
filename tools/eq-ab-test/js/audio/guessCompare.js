import { gainToDb } from "../utils/math.js";

/** @typedef {import('./EQProcessor.js').EQProcessor} EQProcessor */

/**
 * Сравнивает суммарные АЧХ цели и попытки пользователя.
 * @param {EQProcessor} eqTarget
 * @param {EQProcessor} eqUser
 * @returns {{ rmseDb: number, maxDb: number, scorePct: number, pass: boolean }}
 */
export function compareEqCurves(eqTarget, eqUser) {
  const n = 384;
  /** @type {Float32Array} */
  const freqs = new Float32Array(n);
  const mt = new Float32Array(n);
  const mu = new Float32Array(n);
  const l0 = Math.log10(20);
  const l1 = Math.log10(20000);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    freqs[i] = Math.pow(10, l0 + t * (l1 - l0));
  }
  eqTarget.getCombinedMagnitudeAt(freqs, mt);
  eqUser.getCombinedMagnitudeAt(freqs, mu);

  let sumSq = 0;
  let maxAbs = 0;
  for (let i = 0; i < n; i++) {
    const dt = gainToDb(mu[i] + 1e-12) - gainToDb(mt[i] + 1e-12);
    sumSq += dt * dt;
    const a = Math.abs(dt);
    if (a > maxAbs) maxAbs = a;
  }
  const rmseDb = Math.sqrt(sumSq / n);
  const scorePct = Math.max(0, Math.min(100, Math.round((1 - rmseDb / 7.5) * 100)));
  const pass = rmseDb <= 3.2 && maxAbs <= 13;
  return { rmseDb, maxDb: maxAbs, scorePct, pass };
}
