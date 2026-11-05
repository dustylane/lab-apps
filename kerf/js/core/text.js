/* Fonts + text-to-path. Bundled OFL fonts, your own .ttf/.otf/.woff files, and (Chrome/Edge) installed system fonts.
   Text stays editable: a text object is a paper.Group {data.type:'text', data.params} whose children are glyph outlines. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const PT = CI.util.UPI / 72; // 1 pt in document units

  const fonts = {
    list: [],            // {family, weight, category, source, font}
    local: new Map(),    // family -> [FontData] (system fonts, loaded lazily)
    _byKey: new Map(),
    key: (family, weight) => family + '|' + (weight || 400),

    loadBundled() {
      (CI.BUNDLED_FONTS || []).forEach(f => {
        try { this.add(opentype.parse(CI.util.base64ToArrayBuffer(f.data)), { family: f.family, weight: f.weight, category: f.category, source: 'bundled' }); }
        catch (e) { console.warn('Font failed', f.family, e); }
      });
    },
    add(font, meta = {}) {
      const names = font.names || {};
      const pick = (n) => n && (n.en || Object.values(n)[0]);
      const family = meta.family || pick(names.preferredFamily) || pick(names.fontFamily) || 'Custom font';
      const weight = meta.weight || (font.tables && font.tables.os2 && font.tables.os2.usWeightClass) || 400;
      const entry = { family, weight, category: meta.category || 'Imported', source: meta.source || 'file', font };
      const k = this.key(family, weight);
      if (this._byKey.has(k)) { Object.assign(this._byKey.get(k), entry); return this._byKey.get(k); }
      this._byKey.set(k, entry); this.list.push(entry);
      return entry;
    },
    addBuffer(buf, meta) { return this.add(opentype.parse(buf), meta); },
    families() { const s = []; const seen = new Set(); for (const f of this.list) if (!seen.has(f.family)) { seen.add(f.family); s.push(f); } for (const fam of this.local.keys()) if (!seen.has(fam)) { seen.add(fam); s.push({ family: fam, category: 'System', source: 'local' }); } return s; },
    weights(family) { return this.list.filter(f => f.family === family).map(f => f.weight).sort((a, b) => a - b); },
    /** Synchronous lookup of an already-loaded font (closest weight). */
    get(family, weight = 400) {
      const cands = this.list.filter(f => f.family === family);
      if (!cands.length) return null;
      return cands.reduce((a, b) => Math.abs(b.weight - weight) < Math.abs(a.weight - weight) ? b : a).font;
    },
    /** Load a system font on demand (Local Font Access API). */
    async ensure(family, weight = 400) {
      if (this.get(family, weight)) return this.get(family, weight);
      const fds = this.local.get(family);
      if (!fds || !fds.length) return null;
      const fd = fds.find(f => /regular|normal|book/i.test(f.style)) || fds[0];
      const buf = await (await fd.blob()).arrayBuffer();
      this.addBuffer(buf, { family, weight: 400, category: 'System', source: 'local' });
      return this.get(family, weight);
    },
    async loadSystemFonts() {
      if (!('queryLocalFonts' in window)) throw new Error('This browser cannot list installed fonts. Use Chrome or Edge, or load a .ttf/.otf file instead.');
      const all = await window.queryLocalFonts();
      for (const fd of all) { if (!this.local.has(fd.family)) this.local.set(fd.family, []); this.local.get(fd.family).push(fd); }
      return this.local.size;
    },
  };

  const DEFAULTS = { text: 'Text', family: 'Bungee', weight: 400, size: 72, letterSpacing: 0, lineHeight: 1.2, align: 'left', curve: 0, weld: true, color: '#000000' };

  /** opentype path → paper CompoundPath */
  function otPathToPaper(otPath) {
    const d = otPath.toPathData(3);
    if (!d) return null;
    const cp = new paper.CompoundPath({ pathData: d, insert: false });
    // opentype gives TrueType/CFF winding; normalise so nonzero fill renders counters as holes
    cp.fillRule = 'nonzero';
    return cp;
  }

  /** Lay out text and return an array of glyph CompoundPaths in local coordinates (baseline of first line at y=0). */
  function layoutGlyphs(params) {
    const p = Object.assign({}, DEFAULTS, params);
    const font = fonts.get(p.family, p.weight) || fonts.list[0] && fonts.list[0].font;
    if (!font) throw new Error('No fonts loaded');
    const size = p.size * PT; const scale = size / font.unitsPerEm;
    const track = (p.letterSpacing / 1000) * size; // Illustrator-style tracking (1/1000 em)
    const lines = String(p.text).split(/\r?\n/);
    const lineGap = size * p.lineHeight;
    const out = [];
    const lineData = lines.map(line => {
      const glyphs = font.stringToGlyphs(line); let x = 0; const placed = [];
      glyphs.forEach((g, i) => {
        placed.push({ g, x });
        x += g.advanceWidth * scale + track;
        if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale;
      });
      const width = Math.max(0, x - (glyphs.length ? track : 0));
      return { placed, width };
    });
    const maxW = Math.max(0, ...lineData.map(l => l.width));
    lineData.forEach((ld, li) => {
      const y = li * lineGap;
      const dx = p.align === 'center' ? (maxW - ld.width) / 2 : p.align === 'right' ? (maxW - ld.width) : 0;
      const curve = Math.max(-100, Math.min(100, p.curve || 0));
      const R = curve ? ld.width / ((Math.abs(curve) / 100) * 2 * Math.PI * 0.999) : 0;
      ld.placed.forEach(({ g, x }) => {
        const gp = otPathToPaper(g.getPath(0, 0, size)); if (!gp || !gp.children.length) return;
        if (!curve) { gp.translate(new paper.Point(x + dx, y)); }
        else {
          const gw = g.advanceWidth * scale; const s = x + gw / 2 - ld.width / 2; const th = s / R;
          gp.translate(new paper.Point(-gw / 2, 0));
          const sign = curve > 0 ? 1 : -1;
          gp.rotate(sign * th * 180 / Math.PI, new paper.Point(0, 0));
          gp.translate(new paper.Point(R * Math.sin(th) + maxW / 2, y + sign * R * (1 - Math.cos(th))));
        }
        gp.fillColor = p.color;
        out.push(gp);
      });
    });
    return out;
  }

  /** Build the glyph children for a text group. Welded = one outline where letters overlap (script fonts). */
  function buildChildren(params) {
    const glyphs = layoutGlyphs(params);
    if (!glyphs.length) return [];
    if (params.weld === false) return glyphs;
    const welded = CI.geom.uniteAll(glyphs);
    welded.fillColor = params.color || '#000000';
    return [welded];
  }

  /** Create a new editable text object at point (top-left). */
  function create(params, at) {
    const p = Object.assign({}, DEFAULTS, params);
    const g = new paper.Group({ applyMatrix: false, insert: false });
    g.data = { type: 'text', params: p, name: 'Text: ' + String(p.text).slice(0, 24) };
    g.addChildren(buildChildren(p));
    if (at) { const b = g.bounds; g.translate(new paper.Point(at.x - b.x, at.y - b.y)); }
    return g;
  }
  /** Re-generate a text group after its params changed, keeping its position (top-left anchor) and transform. */
  function rebuild(group, newParams) {
    const p = Object.assign({}, group.data.params, newParams);
    const anchor = group.children.length ? group.children.reduce((b, c) => b ? b.unite(c.bounds) : c.bounds, null).topLeft : new paper.Point(0, 0);
    group.removeChildren();
    group.addChildren(buildChildren(p));
    const nb = group.children.length ? group.children.reduce((b, c) => b ? b.unite(c.bounds) : c.bounds, null).topLeft : anchor;
    group.children.forEach(c => c.translate(anchor.subtract(nb)));
    group.data = Object.assign({}, group.data, { params: p, name: 'Text: ' + String(p.text).slice(0, 24) });
    return group;
  }
  /** Convert to plain outlines (no longer editable as text). */
  function toOutlines(group) {
    const parts = group.children.map(c => { const k = c.clone({ insert: false }); k.transform(group.matrix); return k; });
    let res;
    if (parts.length === 1) res = parts[0];
    else { res = new paper.Group({ children: parts, insert: false }); }
    res.data = { name: (group.data.name || 'Text') + ' (outlines)' };
    return res;
  }

  CI.fonts = fonts;
  CI.text = { DEFAULTS, layoutGlyphs, buildChildren, create, rebuild, toOutlines, PT };
})(window.CI);
