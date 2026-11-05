/* Material saver: packs rectangles (each object's bounding box) into a strip of fixed width — the mat / roll —
   using a skyline bottom-left heuristic, optionally trying 90° rotations. Pure JS, no DOM. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  /**
   * rects: [{id, w, h}] (any units). binW: strip width. gap: spacing kept between pieces and from the edges.
   * Returns {placements: [{id, x, y, w, h, rot}], height, width} — x/y are the top-left of each (rotated) box.
   */
  function pack(rects, binW, gap = 0, allowRotate = true) {
    const items = rects.map(r => ({ id: r.id, w: r.w, h: r.h }));
    // biggest first: by longer side, then area
    items.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
    // each piece reserves (w + gap) starting at a skyline x and sits at x + gap; the strip keeps a gap on the right too
    const Wi = binW - gap;
    let sky = [{ x: 0, w: Wi, y: 0 }];            // skyline segments: top edge at height y
    const out = [];
    const fitAt = (i, w) => {                       // y where a box of width w can sit starting at segment i, or -1
      const x = sky[i].x; if (x + w > Wi + 1e-9) return -1;
      let y = 0, rem = w, j = i;
      while (rem > 1e-9) { if (j >= sky.length) return -1; y = Math.max(y, sky[j].y); rem -= sky[j].w; j++; }
      return y;
    };
    for (const it of items) {
      let best = null;
      const tries = allowRotate && Math.abs(it.w - it.h) > 1e-9 ? [[it.w, it.h, 0], [it.h, it.w, 90]] : [[it.w, it.h, 0]];
      for (const [w0, h0, rot] of tries) {
        const w = w0 + gap, h = h0 + gap;
        if (w > Wi + 1e-9) continue;
        for (let i = 0; i < sky.length; i++) {
          const y = fitAt(i, w); if (y < 0) continue;
          const top = y + h;
          if (!best || top < best.top - 1e-9 || (Math.abs(top - best.top) < 1e-9 && sky[i].x < best.x)) best = { i, x: sky[i].x, y, w, h, w0, h0, rot, top };
        }
      }
      if (!best) { // wider than the strip even rotated: put it on its own row (reported as overflow by caller)
        const y = Math.max(...sky.map(s => s.y));
        out.push({ id: it.id, x: 0, y: y + gap, w: it.w, h: it.h, rot: 0, overflow: true });
        sky = [{ x: 0, w: Wi, y: y + gap + it.h }];
        continue;
      }
      out.push({ id: it.id, x: best.x + gap, y: best.y + gap, w: best.w0, h: best.h0, rot: best.rot });
      // raise the skyline under the placed box
      const x0 = best.x, x1 = Math.min(Wi, best.x + best.w), ny = best.top;
      const next = [];
      for (const s of sky) {
        const s0 = s.x, s1 = s.x + s.w;
        if (s1 <= x0 || s0 >= x1) { next.push(s); continue; }
        if (s0 < x0) next.push({ x: s0, w: x0 - s0, y: s.y });
        if (s1 > x1) next.push({ x: x1, w: s1 - x1, y: s.y });
      }
      next.push({ x: x0, w: x1 - x0, y: ny });
      next.sort((a, b) => a.x - b.x);
      // merge equal-height neighbours
      sky = [];
      for (const s of next) { const l = sky[sky.length - 1]; if (l && Math.abs(l.y - s.y) < 1e-9 && Math.abs(l.x + l.w - s.x) < 1e-9) l.w += s.w; else sky.push(Object.assign({}, s)); }
    }
    // w/h are already the on-mat (rotated) size
    const height = out.length ? Math.max(...out.map(p => p.y + p.h)) + gap : 0;
    return { placements: out, height, width: binW };
  }
  CI.nest = { pack };
})(window.CI);
