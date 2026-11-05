/* Pixel operations on ImageData-like objects {width, height, data: Uint8ClampedArray RGBA}.
   Pure JS (no DOM needed) — background removal, hard "pixel perfect" alpha, edge cleanup, color quantizing. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const M = () => CI.mask;
  const dist2 = (a, b) => CI.util.colorDist2(a, b);
  // tolerance 0..100 → max weighted distance² (max possible ≈ 9 * 255² ≈ 585k)
  const tolToD2 = (tol) => { const t = Math.max(0, Math.min(100, tol)) / 100; return t * t * 585225 * 0.5; };

  function makeImageData(w, h, data) {
    data = data || new Uint8ClampedArray(w * h * 4);
    if (typeof ImageData !== 'undefined') { try { return new ImageData(data, w, h); } catch (e) { /* fallthrough */ } }
    return { width: w, height: h, data };
  }
  function cloneImg(img) { return makeImageData(img.width, img.height, new Uint8ClampedArray(img.data)); }
  function px(img, x, y) { const i = (y * img.width + x) * 4, d = img.data; return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] }; }

  /** Mask of pixels similar to the seed pixel. contiguous=true behaves like a magic wand, false = select color everywhere. */
  function selectSimilar(img, sx, sy, tol, contiguous = true) {
    const { width: w, height: h, data } = img; const m = M().create(w, h);
    sx = Math.max(0, Math.min(w - 1, Math.round(sx))); sy = Math.max(0, Math.min(h - 1, Math.round(sy)));
    const seed = px(img, sx, sy); const lim = tolToD2(tol);
    const seedClear = seed.a < 128;
    const match = (i) => {
      const a = data[i * 4 + 3];
      if (seedClear) return a < 128;
      if (a < 128) return false;
      return dist2(seed, { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] }) <= lim;
    };
    if (!contiguous) { for (let i = 0; i < w * h; i++) if (match(i)) m.data[i] = 1; return m; }
    const stack = new Int32Array(w * h); let sp = 0; const s = sy * w + sx;
    stack[sp++] = s; m.data[s] = 1;
    while (sp) {
      const p = stack[--sp]; const x = p % w, y = (p - x) / w;
      if (x > 0 && !m.data[p - 1] && match(p - 1)) { m.data[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && !m.data[p + 1] && match(p + 1)) { m.data[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && !m.data[p - w] && match(p - w)) { m.data[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && !m.data[p + w] && match(p + w)) { m.data[p + w] = 1; stack[sp++] = p + w; }
    }
    return m;
  }

  /** Detect the background: flood from every border pixel that matches the most common border color. */
  function detectBackground(img, tol = 12) {
    const { width: w, height: h, data } = img; const m = M().create(w, h);
    // find dominant border color by coarse bucketing
    const buckets = new Map(); const border = [];
    for (let x = 0; x < w; x++) { border.push([x, 0], [x, h - 1]); }
    for (let y = 1; y < h - 1; y++) { border.push([0, y], [w - 1, y]); }
    for (const [x, y] of border) {
      const p = px(img, x, y); const key = p.a < 128 ? 'clear' : ((p.r >> 4) << 8 | (p.g >> 4) << 4 | (p.b >> 4));
      const b = buckets.get(key) || { n: 0, x, y }; b.n++; buckets.set(key, b);
    }
    let best = null; for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
    if (!best) return m;
    const seed = px(img, best.x, best.y); const lim = tolToD2(tol); const seedClear = seed.a < 128;
    const match = (i) => {
      const a = data[i * 4 + 3];
      if (seedClear) return a < 128;
      if (a < 128) return true; // already transparent counts as background
      return dist2(seed, { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] }) <= lim;
    };
    const stack = new Int32Array(w * h); let sp = 0;
    for (const [x, y] of border) { const i = y * w + x; if (!m.data[i] && match(i)) { m.data[i] = 1; stack[sp++] = i; } }
    while (sp) {
      const p = stack[--sp]; const x = p % w, y = (p - x) / w;
      if (x > 0 && !m.data[p - 1] && match(p - 1)) { m.data[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && !m.data[p + 1] && match(p + 1)) { m.data[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && !m.data[p - w] && match(p - w)) { m.data[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && !m.data[p + w] && match(p + w)) { m.data[p + w] = 1; stack[sp++] = p + w; }
    }
    return m;
  }

  /** Make every pixel in mask fully transparent. Returns a new image. */
  function clearMask(img, mask) {
    const out = cloneImg(img);
    for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) { out.data[i * 4 + 3] = 0; }
    return out;
  }
  /** Keep only the pixels in mask (everything else transparent). */
  function keepMask(img, mask) {
    const out = cloneImg(img);
    for (let i = 0; i < mask.data.length; i++) out.data[i * 4 + 3] = mask.data[i] ? 255 : 0;
    return out;
  }
  function removeColor(img, color, tol) {
    const c = typeof color === 'string' ? CI.util.parseColor(color) : color;
    const { width: w, height: h, data } = img; const m = M().create(w, h); const lim = tolToD2(tol);
    for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] >= 128 && dist2(c, { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] }) <= lim) m.data[i] = 1;
    return clearMask(img, m);
  }

  /**
   * Edge cleanup for cutting. Makes alpha hard (0/255 only), removes specks, fills pinholes,
   * smooths stair-stepped edges and optionally chokes (shrinks) the edge to kill color halos.
   * opts: {threshold 0-255, despeckle px, fillHoles px, smooth px radius, choke px}
   */
  function cleanEdges(img, opts = {}) {
    const o = Object.assign({ threshold: 128, despeckle: 16, fillHoles: 16, smooth: 1, choke: 0 }, opts);
    let m = M().fromAlpha(img, o.threshold);
    if (o.despeckle > 0) m = M().removeSmall(m, o.despeckle);
    if (o.fillHoles > 0) m = M().fillHoles(m, o.fillHoles);
    if (o.smooth > 0) m = M().smooth(m, o.smooth);
    if (o.choke > 0) m = M().erode(m, o.choke);
    if (o.despeckle > 0) m = M().removeSmall(m, o.despeckle); // smoothing can leave crumbs
    const out = cloneImg(img);
    // pixels that became filled but were transparent need a color: borrow nearest opaque neighbor
    const { width: w, height: h } = img; const d = out.data;
    for (let i = 0; i < w * h; i++) {
      if (m.data[i]) {
        if (img.data[i * 4 + 3] < o.threshold) {
          const x = i % w, y = (i - x) / w; let found = false;
          for (let r = 1; r <= 4 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx; if (img.data[j * 4 + 3] >= o.threshold) { d[i * 4] = img.data[j * 4]; d[i * 4 + 1] = img.data[j * 4 + 1]; d[i * 4 + 2] = img.data[j * 4 + 2]; found = true; }
          }
        }
        d[i * 4 + 3] = 255;
      } else d[i * 4 + 3] = 0;
    }
    return { image: out, mask: m };
  }

  /** Count of pixels whose alpha is neither 0 nor 255 (soft edges that make tracing jaggy). */
  function softPixelCount(img) { let n = 0; for (let i = 3; i < img.data.length; i += 4) { const a = img.data[i]; if (a > 0 && a < 255) n++; } return n; }

  // Deterministic PRNG so traces are repeatable (and testable)
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; }

  /**
   * Reduce to k colors with k-means++ (deterministic). Transparent pixels get index -1.
   * Returns {palette:[{r,g,b,count}], indices:Int16Array}
   */
  function quantize(img, k, opts = {}) {
    const { width: w, height: h, data } = img; const n = w * h; const rand = rng(opts.seed || 1234);
    const alphaCut = opts.alphaThreshold || 128;
    // sample opaque pixels
    const opaque = []; for (let i = 0; i < n; i++) if (data[i * 4 + 3] >= alphaCut) opaque.push(i);
    const indices = new Int16Array(n).fill(-1);
    if (!opaque.length) return { palette: [], indices };
    const step = Math.max(1, Math.floor(opaque.length / 20000));
    const sample = []; for (let j = 0; j < opaque.length; j += step) { const i = opaque[j]; sample.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]); }
    k = Math.max(1, Math.min(k, sample.length));
    const d2 = (a, b) => { const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return 2 * dr * dr + 4 * dg * dg + 3 * db * db; };
    // k-means++ init
    const centers = [sample[Math.floor(rand() * sample.length)].slice()];
    const best = new Float64Array(sample.length).fill(Infinity);
    while (centers.length < k) {
      let sum = 0; const c = centers[centers.length - 1];
      for (let i = 0; i < sample.length; i++) { const v = d2(sample[i], c); if (v < best[i]) best[i] = v; sum += best[i]; }
      if (sum === 0) break;
      let r = rand() * sum, idx = 0; for (; idx < sample.length - 1; idx++) { r -= best[idx]; if (r <= 0) break; }
      centers.push(sample[idx].slice());
    }
    const assign = new Int32Array(sample.length);
    for (let iter = 0; iter < 12; iter++) {
      const acc = centers.map(() => [0, 0, 0, 0]); let moved = false;
      for (let i = 0; i < sample.length; i++) {
        let bi = 0, bd = Infinity; for (let c = 0; c < centers.length; c++) { const v = d2(sample[i], centers[c]); if (v < bd) { bd = v; bi = c; } }
        if (assign[i] !== bi) { moved = true; assign[i] = bi; }
        const a = acc[bi]; a[0] += sample[i][0]; a[1] += sample[i][1]; a[2] += sample[i][2]; a[3]++;
      }
      centers.forEach((c, i) => { const a = acc[i]; if (a[3]) { c[0] = a[0] / a[3]; c[1] = a[1] / a[3]; c[2] = a[2] / a[3]; } });
      if (!moved && iter > 0) break;
    }
    const counts = new Array(centers.length).fill(0);
    for (const i of opaque) {
      const p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]; let bi = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) { const v = d2(p, centers[c]); if (v < bd) { bd = v; bi = c; } }
      indices[i] = bi; counts[bi]++;
    }
    // drop empty clusters, sort by count desc
    const order = centers.map((c, i) => i).filter(i => counts[i] > 0).sort((a, b) => counts[b] - counts[a]);
    const remap = new Int16Array(centers.length).fill(-1); order.forEach((old, ni) => remap[old] = ni);
    for (let i = 0; i < n; i++) if (indices[i] >= 0) indices[i] = remap[indices[i]];
    const palette = order.map(i => ({ r: Math.round(centers[i][0]), g: Math.round(centers[i][1]), b: Math.round(centers[i][2]), count: counts[i] }));
    return { palette, indices, width: w, height: h };
  }
  function maskForIndex(q, idx) { const m = M().create(q.width, q.height); for (let i = 0; i < m.data.length; i++) m.data[i] = q.indices[i] === idx ? 1 : 0; return m; }

  /** Dark-pixel mask for black/white art (alpha-aware). */
  function luminanceMask(img, threshold = 128, invert = false) {
    const { width: w, height: h, data } = img; const m = M().create(w, h);
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3] / 255;
      // composite over white
      const l = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) * a + 255 * (1 - a);
      const dark = l < threshold; m.data[i] = (invert ? !dark : dark) ? 1 : 0;
    }
    return m;
  }
  function alphaMask(img, threshold = 128) { return M().fromAlpha(img, threshold); }

  CI.imageops = { makeImageData, cloneImg, px, selectSimilar, detectBackground, clearMask, keepMask, removeColor, cleanEdges, softPixelCount, quantize, maskForIndex, luminanceMask, alphaMask, tolToD2 };
})(window.CI);
