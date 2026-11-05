/* Binary mask math (pure JS, no DOM). A mask is {w, h, data: Uint8Array} with 1 = filled.
   Uses an exact Euclidean distance transform so erode/dilate are true circles at any radius. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const INF = 1e20;

  function create(w, h, fill = 0) { const d = new Uint8Array(w * h); if (fill) d.fill(1); return { w, h, data: d }; }
  function clone(m) { return { w: m.w, h: m.h, data: new Uint8Array(m.data) }; }
  function count(m) { let n = 0; const d = m.data; for (let i = 0; i < d.length; i++) n += d[i]; return n; }

  // Felzenszwalb & Huttenlocher 1-D squared distance transform
  function edt1d(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
  }

  /** Squared distance from each pixel to the nearest pixel whose value === target. */
  function distSq(m, target = 1) {
    const { w, h, data } = m; const n = Math.max(w, h);
    const out = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = data[i] === target ? 0 : INF;
    const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) f[y] = out[y * w + x];
      edt1d(f, h, d, v, z);
      for (let y = 0; y < h; y++) out[y * w + x] = d[y];
    }
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) f[x] = out[o + x];
      edt1d(f, w, d, v, z);
      for (let x = 0; x < w; x++) out[o + x] = d[x];
    }
    return out;
  }

  function dilate(m, r) {
    if (r <= 0) return clone(m);
    const ds = distSq(m, 1), out = create(m.w, m.h), r2 = r * r;
    for (let i = 0; i < ds.length; i++) out.data[i] = ds[i] <= r2 ? 1 : 0;
    return out;
  }
  /** Erode: outside of the mask counts as empty, so shapes at the edge erode too. */
  function erode(m, r) {
    if (r <= 0) return clone(m);
    // pad by 1 so the border counts as background
    const p = pad(m, 1), ds = distSq(p, 0), r2 = r * r, out = create(m.w, m.h);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      out.data[y * m.w + x] = ds[(y + 1) * p.w + (x + 1)] > r2 ? 1 : 0;
    }
    return out;
  }
  function open(m, r) { return dilate(erode(m, r), r); }
  function close(m, r) { const p = pad(m, Math.ceil(r) + 1); const c = erode(dilate(p, r), r); return crop(c, Math.ceil(r) + 1, Math.ceil(r) + 1, m.w, m.h); }

  function pad(m, n) {
    const out = create(m.w + 2 * n, m.h + 2 * n);
    for (let y = 0; y < m.h; y++) out.data.set(m.data.subarray(y * m.w, (y + 1) * m.w), (y + n) * out.w + n);
    return out;
  }
  function crop(m, x0, y0, w, h) {
    const out = create(w, h);
    for (let y = 0; y < h; y++) out.data.set(m.data.subarray((y + y0) * m.w + x0, (y + y0) * m.w + x0 + w), y * w);
    return out;
  }
  function and(a, b) { const o = create(a.w, a.h); for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] & b.data[i]; return o; }
  function or(a, b) { const o = create(a.w, a.h); for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] | b.data[i]; return o; }
  function not(a) { const o = create(a.w, a.h); for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] ? 0 : 1; return o; }
  function sub(a, b) { const o = create(a.w, a.h); for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] & (b.data[i] ^ 1); return o; }

  /** Connected components (4- or 8-connectivity). Returns {labels, comps[]} where comps[i] describes label i+1. */
  function label(m, conn = 4) {
    const { w, h, data } = m; const labels = new Int32Array(w * h); const comps = [];
    const stack = new Int32Array(w * h);
    for (let start = 0; start < w * h; start++) {
      if (!data[start] || labels[start]) continue;
      const id = comps.length + 1;
      let sp = 0; stack[sp++] = start; labels[start] = id;
      let area = 0, minx = w, miny = h, maxx = -1, maxy = -1, border = false, sx = 0, sy = 0;
      while (sp) {
        const p = stack[--sp]; const x = p % w, y = (p - x) / w;
        area++; sx += x; sy += y;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; if (conn === 4 && dx && dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (data[q] && !labels[q]) { labels[q] = id; stack[sp++] = q; }
        }
      }
      comps.push({ id, area, minx, miny, maxx, maxy, touchesBorder: border, cx: sx / area, cy: sy / area });
    }
    return { labels, comps };
  }

  /** Remove filled specks smaller than minArea pixels. */
  function removeSmall(m, minArea, conn = 4) {
    const { labels, comps } = label(m, conn); const out = clone(m);
    const kill = new Uint8Array(comps.length + 1);
    comps.forEach(c => { if (c.area < minArea) kill[c.id] = 1; });
    for (let i = 0; i < out.data.length; i++) if (kill[labels[i]]) out.data[i] = 0;
    return out;
  }
  /** Fill enclosed holes smaller than maxArea pixels (holes touching the border are left alone). */
  function fillHoles(m, maxArea, conn = 4) {
    const inv = not(m); const { labels, comps } = label(inv, conn); const out = clone(m);
    const fill = new Uint8Array(comps.length + 1);
    comps.forEach(c => { if (!c.touchesBorder && c.area < maxArea) fill[c.id] = 1; });
    for (let i = 0; i < out.data.length; i++) if (fill[labels[i]]) out.data[i] = 1;
    return out;
  }
  /** Smooth jagged edges: blur-like majority via open+close at small radius. */
  function smooth(m, r) {
    if (r <= 0) return clone(m);
    return open(close(m, r), r);
  }

  function fromAlpha(imageData, threshold = 128) {
    const { width: w, height: h, data } = imageData; const m = create(w, h);
    for (let i = 0; i < w * h; i++) m.data[i] = data[i * 4 + 3] >= threshold ? 1 : 0;
    return m;
  }
  function bbox(m) {
    let minx = m.w, miny = m.h, maxx = -1, maxy = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.data[y * m.w + x]) {
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    return maxx < 0 ? null : { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 };
  }

  CI.mask = { create, clone, count, distSq, dilate, erode, open, close, pad, crop, and, or, not, sub, label, removeSmall, fillHoles, smooth, fromAlpha, bbox };
})(window.CI);
