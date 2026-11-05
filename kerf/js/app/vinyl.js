/* "My vinyl" — the colors you actually own. Saved in this browser (localStorage) so it carries across projects. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const KEY = 'kerf.myVinyl.v1';
  const DEFAULTS = [
    { name: 'Black', hex: '#111111' }, { name: 'White', hex: '#ffffff' }, { name: 'Red', hex: '#c8102e' },
    { name: 'Gold', hex: '#c9a227' }, { name: 'Royal blue', hex: '#1f4ba5' }, { name: 'Kelly green', hex: '#2fa84f' },
  ];
  let mem = null;
  function load() {
    if (mem) return mem;
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) { mem = v.filter(x => x && /^#[0-9a-f]{6}$/i.test(x.hex)); return mem; } } catch (e) { /* storage blocked */ }
    mem = DEFAULTS.map(x => Object.assign({}, x)); return mem;
  }
  function save(list) {
    mem = list.filter(x => x && /^#[0-9a-f]{6}$/i.test(x.hex)).map(x => ({ name: String(x.name || x.hex).slice(0, 40), hex: x.hex.toLowerCase() }));
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* keep in memory */ }
    return mem;
  }
  CI.vinyl = {
    DEFAULTS,
    list: () => load().slice(),
    save,
    add(name, hex) { const l = load().slice(); l.push({ name, hex }); return save(l); },
    remove(i) { const l = load().slice(); l.splice(i, 1); return save(l); },
    update(i, patch) { const l = load().slice(); l[i] = Object.assign({}, l[i], patch); return save(l); },
    reset() { return save(DEFAULTS.map(x => Object.assign({}, x))); },
    hexes: () => load().map(v => v.hex),
    /** Nearest owned vinyl to a color: {name, hex}. */
    nearest(c) {
      const t = CI.util.parseColor(c); let best = null, bd = Infinity;
      load().forEach(v => { const d = CI.util.colorDist2(CI.util.parseColor(v.hex), t); if (d < bd) { bd = d; best = v; } });
      return best || { name: c, hex: CI.util.colorHex(c) };
    },
    /** Exact match name (for labelling cut layers), or null. */
    nameOf(hex) { const v = load().find(x => x.hex.toLowerCase() === String(hex).toLowerCase()); return v ? v.name : null; },
  };
})(window.CI);
