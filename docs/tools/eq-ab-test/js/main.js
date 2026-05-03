import { EQComparisonWidget } from "./EQComparisonWidget.js";

const mount = document.getElementById("eq-widget");
if (!mount) {
  console.warn("EQ-AB-test: #eq-widget not found");
} else {
  /** @type {string | undefined} */
  const audioAttr = mount.dataset.audio?.trim();
  /** @type {string | undefined} */
  let audioSrc = audioAttr ? audioAttr : undefined;

  /** @example data-bands="5" */
  const bandsRaw = mount.dataset.bands?.trim();

  /** @example data-loop="false" */
  const loopOff = mount.dataset.loop === "false";

  new EQComparisonWidget({
    container: mount,
    audioSrc,
    eqBands: bandsRaw ? Math.min(16, Math.max(1, parseInt(bandsRaw, 10))) : 5,
    loop: !loopOff,
  });
}
