/* paper.js geometry helpers: collecting cut paths, booleans (pathfinder), offsets, smoothing,
   rasterizing vectors into masks for the cut checker. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const isPathLike = (it) => it && (it.className === 'Path' || it.className === 'CompoundPath');

  /** All leaf Path/CompoundPath items under item (not descending into compound paths). */
  function leafPaths(item, out = []) {
    if (!item || item.visible === false) return out;
    if (isPathLike(item)) { out.push(item); return out; }
    if (item.children && (item.className === 'Group' || item.className === 'Layer')) item.children.forEach(c => leafPaths(c, out));
    return out;
  }

  /** Copy of a path in global (project) coordinates, not inserted. */
  function globalCopy(p) {
    const c = p.clone({ insert: false, deep: true });
    if (p.parent && p.parent.className !== 'Layer') c.transform(p.parent.globalMatrix);
    else if (p.parent && p.parent.className === 'Layer' && !p.parent.matrix.isIdentity()) c.transform(p.parent.matrix);
    return c;
  }

  /** Effective cut color for an item (fill, else stroke). */
  function cutColor(p) {
    return CI.util.colorHex(p.fillColor) || CI.util.colorHex(p.strokeColor) || '#000000';
  }

  /** Convert a stroked path to a filled outline (Design Space doesn't cut strokes as you see them). */
  function outlineStroke(p) {
    const w = p.strokeWidth || 1;
    let res = null;
    try {
      if (window.PaperOffset && p.className === 'Path') {
        res = PaperOffset.offsetStroke(p, w / 2, { cap: p.strokeCap === 'round' ? 'round' : 'butt', join: p.strokeJoin || 'miter', insert: false });
      }
    } catch (e) { res = null; }
    if (!res || !res.bounds || res.bounds.width === 0 || !isFinite(res.area)) res = rasterOffset(p, w / 2, { stroke: true });
    res.fillColor = p.strokeColor; res.strokeColor = null;
    return res;
  }

  /** Outer outlines clockwise, holes counter-clockwise — so area math, fills and Design Space all agree. */
  function normalize(p) {
    if (p && p.reorient) { try { p.reorient(false, true); } catch (e) { /* keep as is */ } }
    return p;
  }
  /** Unite a list of paths into one (Weld). Input items are not modified. */
  function uniteAll(paths) {
    if (!paths.length) return null;
    let acc = paths[0].clone({ insert: false });
    for (let i = 1; i < paths.length; i++) {
      const next = acc.unite(paths[i], { insert: false });
      acc = next;
    }
    return normalize(acc);
  }

  /** Boolean op between items (first is the base). op: unite|subtract|intersect|exclude|divide */
  function boolean(items, op) {
    const r = booleanRaw(items, op);
    if (r) r.forEach(normalize);
    return r;
  }
  function booleanRaw(items, op) {
    if (items.length < 2) return null;
    const ps = items.map(globalCopy);
    if (op === 'unite') return [uniteAll(ps)];
    if (op === 'subtract') {
      // Illustrator "Minus Front": bottom-most minus everything above it
      let base = ps[0]; for (let i = 1; i < ps.length; i++) base = base.subtract(ps[i], { insert: false }); return [base];
    }
    if (op === 'intersect') { let base = ps[0]; for (let i = 1; i < ps.length; i++) base = base.intersect(ps[i], { insert: false }); return [base]; }
    if (op === 'exclude') { let base = ps[0]; for (let i = 1; i < ps.length; i++) base = base.exclude(ps[i], { insert: false }); return [base]; }
    if (op === 'divide') {
      // split every shape by every other: pieces = each shape minus union of others, plus pairwise overlaps
      const pieces = [];
      for (let i = 0; i < ps.length; i++) {
        let piece = ps[i].clone({ insert: false });
        for (let j = 0; j < ps.length; j++) if (j !== i) piece = piece.subtract(ps[j], { insert: false });
        if (Math.abs(piece.area) > 0.01) { piece.fillColor = ps[i].fillColor; pieces.push(piece); }
        for (let j = i + 1; j < ps.length; j++) {
          const ov = ps[i].intersect(ps[j], { insert: false });
          if (Math.abs(ov.area) > 0.01) { ov.fillColor = ps[j].fillColor; pieces.push(ov); }
        }
      }
      return pieces;
    }
    return null;
  }

  // ---------- rasterize vectors to masks ----------
  /**
   * Rasterize paths (global coords) into a mask covering `bounds` at `ppu` pixels per unit.
   * Returns {mask, ppu, origin: {x,y}}
   */
  function rasterize(paths, bounds, ppu, opts = {}) {
    const pad = opts.pad != null ? opts.pad : 2;
    const w = Math.max(1, Math.ceil(bounds.width * ppu) + pad * 2), h = Math.max(1, Math.ceil(bounds.height * ppu) + pad * 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(ppu, 0, 0, ppu, -bounds.x * ppu + pad, -bounds.y * ppu + pad);
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    for (const p of paths) {
      const pd = p.pathData; if (!pd) continue;
      const p2 = new Path2D(pd);
      if (opts.stroke) { ctx.lineWidth = (p.strokeWidth || 1); ctx.lineCap = p.strokeCap || 'butt'; ctx.lineJoin = p.strokeJoin || 'miter'; ctx.stroke(p2); }
      else ctx.fill(p2, p.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    const id = ctx.getImageData(0, 0, w, h);
    return { mask: CI.mask.fromAlpha(id, 128), ppu, origin: { x: bounds.x - pad / ppu, y: bounds.y - pad / ppu } };
  }

  /** Choose a raster resolution so the mask stays within maxPixels. */
  function pickPPU(bounds, wantDPI, maxPixels = 3.5e6) {
    let ppu = wantDPI / CI.util.UPI;
    const area = bounds.width * bounds.height * ppu * ppu;
    if (area > maxPixels) ppu *= Math.sqrt(maxPixels / area);
    return ppu;
  }

  /** Raster-based offset: robust for any shape (used for Offset/Contour and as stroke fallback). Positive grows. */
  function rasterOffset(item, dist, opts = {}) {
    const paths = Array.isArray(item) ? item : leafPaths(item).map(globalCopy);
    const b = paths.reduce((acc, p) => acc ? acc.unite(p.strokeBounds) : p.strokeBounds, null).expand(Math.abs(dist) * 2 + 4);
    const ppu = pickPPU(b, opts.dpi || 300);
    const r = rasterize(paths, b, ppu, { stroke: !!opts.stroke, pad: 4 });
    let m = r.mask;
    const rad = Math.abs(dist) * ppu;
    if (!opts.stroke) m = dist > 0 ? CI.mask.dilate(m, rad) : CI.mask.erode(m, rad);
    if (opts.fillHoles) m = CI.mask.fillHoles(m, m.w * m.h);
    const loops = CI.trace.traceLoops(m, { minArea: 2, relax: 1 });
    const cp = CI.trace.loopsToCompound(loops, { tolerance: opts.tolerance || 0.8, scale: 1 / ppu, offset: r.origin });
    return cp;
  }

  // ---------- path quality ----------
  function subpaths(p) { return p.className === 'CompoundPath' ? p.children.slice() : [p]; }
  function nodeCount(p) { return subpaths(p).reduce((n, s) => n + s.segments.length, 0); }
  /** Number of tiny segments (< minLen units) — the signature of a jaggy trace that causes step cutting. */
  function tinySegments(p, minLen) {
    let n = 0; for (const s of subpaths(p)) for (const c of s.curves) if (c.length < minLen) n++; return n;
  }
  /** Smooth/simplify: flatten then re-fit curves. tolerance in units. */
  function smoothPath(p, tolerance) {
    const parts = subpaths(p).map(s => {
      const c = s.clone({ insert: false });
      if (c.segments.length <= 3) return c;
      c.flatten(Math.max(0.25, tolerance / 2));
      if (!c.closed) { c.simplify(tolerance); return c; }
      const f = CI.trace.fitClosed(c.segments.map(sg => sg.point), tolerance);
      return f;
    });
    if (p.className === 'CompoundPath') { const cp = new paper.CompoundPath({ children: parts, insert: false }); cp.copyAttributes(p); cp.matrix = p.matrix; return cp; }
    const r = parts[0]; r.copyAttributes(p); return r;
  }
  /** Remove sub-pieces (islands) smaller than minArea and holes smaller than minHole (units²). */
  function removeSmallParts(p, minArea, minHole) {
    const parts = subpaths(p); let removed = 0;
    if (p.className !== 'CompoundPath') return { path: p.clone({ insert: false }), removed: Math.abs(p.area) < minArea ? -1 : 0 };
    // classify: a child is a hole if its orientation is opposite of the largest child
    const biggest = parts.reduce((a, b) => Math.abs(b.area) > Math.abs(a.area) ? b : a, parts[0]);
    const outerSign = Math.sign(biggest.area) || 1;
    const keep = [];
    for (const s of parts) {
      const isHole = Math.sign(s.area) !== outerSign || isInsideOther(s, parts);
      const lim = isHole ? (minHole || 0) : minArea;
      if (Math.abs(s.area) < lim) { removed++; continue; }
      keep.push(s.clone({ insert: false }));
    }
    const cp = new paper.CompoundPath({ children: keep, insert: false }); cp.copyAttributes(p); cp.matrix = p.matrix;
    return { path: cp, removed };
  }
  function isInsideOther(s, parts) {
    const pt = s.firstSegment ? s.firstSegment.point : null; if (!pt) return false;
    let depth = 0; for (const o of parts) if (o !== s && o.bounds.contains(s.bounds) && o.contains(pt)) depth++;
    return depth % 2 === 1;
  }

  /**
   * Split a path into its separate islands: each outer outline with the holes it contains becomes its own item.
   * (After a slice or bridge cut, one compound path can hold several disconnected pieces.)
   */
  function splitIslands(item) {
    const src = item.clone({ insert: false }); normalize(src);
    const subs = subpaths(src).map(s => s.clone({ insert: false })).filter(s => Math.abs(s.area) > 1e-3);
    const outers = subs.filter(s => s.area > 0), holes = subs.filter(s => s.area < 0);
    const groups = outers.map(o => ({ outer: o, holes: [] }));
    holes.forEach(h => {
      // a hole belongs to the smallest outer whose box holds it AND that contains a point on the hole's own outline.
      // (Using a point INSIDE the hole is wrong for ring-shaped holes like an "O" — that point can sit on an island.)
      const pts = [0, 0.33, 0.66].map(f => h.getPointAt(h.length * f)).filter(Boolean);
      let best = null;
      groups.forEach(g => {
        if (!g.outer.bounds.expand(1).contains(h.bounds)) return;
        if (!pts.some(pt => g.outer.contains(pt))) return;
        if (!best || Math.abs(g.outer.area) < Math.abs(best.outer.area)) best = g;
      });
      if (best) best.holes.push(h);
    });
    return groups.map(g => {
      const r = g.holes.length ? new paper.CompoundPath({ children: [g.outer].concat(g.holes), insert: false, fillRule: 'evenodd' }) : g.outer;
      r.fillColor = item.fillColor || (item.strokeColor || null); return r;
    });
  }
  /** A thin rectangle along the segment a→b (extended a little past both ends), `width` units wide. */
  function strip(a, b, width, extend = 0) {
    const d = b.subtract(a); if (d.length < 1e-6) return null; const u = d.normalize(), n = new paper.Point(-u.y, u.x).multiply(width / 2);
    const A = a.subtract(u.multiply(extend)), B = b.add(u.multiply(extend));
    return new paper.Path({ segments: [A.add(n), B.add(n), B.subtract(n), A.subtract(n)], closed: true, insert: false });
  }

  CI.geom = { splitIslands, strip, isPathLike, leafPaths, globalCopy, cutColor, outlineStroke, normalize, uniteAll, boolean, rasterize, pickPPU, rasterOffset, subpaths, nodeCount, tinySegments, smoothPath, removeSmallParts };
})(window.CI);
