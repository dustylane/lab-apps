/* Export to Design Space-friendly SVG (free "Upload" in Design Space), PNG, and project files.
   SVG rules that keep Design Space happy: real inch dimensions, one <path> per color, no strokes,
   no clip masks, no transforms, fill-rule set, optional mirror for iron-on. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const U = () => CI.util;

  /**
   * Prepare cut layers: [{color, path (global, welded if requested)}], bounds
   * opts: {weld:true, mirror:false}
   */
  /** Can this design be packed? Weed boxes and registration marks need the layout kept exactly as drawn. */
  function packBlockers(items) {
    const r = [];
    if (items.some(i => i.visible && i.data && i.data.weed)) r.push('weed boxes');
    if (items.some(i => i.visible && i.data && i.data.reg)) r.push('registration marks');
    return r;
  }
  function mergeLeaves(ls, weld) {
    if (weld) return CI.geom.uniteAll(ls.map(l => l.path.className === 'Path' && !l.path.closed ? closedCopy(l.path) : l.path));
    const path = new paper.CompoundPath({ insert: false }); ls.forEach(l => { CI.geom.subpaths(l.path).forEach(s => path.addChild(s.clone({ insert: false }))); }); return path;
  }
  /**
   * opts.pack: {width (units), gap (units), rotate} — rearrange each color's objects tightly (material saver).
   * Every top-level object stays in one piece; each color is packed on its own and the color blocks are stacked.
   */
  function cutLayers(items, opts = {}) {
    const o = Object.assign({ weld: true, mirror: false }, opts);
    const { layers, weed } = CI.cutcheck.collect(items);
    const doPack = o.pack && !packBlockers(items).length;
    const out = []; let stackY = 0;
    for (const [color, ls] of layers) {
      let path; let usage = null;
      if (doPack) {
        const units = new Map(); ls.forEach(l => { if (!units.has(l.top)) units.set(l.top, []); units.get(l.top).push(l); });
        const parts = [...units.values()].map(u => mergeLeaves(u, o.weld)).filter(Boolean);
        const before = parts.map(p => p.bounds).reduce((a, c) => a.unite(c));
        const res = CI.nest.pack(parts.map((p, i) => ({ id: i, w: p.bounds.width, h: p.bounds.height })), o.pack.width, o.pack.gap || 0, o.pack.rotate !== false);
        res.placements.forEach(pl => {
          const p = parts[pl.id]; if (pl.rot) p.rotate(90, p.bounds.center);
          p.translate(new paper.Point(pl.x - p.bounds.x, stackY + pl.y - p.bounds.y));
        });
        path = new paper.CompoundPath({ insert: false }); parts.forEach(p => CI.geom.subpaths(p).forEach(s => path.addChild(s.clone({ insert: false }))));
        usage = { before: { w: before.width, h: before.height }, packed: { w: o.pack.width, h: res.height }, pieces: parts.length, overflow: res.placements.some(p => p.overflow) };
        stackY += res.height + 0.5 * U().UPI;
      } else path = mergeLeaves(ls, o.weld);
      if (!path) continue;
      path.fillColor = color; path.strokeColor = null;
      // weed box + lines: separate cut paths, never welded into the design (that would swallow it)
      const extras = (weed && weed.get(color) || []).map(w => { const p = w.path; p.fillColor = color; p.strokeColor = null; return p; });
      out.push({ color, path, count: ls.length, extras, usage });
    }
    const all = (l) => [l.path].concat(l.extras || []);
    const bounds = out.length ? out.map(l => all(l).map(p => p.bounds).reduce((a, b) => a.unite(b))).reduce((a, b) => a.unite(b)) : new paper.Rectangle(0, 0, 0, 0);
    out.forEach(l => { l.bounds = all(l).map(p => p.bounds).reduce((a, b) => a.unite(b)); });
    if (o.mirror) out.forEach(l => { all(l).forEach(p => p.scale(-1, 1, bounds.center)); l.bounds = all(l).map(p => p.bounds).reduce((a, b) => a.unite(b)); });
    return { layers: out, bounds };
  }
  function closedCopy(p) { const c = p.clone({ insert: false }); c.closed = true; return c; }

  function num(v) { return Math.round(v * 1000) / 1000; }

  /** Build an SVG string. opts: {weld, mirror, margin (in), only: color} */
  function toSVG(items, opts = {}) {
    const { layers, bounds } = cutLayers(items, opts);
    const UPI = U().UPI; const margin = (opts.margin || 0) * UPI;
    const use = opts.only ? layers.filter(l => l.color === opts.only) : layers;
    const b = use.length ? use.map(l => l.bounds).reduce((a, c) => a.unite(c)) : bounds;
    const W = b.width + margin * 2, H = b.height + margin * 2;
    const dx = -b.x + margin, dy = -b.y + margin;
    let body = '';
    use.forEach((l, i) => {
      const p = l.path.clone({ insert: false }); p.translate(new paper.Point(dx, dy));
      const d = pathDataOf(p);
      const ex = (l.extras || []).map((e, k) => { const q = e.clone({ insert: false }); q.translate(new paper.Point(dx, dy)); return `    <path id="${layerId(l.color, i)}-weed-${k + 1}" d="${pathDataOf(q)}" fill="${l.color}" fill-rule="evenodd" stroke="none"/>\n`; }).join('');
      body += `  <g id="${layerId(l.color, i)}">\n    <path d="${d}" fill="${l.color}" fill-rule="evenodd" stroke="none"/>\n${ex}  </g>\n`;
    });
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${num(W / UPI)}in" height="${num(H / UPI)}in" viewBox="0 0 ${num(W)} ${num(H)}">\n` +
      `  <title>${U().escapeXml(opts.title || 'Cricut cut file')}</title>\n` + body + `</svg>\n`;
    return { svg, layers: use, widthIn: W / UPI, heightIn: H / UPI };
  }
  function layerId(color, i) { return 'cut-' + (i + 1) + '-' + color.replace('#', ''); }
  function pathDataOf(p) {
    // paper's pathData uses its own precision; force 3 decimals and ensure absolute closepaths
    const subs = CI.geom.subpaths(p); let d = '';
    for (const s of subs) {
      if (!s.segments.length) continue;
      const segs = s.segments; const f = segs[0];
      d += `M${num(f.point.x)},${num(f.point.y)}`;
      const n = s.closed ? segs.length : segs.length - 1;
      for (let i = 0; i < n; i++) {
        const a = segs[i], c = segs[(i + 1) % segs.length];
        const h1 = a.point.add(a.handleOut), h2 = c.point.add(c.handleIn);
        if (a.handleOut.isZero() && c.handleIn.isZero()) d += `L${num(c.point.x)},${num(c.point.y)}`;
        else d += `C${num(h1.x)},${num(h1.y)} ${num(h2.x)},${num(h2.y)} ${num(c.point.x)},${num(c.point.y)}`;
      }
      if (s.closed) d += 'Z';
    }
    return d;
  }

  /** Render items to a PNG data URL at dpi (transparent background). */
  function toPNG(items, dpi = 300, opts = {}) {
    const { layers, bounds } = cutLayers(items, Object.assign({ weld: false }, opts));
    const ppu = dpi / U().UPI;
    const w = Math.max(1, Math.ceil(bounds.width * ppu)), h = Math.max(1, Math.ceil(bounds.height * ppu));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    ctx.setTransform(ppu, 0, 0, ppu, -bounds.x * ppu, -bounds.y * ppu);
    for (const l of layers) { ctx.fillStyle = l.color; ctx.fill(new Path2D(pathDataOf(l.path)), 'evenodd'); }
    return c.toDataURL('image/png');
  }

  // ---------- project (save/open) ----------
  /** paper JSON with raster sources swapped out for asset keys (keeps undo snapshots small). */
  // paper.js reads any array whose first element is a string as ["ClassName", ...] — so item.data arrays
  // like ['#ffffff'] crash importJSON. Escape them on the way out and restore them after import.
  function escapeData(v) {
    if (Array.isArray(v)) { if (v.some(x => typeof x === 'string')) return { __kerfJSON: JSON.stringify(v) }; return v.map(escapeData); }
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = escapeData(v[k]); return o; }
    return v;
  }
  function unescapeData(v) {
    if (Array.isArray(v)) return v.map(unescapeData);
    if (v && typeof v === 'object') { if (typeof v.__kerfJSON === 'string') return JSON.parse(v.__kerfJSON); const o = {}; for (const k of Object.keys(v)) o[k] = unescapeData(v[k]); return o; }
    return v;
  }
  function escapeTree(node) {
    if (Array.isArray(node)) node.forEach(escapeTree);
    else if (node && typeof node === 'object') for (const k of Object.keys(node)) { if (k === 'data' && node[k] && typeof node[k] === 'object') node[k] = escapeData(node[k]); else escapeTree(node[k]); }
  }
  function serialize(layer, assets) {
    const json = layer.exportJSON({ asString: false });
    escapeTree(json);
    walkRasters(json, (obj) => {
      if (obj.source && obj.source.startsWith('data:')) {
        const key = obj.data && obj.data.assetKey || assets.keyFor(obj.source);
        obj.data = Object.assign({}, obj.data, { assetKey: key });
        assets.put(key, obj.source); obj.source = 'asset:' + key;
      }
    });
    return json;
  }
  function deserializeInto(layer, json, assets) {
    const copy = JSON.parse(JSON.stringify(json));
    walkRasters(copy, (obj) => { if (obj.source && obj.source.startsWith('asset:')) obj.source = assets.get(obj.source.slice(6)) || ''; });
    layer.removeChildren();
    layer.importJSON(copy);
    [layer].concat(layer.getItems({})).forEach(it => { if (it.data && typeof it.data === 'object') it.data = unescapeData(it.data); });
  }
  function walkRasters(node, fn) {
    if (Array.isArray(node)) {
      if (node[0] === 'Raster' && node[1] && typeof node[1] === 'object') fn(node[1]);
      node.forEach(n => walkRasters(n, fn));
    } else if (node && typeof node === 'object') Object.values(node).forEach(n => walkRasters(n, fn));
  }

  function makeAssets() {
    const map = new Map(); let n = 0; const rev = new Map();
    return {
      map,
      keyFor(src) { if (rev.has(src)) return rev.get(src); const k = 'img' + (++n) + '_' + Date.now().toString(36); rev.set(src, k); return k; },
      put(k, src) { map.set(k, src); rev.set(src, k); },
      get(k) { return map.get(k); },
      toObject() { return Object.fromEntries(map); },
      load(obj) { Object.entries(obj || {}).forEach(([k, v]) => this.put(k, v)); },
    };
  }

  /**
   * Import SVG text with correct physical size. paper.js ignores units like "in"/"mm", so we read them
   * ourselves and scale to document units. Unitless/px: Illustrator writes 72 per inch, Inkscape/browsers 96.
   * Returns a paper.Group (not inserted) with clip groups released.
   */
  function importSVG(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Not a valid SVG file');
    const perIn = { in: 1, mm: 1 / 25.4, cm: 1 / 2.54, pt: 1 / 72, pc: 1 / 6 };
    const isAI = /Adobe Illustrator/i.test(text);
    const parseLen = (s) => {
      if (!s) return null; const m = String(s).trim().match(/^([\d.+-eE]+)\s*([a-z%]*)$/); if (!m) return null;
      const v = parseFloat(m[1]), u = m[2] || 'px';
      if (u === '%') return null;
      if (u === 'px') return v / (isAI ? 72 : 96);
      return perIn[u] != null ? v * perIn[u] : null;
    };
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(parseFloat);
    const wIn = parseLen(svg.getAttribute('width')), hIn = parseLen(svg.getAttribute('height'));
    let scale = 1;
    if (vb.length === 4 && vb[2] > 0) {
      if (wIn) scale = (wIn * U().UPI) / vb[2];
      else if (hIn) scale = (hIn * U().UPI) / vb[3];
      else scale = U().UPI / (isAI ? 72 : 96);
    } else if (!vb[2]) scale = U().UPI / (isAI ? 72 : 96);
    svg.removeAttribute('width'); svg.removeAttribute('height');
    const item = paper.project.importSVG(svg, { insert: false, expandShapes: true });
    // release clip masks created from the viewBox — they only get in the way of cutting
    const strip = (it) => { if (it.children) it.children.slice().forEach(c => { if (c.clipMask) c.remove(); else strip(c); }); if (it.clipped !== undefined) it.clipped = false; };
    strip(item);
    if (scale !== 1) item.scale(scale, new paper.Point(0, 0));
    return item;
  }

    function itemToJSON(item) { const j = item.exportJSON({ asString: false }); escapeTree(j); return JSON.stringify(j); }
  function restoreData(item) { [item].concat(item.getItems ? item.getItems({}) : []).forEach(it => { if (it.data && typeof it.data === 'object') it.data = unescapeData(it.data); }); return item; }
  /** Material use per color: as laid out vs packed (all in units). */
  function materialUse(items, width, gap, rotate) {
    const laid = cutLayers(items, { weld: true }).layers;
    const blockers = packBlockers(items);
    const packed = blockers.length ? null : cutLayers(items, { weld: true, pack: { width, gap, rotate } }).layers;
    return { blockers, colors: laid.map((l, i) => ({ color: l.color, w: l.bounds.width, h: l.bounds.height, packed: packed ? packed[i].usage : null, path: packed ? packed[i].path : null })) };
  }
  CI.exporter = { itemToJSON, restoreData, cutLayers, packBlockers, materialUse, toSVG, toPNG, pathDataOf, serialize, deserializeInto, makeAssets, importSVG };
})(window.CI);
