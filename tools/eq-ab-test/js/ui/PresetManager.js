/** @typedef {import('../audio/EQProcessor.js').EQProcessor} EQProcessor */

/**
 * @param {EQProcessor} eq
 * @param {string} name
 */
export function applyPreset(eq, name) {
  if (!eq) return;
  const n = eq.numBands;
  switch (name) {
    case "flat":
      eq.resetFlat();
      return;
    case "bass": {
      eq.resetFlat();
      if (n >= 1) eq.setBandParams(0, { type: "lowshelf", frequency: 80, gain: 5, q: 0.9 });
      if (n >= 2) eq.setBandParams(1, { type: "peaking", frequency: 180, gain: 3, q: 1.2 });
      if (n >= 3) eq.setBandParams(2, { type: "peaking", frequency: 900, gain: -1.5, q: 1 });
      if (n >= 4) eq.setBandParams(3, { type: "peaking", frequency: 3500, gain: -2, q: 1.2 });
      if (n >= 5) eq.setBandParams(4, { type: "highshelf", frequency: 9000, gain: -1.5, q: 0.7 });
      return;
    }
    case "vocal": {
      eq.resetFlat();
      if (n >= 1) eq.setBandParams(0, { type: "highpass", frequency: 95, gain: 0, q: 0.7 });
      if (n >= 2) eq.setBandParams(1, { type: "peaking", frequency: 250, gain: -2.5, q: 1.4 });
      if (n >= 3) eq.setBandParams(2, { type: "peaking", frequency: 2800, gain: 3.5, q: 1.5 });
      if (n >= 4) eq.setBandParams(3, { type: "peaking", frequency: 5500, gain: 2, q: 2 });
      if (n >= 5) eq.setBandParams(4, { type: "highshelf", frequency: 10000, gain: 1.5, q: 0.7 });
      return;
    }
    case "air": {
      eq.resetFlat();
      if (n >= 1) eq.setBandParams(0, { type: "peaking", frequency: 100, gain: 1, q: 0.8 });
      if (n >= 2) eq.setBandParams(1, { type: "peaking", frequency: 400, gain: -0.5, q: 1 });
      if (n >= 3) eq.setBandParams(2, { type: "peaking", frequency: 1500, gain: 0.5, q: 1 });
      if (n >= 4) eq.setBandParams(3, { type: "peaking", frequency: 5000, gain: 2, q: 1.2 });
      if (n >= 5) eq.setBandParams(4, { type: "highshelf", frequency: 12000, gain: 4, q: 0.6 });
      return;
    }
    default:
      eq.resetFlat();
  }
}

/** @type {{ id: string, label: string }[]} */
export const PRESET_LIST = [
  { id: "flat", label: "Flat" },
  { id: "bass", label: "Bass" },
  { id: "vocal", label: "Vocal" },
  { id: "air", label: "Air" },
];
