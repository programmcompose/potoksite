/**
 * Крутилка: вертикальный перетаскивание и стрелки (canvas).
 */
export class RotaryKnob {
  /**
   * @param {{
   *   label: string,
   *   min: number,
   *   max: number,
   *   value: number,
   *   format: (v: number) => string,
   *   step?: number,
   *   onChange?: (v: number) => void,
   *   sensitivity?: number,
   *   size?: number,
   * }} opts
   */
  constructor(opts) {
    this.label = opts.label;
    this.min = opts.min;
    this.max = opts.max;
    this.format = opts.format;
    /** @private */ this._step = opts.step ?? 0;
    this.onChange = opts.onChange;
    /** @private */ this._dragSens = opts.sensitivity ?? 0.0035;

    /** @private */ this._wrap = document.createElement("div");
    this._wrap.className = "eq-ab-knob";

    /** @readonly */ this._canvas = document.createElement("canvas");
    this._canvas.className = "eq-ab-knob-ring";

    /** @readonly */ this.valueDisplay = document.createElement("span");
    this.valueDisplay.className = "eq-ab-knob-value";

    const cap = document.createElement("span");
    cap.className = "eq-ab-knob-caption";
    cap.textContent = opts.label.toUpperCase();

    this._wrap.appendChild(this._canvas);
    this._wrap.appendChild(cap);
    this._wrap.appendChild(this.valueDisplay);

    /** @private */ this._sizeCss = opts.size ?? 72;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.width = Math.round(this._sizeCss * pr);
    this._canvas.height = Math.round(this._sizeCss * pr);

    /** @private */ this._dragging = false;
    /** @private */ this._dragStartVal = 0;
    /** @private */ this._dragStartClientY = 0;

    this._onMove = /** @type {(e: PointerEvent) => void} */ ((e) => this._pointerMove(e));
    this._onUp = () => this._pointerUp();

    this._canvas.addEventListener("pointerdown", (e) => this._pointerDown(e));

    /** @readonly */ this.value = this._clamp(opts.value ?? opts.min);
    /** @readonly */ this.element = this._wrap;

    this.setAria();
    this.setValue(this.value, true);
    this._paint();

    /** @readonly */ this._keydown = /** @type {(e: KeyboardEvent) => void} */ ((e) => this._keydownH(e));
    this._canvas.tabIndex = 0;
    this._canvas.setAttribute("role", "slider");
    this._canvas.addEventListener("keydown", this._keydown);
  }

  setAria() {
    this._canvas.setAttribute(
      "aria-label",
      `${this.label}: ${this.format(this.value)}`,
    );
    this._canvas.setAttribute(
      "aria-valuetext",
      this.format(this.value),
    );
  }

  attach(parent) {
    parent.appendChild(this._wrap);
  }

  detach() {
    this._wrap.remove();
  }

  dispose() {
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    this._canvas.removeEventListener("keydown", this._keydown);
    this.detach();
  }

  /**
   * @param {number} v
   * @param {boolean} [silent]
   */
  setValue(v, silent) {
    let next = this._clamp(v);
    if (this._step > 0) next = Math.round(next / this._step) * this._step;
    this.value = next;
    this.valueDisplay.textContent = this.format(next);
    this.setAria();
    this._paint();
    if (!silent && this.onChange) this.onChange(next);
  }

  /** @private @param {number} x */
  _clamp(x) {
    return Math.max(this.min, Math.min(this.max, x));
  }

  /** @private @param {PointerEvent} e */
  _pointerDown(e) {
    e.preventDefault();
    if (typeof e.buttons === "number" && !(e.buttons & 1)) return;
    this._dragging = true;
    this._dragStartVal = this.value;
    this._dragStartClientY = e.clientY;
    this._canvas.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", this._onMove);
    window.addEventListener("pointerup", this._onUp);
    this._canvas.classList.add("eq-ab-knob-ring--grab");
    this._wrap.classList.add("eq-ab-knob--active");
  }

  /** @private @param {PointerEvent} e */
  _pointerMove(e) {
    if (!this._dragging) return;
    e.preventDefault();
    const dy = this._dragStartClientY - e.clientY;
    const span = Math.max(this.max - this.min, 1e-9);
    let nextVal = this._clamp(this._dragStartVal + dy * span * this._dragSens);
    if (this._step > 0) nextVal = Math.round(nextVal / this._step) * this._step;
    this.setValue(nextVal);
  }

  /** @private */
  _pointerUp() {
    if (!this._dragging) return;
    this._dragging = false;
    window.removeEventListener("pointermove", this._onMove);
    window.removeEventListener("pointerup", this._onUp);
    try {
      this._canvas.releasePointerCapture(/** @type {any} */ (0));
    } catch {
      /* ignore */
    }
    this._canvas.classList.remove("eq-ab-knob-ring--grab");
    this._wrap.classList.remove("eq-ab-knob--active");
  }

  /** @private @param {KeyboardEvent} e */
  _keydownH(e) {
    const coarse = Math.max(Math.abs(this._step || 1e-6), (this.max - this.min) * 0.008);
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      this.setValue(this.value + coarse);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      this.setValue(this.value - coarse);
    }
  }

  /** @private */
  _paint() {
    const px = Math.min(window.devicePixelRatio || 1, 2);
    const sCss = this._sizeCss;
    const cx = /** @type {CanvasRenderingContext2D} */ (this._canvas.getContext("2d"));
    const cw = this._canvas.width;
    const ch = this._canvas.height;
    cx.setTransform(px, 0, 0, px, 0, 0);
    cx.clearRect(0, 0, cw / px, ch / px);
    const xc = sCss;
    const yc = sCss;
    const r = sCss * 0.36;

    const t = Math.max(0, Math.min(1, (this.value - this.min) / Math.max(this.max - this.min, 1e-9)));
    const start = Math.PI * 0.9;
    const sweep = Math.PI * 1.3;
    const cur = start + t * sweep;

    cx.strokeStyle = "rgba(255,255,255,0.1)";
    cx.lineWidth = 2.75;
    cx.lineCap = "round";
    cx.beginPath();
    cx.arc(xc, yc, r, start, start + sweep);
    cx.stroke();

    cx.strokeStyle = "rgba(255, 238, 88, 0.92)";
    cx.beginPath();
    cx.arc(xc, yc, r, start, cur);
    cx.stroke();

    const dx = Math.cos(cur) * (r - 5);
    const dy = Math.sin(cur) * (r - 5);
    cx.fillStyle = "#f2f7ff";
    cx.beginPath();
    cx.arc(xc + dx, yc + dy, 3.5, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "rgba(0,0,0,0.55)";
    cx.lineWidth = 1;
    cx.stroke();
  }
}
