import { queryEl, formatTime } from "./utils/dom.js";
import { EventEmitter } from "./utils/events.js";
import { freqToT, tToFreq } from "./utils/math.js";
import { AudioEngine } from "./audio/AudioEngine.js";
import { buildDemoBuffer } from "./audio/demoBuffer.js";
import { EQVisualizer } from "./ui/EQVisualizer.js";
import { RotaryKnob } from "./ui/RotaryKnob.js";
import { applyPreset, PRESET_LIST } from "./ui/PresetManager.js";
import { BAND_PALETTE } from "./utils/palette.js";

/** @typedef {'peaking' | 'lowshelf' | 'highshelf' | 'lowpass' | 'highpass'} EqFilterType */

/**
 * @typedef {{
 *   frequency: number,
 *   gain: number,
 *   q: number,
 *   type: EqFilterType,
 * }} EQParamsBand
 */

/**
 * @typedef {{
 *   bands: EQParamsBand[],
 *   wet: number,
 *   preset?: string,
 * }} ExportedEQSettings
 */

/**
 * @typedef {{
 *   container: string | HTMLElement,
 *   audioSrc?: string | null,
 *   eqBands?: number,
 *   loop?: boolean,
 *   onReady?: () => void,
 *   onEQChange?: (params: ExportedEQSettings) => void,
 *   onA_BToggle?: (isBWetSide: boolean) => void,
 * }} WidgetOptions
 */

const FREQ_RANGE = { min: 20, max: 20000 };

export class EQComparisonWidget {
  /**
   * @param {WidgetOptions} options
   */
  constructor(options) {
    /** @private */ this._opts = options;
    /** @readonly */ this.containerEl = queryEl(options.container);

    /** @private @type {AudioContext | null} */ this._ctx = null;
    /** @readonly */ this.engine = new AudioEngine();
    /** @private */ this._emitter = new EventEmitter();
    /** @private @type {EQVisualizer | null} */ this._viz = null;

    /** @private */ this._elements = {};
    /** @private */ this._keydown = this._onKeyDown.bind(this);
    /** @private */ this._tick = () => this._updateTimeUi();
    /** @private */ this._tickId = 0;

    /** @private */ this._initialized = false;
    /** @private */ this._building = false;

    /** @private @type {{ freq: RotaryKnob, gain: RotaryKnob, q: RotaryKnob }[]} */
    this._bandKnobs = [];

    this.containerEl.innerHTML = "";
    this.containerEl.classList.add("eq-ab-widget-root");
    this._buildSkeleton();
    options.loop ??= true;
    this._eqBands = Math.min(16, Math.max(1, options.eqBands ?? 5));

    document.addEventListener("keydown", this._keydown);

    queueMicrotask(() => this._wireUi());
    this.engine.eqBands = this._eqBands;
  }

  /**
   * Create AudioContext and buffer (requires user gesture for playback).
   * @private
   */
  async _ensureAudio() {
    if (this._initialized) return;
    const AudioContextCtor =
      window.AudioContext || /** @type {typeof AudioContext | undefined} */ (window.webkitAudioContext);
    if (!AudioContextCtor) throw new Error("Web Audio unsupported");
    this._ctx = new AudioContextCtor();
    this.engine.attachContext(this._ctx, { eqBands: this._eqBands, events: this._emitter });

    const src = this._opts.audioSrc;
    try {
      if (src && String(src).trim()) {
        await this.engine.loadBuffer(String(src));
      } else {
        const demo = buildDemoBuffer(this._ctx);
        this.engine.setExternalBuffer(demo);
      }
    } catch (err) {
      console.warn("[EQComparisonWidget] load failed, using demo buffer", err);
      const demo = buildDemoBuffer(this._ctx);
      this.engine.setExternalBuffer(demo);
    }

    this.engine.setLoop(this._opts.loop !== false);

    const canvas /** @type {HTMLCanvasElement} */ = /** @type {any} */ (this._elements.canvas);
    this._viz = new EQVisualizer(
      canvas,
      () => this.engine.eq,
      () => this.engine.spectrum,
      {
        palette: BAND_PALETTE,
        freqRange: FREQ_RANGE,
        onBandAdjust: (bandIndex, hz, secondary, secondaryIsQ) => {
          if (!this.engine.eq) return;
          if (secondaryIsQ) {
            this.engine.eq.setBandParams(bandIndex, { frequency: hz, q: secondary });
          } else {
            this.engine.eq.setBandParams(bandIndex, { frequency: hz, gain: secondary });
          }
          this._syncKnobsForBand(bandIndex);
        },
      },
    );
    this._viz.start();

    this._emitter.on("eqchange", () => this._scheduleEqHook());
    this._initialized = true;
    this._syncUIFromEngine();
    if (typeof this._opts.onReady === "function") this._opts.onReady();
    this.engine.refreshAutoGain();
  }

  /** @private */ _scheduleEqHook() {
    this.engine.refreshAutoGain();
    if (typeof this._opts.onEQChange === "function") this._opts.onEQChange(this.exportSettings());
  }

  /** @private */
  _buildSkeleton() {
    const root = this.containerEl;
    root.innerHTML = `
<section class="eq-ab-panel eq-ab-intro" aria-label="EQ сравнение">
  <p class="eq-ab-hint">Play — старт движка. График: цвет = полоса, узел — перетаскивание по частоте и gain/Q.</p>
</section>

<section class="eq-ab-panel" aria-label="Плеер">
  <div class="eq-ab-player-row">
    <button type="button" class="eq-ab-btn" data-act="togglePlay" aria-pressed="false">Play</button>
    <button type="button" class="eq-ab-btn eq-ab-secondary" data-act="stop">Stop</button>
    <label class="eq-ab-loop"><input type="checkbox" data-field="loop" checked /> Цикл</label>
    <input type="file" data-field="file" accept="audio/mpeg,audio/wav,.mp3,.wav,.ogg,.oga,audio/ogg,audio/mp3" class="eq-ab-file" />
  </div>
  <div class="eq-ab-seek-row">
    <input type="range" data-field="seek" min="0" max="1000" value="0" step="any" aria-label="Позиция" />
    <span data-field="time" class="eq-ab-time" aria-live="polite">0:00 / 0:00</span>
  </div>
</section>

<section class="eq-ab-panel" aria-label="Dry и Wet">
  <div class="eq-ab-crossfade-wrap">
    <span class="eq-ab-ab-label"><span>A</span> <abbr title="без эквалайзера">Dry</abbr></span>
    <input type="range" data-field="dryWet" min="0" max="100" value="50" aria-label="Смешение dry и wet" />
    <span class="eq-ab-ab-label"><span>B</span> <abbr title="с эквалайзером">Wet</abbr></span>
  </div>
  <div class="eq-ab-quick-row">
    <button type="button" class="eq-ab-btn" data-act="toggleAB">A/B: мгновенно</button>
    <button type="button" class="eq-ab-btn eq-ab-secondary" data-act="reset">Сброс EQ</button>
  </div>
</section>

<section class="eq-ab-panel eq-ab-viz-panel" aria-label="Кривая эквалайзера">
  <canvas data-field="canvas" class="eq-ab-canvas" width="860" height="220" role="img" aria-label="Амплитудно-частотная характеристика"></canvas>
</section>

<section class="eq-ab-panel eq-ab-bands-root" aria-label="Полосы EQ">
  <!-- bands injected -->
</section>

<section class="eq-ab-panel eq-ab-presets-panel">
  <label>Пресеты
    <select data-field="preset"></select>
  </label>
  <button type="button" class="eq-ab-btn eq-ab-secondary" data-act="export">Экспорт JSON</button>
  <button type="button" class="eq-ab-btn eq-ab-secondary" data-act="importPrompt">Импорт…</button>
</section>`;

    this._gatherRefs(root);

    /** @type {HTMLSelectElement} */ const sel = /** @type {any} */ (this._elements.preset);
    for (const p of PRESET_LIST) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.label;
      sel.appendChild(o);
    }
  }

  /** @private @param {HTMLElement} root */
  _gatherRefs(root) {
    const q = (s) => root.querySelector(s);
    this._elements = {
      canvas: q('[data-field="canvas"]'),
      dryWet: q('[data-field="dryWet"]'),
      seek: q('[data-field="seek"]'),
      time: q('[data-field="time"]'),
      loop: q('[data-field="loop"]'),
      file: q('[data-field="file"]'),
      preset: q('[data-field="preset"]'),
      bandsRoot: q(".eq-ab-bands-root"),
    };
    this._buttons = root.querySelectorAll("[data-act]");
  }

  /** @private */
  _wireUi() {
    /** @type {HTMLElement} */
    const bandsRoot /** @type {any} */ = this._elements.bandsRoot;
    bandsRoot.innerHTML = "";
    this._bandKnobs = [];

    for (let b = 0; b < this._eqBands; b++) {
      const col = BAND_PALETTE[b % BAND_PALETTE.length];
      const card = document.createElement("div");
      card.className = "eq-ab-band-strip";
      card.dataset.bandIndex = String(b);
      card.style.setProperty("--band-accent", col);
      card.innerHTML = `
<div class="eq-ab-band-head">
  <span class="eq-ab-band-dot" aria-hidden="true"></span>
  <span class="eq-ab-band-title">Полоса ${b + 1}</span>
  <select data-band="${b}" data-param="type" class="eq-ab-type-mini" title="Тип фильтра">
    <option value="peaking">Peak</option>
    <option value="lowshelf">LoSh</option>
    <option value="highshelf">HiSh</option>
    <option value="lowpass">LP</option>
    <option value="highpass">HP</option>
  </select>
</div>
<div class="eq-ab-knob-row" data-knob-row="${b}"></div>`;
      bandsRoot.appendChild(card);
      const row = /** @type {HTMLElement} */ (card.querySelector(`[data-knob-row="${b}"]`));
      const sel = /** @type {HTMLSelectElement} */ (card.querySelector(`select[data-param="type"]`));
      sel.addEventListener("change", () => {
        if (!this.engine.eq) return;
        this.engine.eq.setBandParams(b, { type: /** @type {EqFilterType} */ (sel.value) });
        this._syncKnobsForBand(b);
        this._scheduleEqHook();
      });

      const wrapF = document.createElement("div");
      wrapF.className = "eq-ab-knob-slot";
      const wrapG = document.createElement("div");
      wrapG.className = "eq-ab-knob-slot";
      const wrapQ = document.createElement("div");
      wrapQ.className = "eq-ab-knob-slot";
      row.appendChild(wrapF);
      row.appendChild(wrapG);
      row.appendChild(wrapQ);

      const bi = b;
      const freqKnob = new RotaryKnob({
        label: "Freq",
        min: 0,
        max: 1,
        value: 0.5,
        sensitivity: 0.0022,
        format: (t) => `${Math.round(tToFreq(t, FREQ_RANGE))} Hz`,
        onChange: (t) => {
          if (!this.engine.eq) return;
          this.engine.eq.setBandParams(bi, { frequency: tToFreq(t, FREQ_RANGE) });
          this._scheduleEqHook();
        },
      });
      const gainKnob = new RotaryKnob({
        label: "Gain",
        min: -24,
        max: 24,
        value: 0,
        step: 0.1,
        sensitivity: 0.0035,
        format: (g) => `${g >= 0 ? "+" : ""}${g.toFixed(1)} dB`,
        onChange: (g) => {
          if (!this.engine.eq) return;
          this.engine.eq.setBandParams(bi, { gain: g });
          this._scheduleEqHook();
        },
      });
      const qKnob = new RotaryKnob({
        label: "Q",
        min: 0.1,
        max: 10,
        value: 1,
        step: 0.05,
        sensitivity: 0.0032,
        format: (q) => q.toFixed(2),
        onChange: (q) => {
          if (!this.engine.eq) return;
          this.engine.eq.setBandParams(bi, { q });
          this._scheduleEqHook();
        },
      });
      freqKnob.attach(wrapF);
      gainKnob.attach(wrapG);
      qKnob.attach(wrapQ);
      this._bandKnobs[b] = { freq: freqKnob, gain: gainKnob, q: qKnob };
    }

    /** @type {HTMLInputElement} */ const dw /** @type {any} */ = this._elements.dryWet;
    dw.addEventListener("input", () => {
      if (!this._initialized) return;
      const ratio = dw.valueAsNumber / 100;
      this.engine.setDryWet(ratio);
      this._scheduleEqHook();
    });

    /** @type {HTMLInputElement} */ const seekEl /** @type {any} */ = this._elements.seek;
    seekEl.addEventListener("input", () => {
      if (!this._initialized) return;
      const d = this.engine.getDuration();
      if (d <= 0) return;
      const t = (seekEl.valueAsNumber / 1000) * d;
      this.engine.seek(t);
    });

    /** @type {HTMLInputElement} */ const loopEl /** @type {any} */ = this._elements.loop;
    loopEl.addEventListener("change", () => {
      if (!this._initialized) return;
      this.engine.setLoop(loopEl.checked);
    });

    /** @type {HTMLInputElement} */ const fileEl /** @type {any} */ = this._elements.file;
    fileEl.addEventListener("change", async () => {
      const f = fileEl.files?.[0];
      if (!f) return;
      await this._ensureAudio();
      const ab = await f.arrayBuffer();
      if (!this._ctx) return;
      const buf = await this._ctx.decodeAudioData(ab.slice(0));
      this.engine.setExternalBuffer(buf);
      this._updateTimeUi();
    });

    /** @type {HTMLSelectElement} */ const presetEl /** @type {any} */ = this._elements.preset;
    presetEl.addEventListener("change", () => {
      if (!this.engine.eq) return;
      applyPreset(this.engine.eq, presetEl.value);
      this._syncUIFromEngine();
      this._scheduleEqHook();
    });

    this._buttons.forEach((btn) => {
      btn.addEventListener("click", () => this._onButton(/** @type {HTMLElement} */ (btn).dataset.act));
    });

    this._startTimeUi();
  }

  /** @private @param {number} band */
  _syncKnobsForBand(band) {
    if (!this.engine.eq) return;
    const kb = this._bandKnobs[band];
    if (!kb) return;
    const p = this.engine.eq.getBandParams(band);
    kb.freq.setValue(freqToT(p.frequency, FREQ_RANGE), true);
    kb.gain.setValue(p.gain, true);
    kb.q.setValue(p.q, true);
    /** @type {HTMLSelectElement|null} */
    const ty = this.containerEl.querySelector(`select[data-band="${band}"][data-param="type"]`);
    if (ty) ty.value = p.type;
  }

  /** @private */
  _syncUIFromEngine() {
    if (!this.engine.eq) return;
    for (let b = 0; b < this._eqBands; b++) {
      this._syncKnobsForBand(b);
    }
  }

  /**
   * Мгновенное переключение Dry ↔ Wet на крайних положениях.
   * @private
   * @returns {boolean} true если сейчас сторона B (wet)
   */
  _flipDryWetExtreme() {
    const wetNow = this.engine.getDryWet();
    const next = wetNow < 0.5 ? 1 : 0;
    this.engine.setDryWet(next);
    /** @type {HTMLInputElement} */ (this._elements.dryWet).value = String(next * 100);
    if (typeof this._opts.onA_BToggle === "function") this._opts.onA_BToggle(next >= 0.5);
    return next >= 0.5;
  }

  /** @private @param {string|undefined} act */
  async _onButton(act) {
    switch (act) {
      case "togglePlay": {
        await this._ensureAudio();
        if (this.engine.isPlaying()) {
          this.pause();
        } else {
          this.play();
        }
        this._updatePlayButton();
        return;
      }
      case "stop": {
        await this._ensureAudio();
        this.stop();
        this._updatePlayButton();
        return;
      }
      case "toggleAB": {
        await this._ensureAudio();
        this._flipDryWetExtreme();
        return;
      }
      case "reset": {
        await this._ensureAudio();
        this.engine.eq?.resetFlat();
        /** @type {HTMLSelectElement} */ (this._elements.preset).value = "flat";
        this._syncUIFromEngine();
        this._scheduleEqHook();
        return;
      }
      case "export": {
        const j = JSON.stringify(this.exportSettings(), null, 2);
        if (navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(j).catch(() => {
            window.prompt("Скопируйте JSON", j);
          });
        } else {
          window.prompt("Скопируйте JSON", j);
        }
        return;
      }
      case "importPrompt": {
        const raw = window.prompt("Вставьте JSON настроек");
        if (raw) {
          try {
            this.importSettings(JSON.parse(raw));
          } catch {
            alert("Некорректный JSON");
          }
        }
        return;
      }
      default:
        return;
    }
  }

  /** @private */
  _updatePlayButton() {
    const btn = this.containerEl.querySelector('[data-act="togglePlay"]');
    if (!btn) return;
    const playing = this._initialized && this.engine.isPlaying();
    btn.textContent = playing ? "Pause" : "Play";
    btn.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  /** @private @param {KeyboardEvent} e */
  _onKeyDown(e) {
    if (
      e.target &&
      /** @type {HTMLElement} */ (e.target).closest(
        'input,textarea,select,.eq-ab-knob-ring,.eq-ab-canvas[role="img"]',
      )
    ) {
      if (e.code === "Space") return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      void this._ensureAudio().then(() => {
        if (this.engine.isPlaying()) this.pause();
        else this.play();
        this._updatePlayButton();
      });
      return;
    }
    if (e.key === "a" || e.key === "A") {
      e.preventDefault();
      void this._ensureAudio().then(() => {
        this.engine.setDryWet(0);
        /** @type {HTMLInputElement} */ (this._elements.dryWet).value = "0";
        if (typeof this._opts.onA_BToggle === "function") this._opts.onA_BToggle(false);
      });
      return;
    }
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      void this._ensureAudio().then(() => {
        this.engine.setDryWet(1);
        /** @type {HTMLInputElement} */ (this._elements.dryWet).value = "100";
        if (typeof this._opts.onA_BToggle === "function") this._opts.onA_BToggle(true);
      });
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      void this._ensureAudio().then(() => {
        const cur = this.engine.getDryWet();
        const next = cur < 0.5 ? 1 : 0;
        this.engine.setDryWet(next);
        /** @type {HTMLInputElement} */ (this._elements.dryWet).value = String(next * 100);
        if (typeof this._opts.onA_BToggle === "function") this._opts.onA_BToggle(next >= 0.5);
      });
      return;
    }
    if (e.key === "r" || e.key === "R") {
      void this._ensureAudio().then(() => {
        this.engine.eq?.resetFlat();
        this._syncUIFromEngine();
        this._scheduleEqHook();
      });
    }
  }

  /** @private */
  _startTimeUi() {
    if (this._tickId) return;
    const run = () => {
      this._tick();
      this._tickId = requestAnimationFrame(run);
    };
    this._tickId = requestAnimationFrame(run);
  }

  /** @private */
  _updateTimeUi() {
    /** @type {HTMLElement|null} */
    const tEl /** @type {any} */ = this._elements.time;
    if (!tEl) return;
    const d = this._initialized ? this.engine.getDuration() : 0;
    const cu = this._initialized ? this.engine.getCurrentTime() : 0;
    tEl.textContent = `${formatTime(cu)} / ${formatTime(d)}`;
    /** @type {HTMLInputElement} */
    const sk /** @type {any} */ = this._elements.seek;
    if (d > 0) sk.valueAsNumber = (cu / d) * 1000;
    this.engine.reduceHeadroomIfClipping();
  }

  async play() {
    await this._ensureAudio();
    this.engine.play();
    this._updatePlayButton();
  }

  pause() {
    this.engine.pause();
    this._updatePlayButton();
  }

  stop() {
    this.engine.stop();
    this._updatePlayButton();
  }

  /** @param {number} time */
  seek(time) {
    this.engine.seek(time);
  }

  /** @param {number} ratio 0..1 */
  setDryWet(ratio) {
    void this._ensureAudio().then(() => {
      this.engine.setDryWet(ratio);
      /** @type {HTMLInputElement} */ (this._elements.dryWet).value = String(ratio * 100);
    });
  }

  /**
   * Мгновенное переключение A/B (сухая / через EQ).
   * @returns {boolean} текущее состояние после переключения (true = B / wet), если движок ещё не готов — false
   */
  toggleAB() {
    if (!this._initialized) {
      void this._ensureAudio().then(() => this._flipDryWetExtreme());
      return false;
    }
    return this._flipDryWetExtreme();
  }

  /** @param {string} name */
  setPreset(name) {
    void this._ensureAudio().then(() => {
      if (!this.engine.eq) return;
      applyPreset(this.engine.eq, name);
      /** @type {HTMLSelectElement} */ (this._elements.preset).value = PRESET_LIST.some((x) => x.id === name) ? name : "flat";
      this._syncUIFromEngine();
      this._scheduleEqHook();
    });
  }

  /**
   * @param {number} bandIndex
   * @param {Partial<{ frequency: number, gain: number, q: number, type: EqFilterType }>} params
   */
  setBandParams(bandIndex, params) {
    void this._ensureAudio().then(() => {
      this.engine.eq?.setBandParams(bandIndex, params);
      this._syncUIFromEngine();
      this._scheduleEqHook();
    });
  }

  /** @returns {ExportedEQSettings} */
  exportSettings() {
    const bands =
      this.engine.eq?.exportAllBands() ??
      Array.from({ length: this._eqBands }, (_, i) => ({
        frequency: [120, 400, 1000, 3500, 10000][i % 5] ?? 440,
        gain: 0,
        q: 1,
        type: /** @type {EqFilterType} */ ("peaking"),
      }));
    /** @type {HTMLSelectElement} */
    const pr /** @type {any} */ = this._elements.preset;
    return {
      bands,
      wet: this._initialized ? this.engine.getDryWet() : 0.5,
      preset: pr?.value,
    };
  }

  /** @param {ExportedEQSettings} json */
  importSettings(json) {
    void this._ensureAudio().then(() => {
      if (!json || !Array.isArray(json.bands) || !this.engine.eq) return;
      json.bands.forEach((bp, i) => {
        if (i >= this.engine.eq.numBands) return;
        /** @typedef {ExportedEQSettings['bands'][0]} BP */
        this.engine.eq.setBandParams(i, {
          frequency: bp.frequency,
          gain: bp.gain,
          q: bp.q,
          type: bp.type,
        });
      });
      if (typeof json.wet === "number") this.setDryWet(json.wet);
      if (json.preset && typeof json.preset === "string") {
        /** @type {HTMLSelectElement} */ (this._elements.preset).value = json.preset;
      }
      this._syncUIFromEngine();
      this._scheduleEqHook();
    });
  }

  destroy() {
    document.removeEventListener("keydown", this._keydown);
    if (this._tickId) cancelAnimationFrame(this._tickId);
    this._tickId = 0;
    for (const kb of this._bandKnobs) {
      if (kb) {
        kb.freq.dispose();
        kb.gain.dispose();
        kb.q.dispose();
      }
    }
    this._bandKnobs = [];
    try {
      this._viz?.dispose();
    } catch {
      /* noop */
    }
    this._viz = null;
    this._emitter.dispose();
    try {
      this.engine.stopImmediate();
      this.engine.dispose(true);
    } catch {
      /* noop */
    }
    try {
      this._ctx?.close();
    } catch {
      /* noop */
    }
    this._ctx = null;
    this.containerEl.innerHTML = "";
    this.containerEl.classList.remove("eq-ab-widget-root");
  }
}
