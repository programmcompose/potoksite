import { EQComparisonWidget } from "./EQComparisonWidget.js";

const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);

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

  const widget = new EQComparisonWidget({
    container: mount,
    audioSrc,
    eqBands: bandsRaw ? Math.min(16, Math.max(1, parseInt(bandsRaw, 10))) : 5,
    loop: !loopOff,
    mobile: isMobile,
  });

  if (isMobile) {
    const welcome = document.getElementById("mobile-welcome");
    const startBtn = welcome?.querySelector('[data-act="start"]');
    if (welcome && startBtn) {
      welcome.style.display = "flex";
      const hideWelcome = async () => {
        welcome.style.display = "none";
        await widget.play();
      };
      startBtn.addEventListener("click", hideWelcome, { once: true });
      startBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        hideWelcome();
      }, { once: true });
    }
  }
}
