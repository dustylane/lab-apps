/* Image → vector tracing. Pure contour extraction (no DOM) + paper.js curve fitting.
   Pipeline: mask → crack-following contours → stair-step removal → Bézier fit (Schneider via paper.simplify).
   The stair-step removal is what keeps the Cricut from "step cutting" along pixel edges. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  // dir: 0 right, 1 down, 2 left, 3 up (y-down screen coords)
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

  /**
   * Extract every boundary loop from a mask. Filled area is always on the RIGHT of travel,
   * so outer outlines run clockwise (on screen) and holes counter-clockwise.
   * Diagonal-only pixel contacts are split (4-connectivity) — a zero-width bridge can't be cut.
   * Returns array of loops; each loop is an array of [x,y] corner points (pixel-corner grid).
   */
  function contours(m) {
    const { w, h, data } = m; const W = w + 1;
    const out = new Uint8Array(W * (h + 1)); // bitmask of outgoing dirs per vertex
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : data[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      if (!at(x, y - 1)) out[y * W + x] |= 1 << 0;            // top edge: (x,y)->(x+1,y)
      if (!at(x + 1, y)) out[y * W + x + 1] |= 1 << 1;        // right edge: (x+1,y)->(x+1,y+1)
      if (!at(x, y + 1)) out[(y + 1) * W + x + 1] |= 1 << 2;  // bottom: (x+1,y+1)->(x,y+1)
      if (!at(x - 1, y)) out[(y + 1) * W + x] |= 1 << 3;      // left: (x,y+1)->(x,y)
    }
    const used = new Uint8Array(W * (h + 1)); const loops = [];
    for (let v0 = 0; v0 < out.length; v0++) {
      while (out[v0] & ~used[v0]) {
        const free = out[v0] & ~used[v0]; let d = 0; while (!(free & (1 << d))) d++;
        const pts = []; let v = v0, dir = d, prevDir = -1;
        for (let guard = 0; guard < out.length * 4; guard++) {
          if (used[v] & (1 << dir)) break;
          used[v] |= 1 << dir;
          const x = v % W, y = (v - x) / W;
          if (dir !== prevDir) pts.push([x, y]);
          prevDir = dir;
          const nx = x + DX[dir], ny = y + DY[dir], nv = ny * W + nx;
          const avail = out[nv] & ~used[nv];
          // prefer right turn (hug the filled pixel), then straight, then left
          const order = [(dir + 1) & 3, dir, (dir + 3) & 3];
          let nd = -1; for (const c of order) if (avail & (1 << c)) { nd = c; break; }
          v = nv; if (nd < 0) break; dir = nd;
        }
        // if loop closed on a straight run the first point is redundant
        if (pts.length >= 3) loops.push(pts);
      }
    }
    return loops;
  }

  function signedArea(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]); return a / 2; }

  /**
   * Remove pixel stair-steps: unit-length steps become diagonal (midpoints),
   * long straight runs keep near-corner anchors so real corners stay crisp.
   */
  function destair(pts) {
    const n = pts.length; const res = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.abs(dx) + Math.abs(dy);
      const ux = dx / L, uy = dy / L;
      if (L <= 2) res.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      else { res.push([a[0] + ux * 0.75, a[1] + uy * 0.75]); res.push([b[0] - ux * 0.75, b[1] - uy * 0.75]); }
    }
    return res;
  }
  /** Find real corners: points where the outline turns sharply when looking `span` points either side. */
  function cornerFlags(p, span = 3, minTurnDeg = 50) {
    const n = p.length, flags = new Uint8Array(n); if (n < span * 2 + 3) return flags;
    const turn = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = p[(i - span + n) % n], b = p[i], c = p[(i + span) % n];
      const v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1];
      const l = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y); if (!l) continue;
      turn[i] = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / l))) * 180 / Math.PI;
    }
    // keep only the local maximum of each sharp turn
    for (let i = 0; i < n; i++) {
      if (turn[i] < minTurnDeg) continue;
      let isMax = true; for (let d = -span; d <= span; d++) { if (d && turn[(i + d + n) % n] > turn[i]) { isMax = false; break; } }
      if (isMax) flags[i] = 1;
    }
    return flags;
  }
  /** Corner-aware Laplacian smoothing: curves get smoothed, detected corners (and their neighbours) stay sharp. */
  function relax(pts, iterations = 1, k = 0.5, cornerDeg = 50) {
    let p = pts; const n = pts.length; if (n < 5 || iterations <= 0) return pts;
    const fl = cornerFlags(pts, 3, cornerDeg); const pin = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (fl[i]) { pin[i] = 1; }
    for (let it = 0; it < iterations; it++) {
      const q = new Array(n);
      for (let i = 0; i < n; i++) {
        const b = p[i]; if (pin[i]) { q[i] = b; continue; }
        const a = p[(i - 1 + n) % n], c = p[(i + 1) % n];
        q[i] = [b[0] + k * ((a[0] + c[0]) / 2 - b[0]), b[1] + k * ((a[1] + c[1]) / 2 - b[1])];
      }
      p = q;
    }
    return p;
  }

  /** Evenly resample a closed polyline (~step px apart) so smoothing acts locally and corners are detectable. */
  function resample(pts, step = 1) {
    const out = []; const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.max(1, Math.round(L / step));
      for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
    }
    return out;
  }

  /**
   * Trace a mask into loops ready for curve fitting.
   * opts: minArea (px) — drop specks; relax — smoothing passes; corner — turn angle (deg) kept as a sharp corner
   */
  function traceLoops(m, opts = {}) {
    const minArea = opts.minArea != null ? opts.minArea : 4;
    const relaxN = opts.relax != null ? opts.relax : 3;
    const corner = opts.corner != null ? opts.corner : 50;
    return contours(m)
      .filter(l => Math.abs(signedArea(l)) >= minArea)
      .map(l => {
        const rs = resample(destair(l), 1); const fl = cornerFlags(rs, 3, corner); const corners = [];
        for (let i = 0; i < fl.length; i++) if (fl[i]) corners.push(i);
        return { hole: signedArea(l) < 0, pts: relax(rs, relaxN, 0.5, corner), corners };
      });
  }

  /**
   * Build a paper.CompoundPath from loops. tolerance = curve-fit tolerance in pixels
   * (higher = fewer nodes, smoother cut). Points are scaled by `scale` and offset by `offset`.
   */
  function loopsToCompound(loops, opts = {}) {
    const tol = opts.tolerance != null ? opts.tolerance : 1.2;
    const s = opts.scale || 1, ox = (opts.offset && opts.offset.x) || 0, oy = (opts.offset && opts.offset.y) || 0;
    const children = [];
    for (const l of loops) {
      if (l.pts.length < 3) continue;
      const pts = l.pts.map(q => new paper.Point(q[0] * s + ox, q[1] * s + oy));
      const p = (tol > 0 && pts.length > 4) ? (l.corners && l.corners.length ? fitWithCorners(pts, l.corners, tol * s) : fitClosed(pts, tol * s))
        : new paper.Path({ segments: pts, closed: true, insert: false });
      if (Math.abs(p.area) < 1e-6) continue;
      children.push(p);
    }
    const cp = new paper.CompoundPath({ children, insert: false, fillRule: 'evenodd' });
    return cp;
  }

  /**
   * Curve-fit a closed polyline. paper.simplify() mishandles closed paths (it drops the seam),
   * so fit it as an open run that starts and ends at the sharpest corner, then close it.
   */
  function fitClosed(pts, tol) {
    const n = pts.length;
    // start at the sharpest turn so the seam lands on a real corner
    let best = 0, bestTurn = -1;
    for (let i = 0; i < n; i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      const v1 = b.subtract(a), v2 = c.subtract(b); const t = Math.abs(v1.getDirectedAngle(v2));
      if (t > bestTurn) { bestTurn = t; best = i; }
    }
    const run = []; for (let i = 0; i <= n; i++) run.push(pts[(best + i) % n]);
    const p = new paper.Path({ segments: run, insert: false });
    p.simplify(tol);
    if (p.segments.length > 2) {
      const last = p.lastSegment, first = p.firstSegment;
      if (last.point.getDistance(first.point) < tol * 2) { first.handleIn = last.handleIn; last.remove(); }
    }
    p.closed = true;
    // if the seam wasn't a real corner (smooth shapes like circles), make it smooth
    if (bestTurn < 35) {
      const f = p.firstSegment; const hi = f.handleIn, ho = f.handleOut;
      if (!hi.isZero() && !ho.isZero()) { const dir = ho.normalize().subtract(hi.normalize()).normalize(); f.handleIn = dir.multiply(-hi.length); f.handleOut = dir.multiply(ho.length); }
    }
    return p;
  }

  /** Fit a closed outline piece by piece between its corners, so corners stay true sharp points. */
  function fitWithCorners(pts, cornerIdx, tol) {
    const n = pts.length; const cs = [...new Set(cornerIdx.filter(i => i >= 0 && i < n))].sort((a, b) => a - b);
    if (!cs.length || n < 4) return fitClosed(pts, tol);
    const path = new paper.Path({ insert: false });
    for (let k = 0; k < cs.length; k++) {
      const a = cs[k], b = cs[(k + 1) % cs.length]; const len = ((b - a + n) % n) || n;
      const run = []; for (let j = 0; j <= len; j++) run.push(pts[(a + j) % n]);
      let seg;
      if (run.length < 4) seg = new paper.Path({ segments: [run[0], run[run.length - 1]], insert: false });
      else { seg = new paper.Path({ segments: run, insert: false }); seg.simplify(tol); }
      const segs = seg.segments.map(x => x.clone());
      if (!path.segments.length) path.addSegments(segs);
      else { path.lastSegment.handleOut = segs[0].handleOut; path.addSegments(segs.slice(1)); }
    }
    if (path.segments.length > 2) { const last = path.lastSegment, first = path.firstSegment; first.handleIn = last.handleIn; last.remove(); }
    path.closed = true;
    return path;
  }

  /**
   * Full image tracing.
   * opts.mode: 'alpha' (shape of non-transparent pixels), 'dark' (black line art), 'colors' (one layer per color),
   *            'gray' (opts.levels shades of gray, one layer each). opts.corner: corner angle threshold (deg)
   *            opts.palette: array of hex colors to snap layers to (merging layers that land on the same color)
   * opts.colors: k for color mode; opts.threshold; opts.despeckle (px); opts.smooth (px radius); opts.tolerance (px)
   * opts.ignore: array of hex colors to skip (e.g. white background), opts.ignoreTol
   * Returns [{color:'#rrggbb', path: paper.CompoundPath, pixels}]
   */
  function traceImage(img, opts = {}) {
    const o = Object.assign({ mode: 'alpha', colors: 4, threshold: 128, despeckle: 12, smooth: 1, tolerance: 1.2, ignore: [], ignoreTol: 8, mergeTol: 0 }, opts);
    if (typeof o.ignore === 'string') o.ignore = o.ignore ? o.ignore.split(',') : [];
    const layers = [];
    const prep = (m) => {
      let r = m;
      if (o.despeckle > 0) { r = CI.mask.removeSmall(r, o.despeckle); r = CI.mask.fillHoles(r, o.despeckle); }
      if (o.smooth > 0) r = CI.mask.smooth(r, o.smooth);
      return r;
    };
    const finish = (m, color) => {
      const loops = traceLoops(m, { minArea: Math.max(2, o.despeckle / 2), corner: o.corner });
      if (!loops.length) return;
      const path = loopsToCompound(loops, { tolerance: o.tolerance, scale: o.scale, offset: o.offset });
      path.fillColor = color;
      layers.push({ color, path, pixels: CI.mask.count(m) });
    };
    if (o.mode === 'alpha') finish(prep(CI.imageops.alphaMask(img, o.threshold)), o.color || '#000000');
    else if (o.mode === 'dark') finish(prep(CI.imageops.luminanceMask(img, o.threshold, !!o.invert)), o.color || '#000000');
    else {
      const q = o.mode === 'gray' ? grayLevels(img, o.levels || 4) : CI.imageops.quantize(img, o.colors, { seed: 7 });
      const ign = (o.ignore || []).map(c => CI.util.parseColor(c)); const lim = CI.imageops.tolToD2(o.ignoreTol);
      // palette is sorted by pixel count: biggest color = bottom layer
      const keep = q.palette.map((c, idx) => ({ c, idx })).filter(({ c }) => !ign.some(g => CI.util.colorDist2(g, c) <= lim));
      let masks = keep.map(({ idx }) => CI.imageops.maskForIndex(q, idx));
      // snap to a fixed palette (e.g. the vinyl you own): colors mapping to the same swatch merge into one layer
      if (o.palette && o.palette.length) {
        const pal = o.palette.map(h => CI.util.parseColor(h)); const merged = new Map();
        keep.forEach((k, i) => {
          let bi = 0, bd = Infinity; pal.forEach((pc, j) => { const d = CI.util.colorDist2(pc, k.c); if (d < bd) { bd = d; bi = j; } });
          const hex = CI.util.toHex(pal[bi]);
          if (merged.has(hex)) { const m = merged.get(hex); m.mask = CI.mask.or(m.mask, masks[i]); }
          else merged.set(hex, { c: pal[bi], mask: masks[i] });
        });
        const list = [...merged.values()];
        keep.length = 0; masks = [];
        list.forEach(m => { keep.push({ c: m.c }); masks.push(m.mask); });
      }
      masks = masks.map(prep);
      if (o.stack && masks.length > 1) {
        // layered vinyl: each layer also covers everything above it, so lower colors run underneath (no gaps, no slivers)
        for (let i = masks.length - 2; i >= 0; i--) masks[i] = CI.mask.or(masks[i], masks[i + 1]);
        masks = masks.map(m => CI.mask.fillHoles(m, Math.max(4, o.despeckle)));
      }
      keep.forEach(({ c }, i) => finish(masks[i], CI.util.toHex(c)));
    }
    return layers;
  }

  /** Posterize to N evenly spaced gray levels (alpha-aware, composited over white). Same shape as quantize(). */
  function grayLevels(img, levels) {
    const { width: w, height: h, data } = img; const n = w * h; levels = Math.max(2, Math.min(12, levels | 0));
    const indices = new Int16Array(n).fill(-1); const counts = new Array(levels).fill(0);
    for (let i = 0; i < n; i++) {
      const a = data[i * 4 + 3]; if (a < 128) continue;
      const l = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      const k = Math.min(levels - 1, Math.floor(l / 256 * levels)); indices[i] = k; counts[k]++;
    }
    const order = counts.map((c, i) => i).filter(i => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
    const remap = new Int16Array(levels).fill(-1); order.forEach((old, ni) => remap[old] = ni);
    for (let i = 0; i < n; i++) if (indices[i] >= 0) indices[i] = remap[indices[i]];
    const palette = order.map(k => { const v = Math.round(levels === 1 ? 0 : (k / (levels - 1)) * 255); return { r: v, g: v, b: v, count: counts[k] }; });
    return { palette, indices, width: w, height: h };
  }

  CI.trace = { grayLevels, fitWithCorners, contours, signedArea, destair, resample, relax, cornerFlags, traceLoops, loopsToCompound, fitClosed, traceImage };
})(window.CI);
