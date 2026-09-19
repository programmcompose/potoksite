/** @typedef { (...args: any[]) => void } Listener */

/**
 * Minimal typed event emitter for UI ↔ Audio.
 */
export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Listener>>} */
    this._map = new Map();
  }

  /**
   * @param {string} event
   * @param {Listener} fn
   */
  on(event, fn) {
    let set = this._map.get(event);
    if (!set) {
      set = new Set();
      this._map.set(event, set);
    }
    set.add(fn);
    return () => this.off(event, fn);
  }

  /**
   * @param {string} event
   * @param {Listener} fn
   */
  off(event, fn) {
    const set = this._map.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) this._map.delete(event);
  }

  /**
   * @param {string} event
   * @param {...any} args
   */
  emit(event, ...args) {
    const set = this._map.get(event);
    if (!set) return;
    for (const fn of set) {
      fn(...args);
    }
  }

  dispose() {
    this._map.clear();
  }
}
