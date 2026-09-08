/**
 * Create a short synthetic loop for offline / CORS-free EQ demos.
 * @param {AudioContext} ctx
 * @param {number} [seconds]
 * @returns {AudioBuffer}
 */
export function buildDemoBuffer(ctx, seconds = 4) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, n, sr);
  const c = buf.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const step = Math.floor(t * 2) % 2;
    const kickPhase = Math.min(1, ((t % 0.5) / 0.5) * 12);
    const kickEnv = Math.exp(-kickPhase * 8);
    const kick =
      Math.sin(2 * Math.PI * phase) * kickEnv * 0.42 +
      Math.sin(2 * Math.PI * phase * 0.25) * kickEnv * 0.08;
    phase += 62 / sr;
    const hatRaw = Math.random() * 2 - 1;
    const hat = hatRaw * 0.12 * (step === 0 ? 1 : 0.35);
    const mid = Math.sin(2 * Math.PI * (330 + Math.sin(t * 1.7) * 40) * t) * 0.06 * (0.5 + 0.5 * Math.sin(t * Math.PI * 8));
    c[i] = Math.max(-1, Math.min(1, kick + hat + mid));
  }
  return buf;
}
