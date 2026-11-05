/* End-to-end tests: drives the real app (index.html?test=1) inside a hidden iframe with simulated pointer/keyboard input. */
(function () {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function until(fn, ms = 8000, msg = 'condition') { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) { /* retry */ } await sleep(25); } throw new Error('timed out waiting for ' + msg); }
  let W, A, CIF, P, UI, T, errors = [], downloads = [];
  const UPI = 96; const inch = (v) => v * UPI;

  async function boot() {
    await until(() => window.__KERF_READY__, 15000, 'app boot');
    W = window; A = W.app; CIF = W.CI; P = W.paper; UI = W.ui; T = W.tools;
    if (!W.__hooked) {
      W.__hooked = true;
      const ce = W.console.error.bind(W.console);
      W.console.error = (...a) => { errors.push(a.map(String).join(' ')); ce(...a); };
      W.addEventListener('error', e => errors.push('uncaught: ' + e.message));
      W.addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.message || e.reason)));
      CIF.util.download = (name, data) => downloads.push({ name, data });
      W.confirm = () => true; W.prompt = () => 'Renamed';
    }
  }
  async function fresh() { await boot(); A.newDocument(); A.setMaterial('vinyl'); A.doc.mat = '12x12'; A.doc.mirror = false; A.drawMat(); A.zoomFitMat(); T.setTool('select'); errors = []; downloads = []; await sleep(10); }
  function noErrors() { if (errors.length) throw new Error('app errors: ' + errors.join(' | ')); }

  // ---- input simulation ----
  function client(pt) { const v = A.view.projectToView(pt); const r = A.canvas.getBoundingClientRect(); return { clientX: r.left + v.x, clientY: r.top + v.y }; }
  function ptr(type, pt, o = {}) {
    const ev = new W.PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true }, client(pt), o));
    A.canvas.dispatchEvent(ev);
  }
  async function drag(from, to, o = {}, steps = 6) {
    ptr('pointerdown', from, o);
    for (let i = 1; i <= steps; i++) ptr('pointermove', from.add(to.subtract(from).multiply(i / steps)), o);
    ptr('pointerup', to, o); await sleep(5);
  }
  async function click(pt, o = {}) { ptr('pointerdown', pt, o); ptr('pointerup', pt, o); await sleep(5); }
  function key(k, o = {}) { W.dispatchEvent(new W.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o))); W.dispatchEvent(new W.KeyboardEvent('keyup', Object.assign({ key: k, bubbles: true }, o))); }
  const pt = (x, y) => new P.Point(inch(x), inch(y));
  const $ = (s) => W.document.querySelector(s);
  const $$ = (s) => [...W.document.querySelectorAll(s)];
  function rect(x, y, w, h, color = '#000000') { const r = new P.Path.Rectangle({ point: [inch(x), inch(y)], size: [inch(w), inch(h)], fillColor: color, insert: false }); A.add(r, { select: false }); A.commit('test rect'); return r; }
  function setInput(el, v, ev = 'change') { el.value = v; el.dispatchEvent(new W.Event('input', { bubbles: true })); if (ev === 'change') el.dispatchEvent(new W.Event('change', { bubbles: true })); }

  /** A fake "AI image": off-white noisy background, antialiased shapes + text, JPEG compressed. */
  async function aiLikeImage() {
    const c = W.document.createElement('canvas'); c.width = 600; c.height = 420; const g = c.getContext('2d');
    g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, 600, 420);
    let sd = 12345; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const id = g.getImageData(0, 0, 600, 420); for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 10; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; } g.putImageData(id, 0, 0);
    g.fillStyle = '#d42b2b'; g.beginPath(); g.arc(170, 200, 120, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1f4ba5'; g.beginPath(); g.roundRect ? g.roundRect(330, 90, 220, 230, 40) : g.rect(330, 90, 220, 230); g.fill();
    g.fillStyle = '#111111'; g.font = 'bold 90px sans-serif'; g.fillText('CUT', 360, 240);
    return c.toDataURL('image/jpeg', 0.82);
  }

  describe('App boot & layout', () => {
    it('boots with no errors, all panels and tools present', async () => {
      await fresh();
      expect($$('.tool').length).toBe(13);
      expect($$('.menu').length).toBe(6);
      expect(!!$('#panel-design').innerHTML).toBeTruthy();
      expect(A.view.viewSize.width).toBeGreaterThan(300);
      noErrors();
    });
    it('material and mat selectors drive the mat and rules', async () => {
      await fresh();
      setInput($('#sel-mat'), '12x24'); expect(A.matArea().height).toBe(inch(23.5));
      setInput($('#sel-material'), 'htv'); expect(A.doc.mirror).toBe(true); expect(A.material().mirror).toBe(true);
      setInput($('#sel-material'), 'vinyl'); expect(A.doc.mirror).toBe(false);
      noErrors();
    });
  });

  describe('Drawing & selection tools', () => {
    it('rectangle tool drag makes a 2" × 1" shape', async () => {
      await fresh(); key('m'); expect(T.tool).toBe('rect');
      await drag(pt(1, 1), pt(3, 2));
      const it = A.designItems()[0]; expect(it.bounds.width).toBeCloseTo(inch(2), 0.5); expect(it.bounds.height).toBeCloseTo(inch(1), 0.5);
      noErrors();
    });
    it('shift-drag ellipse is a circle; a plain click makes a 1" default shape', async () => {
      await fresh(); key('l'); await drag(pt(1, 1), pt(3, 2), { shiftKey: true });
      const c = A.designItems()[0]; expect(c.bounds.width).toBeCloseTo(c.bounds.height, 0.5);
      key('y'); await click(pt(5, 5)); expect(A.designItems().length).toBe(2); const pb = A.designItems()[1].bounds; expect(Math.max(pb.width, pb.height)).toBeCloseTo(inch(1), 0.5);
      key('s'); await drag(pt(6, 6), pt(8, 8)); key('\\'); await drag(pt(1, 8), pt(4, 8));
      expect(A.designItems().length).toBe(4); noErrors();
    });
    it('select, move, undo, redo', async () => {
      await fresh(); const r = rect(1, 1, 2, 2); key('v');
      await click(pt(2, 2)); expect(A.selection.length).toBe(1);
      await drag(pt(2, 2), pt(4.37, 3.13), { ctrlKey: true });
      expect(A.selection[0].bounds.x).toBeCloseTo(inch(3.37), 0.5);
      key('z', { ctrlKey: true }); expect(A.designItems()[0].bounds.x).toBeCloseTo(inch(1), 0.5);
      key('z', { ctrlKey: true, shiftKey: true }); expect(A.designItems()[0].bounds.x).toBeCloseTo(inch(3.37), 0.5);
      noErrors();
    });
    it('smart guides snap to the mat edge', async () => {
      await fresh(); rect(1, 1, 1, 1); key('v'); await click(pt(1.5, 1.5));
      await drag(pt(1.5, 1.5), pt(0.53, 1.5));
      expect(A.selection[0].bounds.x).toBeCloseTo(0, 0.01); noErrors();
    });
    it('scale handle resizes; rotate handle rotates', async () => {
      await fresh(); rect(1, 1, 2, 1); key('v'); await click(pt(2, 1.5));
      const b = A.selectionBounds(); await drag(b.bottomRight, b.bottomRight.add(new P.Point(inch(2), 0)));
      expect(A.selectionBounds().width).toBeCloseTo(inch(4), 1); expect(A.selectionBounds().height).toBeCloseTo(inch(1), 1);
      const b2 = A.selectionBounds(); const rh = b2.topCenter.subtract(new P.Point(0, 26 / A.view.zoom));
      await drag(rh, b2.center.add(new P.Point(b2.width, 0)), { shiftKey: true }, 10);
      expect(A.selectionBounds().height).toBeGreaterThan(inch(3)); noErrors();
    });
    it('marquee selects several; alt-drag duplicates', async () => {
      await fresh(); rect(1, 1, 1, 1); rect(3, 1, 1, 1); rect(8, 8, 1, 1); key('v');
      await drag(pt(0.5, 0.5), pt(4.5, 2.5)); expect(A.selection.length).toBe(2);
      await drag(pt(1.5, 1.5), pt(1.5, 5), { altKey: true, ctrlKey: true }); expect(A.designItems().length).toBe(5); noErrors();
    });
    it('pen tool: closed shape and open line', async () => {
      await fresh(); key('p');
      await click(pt(1, 1)); await click(pt(3, 1)); await drag(pt(3, 3), pt(3.5, 3.5)); await click(pt(1, 1));
      const s = A.designItems()[0]; expect(s.closed).toBe(true); expect(!!s.fillColor).toBe(true);
      key('p'); await click(pt(5, 5)); await click(pt(7, 6)); key('Enter');
      const l = A.designItems()[1]; expect(l.closed).toBe(false); expect(!!l.strokeColor).toBe(true); noErrors();
    });
    it('direct select moves a single point and deletes points', async () => {
      await fresh(); const r = rect(1, 1, 2, 2); key('a');
      await click(pt(2, 1)); expect(T.direct.path).toBeTruthy();
      await drag(pt(1, 1), pt(0.5, 0.5));
      const seg = A.designItems()[0].segments.find(s => s.point.getDistance(pt(0.5, 0.5)) < 2); expect(!!seg).toBe(true);
      await click(pt(3, 3)); key('Delete'); expect(A.designItems()[0].segments.length).toBe(3); noErrors();
    });
    it('hand, zoom and wheel move the view', async () => {
      await fresh(); const z0 = A.view.zoom; key('z'); await click(pt(5, 5)); expect(A.view.zoom).toBeGreaterThan(z0);
      key('h'); const c0 = A.view.center.clone(); await drag(pt(5, 5), pt(6, 6)); expect(A.view.center.getDistance(c0)).toBeGreaterThan(10);
      A.canvas.dispatchEvent(new W.WheelEvent('wheel', Object.assign({ deltaY: -200, ctrlKey: true, bubbles: true, cancelable: true }, client(pt(5, 5)))));
      expect(A.view.zoom).toBeGreaterThan(z0); noErrors();
    });
  });

  describe('Keyboard & edit commands', () => {
    it('duplicate, delete, nudge, group/ungroup, arrange, copy/paste', async () => {
      await fresh(); rect(1, 1, 1, 1); key('a', { ctrlKey: true }); key('v');
      key('d', { ctrlKey: true }); expect(A.designItems().length).toBe(2);
      const x0 = A.selection[0].bounds.x; key('ArrowRight', { shiftKey: true }); expect(A.selection[0].bounds.x).toBeCloseTo(x0 + inch(0.25), 0.01);
      key('a', { ctrlKey: true }); key('g', { ctrlKey: true }); expect(A.designItems().length).toBe(1); expect(A.designItems()[0].className).toBe('Group');
      key('g', { ctrlKey: true, shiftKey: true }); expect(A.designItems().length).toBe(2);
      A.select([A.designItems()[0]]); key(']', { ctrlKey: true, shiftKey: true }); expect(A.designItems()[1]).toBe(A.selection[0]);
      key('c', { ctrlKey: true }); key('v', { ctrlKey: true }); expect(A.designItems().length).toBe(3);
      key('Delete'); expect(A.designItems().length).toBe(2); noErrors();
    });
    it('property fields set size and position in inches', async () => {
      await fresh(); rect(1, 1, 2, 1); A.selectAll(); await sleep(10);
      setInput($('[data-prop="w"]'), '4'); expect(A.selectionBounds().width).toBeCloseTo(inch(4), 0.01); expect(A.selectionBounds().height).toBeCloseTo(inch(2), 0.01);
      setInput($('[data-prop="x"]'), '0.5'); expect(A.selectionBounds().x).toBeCloseTo(inch(0.5), 0.01);
      setInput($('[data-prop="rot"]'), '90'); expect(A.selectionBounds().width).toBeCloseTo(inch(2), 0.05);
      setInput($('[data-prop="fill"]'), '#ff0000'); expect(CIF.util.colorHex(A.designItems()[0].fillColor)).toBe('#ff0000'); noErrors();
    });
  });

  describe('Text', () => {
    it('text tool creates editable text; typing updates it', async () => {
      await fresh(); key('t'); await click(pt(1, 1));
      const g = A.designItems()[0]; expect(g.data.type).toBe('text');
      await until(() => $('[data-text="text"]'), 2000, 'text panel');
      const ta = $('[data-text="text"]'); ta.value = 'Kerf rocks'; ta.dispatchEvent(new W.Event('input', { bubbles: true }));
      await until(() => g.data.params.text === 'Kerf rocks', 3000, 'text update'); noErrors();
    });
    it('font, size, curve, spacing and weld controls work', async () => {
      await fresh(); const g = A.addText({ text: 'script', family: 'Bungee' }, pt(1, 1)); A.select([g]); await sleep(20);
      setInput($('[data-text="family"]'), 'Yellowtail'); expect(g.data.params.family).toBe('Yellowtail');
      setInput($('[data-text="size"]'), '144'); expect(g.data.params.size).toBe(144);
      const h0 = g.bounds.height; setInput($('[data-text="curve"]'), '60', 'input'); await until(() => g.data.params.curve === 60, 3000, 'curve');
      expect(g.bounds.height).toBeGreaterThan(h0);
      setInput($('[data-text="letterSpacing"]'), '100'); expect(g.data.params.letterSpacing).toBe(100);
      const w = $('[data-text="weld"]'); w.checked = false; w.dispatchEvent(new W.Event('change', { bubbles: true })); expect(g.children.length).toBeGreaterThan(1);
      $$('[data-align]')[1].click(); expect(g.data.params.align).toBe('center'); noErrors();
    });
    it('convert to outlines; text survives undo and project round-trip', async () => {
      await fresh(); const g = A.addText({ text: 'Keep me', family: 'Damion' }, pt(1, 1));
      const json = A.projectJSON(); await A.openProject(json);
      const g2 = A.designItems()[0]; expect(g2.data.type).toBe('text'); expect(g2.data.params.text).toBe('Keep me');
      A.select([g2]); UI.run('outlines'); expect(A.designItems()[0].data.type).toBe(undefined);
      UI.run('undo'); expect(A.designItems()[0].data.type).toBe('text'); noErrors();
    });
  });

  describe('Pathfinder, offset, align', () => {
    it('weld / minus / intersect / exclude / divide via buttons', async () => {
      const go = async (act) => { await fresh(); rect(1, 1, 2, 2, '#ff0000'); rect(2, 2, 2, 2, '#0000ff'); A.selectAll(); await sleep(5); $(`[data-action="${act}"]`).click(); return A.designItems(); };
      let r = await go('weld'); expect(r.length).toBe(1); expect(Math.abs(r[0].area)).toBeCloseTo(inch(2) * inch(2) * 2 - inch(1) * inch(1), 5);
      r = await go('minus'); expect(r.length).toBe(1); expect(CIF.util.colorHex(r[0].fillColor)).toBe('#ff0000');
      r = await go('intersect'); expect(Math.abs(r[0].area)).toBeCloseTo(inch(1) * inch(1), 5);
      r = await go('exclude'); expect(Math.abs(r[0].area)).toBeCloseTo(inch(2) * inch(2) * 2 - 2 * inch(1) * inch(1), 5);
      r = await go('divide'); expect(r.length).toBe(3); noErrors();
    });
    it('pathfinder with one object warns instead of failing', async () => {
      await fresh(); rect(1, 1, 1, 1); A.selectAll(); expect(A.pathfinder('unite')).toBe(false); noErrors();
    });
    it('offset makes a contour behind the shape', async () => {
      await fresh(); rect(2, 2, 2, 2); A.selectAll(); await sleep(5);
      setInput($('[data-off="dist"]'), '0.25'); $('[data-action="offsetApply"]').click();
      const items = A.designItems(); expect(items.length).toBe(2); expect(items[0].bounds.width).toBeCloseTo(inch(2.5), 2); noErrors();
    });
    it('align and distribute', async () => {
      await fresh(); const a = rect(1, 1, 1, 1), b = rect(3, 4, 1, 1), c = rect(8, 2, 1, 1); A.selectAll();
      $('[data-action="alT"]').click(); expect(A.designItems().every(i => Math.abs(i.bounds.y - inch(1)) < 0.01)).toBe(true);
      A.designItems()[1].translate(new P.Point(inch(-1.5), 0)); A.selectAll(); $('[data-action="disH"]').click();
      const xs = A.designItems().map(i => i.bounds.x).sort((p, q) => p - q); expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 0.01);
      A.select([A.designItems()[0]]); $('[data-action="alH"]').click(); expect(A.designItems()[0].bounds.center.x).toBeCloseTo(A.matArea().center.x, 0.01); noErrors();
    });
    it('smooth reduces nodes on a jagged path', async () => {
      await fresh(); const p = new P.Path({ closed: true, fillColor: '#000', insert: false });
      for (let i = 0; i < 300; i++) { const t = i / 300 * Math.PI * 2; const r = inch(1) + (i % 2 ? 0.4 : -0.4); p.add(new P.Point(inch(3) + Math.cos(t) * r, inch(3) + Math.sin(t) * r)); }
      A.add(p); A.commit('jag'); UI.run('smooth'); expect(CIF.geom.nodeCount(A.designItems()[0])).toBeLessThan(40); noErrors();
    });
  });

  describe('Image → cut file pipeline', () => {
    it('AI-style JPEG: auto background removal, pixel-perfect edges, 3-color trace, ready to cut', async () => {
      await fresh(); const r = await A.importImageURL(await aiLikeImage(), 'ai art');
      expect(r.className).toBe('Raster'); await sleep(30);
      expect($('[data-action="bgAuto"]')).toBeTruthy();
      $('[data-action="bgAuto"]').click(); await until(() => A.rasterStats(A.selectedRaster()).clearPct > 0.4, 8000, 'bg removed');
      $('[data-action="cleanEdges"]').click(); await until(() => A.rasterStats(A.selectedRaster()).soft === 0, 8000, 'clean edges');
      setInput($('[data-img="colors"]'), '4', 'input');
      UI.img.ignoreWhite = null; $('[data-action="traceNow"]').click();
      const g = A.designItems().find(i => i.className === 'Group'); expect(!!g).toBe(true);
      expect(g.children.length).toBeGreaterThan(2); expect(g.children.length).toBeLessThan(5);
      const cols = g.children.map(c => CIF.util.parseColor(CIF.util.colorHex(c.fillColor)));
      expect(cols.some(c => c.r > 150 && c.g < 90)).toBe(true); expect(cols.some(c => c.b > 120 && c.r < 80)).toBe(true); expect(cols.some(c => c.r < 60 && c.g < 60 && c.b < 60)).toBe(true);
      expect(A.designItems().find(i => i.className === 'Raster').visible).toBe(false);
      const res = A.runCutCheck(); expect(res.issues.some(i => i.rule === 'image')).toBe(false);
      expect(res.issues.some(i => i.rule === 'jaggy')).toBe(false);
      const { svg } = A.exportSVG(); expect((svg.match(/<path /g) || []).length).toBe(g.children.length); noErrors();
    }, 60000);
    it('Image Trace presets, live re-trace that follows move/resize, views, merge colors, expand', async () => {
      await fresh(); const r = await A.importImageURL(await aiLikeImage(), 'art'); await sleep(30);
      $('[data-tpreset="c3"]').click(); await until(() => A.preview.children.length > 0, 8000, 'preview');
      expect(UI.img.colors).toBe(3); $('[data-action="traceNow"]').click();
      let t = A.selection[0]; expect(!!t.data.trace).toBe(true); expect(!!$('[data-action="retrace"]')).toBe(true);
      expect($$('[data-tcolor]').length).toBe(A.traceParts(t).length);
      t.scale(0.5, t.bounds.topLeft); t.translate(new P.Point(inch(-1), inch(-0.5))); A.commit('move'); const b = t.bounds.clone();
      $('[data-tpreset="bwlogo"]').click(); await sleep(250); $('[data-action="retrace"]').click();
      t = A.selection[0]; expect(t.data.trace.opts.mode).toBe('dark');
      expect(Math.abs(t.bounds.center.x - b.center.x)).toBeLessThan(inch(0.3)); expect(t.bounds.width).toBeLessThan(b.width * 1.2);
      for (const v of ['outlines', 'source', 'result']) { $(`[data-tview="${v}"]`).click(); await sleep(250); }
      $('[data-tpreset="layered"]').click(); await sleep(250); $('[data-action="retrace"]').click(); t = A.selection[0];
      const n = A.traceParts(t).length; expect(n).toBeGreaterThan(1);
      const sel = $('[data-tmerge="1"]'); sel.value = '0'; sel.dispatchEvent(new W.Event('change', { bubbles: true })); expect(A.traceParts(A.selection[0]).length).toBe(n - 1);
      $('[data-tdel="0"]').click(); expect(A.traceParts(A.selection[0]).length).toBe(Math.max(1, n - 2));
      UI.run('undo'); UI.run('undo'); A.select([A.designItems().find(i => i.data && i.data.trace)]); await sleep(20);
      $('[data-action="expandTrace"]').click(); expect(!!A.selection[0].data.trace).toBe(false);
      expect(A.designItems().some(i => i.className === 'Raster')).toBe(false); noErrors();
    }, 60000);
    it('live trace survives save/open and can still be re-traced', async () => {
      await fresh(); const r = await A.importImageURL(await aiLikeImage(), 'art'); A.trace(r, UI.traceOpts(), UI.traceUI());
      await A.openProject(A.projectJSON()); const t = A.designItems().find(i => i.data && i.data.trace); expect(!!t).toBe(true);
      await W.CI.rasterReady(A.traceSource(t)); A.select([t]); await sleep(20);
      UI.img.colors = 2; UI.img.mode = 'colors'; $('[data-action="retrace"]').click(); expect(!!A.selection[0].data.trace).toBe(true); noErrors();
    }, 60000);
    it('magic eraser removes a clicked color; Shift = everywhere', async () => {
      await fresh(); const r = await A.importImageURL(await aiLikeImage(), 'img'); key('w'); expect(T.tool).toBe('eraser');
      const before = A.rasterStats(r).clearPct; const corner = r.bounds.topLeft.add(new P.Point(3, 3));
      ptr('pointerdown', corner); ptr('pointerup', corner);
      await until(() => A.rasterStats(A.designItems()[0]).clearPct > before + 0.3, 8000, 'erase'); noErrors();
    }, 30000);
    it('trace preview shows pink cut lines and clears on deselect', async () => {
      await fresh(); await A.importImageURL(await aiLikeImage(), 'img'); UI.img.preview = true; UI.renderDesign(true);
      await until(() => A.preview.children.length > 0, 5000, 'preview'); UI.run('deselect'); expect(A.preview.children.length).toBe(0); noErrors();
    }, 30000);
    it('image edits undo/redo correctly', async () => {
      await fresh(); const r = await A.importImageURL(await aiLikeImage(), 'img'); await A.removeBackground(r, 14);
      const cleared = A.rasterStats(A.designItems()[0]).clearPct; expect(cleared).toBeGreaterThan(0.3);
      UI.run('undo'); await W.CI.rasterReady(A.designItems()[0]); await sleep(50); expect(A.rasterStats(A.designItems()[0]).clearPct).toBeLessThan(0.05);
      UI.run('redo'); await W.CI.rasterReady(A.designItems()[0]); await sleep(50); expect(A.rasterStats(A.designItems()[0]).clearPct).toBeCloseTo(cleared, 0.02); noErrors();
    }, 30000);
    it('line-art and silhouette modes trace', async () => {
      await fresh(); const r = await A.importImageURL(await aiLikeImage(), 'img');
      const res1 = A.trace(r, { mode: 'dark', threshold: 100, tolerance: 1.2, despeckle: 20 }); expect(CIF.geom.isPathLike(res1)).toBe(true);
      const r2 = await A.importImageURL(await aiLikeImage(), 'img2'); await A.removeBackground(r2, 14);
      const res2 = A.trace(r2, { mode: 'alpha', tolerance: 1.2, despeckle: 30 }); expect(CIF.geom.isPathLike(res2)).toBe(true); noErrors();
    }, 30000);
  });

  describe('Cut check UI & fixes', () => {
    it('hairline → warning card → Show highlights → Thicken fixes it', async () => {
      await fresh(); rect(1, 1, 3, 0.03); A.runCutCheck(); UI.showTab('check');
      const idx = A.issues.findIndex(i => i.rule === 'thin'); expect(idx).toBeGreaterThan(-1);
      $(`[data-issue="${idx}"][data-do="show"]`).click(); expect(A.overlay.children.length).toBeGreaterThan(0);
      $(`[data-issue="${idx}"][data-do="fix"]`).click(); await sleep(10);
      expect(A.issues.some(i => i.rule === 'thin')).toBe(false); noErrors();
    });
    it('overlap → Weld fix leaves one shape and no overlap', async () => {
      await fresh(); rect(1, 1, 2, 2); rect(2, 2, 2, 2); A.runCutCheck();
      const issue = A.issues.find(i => i.rule === 'overlap'); expect(!!issue).toBe(true);
      A.applyFix(issue); expect(A.designItems().length).toBe(1); expect(A.runCutCheck().issues.some(i => i.rule === 'overlap')).toBe(false); noErrors();
    });
    it('tiny pieces / holes fixes', async () => {
      await fresh(); const hole = new P.Path.Rectangle({ point: [inch(1.5), inch(1.5)], size: [inch(0.04), inch(0.04)], insert: false }); hole.reverse();
      const cp = new P.CompoundPath({ children: [new P.Path.Rectangle({ point: [inch(1), inch(1)], size: [inch(2), inch(2)], insert: false }), hole, new P.Path.Rectangle({ point: [inch(5), inch(1)], size: [inch(0.05), inch(0.05)], insert: false })], fillColor: '#000', insert: false });
      A.add(cp); A.commit('cp'); A.runCutCheck();
      A.applyFix(A.issues.find(i => i.rule === 'tinypiece')); A.runCutCheck(); expect(A.issues.some(i => i.rule === 'tinypiece')).toBe(false);
      A.applyFix(A.issues.find(i => i.rule === 'tinyhole')); A.runCutCheck(); expect(A.issues.some(i => i.rule === 'tinyhole')).toBe(false); noErrors();
    });
    it('jagged trace → Smooth fix', async () => {
      await fresh(); const p = new P.Path({ closed: true, fillColor: '#000', insert: false }); let x = inch(1), y = inch(1);
      for (let i = 0; i < 150; i++) { p.add([x, y]); x += 1; p.add([x, y]); y += 1; } p.add([inch(1), y]); A.add(p); A.commit('jag'); A.runCutCheck();
      const j = A.issues.find(i => i.rule === 'jaggy'); expect(!!j).toBe(true); A.applyFix(j);
      expect(A.runCutCheck().issues.some(i => i.rule === 'jaggy')).toBe(false); noErrors();
    });
    it('too big → fit to mat; HTV → mirror fix', async () => {
      await fresh(); rect(0, 0, 30, 5); A.runCutCheck(); const big = A.issues.find(i => i.rule === 'mat'); expect(big.severity).toBe('error');
      A.applyFix(big); expect(A.runCutCheck().issues.some(i => i.rule === 'mat')).toBe(false);
      A.setMaterial('htv'); A.doc.mirror = false; A.runCutCheck(); const m = A.issues.find(i => i.rule === 'mirror'); A.applyFix(m); expect(A.doc.mirror).toBe(true); noErrors();
    });
    it('status pill reflects state', async () => {
      await fresh(); rect(1, 1, 2, 2); A.runCutCheck(); expect($('#status-pill').textContent).toContain('Ready');
      rect(5, 5, 3, 0.02); A.runCutCheck(); expect($('#status-pill').className).toContain('warn'); noErrors();
    });
    it('editing material rules re-checks with new thresholds', async () => {
      await fresh(); rect(1, 1, 3, 0.1); A.runCutCheck(); expect(A.issues.some(i => i.rule === 'thin')).toBe(false);
      UI.showTab('check'); setInput($('[data-mat="minFeature"]'), '0.25'); A.runCutCheck(); expect(A.issues.some(i => i.rule === 'thin')).toBe(true);
      UI.run('resetMaterial'); A.runCutCheck(); expect(A.issues.some(i => i.rule === 'thin')).toBe(false); noErrors();
    });
  });

  describe('Vintage distress UI', () => {
    it('preset → preview → apply keeps original hidden, passes cut check, undo restores text', async () => {
      await fresh(); const g = A.addText({ text: 'RETRO', family: 'Alfa Slab One', size: 120 }, pt(1, 1)); A.select([g]); await sleep(20);
      expect(!!$('[data-dpreset="grunge"]')).toBe(true);
      $('[data-dpreset="grunge"]').click(); await until(() => A.preview.children.length > 0, 8000, 'distress preview');
      $('[data-action="distressSeed"]').click(); await sleep(50);
      $('[data-action="distressApply"]').click();
      const items = A.designItems(); expect(items.length).toBe(2); expect(items[0].visible).toBe(false); expect(items[1].data.name).toContain('Distressed');
      const r = A.runCutCheck(); expect(r.issues.filter(i => ['thin', 'tinypiece', 'tinyhole'].includes(i.rule)).length).toBe(0);
      UI.run('undo'); expect(A.designItems().length).toBe(1); expect(A.designItems()[0].data.type).toBe('text'); expect(A.designItems()[0].visible).toBe(true); noErrors();
    }, 60000);
    it('edges-only checkbox shows the band slider and the Worn edges preset turns it on', async () => {
      await fresh(); rect(1, 1, 3, 3); A.selectAll(); await sleep(20);
      expect(!!$('[data-dist="band"]')).toBe(false);
      const cb = $('[data-dist="edgeOnly"]'); cb.checked = true; cb.dispatchEvent(new W.Event('input', { bubbles: true }));
      await sleep(20); expect(UI.dist.edgeOnly).toBe(true); expect(!!$('[data-dist="band"]')).toBe(true);
      $('[data-dpreset="light"]').click(); await sleep(20); expect(UI.dist.edgeOnly).toBe(false);
      $('[data-dpreset="edges"]').click(); await sleep(20); expect(UI.dist.edgeOnly).toBe(true);
      $('[data-action="distressApply"]').click(); const res = A.designItems().find(i => i.visible);
      expect(res.contains(pt(2.5, 2.5))).toBe(true); noErrors();
    }, 30000);
    it('Subtle rough edges preset: edge texture only, no wear or cracks', async () => {
      await fresh(); const g = A.addText({ text: 'ROUGH', family: 'Alfa Slab One', size: 120 }, pt(1, 1)); A.select([g]); await sleep(20);
      $('[data-dpreset="subtle"]').click(); await sleep(20);
      expect(UI.dist.texture).toBeGreaterThan(0); expect(UI.dist.wear).toBe(0); expect(UI.dist.cracks).toBe(0); expect(!!$('[data-dist="texture"]')).toBe(true);
      $('[data-action="distressApply"]').click(); const r = A.runCutCheck();
      expect(r.issues.filter(i => ['thin', 'tinypiece', 'tinyhole', 'jaggy', 'complex'].includes(i.rule)).length).toBe(0); noErrors();
    }, 30000);
    it('live distress: New pattern re-scrambles from the ORIGINAL (no compounding); Remove restores it', async () => {
      await fresh(); const g = A.addText({ text: 'WOBBLE', family: 'Alfa Slab One', size: 110 }, pt(1, 1)); A.select([g]); await sleep(20);
      $('[data-dpreset="subtle"]').click(); await sleep(20); $('[data-action="distressApply"]').click();
      const r1 = A.selection[0]; expect(!!r1.data.distress).toBe(true); const d1 = r1.pathData || r1.exportJSON(); const a1 = Math.abs(r1.area);
      expect(!!$('[data-action="distressRemove"]')).toBe(true);
      for (let k = 0; k < 4; k++) { $('[data-action="distressSeed"]').click(); await sleep(10); }
      const r2 = A.selection[0]; expect(A.designItems().length).toBe(2); expect(!!r2.data.distress).toBe(true);
      expect((r2.pathData || r2.exportJSON()) === d1).toBe(false);
      expect(Math.abs(Math.abs(r2.area) - a1) / a1).toBeLessThan(0.03);   // re-scrambles never pile up on each other
      $('[data-action="distressRemove"]').click(); expect(A.designItems().length).toBe(1); expect(A.designItems()[0].visible).toBe(true); expect(A.designItems()[0].data.type).toBe('text');
      UI.run('undo'); expect(A.designItems().length).toBe(2); noErrors();
    }, 60000);
    it('sliders update settings; distress with nothing selected warns', async () => {
      await fresh(); rect(1, 1, 3, 2); A.selectAll(); await sleep(20);
      setInput($('[data-dist="wear"]'), '0.2', 'input'); expect(UI.dist.wear).toBe(0.2); expect(UI.dist.preset).toBe(null);
      A.clearSelection(); UI.run('distressApply'); expect(A.designItems().length).toBe(1); noErrors();
    }, 30000);
  });

  describe('Weeding, expand, placement, my vinyl', () => {
    it('Expand thin lines fixes a hairline; Bolder grows edges', async () => {
      await fresh(); const r = rect(1, 1, 4, 0.025); A.select([r]); await sleep(10);
      $('[data-action="expandThin"]').click();
      expect(A.selection[0].bounds.height).toBeGreaterThan(inch(0.0625)); expect(A.runCutCheck().issues.some(i => i.rule === 'thin')).toBe(false);
      const b0 = A.selection[0].bounds.clone(); UI.boldAmt = 0.05; $('[data-action="bolder"]').click();
      expect(A.selection[0].bounds.width).toBeCloseTo(b0.width + inch(0.1), 2); noErrors();
    });
    it('weed box from the Export panel follows the design, exports, survives save/open, and removes', async () => {
      await fresh(); A.addText({ text: 'WEED ME', family: 'Bungee', size: 72 }, pt(1, 1)); A.clearSelection(); UI.showTab('export'); await sleep(10);
      $('[data-weedlines="both"]').click(); $('#panel-export [data-action="weedBox"]').click();
      expect(A.weedBoxes().length).toBe(1); expect(A.weedBoxes()[0].data.opts.lines).toBe('both');
      const text = A.designItems().find(i => i.data.type === 'text'); A.select([text]); A.nudge(inch(2), inch(1));
      expect(A.weedBoxes()[0].bounds.contains(text.bounds)).toBe(true);
      expect(A.runCutCheck().issues.filter(i => ['weedbox', 'thin', 'overlap'].includes(i.rule)).length).toBe(0);
      const svg = A.exportSVG().svg; expect((svg.match(/<path /g) || []).length).toBeGreaterThan(2);
      await A.openProject(A.projectJSON()); expect(A.weedBoxes().length).toBe(1);
      UI.showTab('export'); await sleep(10); $('#panel-export [data-action="weedRemove"]').click(); expect(A.weedBoxes().length).toBe(0);
      UI.run('undo'); expect(A.weedBoxes().length).toBe(1); noErrors();
    });
    it('placement presets size the design; mockup renders and switches garments/colors', async () => {
      await fresh(); rect(1, 1, 2, 1); A.clearSelection(); UI.showTab('design'); await sleep(10);
      setInput($('[data-place]'), 'left_chest'); $('[data-action="placeFit"]').click();
      expect(A.designItems()[0].bounds.width).toBeCloseTo(inch(3.5), 0.05);
      UI.run('mockup'); expect(!!$('#modal-card svg')).toBe(true);
      $('[data-mock-color="#1b1b1d"]').click(); expect(A.doc.garmentColor).toBe('#1b1b1d');
      const ps = $('#mock-place'); ps.value = 'onesie'; ps.dispatchEvent(new W.Event('change', { bubbles: true })); expect(UI.place).toBe('onesie');
      $('[data-mock-fit]').click(); expect(A.designItems()[0].bounds.width).toBeCloseTo(inch(4), 0.05);
      $('#modal').hidden = true; noErrors();
    });
    it('My vinyl: edit palette, trace with it, snap colors, label export layers', async () => {
      await fresh(); CIF.vinyl.save([{ name: 'Siser Black', hex: '#111111' }, { name: 'Cherry', hex: '#c8102e' }]);
      UI.run('myVinyl'); expect($$('[data-vhex]').length).toBe(2); $('[data-vadd]').click(); expect(CIF.vinyl.list().length).toBe(3); $$('[data-vdel]')[2].click(); expect(CIF.vinyl.list().length).toBe(2); $('#modal').hidden = true;
      const r = await A.importImageURL(await aiLikeImage(), 'art'); await sleep(20); UI.img.mode = 'colors'; UI.img.colors = 4; UI.img.useVinyl = true;
      const res = A.trace(r, UI.traceOpts(), UI.traceUI());
      A.traceParts(res).forEach(p => expect(['#111111', '#c8102e']).toContain(CIF.util.colorHex(p.fillColor)));
      const x = rect(8, 8, 1, 1, '#d02030'); A.select([x]); UI.run('snapVinyl'); expect(CIF.util.colorHex(x.fillColor)).toBe('#c8102e');
      UI.showTab('export'); expect($('#panel-export').textContent).toContain('Cherry');
      CIF.vinyl.reset(); UI.img.useVinyl = false; noErrors();
    }, 30000);
  });

  describe('Registration marks & material saver', () => {
    it('registration marks: every color, same spots, follow the design, clean cut check, export aligned', async () => {
      await fresh(); const c = new P.Path.Circle({ center: [inch(5), inch(4)], radius: inch(2), fillColor: '#c8102e', insert: false }); A.add(c, { select: false }); A.commit('c');
      const t = A.addText({ text: 'RAD', family: 'Bungee', size: 90, color: '#111111' }, pt(3.6, 3.5)); A.clearSelection(); UI.showTab('export'); await sleep(10);
      setInput($('[data-reg="where"]'), 'corners'); $('[data-action="regAdd"]').click();
      const m = A.regMarks(); expect(m.length).toBe(2); expect(m[0].children.length).toBe(4);
      expect(m.map(g => g.children.map(k => k.bounds.center.round().toString()).join(';')).reduce((x, y) => x === y ? x : null)).toBeTruthy();
      expect(A.runCutCheck().issues.filter(i => ['thin', 'tinypiece', 'tinyhole', 'overlap'].includes(i.rule)).length).toBe(0);
      A.select([c, t]); A.nudge(inch(1), 0); expect(A.regMarks()[0].children[0].bounds.center.x).toBeLessThan(c.bounds.left);
      const w = ['#c8102e', '#111111'].map(col => A.exportSVG({ only: col }).svg.match(/width="([\d.]+)in"/)[1]); expect(w[0]).toBe(w[1]);
      await A.openProject(A.projectJSON()); expect(A.regMarks().length).toBe(2);
      UI.showTab('export'); await sleep(10); $('[data-action="regRemove"]').click(); expect(A.regMarks().length).toBe(0); UI.run('undo'); expect(A.regMarks().length).toBe(2); noErrors();
    }, 30000);
    it('material saver: shows savings, packs the export, previews mats, and is blocked by a weed box', async () => {
      await fresh(); for (let i = 0; i < 6; i++) { const s = A.makeShape('star', new P.Rectangle(pt(0.2 + (i % 3) * 4, 0.2 + Math.floor(i / 3) * 7), new P.Size(inch(2.2), inch(2.2)))); A.add(s, { select: false }); }
      A.commit('stars'); A.clearSelection(); UI.showTab('export'); await sleep(10);
      expect($('#panel-export').textContent).toContain('saves');
      const h0 = parseFloat(A.exportSVG().svg.match(/height="([\d.]+)in"/)[1]);
      const cb = $('[data-pack="on"]'); cb.checked = true; cb.dispatchEvent(new W.Event('change', { bubbles: true })); await sleep(10);
      expect(A.doc.pack).toBe(true); const h1 = parseFloat(A.exportSVG().svg.match(/height="([\d.]+)in"/)[1]); expect(h1).toBeLessThan(h0 * 0.7);
      UI.run('matsPreview'); expect($$('#modal-card svg').length).toBe(1); $('#modal').hidden = true;
      $('#panel-export [data-action="weedBox"]').click(); await sleep(10);
      expect(!!$('[data-pack="on"]').disabled).toBe(true); expect(parseFloat(A.exportSVG().svg.match(/height="([\d.]+)in"/)[1])).toBeGreaterThan(h0 * 0.95);
      expect(A.designItems().every(i => i.data && i.data.weed || i.bounds.y < inch(10))).toBe(true); noErrors();
    }, 30000);
  });

  describe('Slice, stencil, effects, copies, wizard', () => {
    it('knife tool (K) slices a shape in two with a gap; undo restores it', async () => {
      await fresh(); rect(1, 1, 3, 2); key('k'); expect(T.tool).toBe('knife');
      await drag(pt(2.5, 0.5), pt(2.5, 3.5));
      const items = A.designItems(); expect(items.length).toBe(2);
      const ws = items.map(i => i.bounds.width).sort((x, y) => x - y); expect(ws[0]).toBeCloseTo(inch(1.485), 0.02); expect(ws[1]).toBeCloseTo(inch(1.485), 0.02);
      UI.run('undo'); expect(A.designItems().length).toBe(1); noErrors();
    });
    it('Slice: a line on top cuts like a knife; a closed shape on top splits inside/outside', async () => {
      await fresh(); const r = rect(1, 1, 3, 2); const l = A.makeShape('line', null, { from: pt(0.5, 2), to: pt(4.5, 2) }); A.add(l); A.commit('l');
      A.select([r, l]); $('[data-action="sliceTop"]').click(); expect(A.designItems().length).toBe(2);
      await fresh(); const r2 = rect(1, 1, 3, 2); const c = new P.Path.Circle({ center: pt(2.5, 2), radius: inch(0.6), fillColor: '#ff0000', insert: false }); A.add(c, { select: false }); A.commit('c');
      A.select([r2, c]); UI.run('sliceTop'); expect(A.designItems().length).toBe(2);
      expect(A.designItems().some(i => Math.abs(Math.abs(i.area) - Math.PI * inch(0.6) ** 2) < inch(0.05) ** 2 * 40)).toBe(true); noErrors();
    });
    it('stencil bridges: no enclosed middles remain, cut check stays clean', async () => {
      await fresh(); const t = A.addText({ text: 'BOAR', family: 'Bungee', size: 100 }, pt(1, 1)); A.select([t]); await sleep(10);
      $('[data-action="bridges"]').click();
      const items = A.designItems(); const b = items.map(i => i.bounds).reduce((x, y) => x.unite(y)); const ppu = CIF.geom.pickPPU(b, 200);
      const r = CIF.geom.rasterize(items.flatMap(i => CIF.geom.leafPaths(i).map(CIF.geom.globalCopy)), b, ppu, { pad: 4 });
      expect(CIF.mask.label(CIF.mask.not(r.mask), 4).comps.filter(c => !c.touchesBorder).length).toBe(0);
      expect(A.runCutCheck().issues.filter(i => ['thin', 'tinypiece', 'tinyhole'].includes(i.rule)).length).toBe(0); noErrors();
    });
    it('one-gap bridges keep every letter in ONE piece (paper spray-paint stencil); stencil-font mode splits them', async () => {
      const run = async (mode) => {
        await fresh(); const t = A.addText({ text: 'BOAR', family: 'Alfa Slab One', size: 110, weld: false }, pt(1, 1)); A.select([t]); await sleep(10);
        setInput($('[data-bridge="dir"]'), mode); $('[data-action="bridges"]').click();
        const pieces = A.designItems().reduce((n, i) => n + CIF.geom.leafPaths(i).length, 0);
        const items = A.designItems(); const b = items.map(i => i.bounds).reduce((x, y) => x.unite(y)); const ppu = CIF.geom.pickPPU(b, 200);
        const r = CIF.geom.rasterize(items.flatMap(i => CIF.geom.leafPaths(i).map(CIF.geom.globalCopy)), b, ppu, { pad: 4 });
        return { pieces, loose: CIF.mask.label(CIF.mask.not(r.mask), 4).comps.filter(c => !c.touchesBorder).length };
      };
      for (const m of ['auto', 'left', 'top']) { const r = await run(m); expect(m + ':' + r.pieces + '/' + r.loose).toBe(m + ':4/0'); }
      const across = await run('across-v'); expect(across.loose).toBe(0); expect(across.pieces).toBeGreaterThan(4);
      noErrors();
    }, 60000);
    it('text effects: outline/shadow layer, knockout badge, split monogram', async () => {
      await fresh(); const t = A.addText({ text: 'RAD', family: 'Bungee', size: 90 }, pt(2, 2)); A.select([t]); await sleep(10);
      UI.fx.shift = 0.06; $('[data-action="fxOutline"]').click();
      expect(A.designItems().length).toBe(2); expect(A.designItems()[0].index).toBe(0); expect(CIF.util.colorHex(CIF.geom.leafPaths(A.designItems()[0])[0].fillColor)).toBe('#c8102e');
      await fresh(); const t2 = A.addText({ text: 'MOM', family: 'Bungee', size: 60 }, pt(2, 2)); A.select([t2]); await sleep(10);
      setInput($('[data-fx="koShape"]'), 'rounded'); $('[data-action="fxKnockout"]').click();
      const ko = A.designItems(); expect(ko.length).toBe(1); expect(ko[0].className).toBe('CompoundPath'); expect(Math.abs(ko[0].area)).toBeLessThan(ko[0].bounds.width * ko[0].bounds.height * 0.95);
      await fresh(); const big = A.addText({ text: 'M', family: 'Bungee', size: 400, color: '#111111' }, pt(1, 1)); const nm = A.addText({ text: 'NAME', family: 'Bungee', size: 40, color: '#c8102e' }, pt(1, 3)); nm.position = big.bounds.center;
      A.select([big, nm]); await sleep(10); $('[data-action="fxSplit"]').click();
      const parts = A.designItems().filter(i => CIF.util.colorHex(CIF.geom.leafPaths(i)[0].fillColor) === '#111111');
      expect(parts.length).toBeGreaterThan(1);
      parts.forEach(p => expect(p.bounds.intersects(nm.bounds.expand(-2))).toBe(false)); noErrors();
    }, 30000);
    it('make copies and fill the mat: all on the mat, no overlaps', async () => {
      await fresh(); const s = A.makeShape('star', new P.Rectangle(pt(1, 1), new P.Size(inch(2), inch(2)))); A.add(s); A.commit('s'); await sleep(10);
      setInput($('[data-copies]'), '6'); $('[data-action="copies"]').click(); expect(A.designItems().length).toBe(6);
      A.select([A.designItems()[0]]); A.selection.length; await fresh(); const s2 = A.makeShape('star', new P.Rectangle(pt(1, 1), new P.Size(inch(2), inch(2)))); A.add(s2); A.commit('s');
      UI.run('copiesFill'); const it = A.designItems(); expect(it.length).toBe(25);
      expect(it.every(i => A.matArea().contains(i.bounds))).toBe(true);
      for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) expect(it[i].bounds.intersects(it[j].bounds)).toBe(false);
      noErrors();
    }, 30000);
    it('start wizard sets material, mirror, mat and garment', async () => {
      await fresh(); UI.run('wizard'); $('[data-wiz="foam"]').click(); expect(A.doc.material).toBe('foam2mm'); expect(A.doc.mat).toBe('12x24'); expect($('#modal').hidden).toBe(true);
      UI.run('wizard'); $('[data-wiz="shirt"]').click(); expect(A.doc.mirror).toBe(true); $('[data-wizg="onesie"]').click(); expect(UI.place).toBe('onesie'); expect(A.doc.material).toBe('htv');
      UI.run('wizard'); $('[data-wiz="decal"]').click(); expect(A.doc.material).toBe('vinyl'); expect(A.doc.mirror).toBe(false);
      A.setMat('12x12'); noErrors();
    });
  });

  describe('Export, save, import, layers', () => {
    it('export panel lists cut layers and downloads a valid mirrored SVG', async () => {
      await fresh(); rect(1, 1, 2, 1, '#ff0000'); rect(1, 3, 1, 1, '#0000ff'); UI.showTab('export');
      expect($$('.cut-layer').length).toBe(2);
      const m = $('[data-exp="mirror"]'); m.checked = true; m.dispatchEvent(new W.Event('change', { bubbles: true }));
      $('#panel-export [data-action="exportSVG"]').click();
      const d = downloads.find(x => x.name.endsWith('.svg')); expect(!!d).toBe(true);
      expect(d.data).toContain('width="2in"'); expect(new W.DOMParser().parseFromString(d.data, 'image/svg+xml').querySelector('parsererror')).toBe(null);
      const back = CIF.exporter.importSVG(d.data); const blue = CIF.geom.leafPaths(back).find(p => CIF.util.colorHex(p.fillColor) === '#0000ff');
      expect(blue.bounds.x).toBeCloseTo(inch(1), 0.1); // mirrored: small square moves to the right side
      downloads = []; $('#panel-export [data-action="exportColors"]').click(); await sleep(900); expect(downloads.length).toBe(2); noErrors();
    });
    it('project save → open round-trip keeps images, text, settings', async () => {
      await fresh(); A.setMaterial('cardstock'); await A.importImageURL(await aiLikeImage(), 'pic'); A.addText({ text: 'Saved', family: 'Fredoka' }, pt(1, 8)); rect(5, 5, 1, 1, '#2fa84f');
      UI.run('save'); const d = downloads.find(x => x.name.endsWith('.kerf')); expect(!!d).toBe(true);
      A.newDocument(); expect(A.designItems().length).toBe(0);
      await A.openProject(d.data); const items = A.designItems();
      expect(items.length).toBe(3); expect(items[0].className).toBe('Raster'); expect(items[0].width).toBe(600); expect(items[1].data.params.text).toBe('Saved'); expect(A.doc.material).toBe('cardstock');
      let threw = false; try { await A.openProject('{"nope":1}'); } catch (e) { threw = true; } expect(threw).toBe(true); noErrors();
    }, 30000);
    it('imports SVG files with units, and fonts', async () => {
      await fresh(); const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50.8mm" height="25.4mm" viewBox="0 0 200 100"><path d="M0 0H200V100H0Z" fill="#c8102e"/></svg>';
      const it = A.importSVGText(svg, 'logo.svg'); expect(it.bounds.width).toBeCloseTo(inch(2), 0.05);
      const file = new W.File([svg], 'logo2.svg', { type: 'image/svg+xml' }); await A.importFile(file); expect(A.designItems().length).toBe(2);
      const bin = W.atob(CIF.BUNDLED_FONTS.find(f => f.family === 'Bungee').data); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const n0 = CIF.fonts.list.length; await A.importFile(new W.File([u8], 'MyFont.woff')); expect(CIF.fonts.list.length).toBe(n0); // same family+weight replaces, no duplicate
      let bad = false; try { await A.importFile(new W.File(['x'], 'notes.txt')); } catch (e) { bad = true; } expect(bad).toBe(true); noErrors();
    });
    it('layers panel: select, hide, lock, reorder, delete', async () => {
      await fresh(); rect(1, 1, 1, 1, '#ff0000'); rect(3, 1, 1, 1, '#00ff00'); UI.showTab('layers');
      const rows = () => $$('#panel-layers .layer'); expect(rows().length).toBe(2);
      rows()[0].click(); expect(A.selection.length).toBe(1);
      rows()[0].querySelector('[data-op="vis"]').click(); expect(A.designItems()[1].visible).toBe(false);
      rows()[0].querySelector('[data-op="vis"]').click(); rows()[1].querySelector('[data-op="lock"]').click(); expect(A.designItems()[0].locked).toBe(true);
      rows()[0].querySelector('[data-op="down"]').click(); expect(CIF.util.colorHex(A.designItems()[0].fillColor)).toBe('#00ff00');
      rows()[0].querySelector('[data-op="del"]').click(); expect(A.designItems().length).toBe(1); noErrors();
    });
    it('cut preview toggles outline view', async () => {
      await fresh(); rect(1, 1, 1, 1); UI.run('cutPreview'); expect(A.overlay.children.some(c => c.data.cutPreview)).toBe(true); expect(A.design.opacity).toBeLessThan(1);
      UI.run('cutPreview'); expect(A.design.opacity).toBe(1); noErrors();
    });
  });

  describe('Robustness', () => {
    it('every menu and panel button runs without errors', async () => {
      await fresh(); rect(1, 1, 2, 2, '#ff0000'); rect(2, 2, 2, 2, '#0000ff'); A.addText({ text: 'All', family: 'Bungee' }, pt(5, 1));
      await A.importImageURL(await aiLikeImage(), 'img');
      const names = [...new Set($$('[data-action]').map(b => b.dataset.action))];
      for (const n of Object.keys(UI.actions)) if (!names.includes(n)) names.push(n);
      const skip = new Set(['new']);
      for (const n of names) {
        if (skip.has(n)) continue;
        A.selectAll(); if (n === 'traceNow' || n === 'bgAuto' || n === 'cleanEdges' || n === 'tracePreview') A.select([A.designItems().find(i => i.className === 'Raster') || A.designItems()[0]]);
        await UI.run(n); await sleep(5);
        const m = W.document.getElementById('modal'); if (!m.hidden) m.hidden = true;
      }
      await sleep(400); noErrors();
    }, 90000);
    it('fuzz: 400 random actions, then undo all the way back', async () => {
      await fresh(); let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const acts = ['duplicate', 'delete', 'group', 'ungroup', 'front', 'back', 'forward', 'backward', 'flipH', 'flipV', 'rot90', 'compound', 'release', 'weld', 'minus', 'intersect', 'exclude', 'divide', 'outlineStroke', 'smooth', 'alL', 'alV', 'disH', 'fitMat', 'outlines', 'offsetApply', 'copy', 'paste', 'cut', 'selectAll', 'deselect', 'checkNow'];
      const makers = [() => rect(rnd() * 8, rnd() * 8, 0.2 + rnd() * 3, 0.2 + rnd() * 3, ['#000000', '#c8102e', '#1f4ba5'][Math.floor(rnd() * 3)]), () => A.addText({ text: 'Fz' + Math.floor(rnd() * 99), family: ['Bungee', 'Damion', 'Yellowtail'][Math.floor(rnd() * 3)], curve: Math.round(rnd() * 80 - 40) }, pt(rnd() * 8, rnd() * 8)),
        () => { const l = A.makeShape('line', null, { from: pt(rnd() * 8, rnd() * 8), to: pt(rnd() * 8, rnd() * 8) }); A.add(l); A.commit('line'); }, () => { const s = A.makeShape('star', new P.Rectangle(pt(rnd() * 8, rnd() * 8), new P.Size(inch(1 + rnd() * 2), inch(1 + rnd() * 2)))); A.add(s); A.commit('star'); }];
      UI.offset.dist = 0.05;
      for (let i = 0; i < 400; i++) {
        if (A.designItems().length < 3 || rnd() < 0.2) makers[Math.floor(rnd() * makers.length)]();
        const items = A.designItems(); const k = 1 + Math.floor(rnd() * Math.min(4, items.length)); const pick = []; for (let j = 0; j < k; j++) pick.push(items[Math.floor(rnd() * items.length)]);
        A.select(pick); const act = acts[Math.floor(rnd() * acts.length)]; await UI.run(act);
        if (rnd() < 0.1) UI.run('undo');
        if (A.designItems().length > 60) { A.selectAll(); UI.run('delete'); }
      }
      A.runCutCheck();
      let guard = 0; while (A.history.canUndo() && guard++ < 200) A.history.undo();
      await sleep(50); noErrors();
    }, 180000);
    it('performance: 150 shapes check + export in reasonable time', async () => {
      await fresh(); for (let i = 0; i < 150; i++) { const r = new P.Path.Circle({ center: [inch(0.5 + (i % 15) * 0.7), inch(0.5 + Math.floor(i / 15) * 0.7)], radius: inch(0.3), fillColor: '#000', insert: false }); A.design.addChild(r); }
      A.commit('many'); const t0 = performance.now(); A.runCutCheck(); const t1 = performance.now(); A.exportSVG(); const t2 = performance.now();
      expect(t1 - t0).toBeLessThan(8000); expect(t2 - t1).toBeLessThan(8000); noErrors();
    }, 60000);
  });
})();
