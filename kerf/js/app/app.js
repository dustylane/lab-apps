/* Kerf editor core: document, selection, operations (pathfinder, align, image cleanup, tracing, fixes). No DOM panels here. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const U = CI.util; const UPI = U.UPI;

  const MAT_STYLE = {
    light: { fill: '#bcd9ef', grid: '#8fb7d6', label: '#4f7ea3', name: 'LightGrip (blue)' },
    standard: { fill: '#bfe3cc', grid: '#8cc5a2', label: '#3f8a5f', name: 'StandardGrip (green)' },
    strong: { fill: '#d5c8ea', grid: '#ad9bd0', label: '#6b5598', name: 'StrongGrip (purple)' },
  };
  const MAT_FOR = { vinyl: 'standard', htv: 'standard', cardstock: 'standard', paper: 'light', foam2mm: 'strong', felt: 'strong', leather: 'strong', chipboard: 'strong' };

  class App {
    constructor(canvas, opts = {}) {
      this.opts = opts;
      paper.setup(canvas);
      paper.settings.hitTolerance = 0;
      this.canvas = canvas; this.view = paper.view; this.project = paper.project;
      this.matLayer = this.project.activeLayer; this.matLayer.name = 'mat'; this.matLayer.locked = true;
      this.design = new paper.Layer({ name: 'design' });
      this.overlay = new paper.Layer({ name: 'overlay' });
      this.preview = new paper.Layer({ name: 'preview' });
      this.ui = new paper.Layer({ name: 'ui' });
      this.design.activate();
      this.assets = CI.exporter.makeAssets();
      this.doc = { name: 'Untitled', material: 'vinyl', machine: 'maker4', mat: '12x12', mirror: false, weld: true, overrides: {}, cutPreview: false };
      this.selection = [];
      this.listeners = {};
      this.history = new CI.History(this);
      this.issues = []; this.summary = null;
      this.fill = '#000000';
      this.clipboard = null;
      this._checkTimer = null;
      this.drawMat();
      this.history.reset();
    }

    // ---------- events ----------
    on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); }
    emit(evt, data) { (this.listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
    toast(msg, kind = 'info') { this.emit('toast', { msg, kind }); }

    // ---------- doc state ----------
    docState() { const d = this.doc; return { name: d.name, material: d.material, machine: d.machine, mat: d.mat, mirror: d.mirror, weld: d.weld, overrides: d.overrides, placement: d.placement || null, garmentColor: d.garmentColor || '#ffffff', pack: !!d.pack, packGap: d.packGap != null ? d.packGap : 0.25, packRotate: d.packRotate !== false }; }
    applyDocState(s, silent) { Object.assign(this.doc, s); this.drawMat(); if (!silent) this.emit('doc'); }
    material() { return CI.getMaterial(this.doc.material, this.doc.overrides[this.doc.material]); }
    setMaterial(key) {
      const was = this.material().mirror;
      this.doc.material = key; const m = this.material();
      if (m.mirror && !was) this.doc.mirror = true; else if (!m.mirror && was) this.doc.mirror = false;
      this.drawMat(); this.emit('doc'); this.commit('Material: ' + m.name);
    }
    setMat(key) { this.doc.mat = key; this.drawMat(); this.emit('doc'); this.commit('Mat ' + key); }
    matArea() { const m = CI.MACHINES[this.doc.machine].mats[this.doc.mat] || Object.values(CI.MACHINES[this.doc.machine].mats)[0]; return new paper.Rectangle(0, 0, m.w * UPI, m.h * UPI); }

    designItems() { return this.design.children.slice(); }
    commit(label) {
      // weed boxes follow the design: rebuild them silently whenever something else changed
      if (!this._syncing && !/weed|registration/i.test(String(label)) && (this.regMarks().length || this.weedBoxes().length)) {
        this._syncing = true;
        try { if (this.regMarks().length) this._syncReg(); if (this.weedBoxes().length) this._syncWeed(); } catch (e) { console.error(e); }
        this._syncing = false;
      }
      const changed = this.history.commit(label);
      this.emit('change', label); this.refreshSelection();
      if (changed) this.scheduleCheck();
      return changed;
    }
    afterRestore() { this.selection = []; this.clearHighlights(); this.clearPreview(); this.refreshSelection(); this.emit('change', 'restore'); this.emit('doc'); this.scheduleCheck(); }

    // ---------- mat ----------
    drawMat() {
      const L = this.matLayer; L.removeChildren(); L.activate();
      const cut = this.matArea(); const pad = 0.25 * UPI;
      const st = MAT_STYLE[MAT_FOR[this.doc.material] || 'standard'];
      const matRect = new paper.Rectangle(cut.x - pad, cut.y - pad, cut.width + pad * 2, cut.height + pad * 2);
      new paper.Path.Rectangle({ rectangle: matRect.expand(0.45 * UPI, 0.45 * UPI), radius: 10, fillColor: st.fill, opacity: 0.55 });
      new paper.Path.Rectangle({ rectangle: matRect, fillColor: '#fbfaf7' });
      const g = new paper.Group();
      for (let x = Math.floor(matRect.left / UPI); x <= Math.ceil(matRect.right / UPI); x++) {
        const X = x * UPI; if (X < matRect.left || X > matRect.right) continue;
        g.addChild(new paper.Path.Line({ from: [X, matRect.top], to: [X, matRect.bottom], strokeColor: st.grid, strokeWidth: 1, strokeScaling: false, opacity: x % 1 ? 0.4 : 0.9 }));
        if (x > 0 && x <= cut.width / UPI) g.addChild(new paper.PointText({ point: [X + 3, matRect.top + 16], content: String(x), fillColor: st.label, fontSize: 15, fontWeight: 'bold', fontFamily: 'AtkUI, sans-serif' }));
      }
      for (let y = Math.floor(matRect.top / UPI); y <= Math.ceil(matRect.bottom / UPI); y++) {
        const Y = y * UPI; if (Y < matRect.top || Y > matRect.bottom) continue;
        g.addChild(new paper.Path.Line({ from: [matRect.left, Y], to: [matRect.right, Y], strokeColor: st.grid, strokeWidth: 1, strokeScaling: false, opacity: 0.9 }));
        if (y > 0 && y <= cut.height / UPI) g.addChild(new paper.PointText({ point: [matRect.left + 4, Y + 16], content: String(y), fillColor: st.label, fontSize: 15, fontWeight: 'bold', fontFamily: 'AtkUI, sans-serif' }));
      }
      for (let x = 0.5; x < cut.width / UPI; x += 1) g.addChild(new paper.Path.Line({ from: [x * UPI, matRect.top], to: [x * UPI, matRect.bottom], strokeColor: st.grid, strokeWidth: 1, strokeScaling: false, opacity: 0.25 }));
      for (let y = 0.5; y < cut.height / UPI; y += 1) g.addChild(new paper.Path.Line({ from: [matRect.left, y * UPI], to: [matRect.right, y * UPI], strokeColor: st.grid, strokeWidth: 1, strokeScaling: false, opacity: 0.25 }));
      new paper.Path.Rectangle({ rectangle: cut, strokeColor: st.label, strokeWidth: 1, dashArray: [5, 4], strokeScaling: false, opacity: 0.8 });
      L.locked = true; this.design.activate();
      this.matStyle = st;
    }

    // ---------- view ----------
    zoomTo(rect, padding = 40) {
      if (!rect || !rect.width || !rect.height) return;
      const vs = this.view.viewSize; if (!vs.width || !vs.height) return;
      const z = Math.min((vs.width - padding * 2) / rect.width, (vs.height - padding * 2) / rect.height);
      this.view.zoom = U.clamp(z, 0.05, 80); this.view.center = rect.center; this.emit('view');
    }
    zoomFitMat() { this.zoomTo(this.matArea().expand(0.9 * UPI)); }
    zoomFitSelection() { const b = this.selectionBounds() || this.contentBounds(); if (b) this.zoomTo(b.expand(0.3 * UPI)); }
    zoomBy(f, at) {
      const v = this.view; const old = v.zoom; const nz = U.clamp(old * f, 0.05, 80);
      at = at || v.center; v.zoom = nz; v.center = at.add(v.center.subtract(at).multiply(old / nz)); this.emit('view');
    }
    contentBounds() { const it = this.designItems().filter(i => i.visible); return it.length ? it.map(i => i.bounds).reduce((a, b) => a.unite(b)) : null; }

    // ---------- selection ----------
    topLevel(item) { while (item && item.parent && item.parent !== this.design) { if (item.layer !== this.design) return null; item = item.parent; } return item && item.parent === this.design ? item : null; }
    select(items, additive = false) {
      items = (items || []).map(i => this.topLevel(i)).filter(Boolean).filter(i => !i.locked);
      if (additive) { const s = new Set(this.selection); items.forEach(i => s.has(i) ? s.delete(i) : s.add(i)); this.selection = [...s]; }
      else this.selection = [...new Set(items)];
      this.refreshSelection();
    }
    clearSelection() { this.select([]); }
    selectAll() { this.select(this.designItems().filter(i => i.visible && !i.locked)); }
    selectionBounds() { const s = this.selection.filter(i => i.parent); return s.length ? s.map(i => i.bounds).reduce((a, b) => a.unite(b)) : null; }
    refreshSelection() { this.selection = this.selection.filter(i => i.parent === this.design); this.emit('selection', this.selection); }
    hitTest(pt, opts = {}) {
      const tol = (opts.tolerance || 4) / this.view.zoom;
      const res = this.project.hitTest(pt, { fill: true, stroke: true, tolerance: tol, match: h => h.item.layer === this.design && this.topLevel(h.item) && !this.topLevel(h.item).locked });
      if (res) return res;
      // fall back to items whose interior contains the point (e.g. unfilled text counters)
      return null;
    }
    itemsInRect(rect) { return this.designItems().filter(i => i.visible && !i.locked && i.bounds.intersects(rect)); }

    // ---------- basic ops ----------
    add(item, opts = {}) {
      if (item.parent !== this.design) this.design.addChild(item);
      if (opts.select !== false) this.select([item]);
      return item;
    }
    deleteSelection() { if (!this.selection.length) return; this.selection.forEach(i => i.remove()); this.selection = []; this.commit('Delete'); }
    duplicate() {
      if (!this.selection.length) return;
      const off = new paper.Point(0.125 * UPI, 0.125 * UPI);
      const copies = this.selection.map(i => { const c = i.clone(); c.translate(off); return c; });
      this.select(copies); this.commit('Duplicate');
    }
    copy() { if (!this.selection.length) return false; this.clipboard = this.selection.map(i => CI.exporter.itemToJSON(i)); return true; }
    cut() { if (this.copy()) this.deleteSelection(); }
    paste() {
      if (!this.clipboard) return;
      this.design.activate();
      const items = this.clipboard.map(j => this.project.importJSON(j)).filter(Boolean).map(i => CI.exporter.restoreData(i));
      items.forEach(i => { if (i.parent !== this.design) this.design.addChild(i); i.translate(new paper.Point(0.125 * UPI, 0.125 * UPI)); });
      this.clipboard = items.map(i => CI.exporter.itemToJSON(i));
      this.select(items); this.commit('Paste');
    }
    group() {
      if (this.selection.length < 2) return;
      const items = this.sortedSelection(); const top = items[items.length - 1];
      const g = new paper.Group(); g.insertAbove(top); g.addChildren(items); g.data = { name: 'Group' };
      this.select([g]); this.commit('Group');
    }
    ungroup() {
      const out = [];
      this.selection.forEach(i => {
        if (i.data && i.data.type === 'text') { const o = CI.text.toOutlines(i); o.insertAbove(i); i.remove(); if (o.className === 'Group') { out.push(...o.children.slice()); this._release(o); } else out.push(o); return; }
        if (i.className === 'Group') { out.push(...i.children.slice()); this._release(i); }
        else out.push(i);
      });
      this.select(out); this.commit('Ungroup');
    }
    _release(g) { const kids = g.children.slice(); kids.forEach(k => { k.transform(g.matrix); }); g.parent.insertChildren(g.index, kids); g.remove(); }
    sortedSelection() { return this.selection.slice().sort((a, b) => a.index - b.index); }
    arrange(how) {
      const s = this.sortedSelection(); if (!s.length) return;
      if (how === 'front') s.forEach(i => i.bringToFront());
      if (how === 'back') s.slice().reverse().forEach(i => i.sendToBack());
      if (how === 'forward') s.slice().reverse().forEach(i => { const n = i.nextSibling; if (n && !s.includes(n)) i.insertAbove(n); });
      if (how === 'backward') s.forEach(i => { const p = i.previousSibling; if (p && !s.includes(p)) i.insertBelow(p); });
      this.commit('Arrange');
    }
    flip(axis) { const b = this.selectionBounds(); if (!b) return; this.selection.forEach(i => i.scale(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1, b.center)); this.commit('Flip'); }
    rotateSelection(deg) { const b = this.selectionBounds(); if (!b) return; this.selection.forEach(i => { i.rotate(deg, b.center); i.data.rot = (((i.data.rot || 0) + deg) % 360 + 360) % 360; }); this.commit('Rotate'); }
    nudge(dx, dy) { if (!this.selection.length) return; this.selection.forEach(i => i.translate(new paper.Point(dx, dy))); this.commit('Nudge'); }
    /** Set the selection's bounds (units). Any field may be null to keep. */
    setBounds({ x, y, w, h }, keepRatio = false) {
      const b = this.selectionBounds(); if (!b) return;
      let sx = 1, sy = 1;
      if (w != null && b.width > 0) sx = w / b.width; if (h != null && b.height > 0) sy = h / b.height;
      if (keepRatio) { if (w != null && h == null) sy = sx; else if (h != null && w == null) sx = sy; }
      if (sx !== 1 || sy !== 1) this.selection.forEach(i => i.scale(sx, sy, b.topLeft));
      const nb = this.selectionBounds();
      const tx = x != null ? x - nb.x : 0, ty = y != null ? y - nb.y : 0;
      if (tx || ty) this.selection.forEach(i => i.translate(new paper.Point(tx, ty)));
      this.commit('Transform');
    }
    setFill(color) {
      this.fill = color || this.fill;
      const apply = (it) => {
        if (it.data && it.data.type === 'text') { CI.text.rebuild(it, { color }); return; }
        if (CI.geom.isPathLike(it)) { it.fillColor = color; return; }
        if (it.children) it.children.forEach(apply);
      };
      this.selection.forEach(apply); this.commit('Fill');
    }
    setStroke(color, width) {
      const apply = (it) => {
        if (CI.geom.isPathLike(it)) { it.strokeColor = color; if (width != null) it.strokeWidth = width; it.strokeScaling = true; return; }
        if (it.children && !(it.data && it.data.type === 'text')) it.children.forEach(apply);
      };
      this.selection.forEach(apply); this.commit('Stroke');
    }
    setVisible(item, v) { item.visible = v; if (!v) this.selection = this.selection.filter(i => i !== item); this.commit(v ? 'Show' : 'Hide'); }
    setLocked(item, v) { item.locked = v; if (v) this.selection = this.selection.filter(i => i !== item); this.commit(v ? 'Lock' : 'Unlock'); }
    rename(item, name) { item.data.name = name; this.commit('Rename'); }
    itemName(i) {
      if (i.data && i.data.name) return i.data.name;
      if (i.className === 'Raster') return 'Image';
      if (i.className === 'CompoundPath') return 'Compound path';
      if (i.className === 'Group') return 'Group';
      return 'Path';
    }
    itemColor(i) {
      if (i.className === 'Raster') return null;
      const leaves = CI.geom.leafPaths(i); return leaves.length ? CI.geom.cutColor(leaves[0]) : null;
    }

    // ---------- shapes ----------
    makeShape(kind, rect, opts = {}) {
      let p;
      const fill = { fillColor: opts.fill || this.fill, insert: false };
      if (kind === 'rect') p = new paper.Path.Rectangle(Object.assign({ rectangle: rect, radius: opts.radius || 0 }, fill));
      else if (kind === 'ellipse') p = new paper.Path.Ellipse(Object.assign({ rectangle: rect }, fill));
      else if (kind === 'polygon') { p = new paper.Path.RegularPolygon(Object.assign({ center: rect.center, sides: opts.sides || 6, radius: Math.max(rect.width, rect.height) / 2 }, fill)); p.fitBounds(rect); }
      else if (kind === 'star') { const R = Math.max(rect.width, rect.height) / 2; p = new paper.Path.Star(Object.assign({ center: rect.center, points: opts.points || 5, radius1: R * (opts.inner || 0.45), radius2: R }, fill)); p.fitBounds(rect); }
      else if (kind === 'line') { p = new paper.Path.Line({ from: opts.from, to: opts.to, strokeColor: opts.fill || this.fill, strokeWidth: opts.strokeWidth || 0.125 * UPI, strokeCap: 'round', insert: false }); }
      p.data = { name: { rect: 'Rectangle', ellipse: 'Ellipse', polygon: 'Polygon', star: 'Star', line: 'Line' }[kind] };
      return p;
    }
    addText(params, at) {
      const g = CI.text.create(Object.assign({ color: this.fill }, params), at);
      this.add(g); this.commit('Text'); return g;
    }
    updateText(item, params) { if (!item || !item.data || item.data.type !== 'text') return; CI.text.rebuild(item, params); this.commit('Edit text'); }
    selectedText() { return this.selection.length === 1 && this.selection[0].data && this.selection[0].data.type === 'text' ? this.selection[0] : null; }
    selectedRaster() { return this.selection.length === 1 && this.selection[0].className === 'Raster' ? this.selection[0] : null; }

    convertToOutlines() {
      const out = [];
      this.selection.forEach(i => { if (i.data && i.data.type === 'text') { const o = CI.text.toOutlines(i); o.insertAbove(i); i.remove(); out.push(o); } else out.push(i); });
      this.select(out); this.commit('Convert to outlines');
    }
    /** Bake text groups into outlines in place (used before destructive fixes). */
    _bakeText(items) {
      return items.map(i => { if (i.data && i.data.type === 'text') { const o = CI.text.toOutlines(i); o.insertAbove(i); i.remove(); return o; } return i; });
    }

    // ---------- pathfinder ----------
    /** One merged global path per selected item (groups/text merged), bottom → top. */
    _shapeOf(item) {
      const leaves = CI.geom.leafPaths(item).map(p => { const g = CI.geom.globalCopy(p); return (!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g; });
      if (!leaves.length) return null;
      const s = leaves.length === 1 ? leaves[0] : CI.geom.uniteAll(leaves);
      s.fillColor = CI.geom.cutColor(CI.geom.leafPaths(item)[0]);
      return s;
    }
    pathfinder(op) {
      const items = this.sortedSelection().filter(i => i.className !== 'Raster');
      if (items.length < 2) { this.toast('Select two or more shapes for ' + op + '.', 'warn'); return false; }
      const shapes = items.map(i => this._shapeOf(i)).filter(Boolean);
      const res = CI.geom.boolean(shapes, op); if (!res) return false;
      const topColor = shapes[shapes.length - 1].fillColor, baseColor = shapes[0].fillColor;
      const results = res.filter(r => r && Math.abs(r.area) > 0.01);
      results.forEach(r => { if (op === 'unite' || op === 'intersect' || op === 'exclude') r.fillColor = op === 'unite' ? topColor : topColor; if (op === 'subtract') r.fillColor = baseColor; r.strokeColor = null; });
      const anchor = items[0];
      results.forEach((r, i) => { r.data = { name: { unite: 'Welded shape', subtract: 'Minus front', intersect: 'Intersection', exclude: 'Excluded shape', divide: 'Piece ' + (i + 1) }[op] }; r.insertAbove(anchor); });
      items.forEach(i => i.remove());
      if (!results.length) this.toast('The result was empty — those shapes don’t overlap.', 'warn');
      this.select(results); this.commit({ unite: 'Weld', subtract: 'Minus front', intersect: 'Intersect', exclude: 'Exclude', divide: 'Divide' }[op]);
      return true;
    }
    makeCompound() {
      const items = this.sortedSelection().filter(i => CI.geom.isPathLike(i));
      if (items.length < 2) return;
      const cp = new paper.CompoundPath({ insert: false }); items.forEach(i => CI.geom.subpaths(i).forEach(s => cp.addChild(CI.geom.globalCopy(s))));
      cp.fillColor = items[items.length - 1].fillColor; cp.fillRule = 'evenodd'; cp.data = { name: 'Compound path' };
      cp.insertAbove(items[items.length - 1]); items.forEach(i => i.remove()); this.select([cp]); this.commit('Make compound');
    }
    releaseCompound() {
      const out = [];
      this.selection.forEach(i => {
        if (i.className !== 'CompoundPath') { out.push(i); return; }
        const kids = i.children.slice().map(k => { const c = k.clone({ insert: false }); c.fillColor = i.fillColor; c.strokeColor = i.strokeColor; c.strokeWidth = i.strokeWidth; return c; });
        kids.forEach(k => { k.insertAbove(i); out.push(k); }); i.remove();
      });
      this.select(out); this.commit('Release compound');
    }
    /** Offset/contour. dist in units (+ grows). keep original; fillHoles makes a sticker-style solid outline. */
    offsetSelection(dist, opts = {}) {
      const items = this.sortedSelection(); if (!items.length) return [];
      const made = [];
      const group = opts.combine !== false && items.length > 1;
      const sets = group ? [items] : items.map(i => [i]);
      for (const set of sets) {
        const paths = []; set.forEach(i => CI.geom.leafPaths(i).forEach(p => { const g = CI.geom.globalCopy(p); paths.push((!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g); }));
        if (!paths.length) continue;
        const r = CI.geom.rasterOffset(paths, dist, { fillHoles: !!opts.fillHoles, tolerance: opts.tolerance || 0.8 });
        r.fillColor = opts.color || CI.geom.cutColor(paths[0]); r.data = { name: dist >= 0 ? 'Offset outline' : 'Inset' };
        if (opts.keep === false) { r.insertAbove(set[set.length - 1]); set.forEach(i => i.remove()); }
        else if (dist >= 0) r.insertBelow(set[0]); else r.insertAbove(set[set.length - 1]);
        made.push(r);
      }
      this.select(made); this.commit('Offset'); return made;
    }
    outlineStrokeSelection() {
      const out = [];
      this.selection.forEach(i => {
        if (CI.geom.isPathLike(i) && i.strokeColor && i.strokeWidth > 0) {
          const o = CI.geom.outlineStroke(CI.geom.globalCopy(i)); o.data = { name: 'Outlined stroke' };
          if (i.fillColor) {
            const f = CI.geom.globalCopy(i); f.strokeColor = null;
            let res;
            if (U.colorHex(i.fillColor) === U.colorHex(i.strokeColor)) { res = CI.geom.uniteAll([f, o]); res.fillColor = i.fillColor; }
            else { res = new paper.Group({ children: [f, o], insert: false }); res.data = { name: 'Fill + outlined stroke' }; }
            res.insertAbove(i); i.remove(); out.push(res);
          }
          else { o.insertAbove(i); i.remove(); out.push(o); }
        } else out.push(i);
      });
      this.select(out); this.commit('Outline stroke');
    }
    smoothSelection(tolIn = 0.01) {
      const tol = tolIn * UPI; let before = 0, after = 0;
      const items = this._bakeText(this.selection);
      const done = items.map(i => {
        const leaves = CI.geom.leafPaths(i);
        leaves.forEach(p => { before += CI.geom.nodeCount(p); const s = CI.geom.smoothPath(p, tol); after += CI.geom.nodeCount(s); s.insertAbove(p); p.remove(); });
        return i.parent ? i : null;
      }).filter(Boolean);
      this.select(done.length ? done : items.filter(i => i.parent));
      this.commit('Smooth');
      return { before, after };
    }

    // ---------- align ----------
    align(mode) {
      const items = this.selection; if (!items.length) return;
      const ref = items.length === 1 ? this.matArea() : this.selectionBounds();
      items.forEach(i => {
        const b = i.bounds; let dx = 0, dy = 0;
        if (mode === 'left') dx = ref.left - b.left; if (mode === 'hcenter') dx = ref.center.x - b.center.x; if (mode === 'right') dx = ref.right - b.right;
        if (mode === 'top') dy = ref.top - b.top; if (mode === 'vcenter') dy = ref.center.y - b.center.y; if (mode === 'bottom') dy = ref.bottom - b.bottom;
        i.translate(new paper.Point(dx, dy));
      });
      this.commit('Align ' + mode);
    }
    distribute(axis) {
      const items = this.selection.slice(); if (items.length < 3) { this.toast('Select three or more objects to distribute.', 'warn'); return; }
      const k = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'width' : 'height';
      items.sort((a, b) => a.bounds[k] - b.bounds[k]);
      const first = items[0].bounds, last = items[items.length - 1].bounds;
      const total = items.reduce((s, i) => s + i.bounds[size], 0);
      const gap = ((last[k] + last[size]) - first[k] - total) / (items.length - 1);
      let pos = first[k] + first[size] + gap;
      for (let n = 1; n < items.length - 1; n++) { const b = items[n].bounds; items[n].translate(axis === 'h' ? new paper.Point(pos - b.x, 0) : new paper.Point(0, pos - b.y)); pos += b[size] + gap; }
      this.commit('Distribute');
    }
    fitToMat() {
      const items = this.selection.length ? this.selection : this.designItems().filter(i => i.visible);
      if (!items.length) return;
      const b = items.map(i => i.bounds).reduce((a, c) => a.unite(c)); const area = this.matArea().expand(-0.1 * UPI);
      const s = Math.min(1, area.width / b.width, area.height / b.height);
      items.forEach(i => { i.scale(s, b.topLeft); });
      const nb = items.map(i => i.bounds).reduce((a, c) => a.unite(c));
      items.forEach(i => i.translate(area.topLeft.subtract(nb.topLeft)));
      this.commit('Fit to mat');
    }

    // ---------- images ----------
    async importImageURL(url, name = 'Image') {
      let img = await U.loadImage(url);
      const maxPx = 4.2e6; let w = img.naturalWidth, h = img.naturalHeight;
      if (w * h > maxPx) { const id = U.imageToImageData(img, maxPx); url = U.imageDataToDataURL(id); img = await U.loadImage(url); w = id.width; h = id.height; this.toast('Large image scaled to ' + w + '×' + h + ' px for editing.', 'info'); }
      const key = this.assets.keyFor(url); this.assets.put(key, url);
      const r = new paper.Raster({ image: img, insert: false });
      await rasterReady(r);
      r.data = { name, assetKey: key, uid: U.uid('img') };
      // place: fit 6" box on the mat
      const box = 6 * UPI; const s = Math.min(box / w, box / h, 1.5);
      r.scale(s); const area = this.matArea(); r.position = new paper.Point(area.center.x, area.center.y);
      this.add(r); this.commit('Import image');
      return r;
    }
    rasterImageData(r) {
      if (!r || !r.width || !r.height) throw new Error('Image is still loading — try again in a moment.');
      return r.getImageData(new paper.Rectangle(0, 0, r.width, r.height));
    }
    async setRasterImageData(r, id, label) {
      const url = U.imageDataToDataURL(id);
      const key = this.assets.keyFor(url); this.assets.put(key, url);
      const m = r.matrix.clone();
      const img = await U.loadImage(url);   // fully decoded first, so the raster is never half-swapped
      r.image = img; r.matrix = m;
      r.data = Object.assign({}, r.data, { assetKey: key });
      if (label) this.commit(label);
      this.emit('raster', r);
      return r;
    }
    pixelAt(r, pt) { const l = r.globalToLocal(pt); return { x: Math.floor(l.x + r.width / 2), y: Math.floor(l.y + r.height / 2) }; }
    async removeBackground(r, tol = 12) {
      const id = this.rasterImageData(r); const m = CI.imageops.detectBackground(id, tol);
      const n = CI.mask.count(m);
      await this.setRasterImageData(r, CI.imageops.clearMask(id, m), 'Remove background');
      return n;
    }
    async eraseAt(r, pt, tol = 12, contiguous = true) {
      const id = this.rasterImageData(r); const p = this.pixelAt(r, pt);
      if (p.x < 0 || p.y < 0 || p.x >= id.width || p.y >= id.height) return 0;
      const m = CI.imageops.selectSimilar(id, p.x, p.y, tol, contiguous);
      await this.setRasterImageData(r, CI.imageops.clearMask(id, m), 'Erase color');
      return CI.mask.count(m);
    }
    async keepColorAt(r, pt, tol = 12) {
      const id = this.rasterImageData(r); const p = this.pixelAt(r, pt);
      const m = CI.imageops.selectSimilar(id, p.x, p.y, tol, false);
      await this.setRasterImageData(r, CI.imageops.keepMask(id, m), 'Keep color');
    }
    async cleanRasterEdges(r, opts) {
      const id = this.rasterImageData(r); const { image } = CI.imageops.cleanEdges(id, opts);
      await this.setRasterImageData(r, image, 'Clean edges');
      return CI.imageops.softPixelCount(image);
    }
    rasterStats(r) {
      if (!r || !r.width || !r.height) return { width: 0, height: 0, soft: 0, clearPct: 0, dpi: 0 };
      const id = this.rasterImageData(r); let clear = 0; for (let i = 3; i < id.data.length; i += 4) if (id.data[i] === 0) clear++;
      return { width: id.width, height: id.height, soft: CI.imageops.softPixelCount(id), clearPct: clear / (id.width * id.height), dpi: id.width / (r.bounds.width / UPI) };
    }
    _traceLayers(r, opts, fitTo) {
      const id = this.rasterImageData(r);
      const layers = CI.trace.traceImage(id, opts);
      let M = r.globalMatrix.clone().translate(-r.width / 2, -r.height / 2);
      // live trace that was moved/resized since it was made: map the original placement onto where it is now
      const fit = fitTo && this._liveFit(fitTo); if (fit) M = fit.append(M);
      layers.forEach(l => { l.path.transform(M); });
      return layers;
    }
    /** Matrix mapping a live trace's original bounds (at trace time) to its current bounds. */
    _liveFit(item) {
      const t = item.data && item.data.trace; if (!t || !t.b0) return null;
      const b0 = new paper.Rectangle(t.b0[0], t.b0[1], t.b0[2], t.b0[3]), b = item.bounds;
      if (!b0.width || !b0.height) return null;
      return new paper.Matrix().translate(b.x, b.y).scale(b.width / b0.width, b.height / b0.height).translate(-b0.x, -b0.y);
    }
    /** view: 'result' (filled + cut lines), 'outlines' (cut lines only), 'source' (just the image). */
    previewTrace(r, opts, view = 'result', fitTo = null) {
      this.clearPreview();
      if (view === 'source') { if (fitTo) { const k = new paper.Path.Rectangle({ rectangle: fitTo.bounds.expand(2), fillColor: new paper.Color(0, 0, 0, 0), insert: false }); this.preview.addChild(k); } return { colors: 0, nodes: 0, layers: [], source: true }; }
      const layers = this._traceLayers(r, opts, fitTo);
      const area = fitTo ? fitTo.bounds : r.bounds;
      this.preview.addChild(new paper.Path.Rectangle({ rectangle: area.expand(3), fillColor: '#fbfaf7', insert: false }));
      layers.forEach(l => {
        if (view !== 'outlines') { l.path.opacity = 0.9; this.preview.addChild(l.path); }
        const o = l.path.clone({ insert: false }); o.fillColor = null; o.opacity = 1; o.strokeColor = view === 'outlines' ? '#1b1b1b' : '#ff3d7f'; o.strokeWidth = 1; o.strokeScaling = false; this.preview.addChild(o);
      });
      const nodes = layers.reduce((s, l) => s + CI.geom.nodeCount(l.path), 0);
      return { colors: layers.length, nodes, layers: layers.map(l => ({ color: l.color, nodes: CI.geom.nodeCount(l.path) })) };
    }
    /** Hidden source image of a live trace (or null). */
    traceSource(item) {
      const t = item && item.data && item.data.trace; if (!t) return null;
      return this.design.getItems({ class: paper.Raster }).find(r => r.data && r.data.uid === t.src) || null;
    }
    liveTrace() { const i = this.selection.length === 1 ? this.selection[0] : null; return i && i.data && i.data.trace ? i : null; }
    /** Re-run a live trace with new settings, keeping its current position and size. */
    retrace(item, opts, ui) {
      const src = this.traceSource(item);
      if (!src) { this.toast('The source image for this trace is gone, so it can’t be re-traced.', 'warn'); return null; }
      const layers = this._traceLayers(src, opts, item);
      if (!layers.length) { this.toast('Nothing to trace with those settings.', 'warn'); return null; }
      const fit = this._liveFit(item);
      const result = this._wrapTrace(layers);
      result.data.trace = { src: item.data.trace.src, opts: cleanOpts(opts), ui: ui || item.data.trace.ui };
      result.insertAbove(item); item.remove();
      this._refreshB0(result, fit);
      this.select([result]); this.commit('Re-trace');
      return result;
    }
    _refreshB0(result, fit) {
      // store b0 as "where this result would sit at the image's own placement", so _liveFit maps it to where it is now
      if (!fit) { const b = result.bounds; result.data.trace.b0 = [b.x, b.y, b.width, b.height]; return; }
      const inv = fit.inverted(); const b = result.bounds; const tl = inv.transform(b.topLeft), br = inv.transform(b.bottomRight);
      result.data.trace.b0 = [Math.min(tl.x, br.x), Math.min(tl.y, br.y), Math.abs(br.x - tl.x), Math.abs(br.y - tl.y)];
    }
    /** Expand: finalize the paths — drop the live link and delete the hidden source image. */
    expandTrace(item) {
      const t = item && item.data && item.data.trace; if (!t) return false;
      const src = this.traceSource(item); delete item.data.trace;
      const stillUsed = src && this.designItems().some(i => i !== item && i.data && i.data.trace && i.data.trace.src === t.src);
      if (src && !stillUsed) src.remove();
      this.select([item]); this.commit('Expand trace'); return true;
    }
    _wrapTrace(layers) {
      layers.forEach(l => { l.path.data = { name: 'Traced ' + l.color }; l.path.opacity = 1; });
      if (layers.length === 1) { const r = layers[0].path; r.data.name = 'Traced shape'; return r; }
      const g = new paper.Group({ children: layers.map(l => l.path), insert: false }); g.data = { name: `Traced (${layers.length} colors)` }; return g;
    }
    // ---------- trace colors (merge / recolor / delete) ----------
    traceParts(item) { return item.className === 'Group' ? item.children.filter(c => CI.geom.isPathLike(c)) : (CI.geom.isPathLike(item) ? [item] : []); }
    recolorPart(item, idx, hex) { const p = this.traceParts(item)[idx]; if (!p) return; p.fillColor = hex; p.data.name = 'Traced ' + hex; this.commit('Recolor'); }
    deletePart(item, idx) {
      const parts = this.traceParts(item); const p = parts[idx]; if (!p) return;
      if (parts.length === 1) { item.remove(); this.selection = []; this.commit('Delete color'); return; }
      p.remove(); this._renameTrace(item); this.commit('Delete color');
    }
    /** Merge color `from` into color `to`: the shapes are welded into one cut layer with to's color. */
    mergePart(item, from, to) {
      const parts = this.traceParts(item); const a = parts[from], b = parts[to]; if (!a || !b || a === b) return;
      const u = CI.geom.uniteAll([b, a]); u.fillColor = b.fillColor; u.data = { name: 'Traced ' + CI.util.colorHex(b.fillColor) };
      u.insertAbove(b); a.remove(); b.remove(); this._renameTrace(item); this.commit('Merge colors');
    }
    _renameTrace(item) { if (item.className === 'Group') item.data.name = `Traced (${item.children.length} color${item.children.length === 1 ? '' : 's'})`; }
    clearPreview() { this.preview.removeChildren(); }
    trace(r, opts = {}, ui = null) {
      this.clearPreview();
      const layers = this._traceLayers(r, opts);
      if (!layers.length) { this.toast('Nothing to trace — try another mode or threshold.', 'warn'); return null; }
      const result = this._wrapTrace(layers);
      result.insertAbove(r);
      if (opts.keepImage === false) r.remove();
      else {
        // live trace: keep the image hidden and remember the settings so it can be re-traced later
        if (!r.data.uid) r.data.uid = U.uid('img');
        const b = result.bounds;
        result.data.trace = { src: r.data.uid, opts: cleanOpts(opts), ui: ui || null, b0: [b.x, b.y, b.width, b.height] };
        r.visible = false; if (!/\(traced\)$/.test(r.data.name || '')) r.data.name = (r.data.name || 'Image') + ' (traced)';
      }
      this.select([result]); this.commit('Trace image');
      return result;
    }
    // ---------- vintage distress ----------
    /**
     * Build distressed paths, one per cut color. Raster wear (spots/edges/cracks) is used only when those are on;
     * Edge texture is a vector wobble on top — so "texture only" keeps the exact letter shapes plus a fine wobble.
     * src: items to distress (default: selection). dpi lower for fast previews.
     */
    _distressBuild(opts, dpi, src) {
      const mat = this.material();
      const items = (src || this.selection).filter(i => i.className !== 'Raster' && !(i.data && i.data.weed));
      const byColor = new Map();
      const leaves = (it, out = []) => { if (CI.geom.isPathLike(it)) out.push(it); else if (it.children) it.children.forEach(c => leaves(c, out)); return out; };
      items.forEach(i => leaves(i).forEach(p => {
        const g = CI.geom.globalCopy(p); const q = (!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g;
        const c = CI.geom.cutColor(p); if (!byColor.has(c)) byColor.set(c, []); byColor.get(c).push(q);
      }));
      const raster = (opts.wear || 0) > 0 || (opts.rough || 0) > 0 || (opts.cracks || 0) > 0;
      const out = [];
      for (const [color, paths] of byColor) {
        let cp;
        if (raster) {
          const b = paths.map(p => p.bounds).reduce((a, c) => a.unite(c));
          const ppu = CI.geom.pickPPU(b, dpi, 6e6);
          const r = CI.geom.rasterize(paths, b, ppu, { pad: 4 });
          const m = CI.distress.apply(r.mask, Object.assign({}, opts, { ppi: ppu * UPI, origin: { x: r.origin.x / UPI, y: r.origin.y / UPI } }), mat);
          const loops = CI.trace.traceLoops(m, { minArea: 4 });
          if (!loops.length) continue;
          cp = CI.trace.loopsToCompound(loops, { tolerance: opts.smooth != null ? opts.smooth : 0.9, scale: 1 / ppu, offset: r.origin });
        } else cp = paths.length === 1 ? paths[0].clone({ insert: false }) : CI.geom.uniteAll(paths);
        cp.fillColor = color;
        if ((opts.texture || 0) > 0) cp = CI.distress.wobble(cp, opts, mat);
        cp.fillColor = color; cp.strokeColor = null; cp.data = { name: 'Distressed ' + color };
        out.push({ color, path: cp, original: paths });
      }
      return out;
    }
    /** Originals behind a live distress result (hidden), or null. */
    distressSources(item) {
      const d = item && item.data && item.data.distress; if (!d) return null;
      const all = this.designItems(); const src = d.srcs.map(u => all.find(i => i.data && i.data.uid === u)).filter(Boolean);
      return src.length ? src : null;
    }
    liveDistress() { const i = this.selection.length === 1 ? this.selection[0] : null; return i && i.data && i.data.distress ? i : null; }
    /** Run fn with hidden source items temporarily visible (leaf collection skips hidden items). */
    _withVisible(items, fn) { const was = items.map(i => i.visible); items.forEach(i => { i.visible = true; }); try { return fn(); } finally { items.forEach((i, k) => { i.visible = was[k]; }); } }
    previewDistress(opts) {
      this.clearPreview();
      const live = this.liveDistress(); const src = live ? this.distressSources(live) : null;
      const res = src ? this._withVisible(src, () => this._distressBuild(opts, 130, src)) : this._distressBuild(opts, 130);
      res.forEach(({ path, original }) => {
        original.forEach(o => { const k = o.clone({ insert: false }); k.fillColor = '#fbfaf7'; k.strokeColor = '#fbfaf7'; k.strokeWidth = 0.05 * UPI; k.strokeScaling = true; this.preview.addChild(k); });
        if (live) { const k = live.clone({ insert: false }); k.fillColor = '#fbfaf7'; k.strokeColor = '#fbfaf7'; k.strokeWidth = 0.05 * UPI; this.preview.addChild(k); }
        this.preview.addChild(path);
        const ln = path.clone({ insert: false }); ln.fillColor = null; ln.strokeColor = '#ff3d7f'; ln.strokeWidth = 1; ln.strokeScaling = false; this.preview.addChild(ln);
      });
      return { colors: res.length, nodes: res.reduce((s, r) => s + CI.geom.nodeCount(r.path), 0) };
    }
    distressSelection(opts, keepOriginal = true, ui = null) {
      this.clearPreview();
      // a live distress result re-distresses from its ORIGINAL artwork (never compounds on itself)
      const live = this.liveDistress(); if (live) return this.redistress(live, opts, ui);
      const items = this.sortedSelection().filter(i => i.className !== 'Raster' && !(i.data && i.data.weed));
      if (!items.length) { this.toast('Select text or shapes to distress.', 'warn'); return []; }
      const res = this._distressBuild(opts, opts.dpi || 250, items);
      if (!res.length) { this.toast('The distress removed everything — lower Wear.', 'warn'); return []; }
      const top = items[items.length - 1];
      const result = this._wrapDistress(res, top);
      if (keepOriginal) {
        items.forEach(i => { if (!i.data.uid) i.data.uid = U.uid('src'); i.visible = false; if (!/\(original\)$/.test(this.itemName(i))) i.data.name = this.itemName(i) + ' (original)'; });
        result.data.distress = { srcs: items.map(i => i.data.uid), opts: cleanDistress(opts), ui: ui || null };
      } else items.forEach(i => i.remove());
      this.select([result]); this.commit('Vintage distress');
      return res.map(r => r.path);
    }
    _wrapDistress(res, above) {
      const made = res.map(r => r.path);
      let result;
      if (made.length === 1) { result = made[0]; result.insertAbove(above); }
      else { result = new paper.Group({ insert: false }); result.insertAbove(above); result.addChildren(made); result.data = { name: 'Distressed design' }; }
      return result;
    }
    /** Re-run distress on a live result from its hidden originals (New pattern / changed sliders). */
    redistress(item, opts, ui) {
      const src = this.distressSources(item);
      if (!src) { this.toast('The original artwork for this distress is gone, so it can\u2019t be redone.', 'warn'); return []; }
      const res = this._withVisible(src, () => this._distressBuild(opts, opts.dpi || 250, src));
      if (!res.length) { this.toast('That setting removes everything — lower Wear.', 'warn'); return []; }
      const result = this._wrapDistress(res, item);
      result.data.distress = { srcs: item.data.distress.srcs, opts: cleanDistress(opts), ui: ui || item.data.distress.ui };
      item.remove(); this.select([result]); this.commit('Re-distress');
      return res.map(r => r.path);
    }
    /** Remove distress: delete the result and bring the original artwork back. */
    removeDistress(item) {
      const src = this.distressSources(item); if (!src) return false;
      src.forEach(i => { i.visible = true; if (i.data.name) i.data.name = i.data.name.replace(/ \(original\)$/, ''); });
      item.remove(); this.select(src); this.commit('Remove distress'); return true;
    }

    /** Split a multi-color trace group into separate top-level layers (one per color). */
    separateColors() {
      const out = [];
      this.selection.forEach(i => { if (i.className === 'Group' && !(i.data && i.data.type === 'text')) { out.push(...i.children.slice()); this._release(i); } else out.push(i); });
      this.select(out); this.commit('Separate colors');
    }

    // ---------- cut check ----------
    scheduleCheck() { clearTimeout(this._checkTimer); this._checkTimer = setTimeout(() => this.runCutCheck(), this.opts.checkDelay != null ? this.opts.checkDelay : 600); }
    runCutCheck() {
      clearTimeout(this._checkTimer);
      try {
        const res = CI.cutcheck.run(this.designItems(), { material: this.material(), machine: this.doc.machine, mat: this.doc.mat, mirrorOnExport: this.doc.mirror });
        this.issues = res.issues; this.summary = res.summary;
      } catch (e) { console.error(e); this.issues = [{ severity: 'error', rule: 'internal', title: 'Cut check failed', detail: String(e.message || e), regions: [], items: [] }]; this.summary = { errors: 1, warnings: 0, infos: 0, ready: false }; }
      this.emit('issues', this.issues);
      if (this.doc.cutPreview) this.drawCutPreview();
      return { issues: this.issues, summary: this.summary };
    }
    clearHighlights() { this.overlay.removeChildren(); }
    highlightIssue(issue, zoom = true) {
      this.clearHighlights(); if (!issue) return;
      const regs = issue.regions || []; const z = this.view.zoom;
      regs.forEach(r => {
        const rect = new paper.Rectangle(r.x, r.y, r.w, r.h).expand(6 / z);
        this.overlay.addChild(new paper.Path.Rectangle({ rectangle: rect, radius: 4 / z, strokeColor: issue.severity === 'error' ? '#ff4b3e' : issue.severity === 'warning' ? '#ff8a2b' : '#3aa0ff', strokeWidth: 2, strokeScaling: false, fillColor: new paper.Color(1, 0.45, 0.1, 0.12), insert: false }));
      });
      if (zoom && regs.length) {
        const b = regs.map(r => new paper.Rectangle(r.x, r.y, r.w, r.h)).reduce((a, c) => a.unite(c));
        if (b.width < 3 * UPI && b.height < 3 * UPI) this.zoomTo(b.expand(1.0 * UPI)); else this.zoomTo(b.expand(0.3 * UPI));
        this.highlightIssue(issue, false);
      }
    }
    setCutPreview(on) { this.doc.cutPreview = on; this.design.opacity = on ? 0.18 : 1; if (on) this.drawCutPreview(); else this.overlay.children.filter(c => c.data.cutPreview).forEach(c => c.remove()); this.emit('doc'); }
    drawCutPreview() {
      this.overlay.children.filter(c => c.data.cutPreview).forEach(c => c.remove());
      const { layers } = CI.exporter.cutLayers(this.designItems(), { weld: this.doc.weld });
      layers.forEach(l => [l.path].concat(l.extras || []).forEach(p => { p.fillColor = null; p.strokeColor = l.color === '#ffffff' ? '#999' : l.color; p.strokeWidth = 1.25; p.strokeScaling = false; p.data = { cutPreview: true }; this.overlay.addChild(p); }));
    }

    /** Apply an automatic fix for an issue. Returns a short message. */
    applyFix(issue) {
      const mat = this.material(); const color = issue.color;
      const itemsOfColor = () => this.designItems().filter(i => i.visible && CI.geom.leafPaths(i).some(p => CI.geom.cutColor(p) === color));
      switch (issue.fix) {
        case 'mirror': this.doc.mirror = true; this.emit('doc'); this.commit('Mirror on'); return 'Mirror is on for export.';
        case 'fitmat': this.select(this.designItems().filter(i => i.visible)); this.fitToMat(); return 'Scaled to fit the mat.';
        case 'trace': { const r = (issue.items || [])[0]; if (r) { this.select([r]); this.emit('open-panel', 'image'); } return 'Open Trace in the Image panel.'; }
        case 'close': (issue.items || []).forEach(i => { if (i.className === 'Path') i.closed = true; }); this.commit('Close path'); return 'Path closed.';
        case 'smooth': { this.select(itemsOfColor()); const r = this.smoothSelection(issue.rule === 'complex' ? 0.015 : 0.01); return `Smoothed: ${r.before} → ${r.after} nodes.`; }
        case 'weld': {
          let items = this._bakeText(itemsOfColor());
          const leaves = []; items.forEach(i => CI.geom.leafPaths(i).forEach(p => { if (CI.geom.cutColor(p) === color) leaves.push(p); }));
          const copies = leaves.map(p => { const g = CI.geom.globalCopy(p); return (!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g; });
          const u = CI.geom.uniteAll(copies); u.fillColor = color; u.strokeColor = null; u.data = { name: 'Welded ' + color };
          const top = leaves.reduce((a, b) => (this.topLevel(b).index > this.topLevel(a).index ? b : a));
          u.insertAbove(this.topLevel(top)); leaves.forEach(p => p.remove()); this._pruneEmpty();
          this.select([u]); this.commit('Weld ' + color); return 'Welded into one shape.';
        }
        case 'removesmall': case 'fillholes': {
          const items = this._bakeText(itemsOfColor()); let removed = 0; const a = UPI * UPI;
          items.forEach(i => CI.geom.leafPaths(i).forEach(p => {
            if (CI.geom.cutColor(p) !== color) return;
            if (issue.fix === 'removesmall' && Math.abs(p.area) < mat.minPiece * a && p.className === 'Path') { p.remove(); removed++; return; }
            const r = CI.geom.removeSmallParts(p, issue.fix === 'removesmall' ? mat.minPiece * a : 0, issue.fix === 'fillholes' ? mat.minHole * a : 0);
            if (r.removed) { removed += Math.max(0, r.removed); r.path.insertAbove(p); p.remove(); }
          }));
          this._pruneEmpty(); this.commit(issue.fix === 'removesmall' ? 'Remove tiny pieces' : 'Fill tiny holes');
          return removed ? `${removed} removed. Re-check: very tiny raster-only specks may need a re-trace with more despeckle.` : 'Nothing small enough to remove as a separate path — re-trace with higher despeckle, or smooth.';
        }
        case 'thicken': { const n = this.thickenThin(color); return n ? `Expanded ${n} thin area(s) to at least ${CI.cutcheck.fmtFrac(mat.minFeature)} — the rest is untouched.` : 'Nothing to expand.'; }
        case 'weedupdate': { this.updateWeedBoxes(); return 'Weed box updated around the design.'; }
      }
      return 'No automatic fix — adjust by hand.';
    }
    _pruneEmpty() {
      const prune = (g) => { if (g.className !== 'Group') return; g.children.slice().forEach(prune); if (!g.children.length) g.remove(); };
      this.designItems().forEach(prune);
    }
    /** Thicken only the parts thinner than the material minimum; everything else stays exactly as drawn. */
    thickenThin(color) {
      const r = this._thicken(color, null, null); if (!r.made) return 0;
      this.select([r.made]); this.commit('Expand thin parts'); return r.n;
    }
    /**
     * Grow every part of `color` thinner than widthIn (default: material minimum) up to that width.
     * scope: limit to these top-level items (default: whole design). Returns {made, n} without committing.
     */
    _thicken(color, scope, widthIn) {
      const mat = this.material(); const W = widthIn || mat.minFeature;
      const pool = (scope || this.designItems()).filter(i => i.visible && !(i.data && i.data.weed) && i.className !== 'Raster');
      let items = this._bakeText(pool.filter(i => CI.geom.leafPaths(i).some(p => CI.geom.cutColor(p) === color)));
      const leaves = []; items.forEach(i => CI.geom.leafPaths(i).forEach(p => { if (CI.geom.cutColor(p) === color) leaves.push(p); }));
      if (!leaves.length) return { made: null, n: 0 };
      const copies = leaves.map(p => { const g = CI.geom.globalCopy(p); return (!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g; });
      const b = copies.map(p => p.bounds).reduce((a, c) => a.unite(c)).expand(W * UPI * 2);
      const ppu = CI.geom.pickPPU(b, Math.max(300, 12 / W));
      const r = CI.geom.rasterize(copies, b, ppu, { pad: 4 });
      const rad = (W / 2) * UPI * ppu;
      const thin = CI.mask.sub(r.mask, CI.mask.dilate(CI.mask.open(r.mask, rad), Math.max(1, rad * 0.25)));
      const grow = CI.mask.dilate(thin, rad * 1.15);
      const loops = CI.trace.traceLoops(grow, { minArea: 4 });
      if (!loops.length) return { made: null, n: 0 };
      const extra = CI.trace.loopsToCompound(loops, { tolerance: 0.8, scale: 1 / ppu, offset: r.origin });
      const u = CI.geom.uniteAll(copies.concat([extra])); u.fillColor = color; u.strokeColor = null; u.data = { name: 'Expanded ' + color };
      const top = leaves.reduce((a, c) => (this.topLevel(c).index > this.topLevel(a).index ? c : a));
      u.insertAbove(this.topLevel(top)); leaves.forEach(p => p.remove()); this._pruneEmpty();
      return { made: u, n: loops.length };
    }
    /** Selection tool: expand every too-thin part of the selected shapes to at least widthIn (default: material minimum). */
    expandThinSelection(widthIn) {
      const sel = this.selection.filter(i => i.className !== 'Raster' && !(i.data && i.data.weed));
      if (!sel.length) { this.toast('Select shapes or text first.', 'warn'); return 0; }
      const colors = new Set(); sel.forEach(i => CI.geom.leafPaths(i).forEach(p => colors.add(CI.geom.cutColor(p))));
      let n = 0; const made = []; let scope = sel.slice();
      for (const c of colors) {
        const r = this._thicken(c, scope.filter(i => i.parent), widthIn);
        if (r.made) { made.push(r.made); n += r.n; scope.push(r.made); }
      }
      const keep = made.concat(scope.filter(i => i.parent && !made.includes(i)));
      this.select(keep.filter(i => i.parent));
      if (n) this.commit('Expand thin lines');
      return n;
    }
    /** Make the selection bolder: expand all edges outward by amountIn (inches). */
    bolderSelection(amountIn) {
      const sel = this.selection.filter(i => i.className !== 'Raster' && !(i.data && i.data.weed));
      if (!sel.length) { this.toast('Select shapes or text first.', 'warn'); return []; }
      this.select(sel);
      return this.offsetSelection(amountIn * UPI, { keep: false, combine: false });
    }

    // ---------- weed box & weeding lines ----------
    weedBoxes() { return this.designItems().filter(i => i.data && i.data.weed); }
    /** opts (inches): {margin, lines:'none'|'vertical'|'horizontal'|'both', spacing}. Targets the selection, or everything. */
    addWeedBox(opts = {}) {
      const o = Object.assign({ margin: 0.25, lines: 'vertical', spacing: 1 }, opts);
      const src = (this.selection.length ? this.selection : this.designItems()).filter(i => i.visible && i.className !== 'Raster' && !(i.data && i.data.weed));
      if (!src.length) { this.toast('Nothing to put a weed box around.', 'warn'); return []; }
      const byColor = new Map();
      src.forEach(i => CI.geom.leafPaths(i).forEach(p => { const c = CI.geom.cutColor(p); const g = CI.geom.globalCopy(p); if (!byColor.has(c)) byColor.set(c, []); byColor.get(c).push((!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g); }));
      const made = [];
      for (const [color, paths] of byColor) {
        this.weedBoxes().filter(w => w.data.color === color).forEach(w => w.remove());
        made.push(this._makeWeed(color, paths, o));
      }
      made.forEach(g => { g.data.sig = null; });
      this.select(made); this.commit('Weed box'); return made;
    }
    _makeWeed(color, paths, o) {
      const res = CI.weed.build(paths, { margin: o.margin * UPI, lines: o.lines, spacing: o.spacing * UPI });
      res.box.fillColor = null; res.box.strokeColor = color; res.box.strokeWidth = 1.5; res.box.strokeScaling = false; res.box.dashArray = [6, 3];
      res.lines.forEach(l => { l.fillColor = color; l.strokeColor = null; });
      const g = new paper.Group({ children: [res.box].concat(res.lines), insert: false });
      g.data = { weed: true, color, name: 'Weed box ' + color + (res.lines.length ? ` + ${res.lines.length} lines` : ''), opts: o };
      this.design.addChild(g); g.sendToBack();
      return g;
    }
    /** Rebuild every weed box around its color's current shapes (after moving/resizing the design). */
    updateWeedBoxes() { const n = this._syncWeed(true); if (n) this.commit('Update weed box'); return n; }
    _syncWeed(force) {
      const boxes = this.weedBoxes(); if (!boxes.length) return 0;
      // skip the rebuild when nothing it depends on moved
      const sig = (c) => { const ps = []; this.designItems().filter(i => i.visible && i.className !== 'Raster' && !(i.data && i.data.weed)).forEach(i => CI.geom.leafPaths(i).forEach(p => { if (CI.geom.cutColor(p) === c) ps.push(p); })); return ps.length ? ps.map(p => { const b = p.strokeBounds; return [b.x, b.y, b.width, b.height, p.id].map(v => Math.round(v * 100)).join(',') + ':' + (p.segments ? p.segments.length : p.children.length); }).join('|') : ''; };
      let n = 0;
      boxes.forEach(w => {
        const color = w.data.color, o = w.data.opts || {};
        const paths = []; this.designItems().filter(i => i.visible && i.className !== 'Raster' && !(i.data && i.data.weed)).forEach(i => CI.geom.leafPaths(i).forEach(p => { if (CI.geom.cutColor(p) === color) paths.push(CI.geom.globalCopy(p)); }));
        const sg = sig(color); if (!force && w.data.sig === sg) return;
        const idx = w.index; w.remove(); n++;
        if (paths.length) { const g = this._makeWeed(color, paths, Object.assign({ margin: 0.25, lines: 'vertical', spacing: 1 }, o)); g.data.sig = sg; if (idx < g.parent.children.length) g.insertBelow(g.parent.children[idx]); }
      });
      this.selection = this.selection.filter(i => i.parent); return n;
    }
    removeWeedBoxes() { const b = this.weedBoxes(); b.forEach(w => w.remove()); this.selection = this.selection.filter(i => i.parent); if (b.length) this.commit('Remove weed box'); return b.length; }

    // ---------- slice ----------
    _artOnly(list) { return list.filter(i => i.visible && !i.locked && i.className !== 'Raster' && !(i.data && (i.data.weed || i.data.reg))); }
    /** Replace one leaf path with pieces (keeps its place in the stacking order / group). */
    _replaceLeaf(leaf, pieces) {
      const parent = leaf.parent; const M = parent && parent !== this.design ? parent.globalMatrix.inverted() : null;
      pieces.forEach(p => { if (M) p.transform(M); p.fillColor = leaf.fillColor || leaf.strokeColor; p.strokeColor = null; p.data = { name: 'Slice of ' + (leaf.data && leaf.data.name || this.itemName(leaf)) }; p.insertAbove(leaf); });
      leaf.remove(); return pieces;
    }
    /** Cut every shape the knife strip crosses into separate pieces. Returns the pieces made. */
    _cutWith(knife, targets) {
      const made = [];
      this._bakeText(targets).forEach(t => {
        const leaves = CI.geom.isPathLike(t) ? [t] : CI.geom.leafPaths(t);
        leaves.forEach(leaf => {
          const g = CI.geom.globalCopy(leaf); const shape = (!leaf.fillColor && leaf.strokeColor) ? CI.geom.outlineStroke(g) : g;
          if (!shape.bounds.intersects(knife.bounds) || (!shape.intersects(knife) && !shape.contains(knife.interiorPoint) && !knife.contains(shape.interiorPoint))) return;
          const cut = shape.subtract(knife, { insert: false }); const pieces = CI.geom.splitIslands(cut).filter(p => Math.abs(p.area) > 0.5);
          if (pieces.length <= 1 && Math.abs(Math.abs(cut.area) - Math.abs(shape.area)) < 0.5) return;
          made.push(...this._replaceLeaf(leaf, pieces));
        });
      });
      this._pruneEmpty(); return made;
    }
    /** Knife tool: slice along the segment a→b with a gap (inches). Cuts the selection, or anything it crosses. */
    sliceLine(a, b, gapIn = 0.03) {
      const knife = CI.geom.strip(a, b, Math.max(0.005, gapIn) * UPI, 0); if (!knife) return [];
      const pool = this._artOnly(this.selection.length ? this.selection : this.designItems());
      const made = this._cutWith(knife, pool.filter(i => i.bounds.intersects(knife.bounds)));
      if (made.length) { this.select(made); this.commit('Slice'); } else this.toast('The line didn\u2019t cross any shape.', 'info');
      return made;
    }
    /** Pathfinder Slice: the TOP selected object is the cutter. A line/open path cuts like a knife; a closed shape splits inside/outside. */
    sliceWithTop(gapIn = 0.03) {
      const sel = this._artOnly(this.sortedSelection());
      if (sel.length < 2) { this.toast('Select the shapes to cut plus a line or shape on top to cut with.', 'warn'); return []; }
      const cutterItem = sel[sel.length - 1]; const targets = sel.slice(0, -1);
      const cl = CI.geom.leafPaths(cutterItem).map(CI.geom.globalCopy); if (!cl.length) return [];
      const openLine = cl.length === 1 && cl[0].className === 'Path' && (!cl[0].closed || (!cl[0].fillColor && cl[0].strokeColor));
      let made = [];
      if (openLine) {
        const line = cl[0].clone({ insert: false }); line.strokeWidth = Math.max(0.005, gapIn) * UPI; line.strokeColor = '#000'; line.fillColor = null; line.closed = false;
        const knife = CI.geom.outlineStroke(line); made = this._cutWith(knife, targets);
      } else {
        const cutter = cl.length === 1 ? cl[0] : CI.geom.uniteAll(cl);
        this._bakeText(targets).forEach(t => (CI.geom.isPathLike(t) ? [t] : CI.geom.leafPaths(t)).forEach(leaf => {
          const sh = CI.geom.globalCopy(leaf); if (!sh.bounds.intersects(cutter.bounds)) return;
          const parts = CI.geom.splitIslands(sh.intersect(cutter, { insert: false })).concat(CI.geom.splitIslands(sh.subtract(cutter, { insert: false }))).filter(p => Math.abs(p.area) > 0.5);
          if (parts.length > 1) made.push(...this._replaceLeaf(leaf, parts));
        }));
      }
      if (!made.length) { this.toast('Nothing was cut — the cutter must cross the shapes below it.', 'info'); return []; }
      cutterItem.remove(); this._pruneEmpty(); this.select(made); this.commit('Slice'); return made;
    }

    // ---------- stencil bridges ----------
    /**
     * Stencils: the middle of an O, A, R… (a hole in a cut shape) would fall out of the stencil sheet.
     * mode 'auto' | 'left' | 'right' | 'top' | 'bottom' (default): ONE bridge per middle, through the thinnest wall
     *   (or the chosen side) — every middle opens to the outside and every letter stays ONE connected piece.
     * mode 'across-v' | 'across-h': stencil-font look — a bar straight across each middle (splits the letter).
     */
    stencilBridges(widthIn, mode = 'auto') {
      if (mode === 'vertical') mode = 'across-v'; if (mode === 'horizontal') mode = 'across-h';
      const mat = this.material(); const W = (widthIn || Math.max(0.08, mat.minFeature * 1.6)) * UPI;
      const items = this._bakeText(this._artOnly(this.selection.length ? this.selection : this.designItems()));
      let bridges = 0, failed = 0, moved = 0; const made = [];
      items.forEach(t => (CI.geom.isPathLike(t) ? [t] : CI.geom.leafPaths(t)).forEach(leaf => {
        const sh = CI.geom.globalCopy(leaf); CI.geom.normalize(sh);
        const subs = CI.geom.subpaths(sh); const holes = subs.filter(x => x.area < 0); if (!holes.length) return;
        const outers = subs.filter(x => x.area > 0);
        const ownerOf = (h) => { const pts = [0, 0.5].map(f => h.getPointAt(h.length * f)); return outers.filter(x => x.bounds.expand(1).contains(h.bounds) && pts.some(p => x.contains(p))).sort((a, b) => Math.abs(a.area) - Math.abs(b.area))[0]; };
        let res;
        if (mode === 'across-v' || mode === 'across-h') {
          const cuts = holes.map(h => {
            let ip; try { ip = h.interiorPoint; } catch (e) { ip = h.bounds.center; }
            const ob = (ownerOf(h) || sh).bounds.expand(2);
            return mode === 'across-h' ? new paper.Path.Rectangle({ rectangle: new paper.Rectangle(ob.left, ip.y - W / 2, ob.width, W), insert: false })
              : new paper.Path.Rectangle({ rectangle: new paper.Rectangle(ip.x - W / 2, ob.top, W, ob.height), insert: false });
          });
          bridges += cuts.length;
          res = sh.subtract(cuts.length === 1 ? cuts[0] : CI.geom.uniteAll(cuts), { insert: false });
        } else {
          res = sh;
          for (const h of holes) {
            const owner = ownerOf(h); if (!owner) { failed++; continue; }
            // the chosen side first; if it can't reach the outside (e.g. the lower middle of a B from the top), the thinnest other wall
            const cands = this._bridgeCandidates(res, h, owner, W, mode).map(c => Object.assign(c, { alt: false }))
              .concat(mode === 'auto' ? [] : this._bridgeCandidates(res, h, owner, W, 'auto').map(c => Object.assign(c, { alt: true })));
            let ok = false;
            for (const c of cands) {
              // the cut must open THIS middle to the outside and must not split anything into extra pieces
              const before = CI.geom.splitIslands(res).length;
              const trial = res.subtract(CI.geom.strip(c.a, c.b, W), { insert: false });
              const after = CI.geom.splitIslands(trial);
              const stillClosed = CI.geom.subpaths(trial).some(x => x.area < 0 && x.bounds.intersects(h.bounds.expand(-1)) && x.contains(c.inside));
              if (after.length === before && !stillClosed) { res = trial; ok = true; bridges++; if (c.alt) moved++; break; }
            }
            if (!ok) failed++;
          }
        }
        const pieces = CI.geom.splitIslands(res).filter(p => Math.abs(p.area) > 0.5);
        made.push(...this._replaceLeaf(leaf, pieces));
      }));
      this._pruneEmpty();
      if (bridges) { this.select(made); this.commit('Stencil bridges'); }
      else if (!failed) this.toast('No enclosed middles found — nothing would fall out.', 'info');
      if (moved) this.toast(`${moved} middle(s) couldn\u2019t open on the ${mode} side, so they use their thinnest wall instead.`, 'info');
      if (failed) this.toast(`${failed} middle(s) couldn\u2019t be bridged without splitting a letter — try another side.`, 'warn');
      return bridges;
    }
    /** Possible single bridges for one hole: straight cuts from inside the hole, across the wall, to the outside. Sorted best first. */
    _bridgeCandidates(shape, hole, owner, W, mode) {
      const dirs = { left: new paper.Point(-1, 0), right: new paper.Point(1, 0), top: new paper.Point(0, -1), bottom: new paper.Point(0, 1) };
      const use = mode === 'auto' ? Object.keys(dirs) : [mode];
      const hb = hole.bounds; const out = [];
      use.forEach(k => {
        const d = dirs[k]; const horiz = d.y === 0;
        [0.5, 0.35, 0.65, 0.25, 0.75].forEach(f => {
          const p = horiz ? new paper.Point(hb.center.x, hb.top + hb.height * f) : new paper.Point(hb.left + hb.width * f, hb.center.y);
          if (!hole.contains(p)) return;
          const far = p.add(d.multiply(hb.width + hb.height + owner.bounds.width + owner.bounds.height));
          const ray = new paper.Path.Line({ from: p, to: far, insert: false });
          const hits = shape.getIntersections(ray).map(x => x.point.getDistance(p)).sort((a, b) => a - b);
          if (hits.length < 2) return;
          const d1 = hits[0], d2 = hits[1];
          const beyond = p.add(d.multiply(d2 + 1.5));
          if (owner.contains(beyond)) return;                       // would only reach another middle, not the outside
          // the strip must not clip the hole's corner on its way out: keep it inside the hole near the start
          // overshoot past the wall to open it cleanly — but never into a neighbouring letter (stop halfway across the gap)
          const over = hits.length > 2 ? Math.min(W, (hits[2] - d2) / 2) : W;
          const a = p.add(d.multiply(Math.max(0, d1 - W))), b = p.add(d.multiply(d2 + over));
          const wall = d2 - d1;
          const centered = Math.abs(f - 0.5);
          out.push({ a, b, wall, inside: p, score: wall * (1 + centered * 0.6) });
        });
      });
      return out.sort((x, y) => x.score - y.score);
    }

    // ---------- text effects ----------
    /** A solid outline layer behind the selection in another color, optionally shifted for a drop-shadow look. */
    effectOutline(offsetIn, color, shiftIn = 0) {
      const sel = this._artOnly(this.selection); if (!sel.length) { this.toast('Select text or shapes first.', 'warn'); return null; }
      this.select(sel);
      const made = this.offsetSelection(offsetIn * UPI, { fillHoles: true, keep: true, color, combine: true });
      made.forEach(m => { if (shiftIn) m.translate(new paper.Point(shiftIn * UPI, shiftIn * UPI)); m.data.name = shiftIn ? 'Shadow layer' : 'Outline layer'; });
      this.select(made.concat(sel)); this.commit('Outline layer'); return made[0] || null;
    }
    /** Knockout: a badge shape around the selection with the selection cut out of it (one piece to cut). */
    effectKnockout(shape = 'circle', padIn = 0.2, color = null) {
      const sel = this._artOnly(this.sortedSelection()); if (!sel.length) { this.toast('Select text or shapes first.', 'warn'); return null; }
      const art = []; sel.forEach(i => CI.geom.leafPaths(i).forEach(p => { const g = CI.geom.globalCopy(p); art.push((!p.fillColor && p.strokeColor) ? CI.geom.outlineStroke(g) : g); }));
      const b = art.map(p => p.bounds).reduce((a, c) => a.unite(c)); const pad = padIn * UPI;
      let base;
      if (shape === 'circle') base = new paper.Path.Circle({ center: b.center, radius: Math.hypot(b.width, b.height) / 2 + pad, insert: false });
      else if (shape === 'oval') base = new paper.Path.Ellipse({ rectangle: b.expand(pad * 2 + b.width * 0.22, pad * 2 + b.height * 0.5), insert: false });
      else base = new paper.Path.Rectangle({ rectangle: b.expand(pad * 2), radius: shape === 'rounded' ? Math.min(b.height, b.width) * 0.18 + pad : 0, insert: false });
      const cut = base.subtract(CI.geom.uniteAll(art), { insert: false }); CI.geom.normalize(cut);
      cut.fillColor = color || CI.geom.cutColor(CI.geom.leafPaths(sel[0])[0]); cut.data = { name: 'Knockout ' + shape };
      cut.insertAbove(sel[sel.length - 1]); sel.forEach(i => i.remove());
      this.select([cut]); this.commit('Knockout'); return cut;
    }
    /** Split monogram: cut the biggest selected shape around the other selected items (e.g. a name across a big letter). */
    effectSplit(padIn = 0.08) {
      const sel = this._artOnly(this.sortedSelection());
      if (sel.length < 2) { this.toast('Select the big letter/shape AND the text that goes across it.', 'warn'); return []; }
      const base = sel.reduce((a, c) => (a.bounds.area >= c.bounds.area ? a : c)); const others = sel.filter(i => i !== base);
      const ob = others.map(i => i.bounds).reduce((a, c) => a.unite(c)); const pad = padIn * UPI; const bb = base.bounds.expand(4);
      const band = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(bb.left, ob.top - pad, bb.width, ob.height + pad * 2), insert: false });
      const made = this._cutWith(band, [base]);
      if (!made.length) { this.toast('The text needs to sit across the big shape.', 'info'); return []; }
      this.select(made.concat(others.filter(i => i.parent))); this.commit('Split monogram'); return made;
    }

    // ---------- batch copies ----------
    /** Lay out n copies of the selection on the mat (packed). n = 'fill' fits as many as the mat holds. */
    makeCopies(n, gapIn = 0.25) {
      const sel = this._artOnly(this.sortedSelection()); if (!sel.length) { this.toast('Select the design to copy first.', 'warn'); return 0; }
      const area = this.matArea(); const b = sel.map(i => i.bounds).reduce((a, c) => a.unite(c)); const gap = gapIn * UPI;
      if (b.width > area.width) { this.toast('The design is wider than the mat.', 'warn'); return 0; }
      const fill = n === 'fill'; const count = fill ? 500 : Math.max(1, Math.min(500, n | 0));
      const res = CI.nest.pack(Array.from({ length: count }, (_, i) => ({ id: i, w: b.width, h: b.height })), area.width, gap, false);
      let places = res.placements.sort((p, q) => p.id - q.id);
      if (fill) places = places.filter(p => p.y + p.h <= area.height - gap / 2 + 1e-6);
      if (!places.length) { this.toast('It doesn\u2019t fit on the mat.', 'warn'); return 0; }
      const all = [];
      const groups = places.map((pl, k) => (k === 0 ? sel : sel.map(i => i.clone())));   // clone BEFORE anything moves
      places.forEach((pl, k) => { const d = new paper.Point(area.x + pl.x - b.x, area.y + pl.y - b.y); groups[k].forEach(i => i.translate(d)); all.push(...groups[k]); });
      const bottom = Math.max(...places.map(p => p.y + p.h));
      this.select(all); this.commit('Make copies');
      const mats = Math.ceil(bottom / area.height - 1e-6);
      if (!fill && mats > 1) this.toast(`${places.length} copies need ${bottom / UPI > 23.5 ? mats + ' mats' : 'the 12x24 mat'} (${U.round(bottom / UPI, 1)}" long).`, 'info');
      return places.length;
    }

    // ---------- registration marks (layered vinyl / HTV) ----------
    regMarks() { return this.designItems().filter(i => i.data && i.data.reg); }
    /** The artwork the marks frame: visible, not weed boxes, not marks themselves. */
    _regArt() { return this.designItems().filter(i => i.visible && i.className !== 'Raster' && !(i.data && (i.data.weed || i.data.reg))); }
    _regSig(art) { const b = art.map(i => i.bounds).reduce((a, c) => a.unite(c)); const cols = new Set(); art.forEach(i => CI.geom.leafPaths(i).forEach(p => cols.add(CI.geom.cutColor(p)))); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 100)).join(',') + '|' + [...cols].sort().join(','); }
    /**
     * Add identical marks to every color layer at the same spots beside the design.
     * opts: {shape: 'cross'|'circle'|'square', where: 'sides'|'corners', size (in), offset (in)}
     */
    addRegMarks(opts = {}) {
      const art = this._regArt(); if (!art.length) { this.toast('Add some artwork first.', 'warn'); return []; }
      this.regMarks().forEach(g => g.remove());
      const made = this._buildReg(art, opts);
      this.commit('Registration marks'); this.select([]);
      return made;
    }
    _buildReg(art, opts) {
      const mat = this.material();
      const o = Object.assign({ shape: 'cross', where: 'sides', offset: 0.25 }, opts);
      const arm = Math.max(0.06, mat.minFeature * 1.6);                   // stroke of the cross: safely cuttable
      const size = Math.max(o.size || 0, 0.3, arm * 3.2, Math.sqrt(mat.minPiece) * 2.5);
      const B = art.map(i => i.bounds).reduce((a, c) => a.unite(c));
      const off = (o.offset + size / 2) * UPI, S = size * UPI, A = arm * UPI;
      const spots = o.where === 'corners'
        ? [B.topLeft.add([-off, -off]), B.topRight.add([off, -off]), B.bottomLeft.add([-off, off]), B.bottomRight.add([off, off])]
        : [new paper.Point(B.left - off, B.center.y), new paper.Point(B.right + off, B.center.y)];
      const cols = []; art.forEach(i => CI.geom.leafPaths(i).forEach(p => { const c = CI.geom.cutColor(p); if (!cols.includes(c)) cols.push(c); }));
      const shapeAt = (c) => {
        if (o.shape === 'circle') return new paper.Path.Circle({ center: c, radius: S / 2, insert: false });
        if (o.shape === 'square') return new paper.Path.Rectangle({ rectangle: new paper.Rectangle(c.subtract(S / 2), new paper.Size(S, S)), insert: false });
        const h = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(c.x - S / 2, c.y - A / 2, S, A), insert: false });
        const v = new paper.Path.Rectangle({ rectangle: new paper.Rectangle(c.x - A / 2, c.y - S / 2, A, S), insert: false });
        return CI.geom.uniteAll([h, v]);
      };
      const sig = this._regSig(art);
      return cols.map(color => {
        const g = new paper.Group({ children: spots.map(c => { const m = shapeAt(c); m.fillColor = color; return m; }), insert: false });
        g.data = { reg: true, color, opts: o, sig, name: 'Registration marks ' + color };
        this.design.addChild(g); return g;
      });
    }
    _syncReg() {
      const marks = this.regMarks(); if (!marks.length) return 0;
      const art = this._regArt(); if (!art.length) { marks.forEach(m => m.remove()); return 1; }
      const sig = this._regSig(art); if (marks[0].data.sig === sig) return 0;
      const o = marks[0].data.opts; marks.forEach(m => m.remove()); this._buildReg(art, o); return 1;
    }
    removeRegMarks() { const m = this.regMarks(); m.forEach(g => g.remove()); this.selection = this.selection.filter(i => i.parent); if (m.length) this.commit('Remove registration marks'); return m.length; }

    // ---------- garment placement ----------
    /** Size the selection (or whole design) for a garment placement preset. Returns the scale applied. */
    placeFor(key) {
      const p = CI.PLACEMENTS[key]; if (!p) return 0;
      const items = (this.selection.length ? this.selection : this.designItems().filter(i => i.visible)).filter(i => !(i.data && (i.data.weed || i.data.reg)));
      if (!items.length) { this.toast('Nothing to size.', 'warn'); return 0; }
      const b = items.map(i => i.bounds).reduce((a, c) => a.unite(c));
      const s = Math.min((p.w * UPI) / b.width, (p.maxH * UPI) / b.height, (p.maxW * UPI) / b.width);
      items.forEach(i => i.scale(s, b.topLeft));
      this.doc.placement = key; this.select(items); this.commit('Size for ' + p.name);
      return s;
    }

    // ---------- my vinyl ----------
    /** Recolor the selection (or everything) to the nearest color in your vinyl palette. */
    snapToVinyl() {
      const pal = CI.vinyl.list(); if (!pal.length) { this.toast('Add some colors to My vinyl first.', 'warn'); return 0; }
      const items = (this.selection.length ? this.selection : this.designItems()).filter(i => i.className !== 'Raster' && !(i.data && i.data.weed));
      let n = 0;
      const apply = (it) => {
        if (it.data && it.data.type === 'text') { const v = CI.vinyl.nearest(it.data.params.color); if (v.hex !== it.data.params.color) { CI.text.rebuild(it, { color: v.hex }); n++; } return; }
        if (CI.geom.isPathLike(it)) { const cur = CI.geom.cutColor(it); const v = CI.vinyl.nearest(cur); if (v.hex !== cur) { if (it.fillColor) it.fillColor = v.hex; else it.strokeColor = v.hex; n++; } return; }
        if (it.children) it.children.forEach(apply);
      };
      items.forEach(apply);
      this.commit('Snap to my vinyl'); return n;
    }

    // ---------- import / export / project ----------
    async importFile(file) {
      const name = file.name || 'file'; const lower = name.toLowerCase();
      if (lower.endsWith('.svg') || file.type === 'image/svg+xml') {
        const text = await U.readFileAs(file, 'text'); return this.importSVGText(text, name);
      }
      if (lower.endsWith('.kerf') || lower.endsWith('.json')) { const text = await U.readFileAs(file, 'text'); return this.openProject(text); }
      if (/\.(ttf|otf|woff)$/.test(lower)) { const buf = await U.readFileAs(file, 'buffer'); const f = CI.fonts.addBuffer(buf, { source: 'file' }); this.emit('fonts'); this.toast('Font added: ' + f.family); return f; }
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/.test(lower)) { const url = await U.readFileAs(file, 'dataURL'); return this.importImageURL(url, name.replace(/\.[^.]+$/, '')); }
      throw new Error('Unsupported file: ' + name);
    }
    importSVGText(text, name = 'SVG') {
      const item = CI.exporter.importSVG(text);
      item.data = { name: name.replace(/\.svg$/i, '') };
      // flatten single-child wrapper groups
      let it = item; while (it.className === 'Group' && it.children.length === 1 && it.firstChild.className === 'Group') { const c = it.firstChild; c.transform(it.matrix); it = c; }
      const area = this.matArea(); if (it.bounds.width > area.width || it.bounds.height > area.height) { const s = Math.min(area.width / it.bounds.width, area.height / it.bounds.height) * 0.9; it.scale(s); this.toast('SVG was larger than the mat, scaled to fit.', 'info'); }
      it.position = area.center; this.add(it); this.commit('Import SVG'); return it;
    }
    packOpts() { return this.doc.pack ? { width: this.matArea().width, gap: (this.doc.packGap != null ? this.doc.packGap : 0.25) * UPI, rotate: this.doc.packRotate !== false } : null; }
    exportSVG(opts = {}) { return CI.exporter.toSVG(this.designItems(), Object.assign({ weld: this.doc.weld, mirror: this.doc.mirror, title: this.doc.name, pack: this.packOpts() }, opts)); }
    materialUse() { return CI.exporter.materialUse(this.designItems(), this.matArea().width, (this.doc.packGap != null ? this.doc.packGap : 0.25) * UPI, this.doc.packRotate !== false); }
    exportPNG(dpi = 300) { return CI.exporter.toPNG(this.designItems(), dpi, { mirror: false }); }
    projectJSON() {
      const design = CI.exporter.serialize(this.design, this.assets);
      const used = new Set(); JSON.stringify(design).replace(/asset:([A-Za-z0-9_]+)/g, (m, k) => used.add(k));
      const assets = {}; used.forEach(k => assets[k] = this.assets.get(k));
      return JSON.stringify({ format: 'kerf-project', version: 1, saved: new Date().toISOString(), doc: this.docState(), design, assets });
    }
    async openProject(text) {
      let p; try { p = JSON.parse(text); } catch (e) { throw new Error('Not a Kerf project file'); }
      if (!p || p.format !== 'kerf-project') throw new Error('Not a Kerf project file');
      this.assets.load(p.assets);
      CI.exporter.deserializeInto(this.design, p.design, this.assets);
      await Promise.all(this.design.getItems({ class: paper.Raster }).map(rasterReady));
      this.applyDocState(p.doc || {}); this.selection = []; this.history.reset(); this.afterRestore(); this.zoomFitMat();
      return true;
    }
    newDocument() { this.design.removeChildren(); this.doc.name = 'Untitled'; this.selection = []; this.clearHighlights(); this.clearPreview(); this.history.reset(); this.afterRestore(); }
  }

  function cleanDistress(o) { const c = {}; ['wear', 'rough', 'cracks', 'texture', 'grain', 'seed', 'smooth', 'edgeOnly', 'band'].forEach(k => { if (o[k] !== undefined) c[k] = o[k]; }); return c; }
  function cleanOpts(o) { const c = {}; ['mode', 'colors', 'levels', 'threshold', 'tolerance', 'corner', 'despeckle', 'smooth', 'ignore', 'ignoreTol', 'stack'].forEach(k => { if (o[k] !== undefined) c[k] = o[k]; }); return c; }
  function rasterReady(r) {
    return new Promise((res) => {
      if (r.loaded) return res(r);
      const done = () => res(r); r.onLoad = done; r.onError = () => res(r);
      setTimeout(done, 8000);
    });
  }
  CI.rasterReady = rasterReady;
  CI.App = App;
  CI.MAT_STYLE = MAT_STYLE; CI.MAT_FOR = MAT_FOR;
})(window.CI);
