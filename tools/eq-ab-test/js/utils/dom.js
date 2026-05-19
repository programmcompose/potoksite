/**
 * @param {string|HTMLElement} ref
 * @returns {HTMLElement}
 */
export function queryEl(ref) {
  if (typeof ref === "string") {
    const el = document.querySelector(ref);
    if (!el) throw new Error(`Element not found: ${ref}`);
    return el;
  }
  return ref;
}

/**
 * @param {HTMLElement} el
 */
export function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * @param {number} secs
 */
export function formatTime(secs) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
}
