/** @param {number} a
 * @param {number} b
 * @param {() => number} [rnd]
 */
function randRange(a, b, rnd = Math.random) {
  return a + (b - a) * rnd();
}

/**
 * Случайный «скрытый» эквалайзер для режима угадывания.
 * Частоты равномерно размазаны по лог‑шкале с джиттером.
 * @param {number} bands
 * @param {() => number} [rnd]
 * @returns {{ frequency: number, gain: number, q: number, type: string }[]}
 */
export function generateRandomTargetBands(bands = 5, rnd = Math.random) {
  /** @type {{ frequency: number, gain: number, q: number, type: string }[]} */
  const out = [];
  const logMin = Math.log10(72);
  const logMax = Math.log10(12000);

  for (let i = 0; i < bands; i++) {
    let tCenter = bands <= 1 ? 0.5 : i / (bands - 1);
    /* небольшое смещение, чтобы полосы не совпали с узлами графика */
    tCenter = Math.max(0.02, Math.min(0.98, tCenter + randRange(-0.045, 0.045, rnd)));
    let f = Math.pow(10, logMin + (logMax - logMin) * tCenter);
    f *= Math.pow(2, randRange(-2.05, 2.05, rnd));
    f = Math.max(50, Math.min(13000, f));

    /** @type {'peaking' | 'lowshelf' | 'highshelf'} */
    let type = "peaking";
    const r = rnd();
    if (r < 0.065 && i === 0) type = "lowshelf";
    else if (r > 0.935 && i === bands - 1) type = "highshelf";

    const gain =
      type === "lowshelf" || type === "highshelf"
        ? randRange(-5.5, 7.5, rnd)
        : randRange(-12, 12, rnd);

    const q =
      type === "lowshelf" || type === "highshelf"
        ? randRange(0.5, 1.35, rnd)
        : randRange(0.5, 5, rnd);

    out.push({ frequency: f, gain, q, type });
  }
  return out;
}
