/* Interactive tools: select/transform (with smart guides), direct select (points), pen, shapes, text, magic eraser, hand, zoom. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const U = CI.util; const UPI = U.UPI;
  const ACCENT = '#16a974', GUIDE = '#ff2d8a';
  const HANDLES = ['topLeft', 'topCenter', 'topRight', 'rightCenter', 'bottomRight', 'bottomCenter', 'bottomLeft', 'leftCenter'];
  const OPP = { topLeft: 'bottomRight', topCenter: 'bottomCenter', topRight: 'bottomLeft', rightCenter: 'leftCenter', bottomRight: 'topLeft', bottomCenter: 'topCenter', bottomLeft: 'topRight', leftCenter: 'rightCenter' };
  const CURSORS = { select: 'default', direct: 'default', pen: 'crosshair', rect: 'crosshair', ellipse: 'crosshair', polygon: 'crosshair', star: 'crosshair', line: 'crosshair', text: 'text', eraser: 'cell', knife: 'crosshair', hand: 'grab', zoom: 'zoom-in' };

  class Tools {
    constructor(app) {
      this.app = app; this.canvas = app.canvas; this.tool = 'select';
      this.opts = { sides: 6, points: 5, inner: 0.45, radius: 0, eraseTol: 12, contiguous: true, snap: true, sliceGap: 0.03 };
      this.drag = null; this.space = false; this.pen = null; this.direct = { path: null, segs: new Set() }; this.hover = null;
      const c = this.canvas;
      c.addEventListener('pointerdown', e => this.onDown(e));
      window.addEventListener('pointermove', e => this.onMove(e));
      window.addEventListener('pointerup', e => this.onUp(e));
      c.addEventListener('dblclick', e => this.onDbl(e));
      c.addEventListener('wheel', e => this.onWheel(e), { passive: false });
      c.addEventListener('contextmenu', e => e.preventDefault());
      ['selection', 'change', 'view'].forEach(ev => app.on(ev, () => this.draw()));
      this.setTool('select');
    }
    setTool(t) {
      if (this.pen && t !== 'pen') this.finishPen();
      if (t !== 'direct') this.direct = { path: null, segs: new Set() };
      this.tool = t; this.canvas.style.cursor = CURSORS[t] || 'default';
      this.app.emit('tool', t); this.draw();
    }
    vpt(e) { const r = this.canvas.getBoundingClientRect(); return new paper.Point(e.clientX - r.left, e.clientY - r.top); }
    ppt(e) { return this.app.view.viewToProject(this.vpt(e)); }
    get z() { return this.app.view.zoom; }
    effectiveTool() { return this.space ? 'hand' : this.tool; }

    // ---------- pointer ----------
    onDown(e) {
      if (e.button === 2) return;
      if (e.button === 1) { this.drag = { mode: 'pan', v0: this.vpt(e), c0: this.app.view.center.clone() }; e.preventDefault(); return; }
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      const p = this.ppt(e); const t = this.effectiveTool(); const app = this.app;
      this.down = { p, v: this.vpt(e), shift: e.shiftKey, alt: e.altKey, time: Date.now() };
      if (t === 'hand') { this.drag = { mode: 'pan', v0: this.vpt(e), c0: app.view.center.clone() }; this.canvas.style.cursor = 'grabbing'; return; }
      if (t === 'zoom') { this.drag = { mode: 'zoomrect', p0: p }; return; }
      if (t === 'select') return this.selectDown(e, p);
      if (t === 'direct') return this.directDown(e, p);
      if (t === 'pen') return this.penDown(e, p);
      if (['rect', 'ellipse', 'polygon', 'star', 'line'].includes(t)) { this.drag = { mode: 'shape', p0: p, kind: t }; return; }
      if (t === 'text') { const g = app.addText({ text: 'Your text' }, p); app.emit('edit-text', g); this.setTool('select'); return; }
      if (t === 'eraser') return this.eraserDown(e, p);
      if (t === 'knife') { this.drag = { mode: 'knife', p0: p, p1: p }; return; }
    }
    onMove(e) {
      if (!this.down && !this.drag) { this.hoverMove(e); return; }
      if (!this.drag) return;
      const p = this.ppt(e); const d = this.drag; const app = this.app;
      if (d.mode === 'pan') { const dv = this.vpt(e).subtract(d.v0); app.view.center = d.c0.subtract(dv.divide(this.z)); app.emit('view'); return; }
      if (d.mode === 'move') return this.moveDrag(p, e);
      if (d.mode === 'scale') return this.scaleDrag(p, e);
      if (d.mode === 'rotate') return this.rotateDrag(p, e);
      if (d.mode === 'marquee' || d.mode === 'zoomrect') { d.p1 = p; this.draw(); this.drawRect(new paper.Rectangle(d.p0, p)); return; }
      if (d.mode === 'shape') { d.p1 = p; d.shift = e.shiftKey; d.alt = e.altKey; this.draw(); const s = this.shapeFromDrag(d); if (s) { s.opacity = 0.6; this.app.ui.addChild(s); } return; }
      if (d.mode === 'seg' || d.mode === 'handle') return this.directDrag(p, e);
      if (d.mode === 'knife') { d.p1 = this.knifeEnd(d.p0, p, e.shiftKey); this.draw(); const k = CI.geom.strip(d.p0, d.p1, Math.max(0.005, this.opts.sliceGap) * UPI); if (k) { k.fillColor = new paper.Color(1, 0.17, 0.5, 0.35); k.strokeColor = '#ff2d8a'; k.strokeWidth = 1; k.strokeScaling = false; this.app.ui.addChild(k); } return; }
      if (d.mode === 'pen') { const seg = d.seg; const v = p.subtract(seg.point); seg.handleOut = v; seg.handleIn = v.multiply(-1); this.draw(); return; }
    }
    onUp(e) {
      const d = this.drag; const app = this.app; this.down = null;
      try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!d) return;
      this.drag = null;
      if (d.mode === 'pan') { this.canvas.style.cursor = CURSORS[this.effectiveTool()]; return; }
      if (d.mode === 'move' || d.mode === 'scale' || d.mode === 'rotate') { if (d.changed) app.commit({ move: 'Move', scale: 'Scale', rotate: 'Rotate' }[d.mode]); this.draw(); return; }
      if (d.mode === 'marquee') { if (d.p1) { const r = new paper.Rectangle(d.p0, d.p1); app.select(app.itemsInRect(r), d.shift); } else if (!d.shift) app.clearSelection(); this.draw(); return; }
      if (d.mode === 'zoomrect') {
        if (d.p1 && d.p1.getDistance(d.p0) * this.z > 6) app.zoomTo(new paper.Rectangle(d.p0, d.p1), 10);
        else app.zoomBy(e.altKey ? 1 / 1.6 : 1.6, d.p0);
        this.draw(); return;
      }
      if (d.mode === 'shape') {
        let s = this.shapeFromDrag(d);
        if (!s || (s.bounds.width < 2 && s.bounds.height < 2)) { d.p1 = d.p0.add(new paper.Point(UPI, UPI)); d.shift = false; d.alt = false; s = this.shapeFromDrag(d); }
        app.add(s); app.commit('Draw ' + d.kind); this.draw(); return;
      }
      if (d.mode === 'seg' || d.mode === 'handle') { if (d.changed) app.commit('Edit points'); this.draw(); return; }
      if (d.mode === 'pen') { this.draw(); return; }
      if (d.mode === 'knife') { const p1 = this.knifeEnd(d.p0, this.ppt(e), e.shiftKey); this.draw(); if (p1.getDistance(d.p0) * this.z > 4) app.sliceLine(d.p0, p1, this.opts.sliceGap); return; }
    }
    knifeEnd(p0, p, shift) { if (!shift) return p; const v = p.subtract(p0); const ang = Math.round(v.angle / 45) * 45; return p0.add(new paper.Point({ length: v.length, angle: ang })); }
    onDbl(e) {
      const p = this.ppt(e); const app = this.app;
      if (this.tool === 'pen') { this.finishPen(); return; }
      if (this.tool === 'direct' && this.direct.path) {
        const loc = this.direct.path.getNearestLocation(this.direct.path.globalToLocal(p));
        if (loc && loc.point.getDistance(this.direct.path.globalToLocal(p)) * this.z < 8) {
          const target = loc.path || this.direct.path; target.divideAt(loc); app.commit('Add point'); this.draw();
        }
        return;
      }
      if (this.tool === 'select') {
        const h = app.hitTest(p); const top = h && app.topLevel(h.item);
        if (top && top.data && top.data.type === 'text') app.emit('edit-text', top);
        else if (top && CI.geom.isPathLike(top)) { this.setTool('direct'); this.direct.path = h.item.className === 'Path' && h.item.parent && h.item.parent.className === 'CompoundPath' ? h.item.parent : h.item; this.draw(); }
      }
    }
    onWheel(e) {
      e.preventDefault(); const app = this.app;
      if (e.ctrlKey || e.metaKey) { const f = Math.exp(-e.deltaY * 0.0022); app.zoomBy(f, this.ppt(e)); }
      else { const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY; app.view.center = app.view.center.add(new paper.Point(dx, dy).divide(this.z)); app.emit('view'); }
    }

    // ---------- select tool ----------
    handleAt(vp) {
      const b = this.app.selectionBounds(); if (!b) return null;
      const r = 7;
      const top = this.app.view.projectToView(b.topCenter);
      if (top.subtract(new paper.Point(0, 26)).getDistance(vp) <= r + 2) return 'rotate';
      for (const h of HANDLES) { const hp = this.app.view.projectToView(b[h]); if (Math.abs(hp.x - vp.x) <= r && Math.abs(hp.y - vp.y) <= r) return h; }
      return null;
    }
    selectDown(e, p) {
      const app = this.app; const vp = this.vpt(e);
      const h = app.selection.length ? this.handleAt(vp) : null;
      if (h === 'rotate') { const b = app.selectionBounds(); this.drag = { mode: 'rotate', center: b.center, last: p, total: 0 }; return; }
      if (h) { const b = app.selectionBounds(); this.drag = { mode: 'scale', handle: h, b0: b.clone(), anchor: b[OPP[h]].clone(), center: b.center.clone() }; return; }
      const hit = app.hitTest(p); const top = hit && app.topLevel(hit.item);
      // clicking inside the selection box moves the selection (easier to grab thin shapes)
      const selB = app.selectionBounds();
      if (!top && selB && selB.contains(p) && !e.shiftKey) { this.startMove(p, e); return; }
      if (top) {
        if (e.shiftKey) { app.select([top], true); this.drag = null; this.draw(); return; }
        if (!app.selection.includes(top)) app.select([top]);
        this.startMove(p, e); return;
      }
      this.drag = { mode: 'marquee', p0: p, shift: e.shiftKey };
    }
    startMove(p, e) {
      const app = this.app;
      if (e.altKey) { const copies = app.selection.map(i => i.clone()); app.select(copies); }
      const others = app.designItems().filter(i => i.visible && !app.selection.includes(i)).map(i => i.bounds);
      const area = app.matArea(); others.push(area);
      const xs = [], ys = []; others.forEach(b => { xs.push(b.left, b.center.x, b.right); ys.push(b.top, b.center.y, b.bottom); });
      this.drag = { mode: 'move', p0: p, last: p, b0: app.selectionBounds().clone(), xs, ys, moved: new paper.Point(0, 0) };
    }
    moveDrag(p, e) {
      const d = this.drag; const app = this.app;
      let delta = p.subtract(d.p0);
      if (e.shiftKey) { if (Math.abs(delta.x) > Math.abs(delta.y)) delta.y = 0; else delta.x = 0; }
      const guides = [];
      if (this.opts.snap && !e.ctrlKey) {
        const th = 6 / this.z; const b = d.b0.clone(); b.x += delta.x; b.y += delta.y;
        const snap = (vals, cands) => { let best = null; for (const v of vals) for (const c of cands) { const dd = c - v; if (Math.abs(dd) < th && (!best || Math.abs(dd) < Math.abs(best.d))) best = { d: dd, at: c }; } return best; };
        const sx = snap([b.left, b.center.x, b.right], d.xs); const sy = snap([b.top, b.center.y, b.bottom], d.ys);
        if (sx) { delta.x += sx.d; guides.push(['v', sx.at]); }
        if (sy) { delta.y += sy.d; guides.push(['h', sy.at]); }
      }
      const step = delta.subtract(d.moved);
      if (!step.isZero()) { app.selection.forEach(i => i.translate(step)); d.moved = delta; d.changed = true; }
      this.draw();
      const vb = app.view.bounds;
      guides.forEach(([k, v]) => { const l = k === 'v' ? new paper.Path.Line([v, vb.top], [v, vb.bottom]) : new paper.Path.Line([vb.left, v], [vb.right, v]); l.strokeColor = GUIDE; l.strokeWidth = 1; l.strokeScaling = false; l.dashArray = [4 / this.z, 3 / this.z]; app.ui.addChild(l); });
      app.emit('transforming');
    }
    scaleDrag(p, e) {
      const d = this.drag; const app = this.app; const h = d.handle; const b0 = d.b0;
      const anchor = e.altKey ? d.center : d.anchor;
      const horiz = !/Center$/.test(h) || h === 'leftCenter' || h === 'rightCenter';
      const vert = !/Center$/.test(h) || h === 'topCenter' || h === 'bottomCenter';
      const handlePt = b0[h];
      let sx = horiz ? (p.x - anchor.x) / ((handlePt.x - anchor.x) || 1) : 1;
      let sy = vert ? (p.y - anchor.y) / ((handlePt.y - anchor.y) || 1) : 1;
      // images and text keep proportions by default (Shift frees them); shapes are free by default (Shift constrains)
      const proportional = app.selection.some(i => i.className === 'Raster' || (i.data && i.data.type === 'text'));
      const uniform = proportional ? !e.shiftKey : e.shiftKey;
      if (uniform && horiz && vert) { const s = Math.max(Math.abs(sx), Math.abs(sy)); sx = s * Math.sign(sx || 1); sy = s * Math.sign(sy || 1); }
      sx = Math.max(sx, 0.002); sy = Math.max(sy, 0.002);
      // apply relative to the current state
      const cur = app.selectionBounds();
      const targetW = b0.width * sx, targetH = b0.height * sy;
      const fx = cur.width ? targetW / cur.width : 1, fy = cur.height ? targetH / cur.height : 1;
      if (isFinite(fx) && isFinite(fy) && (Math.abs(fx - 1) > 1e-6 || Math.abs(fy - 1) > 1e-6)) { app.selection.forEach(i => i.scale(fx, fy, anchor)); d.changed = true; }
      this.draw(); app.emit('transforming');
    }
    rotateDrag(p, e) {
      const d = this.drag; const app = this.app;
      const a0 = d.last.subtract(d.center).angle, a1 = p.subtract(d.center).angle;
      let delta = a1 - a0; if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
      let next = d.total + delta;
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      const apply = next - (d.applied || 0);
      if (apply) { app.selection.forEach(i => { i.rotate(apply, d.center); i.data.rot = (((i.data.rot || 0) + apply) % 360 + 360) % 360; }); d.applied = next; d.changed = true; }
      d.total += delta; d.last = p; this.draw(); app.emit('transforming');
    }
    hoverMove(e) {
      if (this.tool === 'pen' && this.pen) { this.penPreview = this.ppt(e); this.draw(); return; }
      if (this.tool !== 'select' && this.tool !== 'direct') { if (this.hover) { this.hover = null; this.draw(); } return; }
      const vp = this.vpt(e);
      if (this.tool === 'select' && this.app.selection.length) {
        const h = this.handleAt(vp);
        this.canvas.style.cursor = h === 'rotate' ? 'alias' : h ? ({ topLeft: 'nwse-resize', bottomRight: 'nwse-resize', topRight: 'nesw-resize', bottomLeft: 'nesw-resize', topCenter: 'ns-resize', bottomCenter: 'ns-resize', leftCenter: 'ew-resize', rightCenter: 'ew-resize' })[h] : 'default';
      }
      const r = this.canvas.getBoundingClientRect(); if (e.clientX < r.left || e.clientY < r.top || e.clientX > r.right || e.clientY > r.bottom) return;
      const hit = this.app.hitTest(this.ppt(e)); const top = hit ? (this.tool === 'select' ? this.app.topLevel(hit.item) : hit.item) : null;
      if (top !== this.hover) { this.hover = top; this.draw(); }
      this.app.emit('cursor', this.ppt(e));
    }

    // ---------- direct select ----------
    directDown(e, p) {
      const app = this.app; const dp = this.direct.path;
      if (dp && dp.parent) {
        const hit = dp.hitTest(p, { segments: true, handles: true, tolerance: 6 / this.z });
        if (hit && (hit.type === 'segment' || hit.type === 'handle-in' || hit.type === 'handle-out')) {
          const seg = hit.segment;
          if (hit.type === 'segment') {
            if (e.altKey) { // toggle smooth/corner
              if (seg.handleIn.isZero() && seg.handleOut.isZero()) seg.smooth(); else { seg.handleIn = null; seg.handleOut = null; }
              app.commit('Toggle smooth'); this.draw(); return;
            }
            if (e.shiftKey) { this.direct.segs.has(seg) ? this.direct.segs.delete(seg) : this.direct.segs.add(seg); }
            else if (!this.direct.segs.has(seg)) this.direct.segs = new Set([seg]);
            this.drag = { mode: 'seg', last: p };
          } else this.drag = { mode: 'handle', seg, which: hit.type, last: p };
          this.draw(); return;
        }
      }
      const hit = app.hitTest(p);
      if (hit) {
        const top = app.topLevel(hit.item);
        if (top && top.data && top.data.type === 'text') { app.toast('Text: use Type → Convert to outlines to edit its points.', 'info'); app.select([top]); return; }
        if (top && top.className === 'Raster') { app.select([top]); return; }
        let target = hit.item; if (target.parent && target.parent.className === 'CompoundPath') target = target.parent;
        this.direct = { path: target, segs: new Set() }; app.select([top]); this.draw(); return;
      }
      this.direct = { path: null, segs: new Set() }; app.clearSelection(); this.draw();
    }
    directDrag(p, e) {
      const d = this.drag; const dp = this.direct.path; if (!dp) return;
      const a = dp.globalToLocal(d.last), b = dp.globalToLocal(p); const delta = b.subtract(a);
      if (d.mode === 'seg') this.direct.segs.forEach(s => { s.point = s.point.add(delta); });
      else {
        const s = d.seg; const local = dp.globalToLocal(p).subtract(s.point);
        const smooth = !e.altKey && !s.handleIn.isZero() && !s.handleOut.isZero() && Math.abs(s.handleIn.normalize().dot(s.handleOut.normalize()) + 1) < 0.02;
        if (d.which === 'handle-in') { const len = s.handleOut.length; s.handleIn = local; if (smooth) s.handleOut = local.normalize(-len); }
        else { const len = s.handleIn.length; s.handleOut = local; if (smooth) s.handleIn = local.normalize(-len); }
      }
      d.last = p; d.changed = true; this.draw();
    }
    deleteSegments() {
      const dp = this.direct.path; if (!dp || !this.direct.segs.size) return false;
      this.direct.segs.forEach(s => { const path = s.path; s.remove(); if (path && path.segments.length < 2) path.remove(); });
      this.direct.segs = new Set(); if (!dp.parent || (dp.className === 'CompoundPath' && !dp.children.length)) { if (dp.parent) dp.remove(); this.direct.path = null; }
      this.app.commit('Delete points'); this.draw(); return true;
    }

    // ---------- pen ----------
    penDown(e, p) {
      const app = this.app;
      if (!this.pen) {
        const path = new paper.Path({ strokeColor: '#1a7cff', strokeWidth: 1.5, strokeScaling: false, insert: false });
        app.ui.addChild(path); this.pen = path;
      }
      const path = this.pen;
      if (path.segments.length > 2 && path.firstSegment.point.getDistance(p) * this.z < 9) { path.closed = true; this.finishPen(); return; }
      const seg = path.add(p); this.drag = { mode: 'pen', seg }; this.draw();
    }
    finishPen() {
      const path = this.pen; this.pen = null; this.penPreview = null; if (!path) return;
      path.remove();
      if (path.segments.length >= 2) {
        const out = path.clone({ insert: false });
        if (out.closed) { out.fillColor = this.app.fill; out.strokeColor = null; }
        else { out.fillColor = null; out.strokeColor = this.app.fill; out.strokeWidth = 0.125 * UPI; out.strokeCap = 'round'; out.strokeJoin = 'round'; out.strokeScaling = true; }
        out.data = { name: out.closed ? 'Pen shape' : 'Pen line' };
        this.app.add(out); this.app.commit('Pen');
      }
      this.draw();
    }

    // ---------- shapes ----------
    shapeFromDrag(d) {
      if (!d.p1) return null;
      if (d.kind === 'line') {
        let to = d.p1; if (d.shift) { const v = to.subtract(d.p0); const ang = Math.round(v.angle / 45) * 45; to = d.p0.add(new paper.Point({ length: v.length, angle: ang })); }
        return this.app.makeShape('line', null, { from: d.p0, to });
      }
      let v = d.p1.subtract(d.p0);
      if (d.shift) { const m = Math.max(Math.abs(v.x), Math.abs(v.y)); v = new paper.Point(m * Math.sign(v.x || 1), m * Math.sign(v.y || 1)); }
      const r = d.alt ? new paper.Rectangle(d.p0.subtract(v), d.p0.add(v)) : new paper.Rectangle(d.p0, d.p0.add(v));
      if (r.width < 0.5 && r.height < 0.5) return null;
      return this.app.makeShape(d.kind, r, { sides: this.opts.sides, points: this.opts.points, inner: this.opts.inner, radius: this.opts.radius * UPI });
    }

    // ---------- eraser (magic wand background removal) ----------
    async eraserDown(e, p) {
      const app = this.app;
      let r = app.selectedRaster();
      const hit = app.hitTest(p); const top = hit && app.topLevel(hit.item);
      if (top && top.className === 'Raster') r = top;
      if (!r || !r.bounds.contains(p)) { app.toast('Click on an image to erase a color from it.', 'warn'); return; }
      app.select([r]);
      const n = await app.eraseAt(r, p, this.opts.eraseTol, this.opts.contiguous && !e.shiftKey);
      app.toast(n ? `Erased ${n.toLocaleString()} pixels.` : 'Nothing erased there.');
    }

    // ---------- keyboard (tool-specific) ----------
    handleKey(e) {
      if (this.tool === 'pen' && this.pen && (e.key === 'Enter' || e.key === 'Escape')) { this.finishPen(); return true; }
      if (this.tool === 'direct' && (e.key === 'Delete' || e.key === 'Backspace') && this.direct.segs.size) return this.deleteSegments();
      return false;
    }

    // ---------- drawing selection UI ----------
    drawRect(r) { const p = new paper.Path.Rectangle({ rectangle: r, strokeColor: ACCENT, strokeWidth: 1, strokeScaling: false, dashArray: [4 / this.z, 3 / this.z], fillColor: new paper.Color(0.09, 0.66, 0.45, 0.06) }); this.app.ui.addChild(p); }
    draw() {
      const app = this.app; const L = app.ui; const z = this.z;
      L.children.slice().forEach(c => { if (c !== this.pen) c.remove(); });
      const style = { strokeColor: ACCENT, strokeWidth: 1, strokeScaling: false };
      if (this.hover && this.hover.parent && !app.selection.includes(this.hover) && this.tool === 'select') {
        const hb = new paper.Path.Rectangle(Object.assign({ rectangle: this.hover.bounds }, style, { opacity: 0.6, insert: false })); L.addChild(hb);
      }
      if (this.tool === 'direct') {
        const dp = this.direct.path;
        if (dp && dp.parent) {
          const o = dp.clone({ insert: false }); o.transform(dp.parent.globalMatrix); o.fillColor = null; o.strokeColor = '#1a7cff'; o.strokeWidth = 1; o.strokeScaling = false; L.addChild(o);
          const M = dp.globalMatrix;
          CI.geom.subpaths(dp).forEach(sp => sp.segments.forEach(s => {
            const gp = M.transform(s.point); const sel = this.direct.segs.has(s);
            if (sel) {
              [['handleIn'], ['handleOut']].forEach(([k]) => { if (!s[k].isZero()) { const hp = M.transform(s.point.add(s[k])); L.addChild(new paper.Path.Line({ from: gp, to: hp, strokeColor: '#1a7cff', strokeWidth: 1, strokeScaling: false, insert: false })); L.addChild(new paper.Path.Circle({ center: hp, radius: 3.5 / z, fillColor: '#fff', strokeColor: '#1a7cff', strokeWidth: 1, strokeScaling: false, insert: false })); } });
            }
            L.addChild(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(gp.subtract(3.5 / z), new paper.Size(7 / z, 7 / z)), fillColor: sel ? '#1a7cff' : '#fff', strokeColor: '#1a7cff', strokeWidth: 1, strokeScaling: false, insert: false }));
          }));
        }
        return;
      }
      if (this.pen) {
        if (this.penPreview && this.pen.lastSegment) L.addChild(new paper.Path.Line({ from: this.pen.lastSegment.point, to: this.penPreview, strokeColor: '#1a7cff', strokeWidth: 1, dashArray: [4 / z, 3 / z], strokeScaling: false, insert: false }));
        this.pen.segments.forEach((s, i) => L.addChild(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(s.point.subtract(3 / z), new paper.Size(6 / z, 6 / z)), fillColor: i === 0 ? '#1a7cff' : '#fff', strokeColor: '#1a7cff', strokeWidth: 1, strokeScaling: false, insert: false })));
        if (this.pen.parent !== L) L.addChild(this.pen);
      }
      const sel = app.selection.filter(i => i.parent);
      if (!sel.length || this.tool !== 'select') return;
      if (sel.length > 1) sel.forEach(i => L.addChild(new paper.Path.Rectangle(Object.assign({ rectangle: i.bounds, opacity: 0.5, insert: false }, style))));
      const b = app.selectionBounds();
      L.addChild(new paper.Path.Rectangle(Object.assign({ rectangle: b, insert: false }, style)));
      const hs = 7 / z;
      HANDLES.forEach(h => L.addChild(new paper.Path.Rectangle({ rectangle: new paper.Rectangle(b[h].subtract(hs / 2), new paper.Size(hs, hs)), fillColor: '#fff', strokeColor: ACCENT, strokeWidth: 1, strokeScaling: false, insert: false })));
      const rp = b.topCenter.subtract(new paper.Point(0, 26 / z));
      L.addChild(new paper.Path.Line({ from: b.topCenter, to: rp, strokeColor: ACCENT, strokeWidth: 1, strokeScaling: false, insert: false }));
      L.addChild(new paper.Path.Circle({ center: rp, radius: 4.5 / z, fillColor: ACCENT, strokeColor: '#fff', strokeWidth: 1, strokeScaling: false, insert: false }));
      // size label
      const lbl = new paper.PointText({ point: b.bottomCenter.add(new paper.Point(0, 16 / z)), content: `${U.round(b.width / UPI, 2)}" × ${U.round(b.height / UPI, 2)}"`, justification: 'center', fillColor: '#0d6b49', fontSize: 11 / z, fontFamily: 'AtkUI, sans-serif', insert: false });
      L.addChild(lbl);
    }
  }
  CI.Tools = Tools;
})(window.CI);
