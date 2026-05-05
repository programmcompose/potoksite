/**
 * VST-style rotary knob: 270° arc, tick marks, indicator line,
 * vertical drag, mouse wheel, cyan glow on drag, localStorage persistence.
 */
export class RotaryKnob {
  /** @private */ static _defaultSize = 60;
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
   *   storageKey?: string,
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
    /** @private */ this._storageKey = opts.storageKey ?? `eqknob_${this.label}`;

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

    /** @private */ this._sizeCss = opts.size ?? 60;
    this._resizeCanvas();

    /** @private */ this._dragging = false;
    /** @private */ this._dragStartVal = 0;
    /** @private */ this._dragStartClientY = 0;

    this._onMove = /** @type {(e: PointerEvent) => void} */ ((e) => this._pointerMove(e));
    this._onUp = () => this._pointerUp();
    this._onWheel = /** @type {(e: WheelEvent) => void} */ ((e) => this._wheel(e));

    this._canvas.addEventListener("pointerdown", (e) => this._pointerDown(e));
    this._canvas.addEventListener("wheel", this._onWheel, { passive: false });

    // Resize observer для адаптивного размера на мобильных
    /** @private */ this._resizeObserver = null;
    try {
      this._resizeObserver = new ResizeObserver(() => {
        const newSize = this._getCssSize();
        if (Math.abs(newSize - this._sizeCss) > 1) {
          this._resizeCanvas();
          this._paint();
        }
      });
      this._resizeObserver.observe(this._canvas);
    } catch {
      /* ResizeObserver не поддерживается */
    }

    /** @private */ this._initValue = opts.value ?? opts.min;
    this.value = this._loadValue() ?? this._clamp(opts.value ?? opts.min);
    /** @readonly */ this.element = this._wrap;

    this.setAria();
    this.setValue(this.value, true);
    this._paint();

    /** @readonly */ this._keydown = /** @type {(e: KeyboardEvent) => void} */ ((e) => this._keydownH(e));
    this._canvas.tabIndex = 0;
    this._canvas.setAttribute("role", "slider");
    this._canvas.addEventListener("keydown", this._keydown);
  }

  /** @private */
  _resizeCanvas() {
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    const computedSize = this._getCssSize();
    this._sizeCss = computedSize;
    this._canvas.width = Math.round(computedSize * pr);
    this._canvas.height = Math.round(computedSize * pr);
    this._canvas.style.width = computedSize + "px";
    this._canvas.style.height = computedSize + "px";
  }

  /** Получить размер из CSS-переменной или fallback */
  _getCssSize() {
    const optSize = this.constructor.prototype._defaultSize;
    try {
      const style = getComputedStyle(document.documentElement);
      const val = style.getPropertyValue("--eq-knob-size").trim();
      if (val) {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) return num;
      }
    } catch { /* noop */ }
    return optSize ?? 60;
  }

  /** @private @returns {number | null} */
  _loadValue() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw === null) return null;
      const n = parseFloat(raw);
      return isNaN(n) ? null : n;
    } catch {
      return null;
    }
  }

  /** @private @param {number} v */
  _saveValue(v) {
    try {
      localStorage.setItem(this._storageKey, String(v));
    } catch {
      /* quota exceeded — ignore */
    }
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
    this._canvas.removeEventListener("wheel", this._onWheel);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
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
    this._saveValue(next);
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
    this._paint();
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
    this._paint();
  }

  /** @private @param {WheelEvent} e */
  _wheel(e) {
    e.preventDefault();
    const span = Math.max(this.max - this.min, 1e-9);
    const delta = -e.deltaY * this._dragSens * 0.5;
    let nextVal = this._clamp(this.value + delta * span);
    if (this._step > 0) nextVal = Math.round(nextVal / this._step) * this._step;
    this.setValue(nextVal);
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

    const xc = sCss / 2;
    const yc = sCss / 2;
    const r = sCss * 0.42;

    // Normalized value 0..1
    const t = Math.max(0, Math.min(1, (this.value - this.min) / Math.max(this.max - this.min, 1e-9)));

    // 270° arc: start at 135° (bottom-left), sweep 270° CCW
    const startAngle = Math.PI * 0.75;       // 135°
    const sweepAngle = Math.PI * 1.5;        // 270°
    const curAngle = startAngle - t * sweepAngle;

    // --- Knob body (dark circle) ---
    const bodyGrad = cx.createRadialGradient(xc, yc, 0, xc, yc, r + 4);
    bodyGrad.addColorStop(0, "#2a2d3a");
    bodyGrad.addColorStop(0.7, "#1c1e28");
    bodyGrad.addColorStop(1, "#13141c");
    cx.fillStyle = bodyGrad;
    cx.beginPath();
    cx.arc(xc, yc, r + 4, 0, Math.PI * 2);
    cx.fill();

    // Body outline
    cx.strokeStyle = "rgba(255,255,255,0.08)";
    cx.lineWidth = 1;
    cx.stroke();

    // --- Track arc (dim background) ---
    cx.strokeStyle = "rgba(255,255,255,0.08)";
    cx.lineWidth = 2.5;
    cx.lineCap = "round";
    cx.beginPath();
    cx.arc(xc, yc, r, startAngle, startAngle - sweepAngle, true);
    cx.stroke();

    // --- Active arc ---
    const isDragging = this._dragging;
    if (isDragging) {
      // Cyan glow when dragging
      cx.shadowColor = "#22d3ee";
      cx.shadowBlur = 10;
      cx.strokeStyle = "#22d3ee";
      cx.lineWidth = 3;
    } else {
      cx.shadowColor = "transparent";
      cx.shadowBlur = 0;
      cx.strokeStyle = "rgba(253, 224, 71, 0.85)";
      cx.lineWidth = 2.5;
    }
    cx.beginPath();
    cx.arc(xc, yc, r, startAngle, curAngle, true);
    cx.stroke();
    cx.shadowBlur = 0;

    // --- Tick marks ---
    const numMajor = 10;
    const numMinor = 3; // minor ticks between majors
    const tickOuter = r + 6;
    const majorInner = tickOuter - 5;
    const minorInner = tickOuter - 3;

    for (let i = 0; i <= numMajor * numMinor; i++) {
      const frac = i / (numMajor * numMinor);
      const angle = startAngle - frac * sweepAngle;
      const isMajor = i % numMinor === 0;
      const innerR = isMajor ? majorInner : minorInner;

      const x1 = xc + Math.cos(angle) * innerR;
      const y1 = yc + Math.sin(angle) * innerR;
      const x2 = xc + Math.cos(angle) * tickOuter;
      const y2 = yc + Math.sin(angle) * tickOuter;

      cx.beginPath();
      cx.moveTo(x1, y1);
      cx.lineTo(x2, y2);

      if (isDragging) {
        cx.strokeStyle = isMajor ? "rgba(34,211,238,0.7)" : "rgba(34,211,238,0.3)";
      } else {
        cx.strokeStyle = isMajor ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)";
      }
      cx.lineWidth = isMajor ? 1.5 : 1;
      cx.stroke();
    }

    // --- Indicator line ---
    const indLen = r - 3;
    const indX = xc + Math.cos(curAngle) * indLen;
    const indY = yc + Math.sin(curAngle) * indLen;

    cx.beginPath();
    cx.moveTo(xc, yc);
    cx.lineTo(indX, indY);
    cx.lineCap = "round";

    if (isDragging) {
      cx.shadowColor = "#22d3ee";
      cx.shadowBlur = 8;
      cx.strokeStyle = "#22d3ee";
      cx.lineWidth = 3;
    } else {
      cx.strokeStyle = "rgba(242,247,255,0.8)";
      cx.lineWidth = 2;
    }
    cx.stroke();
    cx.shadowBlur = 0;

    // Center dot
    cx.fillStyle = isDragging ? "#22d3ee" : "rgba(242,247,255,0.6)";
    cx.beginPath();
    cx.arc(xc, yc, 2.5, 0, Math.PI * 2);
    cx.fill();
  }
}
