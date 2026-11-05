/* Weed box + weeding lines. The box is cut around a color layer; weeding lines split the waste vinyl into strips
   so it peels off in pieces — but they stop short of the design (keep-out margin) so they never cut into it. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  /**
   * paths: global copies of one color's shapes. o (all units): {margin, lines:'none'|'vertical'|'horizontal'|'both',
   * spacing, keepout, lineWidth}. Returns {box: Path, lines: [Path], bounds}.
   */
  function build(paths, o) {
    const UPI = CI.util.UPI;
    const opt = Object.assign({ margin: 0.25 * UPI, lines: 'vertical', spacing: 1 * UPI, keepout: 0.06 * UPI, lineWidth: 0.012 * UPI }, o);
    const b = paths.map(p => p.bounds).reduce((a, c) => a.unite(c));
    const boxR = b.expand(opt.margin * 2);
    const box = new paper.Path.Rectangle({ rectangle: boxR, insert: false });
    const lines = [];
    if (opt.lines !== 'none' && opt.spacing > 0) {
      const keep = CI.geom.rasterOffset(paths, opt.keepout, { fillHoles: true, tolerance: 1 });
      const minLen = 0.12 * UPI;
      const addPieces = (rect) => {
        let r = new paper.Path.Rectangle({ rectangle: rect, insert: false });
        let res = r.subtract(keep, { insert: false });
        CI.geom.subpaths(res).forEach(s => { const sb = s.bounds; if (Math.max(sb.width, sb.height) >= minLen && Math.abs(s.area) > 1e-3) { const c = s.clone({ insert: false }); c.closed = true; lines.push(c); } });
      };
      const lw = opt.lineWidth;
      const place = (from, to) => { const n = Math.max(1, Math.round((to - from) / opt.spacing)); const step = (to - from) / n; const out = []; for (let i = 1; i < n; i++) out.push(from + i * step); if (!out.length) out.push((from + to) / 2); return out; };
      if (opt.lines === 'vertical' || opt.lines === 'both') place(boxR.left, boxR.right).forEach(x => addPieces(new paper.Rectangle(x - lw / 2, boxR.top, lw, boxR.height)));
      if (opt.lines === 'horizontal' || opt.lines === 'both') place(boxR.top, boxR.bottom).forEach(y => addPieces(new paper.Rectangle(boxR.left, y - lw / 2, boxR.width, lw)));
    }
    return { box, lines, bounds: boxR };
  }
  CI.weed = { build };
})(window.CI);
