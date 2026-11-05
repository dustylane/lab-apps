/* Undo/redo via compact snapshots of the design layer (images are stored once as assets, not per step). */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  class History {
    constructor(app, limit = 80) { this.app = app; this.limit = limit; this.stack = []; this.index = -1; this.onChange = null; }
    snapshot() { return JSON.stringify({ design: CI.exporter.serialize(this.app.design, this.app.assets), doc: this.app.docState() }); }
    reset() { this.stack = [{ label: 'Start', data: this.snapshot() }]; this.index = 0; this._emit(); }
    commit(label = 'Edit') {
      const data = this.snapshot();
      if (this.stack[this.index] && this.stack[this.index].data === data) return false; // nothing changed
      this.stack = this.stack.slice(0, this.index + 1);
      this.stack.push({ label, data });
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1; this._emit();
      return true;
    }
    canUndo() { return this.index > 0; }
    canRedo() { return this.index < this.stack.length - 1; }
    undo() { if (!this.canUndo()) return null; this.index--; this._restore(); return this.stack[this.index + 1].label; }
    redo() { if (!this.canRedo()) return null; this.index++; this._restore(); return this.stack[this.index].label; }
    _restore() {
      const { design, doc } = JSON.parse(this.stack[this.index].data);
      CI.exporter.deserializeInto(this.app.design, design, this.app.assets);
      this.app.applyDocState(doc, true);
      this.app.afterRestore(); this._emit();
    }
    _emit() { if (this.onChange) this.onChange(); }
  }
  CI.History = History;
})(window.CI);
