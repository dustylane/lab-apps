/* Vintage distress that stays cuttable.
   Wear only REMOVES material (like ink worn off a shirt). Every hole/notch is then forced to be wide and big
   enough to weed for the chosen material, every remaining sliver is cleaned up, and tiny crumbs are dropped.
   Noise is seeded and measured in inches, so the preview matches the result at any resolution. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const M = () => CI.mask;

  // ---- seeded value noise ----
  function hash(ix, iy, seed) {
    let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const fade = (t) => t * t * (3 - 2 * t);
  function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = fade(x - ix), fy = fade(y - iy);
    const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  /** Fractal noise in [0,1]. */
  function fbm(x, y, seed, oct = 4) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += amp * vnoise(x * f, y * f, seed + o * 101); norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }

  const PRESETS = {
    subtle: { name: 'Subtle rough edges', wear: 0, rough: 0, cracks: 0, texture: 0.35, grain: 0.08, edgeOnly: false },
    light:  { name: 'Light wear',   wear: 0.40, rough: 0.30, cracks: 0.00, texture: 0.25, grain: 0.14, edgeOnly: false },
    worn:   { name: 'Worn print',   wear: 0.50, rough: 0.45, cracks: 0.15, texture: 0.35, grain: 0.14, edgeOnly: false },
    cracked:{ name: 'Cracked ink',  wear: 0.25, rough: 0.35, cracks: 0.70, texture: 0.25, grain: 0.20, edgeOnly: false },
    grunge: { name: 'Heavy grunge', wear: 0.70, rough: 0.65, cracks: 0.30, texture: 0.5, grain: 0.12, edgeOnly: false },
    edges:  { name: 'Worn edges',   wear: 0.65, rough: 0.70, cracks: 0.10, texture: 0.4, grain: 0.12, edgeOnly: true, band: 0.12 },
  };

  /**
   * Distress a mask.
   * o: {ppi (pixels per inch), origin:{x,y} (inches of pixel 0,0), wear, rough, cracks (0..1), grain (inches), seed,
   *      edgeOnly (bool) + band (inches): confine all wear to a band along the outlines; the middle stays solid,
   *      (texture is applied separately, on the vector outline — see wobble())}
   * mat: material rules (minFeature, minGap, minPiece, minHole). Returns a new mask (subset of the input).
   */
  function apply(m, o, mat) {
    const { w, h } = m; const ppi = o.ppi; const ox = o.origin ? o.origin.x : 0, oy = o.origin ? o.origin.y : 0;
    const seed = (o.seed | 0) || 1; const grain = Math.max(0.03, o.grain || 0.14);
    const wear = clamp01(o.wear), rough = clamp01(o.rough), cracks = clamp01(o.cracks);
    const minW = Math.max(mat.minFeature, mat.minGap);          // narrowest hole/notch that can be weeded cleanly
    const rHole = (minW / 2) * ppi * 1.12;
    const rFeat = (mat.minFeature / 2) * ppi * 1.12;

    // distance (px) from each filled pixel to the edge — for edge bites
    const p = M().pad(m, 1); const dsq = M().distSq(p, 0);
    const edgeDepth = rough * 0.045 * ppi;                         // shallow chipping, up to ~0.045" deep
    const crackW = cracks * 0.025;
    const edgeOnly = !!o.edgeOnly; const bandPx = Math.max(0.02, o.band || 0.12) * ppi;
    const holes = M().create(w, h);
    for (let y = 0; y < h; y++) {
      const Y = oy + y / ppi;
      for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!m.data[i]) continue;
        const X = ox + x / ppi; let cut = false;
        const d = Math.sqrt(dsq[(y + 1) * p.w + x + 1]);
        // edges-only: nothing deeper than the band is touched, and wear fades out across the band
        const fall = edgeOnly ? (d >= bandPx ? 0 : 1 - smooth(0.25, 1, d / bandPx)) : 1;
        if (fall <= 0) continue;
        if (edgeDepth > 0) {
          if (d < edgeDepth) { const n = fbm(X / (grain * 0.45), Y / (grain * 0.45), seed + 7, 2); if (d < edgeDepth * Math.pow(n, 3) * 2.6) cut = true; }
        }
        if (!cut && wear > 0) {
          // worn zones (big, soft) decide WHERE ink is gone; fine speckle decides the texture inside them
          const zone = fbm(X / (grain * 8), Y / (grain * 8), seed, 3);
          // edge mode: every edge gets some wear (zones only vary it), scaled down toward the inside of the band
          const dens = edgeOnly ? wear * (0.45 + 0.55 * smooth(0.3, 0.78, zone)) * fall * 1.15 : wear * smooth(0.3, 0.78, zone);
          if (dens > 0.02) { const f = fbm(X / grain, Y / grain, seed + 31, 2); if (f > 1 - dens * 0.75) cut = true; }
        }
        if (!cut && cracks > 0) {
          const c = Math.abs(fbm(X / (grain * 1.6), Y / (grain * 1.6), seed + 77, 4) - 0.5);
          if (c < crackW * fall) cut = true;
        }
        if (cut) holes.data[i] = 1;
      }
    }
    // cracks/edge bites are thin: widen everything we remove to the weedable width, but stay inside the shape
    let H = M().and(M().dilate(holes, rHole * 0.45), m);
    // narrower-than-weedable bits of removed area fill back in
    H = M().open(H, rHole);
    // removed islands that are too small to weed fill back in (notches open to the outside are just edge texture)
    const outside = M().not(m);
    const lab = M().label(H, 4); const minHolePx = mat.minHole * ppi * ppi * 1.25;
    const keepHole = new Uint8Array(lab.comps.length + 1);
    lab.comps.forEach(c => { keepHole[c.id] = c.area >= minHolePx ? 1 : 0; });
    // notches touching the original outside are kept if they passed the width test
    for (let i = 0; i < H.data.length; i++) {
      if (!H.data[i]) continue;
      const id = lab.labels[i]; if (keepHole[id]) continue;
      const x = i % w, y = (i - x) / w;
      if ((x > 0 && outside.data[i - 1]) || (x < w - 1 && outside.data[i + 1]) || (y > 0 && outside.data[i - w]) || (y < h - 1 && outside.data[i + w])) keepHole[id] = 2;
    }
    for (let i = 0; i < H.data.length; i++) if (H.data[i] && !keepHole[lab.labels[i]]) H.data[i] = 0;
    let out = M().sub(m, H);
    // material left between holes must be at least minFeature wide — only re-shape near what changed
    const changed = M().dilate(H, rFeat * 2.5);
    const opened = M().open(out, rFeat);
    for (let i = 0; i < out.data.length; i++) if (changed.data[i]) out.data[i] = opened.data[i];
    // crumbs
    out = M().removeSmall(out, Math.max(4, mat.minPiece * ppi * ppi * 1.25));
    return out;
  }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));

  /**
   * Fine, natural edge wobble done on the VECTOR outline (not pixels), so it can be much finer than any raster effect.
   * Walks every outline in tiny steps and nudges each point in or out by smooth noise. Never removes chunks.
   * Cut safety: at every point it measures the local stroke width (and the gap to the neighbour) and never lets
   * a stroke get thinner than mat.minFeature or a gap narrower than mat.minGap.
   * shape: paper PathItem in global coords. o: {texture 0..1 (amount), grain (inches, wobble size), seed}
   */
  function wobble(shape, o, mat) {
    const UPI = CI.util.UPI; const tex = clamp01(o.texture); if (!tex) return shape.clone({ insert: false });
    const amp = (0.003 + tex * 0.014) * UPI;                                   // 0.003"–0.017" peak
    // thick materials (foam, felt, chipboard) can't take fine detail: their node budget sets the finest step allowed
    const minStep = (mat.maxNodesPerSqIn || 60) < 40 ? 0.5 * 1.2 / mat.maxNodesPerSqIn : 0.005;
    const scale = Math.max(minStep * 4, Math.min(0.06, Math.max(0.008, (o.grain || 0.08) * 0.22))) * UPI; // wobble wavelength
    const step = Math.max(minStep * UPI, scale / 4);
    const seed = (o.seed | 0) || 1;
    // distance fields for the safety limits
    const b = shape.bounds.expand(0.6 * UPI);
    const ppu = CI.geom.pickPPU(b, 300, 5e6);
    const r = CI.geom.rasterize([shape], b, ppu, { pad: 2 });
    const W = r.mask.w, H = r.mask.h;
    const din = M().distSq(r.mask, 0), dout = M().distSq(r.mask, 1);
    const at = (arr, x, y) => { const px = Math.round((x - r.origin.x) * ppu), py = Math.round((y - r.origin.y) * ppu); if (px < 0 || py < 0 || px >= W || py >= H) return -1; return arr[py * W + px]; };
    const inside = (x, y) => { const px = Math.floor((x - r.origin.x) * ppu), py = Math.floor((y - r.origin.y) * ppu); return px >= 0 && py >= 0 && px < W && py < H && r.mask.data[py * W + px] === 1; };
    const maxWalk = 0.3 * UPI, st = 1 / ppu;
    // half-width of the stroke (or gap) on one side of p, in units: peak of the distance field along the ray
    const extent = (arr, p, d) => { let best = 0; for (let t = st; t < maxWalk; t += st) { const v = at(arr, p.x + d.x * t, p.y + d.y * t); if (v < 0) return maxWalk; const s2 = Math.sqrt(v); if (s2 < best - 1) break; if (s2 > best) best = s2; } return best / ppu; };
    const minIn = (mat.minFeature / 2) * UPI * 1.1, minOut = (Math.max(mat.minGap, 0.015) / 2) * UPI * 1.1;

    // sample every outline once: point, outward normal, noise displacement (already safety-limited)
    const subs = CI.geom.subpaths(shape).map(sp => {
      if (!sp.closed || sp.length < step * 8) return { keep: sp };
      let ip = null; try { ip = sp.interiorPoint; } catch (e) { ip = null; }
      const isHole = ip ? !inside(ip.x, ip.y) : false;
      const protectHole = isHole && Math.abs(sp.area) < mat.minHole * UPI * UPI * 6;   // small counters may only grow
      const curves = sp.curves.filter(c => c.length > 1e-6);   // fonts sometimes contain zero-length segments
      const samples = [], corners = [];
      curves.forEach((c, ci) => {
        const prev = curves[(ci - 1 + curves.length) % curves.length];
        const tIn = prev.getTangentAtTime(1), tOut = c.getTangentAtTime(0);
        if (tIn && tOut && Math.abs(tIn.getDirectedAngle(tOut)) > 22) corners.push(samples.length);
        const k = Math.max(1, Math.round(c.length / step));
        for (let j = 0; j < k; j++) {
          const off = c.length * j / k; const p = c.getPointAt(off); let n = c.getNormalAt(off);
          if (!p || !n || n.isZero()) continue;
          n = n.normalize();
          if (inside(p.x + n.x * 1.5 * st, p.y + n.y * 1.5 * st)) n = n.multiply(-1); // n now points outward
          let v = (fbm(p.x / scale, p.y / scale, seed + 501, 3) - 0.5) * 2.4;
          const nick = fbm(p.x / (scale * 0.45), p.y / (scale * 0.45), seed + 509, 2);
          if (nick > 0.68) v -= (nick - 0.68) * 7;                                   // occasional small worn nick
          v = Math.max(-1.7, Math.min(1, v));
          let d = v * amp;
          if (d < 0) d = Math.max(d, -Math.max(0, extent(din, p, n.multiply(-1)) - minIn));
          else if (d > 0) d = protectHole ? 0 : Math.min(d, Math.max(0, extent(dout, p, n) - minOut));
          samples.push({ p, n, d });
        }
      });
      return samples.length < 8 ? { keep: sp } : { samples, corners, orig: sp };
    });

    // build the outline; `calm(p)` → true switches the wobble off at that point (used to repair pinch spots)
    const build = (calm) => {
      const kids = subs.map(sb => {
        if (sb.keep) return sb.keep.clone({ insert: false });
        const pts = sb.samples.map(sm => (calm && calm(sm.p)) ? sm.p : sm.p.add(sm.n.multiply(sm.d)));
        const tol = Math.max(0.0018 * UPI, amp * 0.22);
        return CI.trace.fitWithCorners(pts, sb.corners, tol);
      });
      let out = new paper.CompoundPath({ children: kids, insert: false, fillRule: 'evenodd' });
      try { const rc = out.resolveCrossings(); if (rc) out = rc; } catch (e) { /* keep */ }
      CI.geom.normalize(out);
      if (out.className === 'CompoundPath') {
        const keep = out.children.filter(c => c.segments.length >= 2 && Math.abs(c.area) > 1e-3);   // degenerate slivers
        if (keep.length !== out.children.length) { const cp = new paper.CompoundPath({ children: keep.map(k => k.clone({ insert: false })), insert: false, fillRule: 'evenodd' }); out = cp; }
        const a2 = UPI * UPI; out = CI.geom.removeSmallParts(out, mat.minPiece * a2, mat.minHole * a2).path;
      }
      return out;
    };
    // where two wobbling edges almost pinch (a pocket nearly sealed, or a tip hanging on by a hair) the blade can't
    // cut it cleanly. Find such spots at Cut check's resolution and rebuild with the wobble calmed around them.
    const checkDpi = Math.max(150, Math.min(400, 10 / mat.minFeature));
    const badZones = (out) => {
      const zones = [];
      // first pass uses exactly Cut check's grid (same bounds, resolution and padding), then finer/offset grids
      const grids = [[checkDpi, 0], [checkDpi * 0.9, 0.05], [300, 0.05]];
      for (const [dpi, ex] of grids) {
        const fb = ex ? out.bounds.expand(ex * UPI) : out.bounds; const fppu = ex ? CI.geom.pickPPU(fb, dpi, 6e6) : CI.geom.pickPPU(fb, dpi);
        const fr = CI.geom.rasterize([out], fb, fppu, { pad: ex ? 3 : Math.ceil(mat.minGap * UPI * fppu) + 3 });
        const A = UPI * UPI * fppu * fppu;
        const holes = M().label(M().not(fr.mask), 4).comps.filter(c => !c.touchesBorder && c.area < mat.minHole * A);
        const crumbs = M().label(fr.mask, 8).comps.filter(c => c.area < mat.minPiece * A);
        holes.concat(crumbs).forEach(c => zones.push(new paper.Point(fr.origin.x + (c.minx + c.maxx + 1) / 2 / fppu, fr.origin.y + (c.miny + c.maxy + 1) / 2 / fppu)));
      }
      return zones;
    };
    let out = build(null);
    const zones = [];
    let R = 0;
    for (let pass = 0; pass < 3; pass++) {
      const z = badZones(out); if (!z.length) break;
      zones.push(...z);
      R = Math.max(0.06 * UPI, amp * 4) * (1 + pass);
      out = build((p) => zones.some(c => c.getDistance(p) < R));
    }
    // last resort: any outline still involved in a pinch is kept exactly as originally drawn (guaranteed clean)
    const left = badZones(out);
    if (left.length) {
      const RR = Math.max(R, 0.1 * UPI);
      subs.forEach(sb => { if (sb.samples && sb.samples.some(sm => left.some(c => c.getDistance(sm.p) < RR))) { sb.keep = sb.orig; } });
      out = build((p) => zones.some(c => c.getDistance(p) < R));
    }
    out.fillColor = shape.fillColor;
    return out;
  }

  CI.distress = { apply, wobble, fbm, vnoise, PRESETS };
})(window.CI);
