import { gainToDb } from "../utils/math.js";

/** @typedef {import('../audio/EQProcessor.js').EQProcessor} EQProcessor */
/** @typedef {import('../audio/Analyser.js').SpectrumAnalyser} SpectrumAnalyser */
/** @typedef {{ min: number, max: number }} FreqRange */

/**
 * Интерактивный частотный график EQ: подсветка зон по полосам, узлы на кривой, перетаскивание.
 */

/**
 * @typedef {{
 *   palette?: string[],
 *   freqRange?: FreqRange,
 *   onBandAdjust?: (bandIndex: number, hz: number, secondary: number, secondaryIsQ: boolean) => void,
 * }} GraphInteraction
 */

export class EQVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {() => EQProcessor | null} getEq
   * @param {() => SpectrumAnalyser | null} [getSpectrum]
   * @param {GraphInteraction} [interaction]
   */
  constructor(canvas, getEq, getSpectrum, interaction) {
    this.canvas = canvas;
    this.getEq = getEq;
    this.getSpectrum = getSpectrum ?? (() => null);
    /** @readonly */ this.interaction = interaction ?? {};

    /** @private */ this._raf = 0;
    /** @private */ this._freqs = new Float32Array(560);
    /** @private */ this._mags = new Float32Array(560);
    /** @private @type {{ x: number, y: number, r: number, band: number }[]} */
    this._hitTargets = [];

    /** @private */ this._dragBand = -1;
    /** @private */ this._activePointerId = NaN;

    /** @readonly */ this.dbExtent = { top: 24, bot: -24 };

    /** @private */ this._paintLayout = /** @type {null | LayoutInfo} */ (null);

    /** @private */ this._isMobile = /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);

    /** @private */ this._targetEq = /** @type {() => EQProcessor | null} */ (() => null);
    /** @private */ this._showTarget = false;

    this._pointerDownBound = /** @type {(e: PointerEvent)=>void} */ ((e) => this._pointerDown(e));
    this.canvas.addEventListener("pointerdown", this._pointerDownBound);

    this._buildLogGrid();
  }

  /**
   * Set target EQ getter and whether to draw it.
   * @param {() => EQProcessor | null} getTargetEq
   */
  setShowTarget(getTargetEq) {
    this._targetEq = getTargetEq;
    this._showTarget = true;
  }

  /** Reset target reveal (for new round). */
  hideTarget() {
    this._showTarget = false;
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  dispose() {
    this.stop();
    this.canvas.removeEventListener("pointerdown", this._pointerDownBound);
    window.removeEventListener("pointermove", this._pointerMoveBound);
    window.removeEventListener("pointerup", this._pointerUpBound);
    window.removeEventListener("pointercancel", this._pointerUpBound);
  }

  _buildLogGrid() {
    const n = this._freqs.length;
    const fMin = 20;
    const fMax = 20000;
    const l0 = Math.log10(fMin);
    const l1 = Math.log10(fMax);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      this._freqs[i] = Math.pow(10, l0 + t * (l1 - l0));
    }
  }

  start() {
    if (this._raf) return;
    const tick = () => {
      this.draw();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  draw() {
    // Пропуск кадров при неактивной вкладке
    if (document.hidden) return;

    const canvas = this.canvas;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth | 0;
    const h = canvas.clientHeight | 0;
    if (w < 2 || h < 2) return;
    // Ограничение разрешения для производительности
    const tw = Math.max(1, Math.min(1600, Math.floor(w * dpr)));
    const th = Math.max(1, Math.min(1200, Math.floor(h * dpr)));
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx2d.clearRect(0, 0, w, h);

    const bg = "#0a0b0f";
    const grid = "rgba(255,255,255,0.06)";
    const curveClr = "#fef08a";
    const curveFillTop = "rgba(253, 224, 71, 0.14)";
    const padL = 48;
    const padR = 46;
    const padT = 22;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    /** @typedef {{ padL:number,padR:number,padT:number,padB:number, plotW:number, plotH:number, w:number, h:number, xForHz:(hz:number)=>number, hzForX:(cx:number)=>number, yForDb:(db:number)=>number, dbForY:(cy:number)=>number }} LayoutInfo */

    /** @type {FreqRange} */
    const freqRange =
      /** @type {FreqRange} */ (
        this.interaction.freqRange ?? {
          min: 20,
          max: 20000,
        }
      );
    const freqSpan = Math.log10(freqRange.max / freqRange.min);
    /** @type {LayoutInfo} */
    const ly = {
      padL,
      padR,
      padT,
      padB,
      plotW,
      plotH,
      w,
      h,
      /** @type {(hz: number) => number} */ xForHz: (hz) => {
        const u = Math.log10(Math.max(freqRange.min, Math.min(freqRange.max, hz)) / freqRange.min) / freqSpan;
        return padL + u * plotW;
      },
      /** @type {(cx: number) => number} */
      hzForX: (px) => {
        const u = Math.max(0, Math.min(1, (px - padL) / plotW));
        return freqRange.min * Math.pow(10, u * freqSpan);
      },
      /** @type {(db: number) => number} */ yForDb: (db) => {
        const dTop = this.dbExtent.top;
        const dBot = this.dbExtent.bot;
        return padT + ((dTop - db) / (dTop - dBot)) * plotH;
      },
      /** @type {(cy: number) => number} */
      dbForY: (py) => {
        const dTop = this.dbExtent.top;
        const dBot = this.dbExtent.bot;
        const frac = (py - padT) / plotH;
        return dTop - frac * (dTop - dBot);
      },
    };
    this._paintLayout = ly;

    ctx2d.fillStyle = bg;
    ctx2d.fillRect(0, 0, w, h);

    const palette = this.interaction.palette ?? [
      "#e94560",
      "#ffa726",
      "#fde047",
      "#66bb6a",
      "#42a5f5",
    ];

    const eq = this.getEq();

    // Упрощённая сетка на мобильных
    const isMobile = this._isMobile;
    const xticks = isMobile ? [100, 1000, 10000] : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
    const dBticks = isMobile ? [-12, 0, 12] : [-24, -12, -6, 0, 6, 12, 24];

    ctx2d.strokeStyle = grid;
    ctx2d.lineWidth = 1;
    for (const hz of xticks) {
      if (hz < freqRange.min || hz > freqRange.max) continue;
      const x = ly.xForHz(hz);
      ctx2d.beginPath();
      ctx2d.moveTo(x, padT);
      ctx2d.lineTo(x, padT + plotH);
      ctx2d.stroke();
    }
    for (const db of dBticks) {
      const y = ly.yForDb(db);
      ctx2d.globalAlpha = db === 0 ? 0.35 : 0.12;
      ctx2d.strokeStyle = db === 0 ? "rgba(255,236,153,0.45)" : grid;
      ctx2d.lineWidth = db === 0 ? 1.25 : 1;
      ctx2d.beginPath();
      ctx2d.moveTo(padL, y);
      ctx2d.lineTo(padL + plotW, y);
      ctx2d.stroke();
      ctx2d.strokeStyle = grid;
      ctx2d.globalAlpha = 1;
      ctx2d.lineWidth = 1;

      // Меньше текста на мобильных
      if (!isMobile || h > 200) {
        ctx2d.fillStyle = "rgba(248,248,248,0.35)";
        ctx2d.font = isMobile ? "9px system-ui,sans-serif" : "10px system-ui,sans-serif";
        ctx2d.textAlign = "right";
        ctx2d.fillText(`${db > 0 ? "+" : ""}${db}${isMobile ? "" : " dB"}`, padL - 6, y + 3);
        ctx2d.textAlign = "left";
        ctx2d.fillText(`${db > 0 ? "+" : ""}${db}`, padL + plotW + 6, y + 3);
      }
    }

    if (eq) {
      /* цветные полосы по частотному домену */
      const bands = [];
      for (let i = 0; i < eq.numBands; i++) bands.push(eq.getBandParams(i));
      const sortedIdx = Array.from({ length: eq.numBands }, (_, i) => i).sort(
        (a, b) => bands[a].frequency - bands[b].frequency,
      );
      const mids = [];
      for (let i = 0; i < sortedIdx.length - 1; i++) {
        const fa = bands[sortedIdx[i]].frequency;
        const fb = bands[sortedIdx[i + 1]].frequency;
        mids.push(Math.sqrt(Math.max(fa * fb, 1)));
      }
      for (let k = 0; k < sortedIdx.length; k++) {
        const idx = sortedIdx[k];
        const leftF = k === 0 ? freqRange.min : mids[k - 1];
        const rightF = k === sortedIdx.length - 1 ? freqRange.max : mids[k];
        const x0 = ly.xForHz(leftF);
        const x1 = ly.xForHz(rightF);
        const hex = palette[idx % palette.length] ?? "#ffa726";
        ctx2d.fillStyle = hex;
        ctx2d.globalAlpha = 0.18;
        ctx2d.fillRect(Math.min(x0, x1), padT, Math.abs(x1 - x0), plotH);
        ctx2d.globalAlpha = 1;
      }
    }

    // Спектр только если играет аудио (оптимизация для мобильных)
    const spec = this.getSpectrum();
    const specData = spec?.readSpectrum();
    if (specData && specData.length > 4 && spec.analyser && !isMobile) {
      const sr = spec.analyser.context.sampleRate;
      const fft = spec.analyser.fftSize;
      const sn = specData.length;
      ctx2d.beginPath();
      ctx2d.fillStyle = "rgba(171,71,188,0.12)";
      for (let i = 0; i < sn; i++) {
        const hz = (i * sr) / fft;
        if (hz < freqRange.min || hz > freqRange.max) continue;
        const x = ly.xForHz(hz);
        const amp = specData[i];
        const y = padT + plotH - amp * plotH * 0.38;
        if (i === 0) ctx2d.moveTo(x, padT + plotH);
        ctx2d.lineTo(x, y);
      }
      ctx2d.lineTo(ly.xForHz(freqRange.max), padT + plotH);
      ctx2d.lineTo(ly.xForHz(freqRange.min), padT + plotH);
      ctx2d.closePath();
      ctx2d.fill();
    }

    this._hitTargets = [];

    if (!eq) {
      ctx2d.fillStyle = "rgba(255,255,255,0.28)";
      ctx2d.font = isMobile ? "11px system-ui,sans-serif" : "13px system-ui,sans-serif";
      ctx2d.fillText("Запустите воспроизведение для графика EQ", padL, padT + plotH / 2);
      return;
    }

    eq.getCombinedMagnitudeAt(this._freqs, this._mags);
    const pts /** @type {number[]} */ = [];
    for (let i = 0; i < this._mags.length; i++) {
      const db = gainToDb(this._mags[i]);
      const clamped = Math.max(this.dbExtent.bot, Math.min(this.dbExtent.top, db));
      pts.push(ly.xForHz(this._freqs[i]), ly.yForDb(clamped));
    }

    ctx2d.beginPath();
    ctx2d.moveTo(pts[0], ly.yForDb(0));
    for (let i = 0; i < pts.length; i += 2) ctx2d.lineTo(pts[i], pts[i + 1]);
    ctx2d.lineTo(pts[pts.length - 2], ly.yForDb(0));
    ctx2d.closePath();
    ctx2d.fillStyle = curveFillTop;
    ctx2d.fill();

    ctx2d.beginPath();
    ctx2d.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx2d.lineTo(pts[i], pts[i + 1]);
    ctx2d.strokeStyle = curveClr;
    ctx2d.shadowColor = "rgba(250,204,21,0.55)";
    ctx2d.shadowBlur = isMobile ? 8 : 14;
    ctx2d.lineWidth = isMobile ? 2.5 : 3;
    ctx2d.stroke();
    ctx2d.shadowBlur = 0;

    // Рисуем целевую кривую, если она раскрыта
    if (this._showTarget) {
      const targetEq = this._targetEq();
      if (targetEq) {
        const tMags = new Float32Array(this._freqs.length);
        targetEq.getCombinedMagnitudeAt(this._freqs, tMags);
        const tPts /** @type {number[]} */ = [];
        for (let i = 0; i < tMags.length; i++) {
          const db = gainToDb(tMags[i]);
          const clamped = Math.max(this.dbExtent.bot, Math.min(this.dbExtent.top, db));
          tPts.push(ly.xForHz(this._freqs[i]), ly.yForDb(clamped));
        }
        // Заполнение целевой кривой
        ctx2d.beginPath();
        ctx2d.moveTo(tPts[0], ly.yForDb(0));
        for (let i = 0; i < tPts.length; i += 2) ctx2d.lineTo(tPts[i], tPts[i + 1]);
        ctx2d.lineTo(tPts[tPts.length - 2], ly.yForDb(0));
        ctx2d.closePath();
        ctx2d.fillStyle = "rgba(244,63,94,0.1)";
        ctx2d.fill();
        // Линия целевой кривой
        ctx2d.beginPath();
        ctx2d.moveTo(tPts[0], tPts[1]);
        for (let i = 2; i < tPts.length; i += 2) ctx2d.lineTo(tPts[i], tPts[i + 1]);
        ctx2d.strokeStyle = "#f43f5e";
        ctx2d.shadowColor = "rgba(244,63,94,0.5)";
        ctx2d.shadowBlur = isMobile ? 6 : 10;
        ctx2d.lineWidth = isMobile ? 2 : 2.5;
        ctx2d.setLineDash([8, 4]);
        ctx2d.stroke();
        ctx2d.setLineDash([]);
        ctx2d.shadowBlur = 0;
        // Узлы целевой кривой
        const tNb = targetEq.numBands;
        const tOneHzMag = new Float32Array(1);
        /** @type {Float32Array} */
        const tHzBuf = new Float32Array(1);
        const tLabelR = isMobile ? 10 : 9;
        for (let bi = 0; bi < tNb; bi++) {
          const tbp = targetEq.getBandParams(bi);
          tHzBuf[0] = tbp.frequency;
          targetEq.getCombinedMagnitudeAt(tHzBuf, tOneHzMag);
          const tpdb = gainToDb(tOneHzMag[0]);
          const tdbg = Math.max(this.dbExtent.bot, Math.min(this.dbExtent.top, tpdb));
          const thx = ly.xForHz(tbp.frequency);
          const thy = ly.yForDb(tdbg);
          ctx2d.beginPath();
          ctx2d.arc(thx, thy, tLabelR * 0.55, 0, Math.PI * 2);
          ctx2d.fillStyle = "#f43f5e";
          ctx2d.strokeStyle = "rgba(255,255,255,0.7)";
          ctx2d.lineWidth = isMobile ? 1.5 : 1.25;
          ctx2d.fill();
          ctx2d.stroke();
          // Соединительная линия: узел цели → узел пользователя
          if (bi < eq.numBands) {
            const ubp = eq.getBandParams(bi);
            const uOneHzMag = new Float32Array(1);
            const uHzBuf = new Float32Array(1);
            uHzBuf[0] = ubp.frequency;
            eq.getCombinedMagnitudeAt(uHzBuf, uOneHzMag);
            const updb = gainToDb(uOneHzMag[0]);
            const udbg = Math.max(this.dbExtent.bot, Math.min(this.dbExtent.top, updb));
            const uhx = ly.xForHz(ubp.frequency);
            const uhy = ly.yForDb(udbg);
            ctx2d.beginPath();
            ctx2d.moveTo(thx, thy);
            ctx2d.lineTo(uhx, uhy);
            ctx2d.strokeStyle = "rgba(255,255,255,0.2)";
            ctx2d.lineWidth = 1;
            ctx2d.setLineDash([3, 3]);
            ctx2d.stroke();
            ctx2d.setLineDash([]);
          }
        }
      }
    }

    /* Узлы + хит-боксы по полосам — увеличенные на мобильных */
    const nb = eq.numBands;
    const oneHzMag = new Float32Array(1);
    /** @type {Float32Array} */
    const hzBuf = new Float32Array(1);
    const handleR = isMobile ? 18 : 12; // Увеличенные хит-зоны на мобильных
    const labelR = isMobile ? 14 : 12;
    for (let bi = 0; bi < nb; bi++) {
      const bp = eq.getBandParams(bi);
      hzBuf[0] = bp.frequency;
      eq.getCombinedMagnitudeAt(hzBuf, oneHzMag);
      const pdb = gainToDb(oneHzMag[0]);
      const dbg = Math.max(this.dbExtent.bot, Math.min(this.dbExtent.top, pdb));
      const hx = ly.xForHz(bp.frequency);
      const hy = ly.yForDb(dbg);
      const col = palette[bi % palette.length] ?? "#fff";
      ctx2d.beginPath();
      ctx2d.arc(hx, hy, labelR * 0.68, 0, Math.PI * 2);
      ctx2d.fillStyle = col;
      ctx2d.strokeStyle = "rgba(255,255,255,0.92)";
      ctx2d.lineWidth = isMobile ? 2.5 : 2.25;
      ctx2d.fill();
      ctx2d.stroke();
      ctx2d.fillStyle = "rgba(255,255,255,0.95)";
      ctx2d.font = `700 ${isMobile ? 10 : 11}px ui-sans-serif,system-ui,sans-serif`;
      const label =
        bp.frequency >= 1000 ? `${(bp.frequency / 1000).toFixed(2).replace(/\.?0+$/, "")} k` : `${Math.round(bp.frequency)}`;
      ctx2d.textAlign = "center";
      ctx2d.shadowColor = "#000";
      ctx2d.shadowBlur = 4;
      ctx2d.fillText(label, hx, hy - handleR * 0.68 + (isMobile ? 14 : 12));
      ctx2d.shadowBlur = 0;
      ctx2d.textAlign = "left";
      this._hitTargets.push({ x: hx, y: hy, r: handleR + (isMobile ? 8 : 4), band: bi });
    }

    // Подписи оси X
    if (!isMobile || h > 180) {
      ctx2d.fillStyle = "rgba(200,206,217,0.55)";
      ctx2d.font = isMobile ? "9px system-ui,sans-serif" : "10px system-ui,sans-serif";
      ctx2d.fillText("20 Hz", padL, h - 10);
      ctx2d.textAlign = "right";
      ctx2d.fillText("20 kHz", padL + plotW, h - 10);
      ctx2d.textAlign = "left";
    }
    if (!isMobile) {
      ctx2d.fillText("АЧХ (сумма полос) · перетаскивайте узлы", padL, 14);
    }
  }

  /** @private @param {PointerEvent} e */
  _pointerDown(e) {
    if (!this.interaction.onBandAdjust) return;
    const eq = this.getEq();
    if (!eq) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = -1;
    let bestD = 1e9;
    for (const t of this._hitTargets) {
      const dx = mx - t.x;
      const dy = my - t.y;
      const d = Math.hypot(dx, dy);
      if (d < t.r && d < bestD) {
        bestD = d;
        best = t.band;
      }
    }
    if (best < 0) return;
    e.preventDefault();
    this._dragBand = best;
    this._activePointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", this._pointerMoveBound);
    window.addEventListener("pointerup", this._pointerUpBound);
    window.addEventListener("pointercancel", this._pointerUpBound);
    this.canvas.classList.add("eq-ab-canvas--drag");
  }

  /** @private @param {PointerEvent} e */
  _pointerMove(e) {
    if (this._dragBand < 0 || e.pointerId !== this._activePointerId) return;
    const ly = this._paintLayout;
    if (!ly) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hz = ly.hzForX(mx);
    const eq = this.getEq();
    if (!eq) return;
    const p = eq.getBandParams(this._dragBand);
    const typesGain = new Set(["peaking", "lowshelf", "highshelf"]);
    const secondaryIsQ = !typesGain.has(p.type);
    const frac = Math.max(0, Math.min(1, (my - ly.padT) / ly.plotH));
    const qMapped = Math.pow(10, 1 - frac * 2);
    const gainMapped = Math.max(-24, Math.min(24, ly.dbForY(my)));
    if (this.interaction.onBandAdjust) {
      this.interaction.onBandAdjust(
        this._dragBand,
        hz,
        secondaryIsQ ? Math.max(0.1, Math.min(10, qMapped)) : gainMapped,
        secondaryIsQ,
      );
    }
  }

  /** @private @param {PointerEvent} e */
  _pointerUp(e) {
    if (this._dragBand < 0) return;
    if (e.pointerId !== this._activePointerId) return;
    this._dragBand = -1;
    this._activePointerId = NaN;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    window.removeEventListener("pointermove", this._pointerMoveBound);
    window.removeEventListener("pointerup", this._pointerUpBound);
    window.removeEventListener("pointercancel", this._pointerUpBound);
    this.canvas.classList.remove("eq-ab-canvas--drag");
  }
}
