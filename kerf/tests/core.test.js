/* Core engine tests: masks, image ops, background removal, tracing, cut checks, text, booleans, export. */
(function () {
  const UPI = CI.util.UPI;
  // helpers
  const maskFrom = (rows) => { const h = rows.length, w = rows[0].length; const m = CI.mask.create(w, h); rows.forEach((r, y) => [...r].forEach((c, x) => m.data[y * w + x] = c === '#' ? 1 : 0)); return m; };
  const rectMask = (w, h, x0, y0, x1, y1) => { const m = CI.mask.create(w, h); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.data[y * w + x] = 1; return m; };
  const img = (w, h, fn) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] == null ? 255 : c[3]; } return CI.imageops.makeImageData(w, h, d); };
  const inRect = (b, x, y) => x >= b.x - 1e-6 && y >= b.y - 1e-6 && x <= b.x + b.w + 1e-6 && y <= b.y + b.h + 1e-6;
  const rectPath = (x, y, w, h, color = '#000000') => new paper.Path.Rectangle({ point: [x, y], size: [w, h], fillColor: color, insert: false });
  const inch = (v) => v * UPI;
  const mat = (k) => CI.getMaterial(k);

  describe('Mask morphology', () => {
    it('distance transform is exact (Euclidean)', () => {
      const m = CI.mask.create(11, 11); m.data[5 * 11 + 5] = 1;
      const d = CI.mask.distSq(m, 1);
      expect(d[5 * 11 + 5]).toBe(0); expect(d[5 * 11 + 8]).toBe(9); expect(d[8 * 11 + 9]).toBe(9 + 16);
    });
    it('dilate grows a point into a disc of the right area', () => {
      const m = CI.mask.create(41, 41); m.data[20 * 41 + 20] = 1;
      const a = CI.mask.count(CI.mask.dilate(m, 10));
      expect(Math.abs(a - Math.PI * 100) / (Math.PI * 100)).toBeLessThan(0.05);
    });
    it('erode removes lines thinner than 2r and keeps thick ones', () => {
      const m = CI.mask.or(rectMask(60, 40, 5, 5, 55, 8), rectMask(60, 40, 5, 15, 55, 35));
      const e = CI.mask.erode(m, 3);
      expect(CI.mask.count(CI.mask.and(e, rectMask(60, 40, 0, 0, 60, 10)))).toBe(0);
      expect(CI.mask.count(CI.mask.and(e, rectMask(60, 40, 0, 15, 60, 35)))).toBeGreaterThan(0);
    });
    it('erode treats the image border as empty', () => {
      const m = CI.mask.create(10, 10, 1); expect(CI.mask.erode(m, 2).data[0]).toBe(0);
    });
    it('open/close preserve a big square', () => {
      const m = rectMask(50, 50, 10, 10, 40, 40);
      expect(CI.mask.count(CI.mask.close(m, 3))).toBe(900);
      expect(Math.abs(CI.mask.count(CI.mask.open(m, 3)) - 900)).toBeLessThan(30);
    });
    it('labels components with 4-connectivity (diagonals separate)', () => {
      const m = maskFrom(['#..', '.#.', '..#']);
      expect(CI.mask.label(m, 4).comps.length).toBe(3);
      expect(CI.mask.label(m, 8).comps.length).toBe(1);
    });
    it('removeSmall and fillHoles', () => {
      const m = maskFrom(['#####....#', '#...#.....', '#####.....']);
      expect(CI.mask.count(CI.mask.removeSmall(m, 2))).toBe(12);
      expect(CI.mask.count(CI.mask.fillHoles(m, 10))).toBe(16);
      expect(CI.mask.count(CI.mask.fillHoles(m, 3))).toBe(13);
    });
  });

  describe('Image ops: background removal & cleanup', () => {
    const logo = () => img(40, 40, (x, y) => (x - 20) ** 2 + (y - 20) ** 2 < 100 ? [200, 20, 20] : [250, 250, 250]);
    it('magic wand (contiguous) selects the background only', () => {
      const m = CI.imageops.selectSimilar(logo(), 0, 0, 10, true);
      expect(m.data[0]).toBe(1); expect(m.data[20 * 40 + 20]).toBe(0);
    });
    it('contiguous wand does not leak into enclosed areas of the same color', () => {
      const ring = img(30, 30, (x, y) => { const r = Math.hypot(x - 15, y - 15); return r > 6 && r < 10 ? [0, 0, 0] : [255, 255, 255]; });
      const m = CI.imageops.selectSimilar(ring, 0, 0, 10, true);
      expect(m.data[15 * 30 + 15]).toBe(0);
      const g = CI.imageops.selectSimilar(ring, 0, 0, 10, false);
      expect(g.data[15 * 30 + 15]).toBe(1);
    });
    it('auto-detects a plain background from the borders', () => {
      const m = CI.imageops.detectBackground(logo(), 10);
      const cleared = CI.imageops.clearMask(logo(), m);
      expect(cleared.data[3]).toBe(0); expect(cleared.data[(20 * 40 + 20) * 4 + 3]).toBe(255);
    });
    it('tolerance handles JPEG-like noise in the background', () => {
      const noisy = img(40, 40, (x, y) => (x - 20) ** 2 + (y - 20) ** 2 < 100 ? [30, 30, 160] : [245 + ((x * 7 + y * 3) % 10), 245, 248 - ((x + y) % 6)]);
      const m = CI.imageops.detectBackground(noisy, 12);
      expect(CI.mask.count(m)).toBeGreaterThan(40 * 40 - 330);
    });
    it('removeColor clears a color everywhere', () => {
      const out = CI.imageops.removeColor(logo(), '#c81414', 10);
      expect(out.data[(20 * 40 + 20) * 4 + 3]).toBe(0); expect(out.data[3]).toBe(255);
    });
    it('cleanEdges makes alpha hard (pixel perfect) and removes specks', () => {
      const soft = img(30, 30, (x, y) => { if (x === 2 && y === 2) return [0, 0, 0, 255]; const r = Math.hypot(x - 15, y - 15); return [0, 0, 0, r < 8 ? 255 : r < 9 ? 140 : r < 10 ? 60 : 0]; });
      expect(CI.imageops.softPixelCount(soft)).toBeGreaterThan(0);
      const { image } = CI.imageops.cleanEdges(soft, { despeckle: 4, smooth: 1 });
      expect(CI.imageops.softPixelCount(image)).toBe(0);
      expect(image.data[(2 * 30 + 2) * 4 + 3]).toBe(0);
      expect(image.data[(15 * 30 + 15) * 4 + 3]).toBe(255);
    });
    it('choke shrinks the edge to remove halos', () => {
      const sq = img(20, 20, (x, y) => [0, 0, 0, x >= 5 && x < 15 && y >= 5 && y < 15 ? 255 : 0]);
      const { mask } = CI.imageops.cleanEdges(sq, { choke: 1, smooth: 0, despeckle: 0, fillHoles: 0 });
      expect(CI.mask.count(mask)).toBe(64);
    });
    it('quantize finds the right colors deterministically', () => {
      const im = img(30, 30, (x) => x < 10 ? [255, 0, 0] : x < 20 ? [0, 255, 0] : [0, 0, 255]);
      const q1 = CI.imageops.quantize(im, 3), q2 = CI.imageops.quantize(im, 3);
      expect(q1.palette.length).toBe(3);
      expect(JSON.stringify(q1.palette)).toBe(JSON.stringify(q2.palette));
      const hexes = q1.palette.map(c => CI.util.toHex(c)).sort();
      expect(hexes).toEqual(['#0000ff', '#00ff00', '#ff0000']);
    });
    it('quantize ignores transparent pixels', () => {
      const im = img(10, 10, (x) => x < 5 ? [255, 0, 0, 255] : [0, 0, 0, 0]);
      const q = CI.imageops.quantize(im, 4);
      expect(q.palette.length).toBe(1); expect(q.indices[9]).toBe(-1);
    });
  });

  describe('Tracing (image → vector)', () => {
    it('square contour is one clockwise loop with 4 corners', () => {
      const loops = CI.trace.contours(rectMask(10, 10, 2, 2, 8, 8));
      expect(loops.length).toBe(1); expect(loops[0].length).toBe(4);
      expect(CI.trace.signedArea(loops[0])).toBe(36);
    });
    it('holes come out counter-clockwise', () => {
      const m = CI.mask.sub(rectMask(20, 20, 2, 2, 18, 18), rectMask(20, 20, 6, 6, 14, 14));
      const loops = CI.trace.contours(m); const areas = loops.map(CI.trace.signedArea).sort((a, b) => a - b);
      expect(areas).toEqual([-64, 256]);
    });
    it('diagonal-touching pixels become separate loops', () => {
      expect(CI.trace.contours(maskFrom(['#.', '.#'])).length).toBe(2);
    });
    it('shape touching the image border traces correctly', () => {
      const loops = CI.trace.contours(CI.mask.create(5, 5, 1)); expect(loops.length).toBe(1); expect(CI.trace.signedArea(loops[0])).toBe(25);
    });
    it('traced circle is smooth: few nodes, no stair steps, accurate area', () => {
      const R = 60, m = CI.mask.create(150, 150);
      for (let y = 0; y < 150; y++) for (let x = 0; x < 150; x++) if ((x - 75 + 0.5) ** 2 + (y - 75 + 0.5) ** 2 < R * R) m.data[y * 150 + x] = 1;
      const cp = CI.trace.loopsToCompound(CI.trace.traceLoops(m), { tolerance: 1.2 });
      const nodes = CI.geom.nodeCount(cp);
      expect(nodes).toBeLessThan(24);
      expect(CI.geom.tinySegments(cp, 2)).toBe(0);
      expect(Math.abs(Math.abs(cp.area) - Math.PI * R * R) / (Math.PI * R * R)).toBeLessThan(0.02);
    });
    it('corners stay sharp while curves get smoothed', () => {
      const m = rectMask(120, 120, 20, 20, 100, 100);
      const cp = CI.trace.loopsToCompound(CI.trace.traceLoops(m), { tolerance: 1.2 });
      expect(Math.abs(Math.abs(cp.area) - 6400) / 6400).toBeLessThan(0.01);
      expect(cp.bounds.x).toBeCloseTo(20, 0.8); expect(cp.bounds.width).toBeCloseTo(80, 1.6);
      expect(CI.geom.nodeCount(cp)).toBeLessThan(17);
    });
    it('stacked color layers: lower colors extend under upper ones', () => {
      const im = img(60, 60, (x, y) => (x - 30) ** 2 + (y - 30) ** 2 < 100 ? [20, 20, 200] : (x > 5 && x < 55 && y > 5 && y < 55 ? [220, 30, 30] : [0, 0, 0, 0]));
      const flat = CI.trace.traceImage(im, { mode: 'colors', colors: 2, despeckle: 4 });
      const stacked = CI.trace.traceImage(im, { mode: 'colors', colors: 2, despeckle: 4, stack: true });
      const red = (ls) => ls.find(l => l.color.startsWith('#dc') || l.color.startsWith('#dd'));
      expect(red(flat).path.contains(new paper.Point(30, 30))).toBeFalsy();
      expect(red(stacked).path.contains(new paper.Point(30, 30))).toBeTruthy();
    });
    it('grayscale mode makes one layer per gray level', () => {
      const im = img(90, 30, (x) => x < 30 ? [10, 10, 10] : x < 60 ? [128, 128, 128] : [250, 250, 250]);
      const ls = CI.trace.traceImage(im, { mode: 'gray', levels: 3, despeckle: 4 });
      expect(ls.map(l => l.color).sort()).toEqual(['#000000', '#808080', '#ffffff']);
      expect(CI.trace.traceImage(im, { mode: 'gray', levels: 3, despeckle: 4, ignore: ['#ffffff'] }).length).toBe(2);
    });
    it('Corners control: higher setting keeps a triangle sharper', () => {
      const m = CI.mask.create(140, 140); for (let y = 20; y < 120; y++) for (let x = 20; x < 120; x++) if (x - 20 > (y - 20) * 0.6) m.data[y * 140 + x] = 1;
      const area = (corner) => Math.abs(CI.trace.loopsToCompound(CI.trace.traceLoops(m, { corner }), { tolerance: 1.2 }).area);
      expect(area(25)).toBeGreaterThan(area(85));
    });
    it('traced shape keeps holes (letter O)', () => {
      const m = CI.mask.create(80, 80);
      for (let y = 0; y < 80; y++) for (let x = 0; x < 80; x++) { const r = Math.hypot(x - 40, y - 40); if (r < 35 && r > 20) m.data[y * 80 + x] = 1; }
      const cp = CI.trace.loopsToCompound(CI.trace.traceLoops(m), {});
      expect(cp.children.length).toBe(2);
      expect(cp.contains(new paper.Point(40, 40))).toBeFalsy();
      expect(cp.contains(new paper.Point(40, 12))).toBeTruthy();
    });
    it('traceImage color mode makes one layer per color and skips white', () => {
      const im = img(60, 30, (x, y) => (y < 5 || y > 25) ? [255, 255, 255] : x < 30 ? [220, 30, 30] : [20, 20, 200]);
      const layers = CI.trace.traceImage(im, { mode: 'colors', colors: 3, ignore: ['#ffffff'] });
      expect(layers.length).toBe(2);
      expect(layers.map(l => l.color).sort()).toEqual(['#1414c8', '#dc1e1e']);
    });
    it('traceImage dark mode for line art; scale maps pixels to document units', () => {
      const im = img(40, 40, (x, y) => x > 9 && x < 30 && y > 9 && y < 30 ? [0, 0, 0] : [255, 255, 255]);
      const [l] = CI.trace.traceImage(im, { mode: 'dark', scale: 2, offset: { x: 100, y: 100 } });
      expect(l.path.bounds.x).toBeCloseTo(120, 3); expect(l.path.bounds.width).toBeCloseTo(40, 3);
    });
    it('despeckle drops noise before tracing', () => {
      const im = img(50, 50, (x, y) => (x === 3 && y === 3) || (x === 40 && y === 5) ? [0, 0, 0] : x > 15 && x < 35 && y > 15 && y < 35 ? [0, 0, 0] : [255, 255, 255]);
      const [l] = CI.trace.traceImage(im, { mode: 'dark', despeckle: 6 });
      expect(l.path.children.length).toBe(1);
    });
    it('empty image traces to nothing (no crash)', () => {
      const im = img(10, 10, () => [255, 255, 255]);
      expect(CI.trace.traceImage(im, { mode: 'dark' }).length).toBe(0);
      expect(CI.trace.traceImage(img(10, 10, () => [0, 0, 0, 0]), { mode: 'colors' }).length).toBe(0);
    });
  });

  describe('Pathfinder & geometry', () => {
    const a = () => rectPath(0, 0, 100, 100), b = () => rectPath(50, 50, 100, 100);
    it('unite (weld)', () => { const [r] = CI.geom.boolean([a(), b()], 'unite'); expect(Math.abs(r.area)).toBeCloseTo(17500, 1); });
    it('minus front', () => { const [r] = CI.geom.boolean([a(), b()], 'subtract'); expect(Math.abs(r.area)).toBeCloseTo(7500, 1); });
    it('intersect', () => { const [r] = CI.geom.boolean([a(), b()], 'intersect'); expect(Math.abs(r.area)).toBeCloseTo(2500, 1); });
    it('exclude', () => { const [r] = CI.geom.boolean([a(), b()], 'exclude'); expect(Math.abs(r.area)).toBeCloseTo(15000, 1); });
    it('divide gives 3 pieces', () => { const r = CI.geom.boolean([a(), b()], 'divide'); expect(r.length).toBe(3); });
    it('needs at least two shapes', () => { expect(CI.geom.boolean([a()], 'unite')).toBe(null); });
    it('global copy bakes in group transforms', () => {
      const g = new paper.Group({ children: [rectPath(0, 0, 10, 10)], applyMatrix: false, insert: false });
      g.translate(new paper.Point(100, 0)); g.scale(2, g.bounds.topLeft);
      const c = CI.geom.globalCopy(g.firstChild);
      expect(c.bounds.x).toBeCloseTo(100, 4); expect(c.bounds.width).toBeCloseTo(20, 4);
    });
    it('raster offset grows a square by the right amount', () => {
      const p = rectPath(0, 0, inch(1), inch(1)); const o = CI.geom.rasterOffset(p, inch(0.1));
      expect(o.bounds.width).toBeCloseTo(inch(1.2), 1.5);
    });
    it('outline stroke turns a line into a filled shape of stroke width', () => {
      const l = new paper.Path.Line({ from: [0, 0], to: [100, 0], strokeColor: 'black', strokeWidth: 10, insert: false });
      const o = CI.geom.outlineStroke(l);
      expect(o.bounds.height).toBeCloseTo(10, 1.5); expect(o.fillColor).toBeTruthy();
    });
    it('smoothPath reduces node count of a jagged path', () => {
      const p = new paper.Path({ closed: true, insert: false });
      for (let i = 0; i < 400; i++) { const t = i / 400 * Math.PI * 2; const r = 100 + (i % 2 ? 0.6 : -0.6); p.add(new paper.Point(Math.cos(t) * r, Math.sin(t) * r)); }
      const s = CI.geom.smoothPath(p, 2);
      expect(CI.geom.nodeCount(s)).toBeLessThan(40);
      expect(Math.abs(Math.abs(s.area) - Math.abs(p.area)) / Math.abs(p.area)).toBeLessThan(0.03);
    });
    it('removeSmallParts drops tiny islands and tiny holes', () => {
      const hole = new paper.Path.Rectangle({ point: [40, 40], size: [3, 3], insert: false }); hole.reverse();
      const cp2 = new paper.CompoundPath({ insert: false, children: [rectPath(0, 0, 100, 100), rectPath(200, 0, 2, 2), hole] });
      const { path, removed } = CI.geom.removeSmallParts(cp2, 10, 20);
      expect(removed).toBe(2); expect(path.children.length).toBe(1);
    });
  });

  describe('Text & fonts', () => {
    it('bundled open-source fonts load (WOFF via opentype.js)', () => {
      expect(CI.fonts.list.length).toBeGreaterThan(8);
      expect(CI.fonts.families().map(f => f.family)).toContain('Damion');
    });
    it('text becomes paths at the right size', () => {
      const g = CI.text.create({ text: 'HELLO', family: 'Bungee', size: 72 });
      expect(g.children.length).toBe(1);
      // Bungee caps are ~0.7 em tall; 72pt = 1 inch em
      expect(g.bounds.height).toBeGreaterThan(inch(0.5)); expect(g.bounds.height).toBeLessThan(inch(1.05));
    });
    it('weld off keeps letters separate; weld on merges', () => {
      const off = CI.text.create({ text: 'abc', family: 'Damion', weld: false });
      const on = CI.text.create({ text: 'abc', family: 'Damion', weld: true });
      expect(off.children.length).toBe(3); expect(on.children.length).toBe(1);
    });
    it('script font auto-weld removes overlaps (single outline for touching letters)', () => {
      const on = CI.text.create({ text: 'love', family: 'Yellowtail', weld: true, size: 100 });
      const r = CI.cutcheck.run([on], { material: mat('vinyl') });
      expect(r.issues.filter(i => i.rule === 'overlap').length).toBe(0);
    });
    it('letter spacing widens text; alignment and multiline work', () => {
      const a = CI.text.create({ text: 'ABC', family: 'Bungee', letterSpacing: 0 });
      const b = CI.text.create({ text: 'ABC', family: 'Bungee', letterSpacing: 200 });
      expect(b.bounds.width).toBeGreaterThan(a.bounds.width);
      const ml = CI.text.create({ text: 'A\nWIDE LINE', family: 'Bungee', align: 'center' });
      expect(ml.bounds.height).toBeGreaterThan(a.bounds.height * 1.8);
    });
    it('curved text arcs (rainbow up / smile down)', () => {
      const flat = CI.text.create({ text: 'CURVED TEXT', family: 'Bungee', weld: false });
      const up = CI.text.create({ text: 'CURVED TEXT', family: 'Bungee', curve: 40, weld: false });
      const down = CI.text.create({ text: 'CURVED TEXT', family: 'Bungee', curve: -40, weld: false });
      expect(up.bounds.height).toBeGreaterThan(flat.bounds.height * 1.3);
      // rainbow: middle letter higher than end letters
      const mid = up.children[Math.floor(up.children.length / 2)].bounds.center.y, end = up.children[0].bounds.center.y;
      expect(mid).toBeLessThan(end);
      const mid2 = down.children[Math.floor(down.children.length / 2)].bounds.center.y, end2 = down.children[0].bounds.center.y;
      expect(mid2).toBeGreaterThan(end2);
    });
    it('rebuild keeps position and updates params', () => {
      const g = CI.text.create({ text: 'Hi', family: 'Bungee' }, { x: 300, y: 200 });
      g.translate(new paper.Point(10, 0));
      const x0 = g.bounds.x;
      CI.text.rebuild(g, { text: 'Hiya' });
      expect(g.data.params.text).toBe('Hiya'); expect(g.bounds.x).toBeCloseTo(x0, 0.5);
    });
    it('empty text and spaces do not crash', () => {
      expect(() => CI.text.create({ text: '' })).not.toThrow();
      expect(() => CI.text.create({ text: '   ' })).not.toThrow();
    });
    it('toOutlines produces plain paths', () => {
      const g = CI.text.create({ text: 'OK', family: 'Bungee' }); g.rotate(30);
      const o = CI.text.toOutlines(g);
      expect(o.data.type).toBe(undefined); expect(CI.geom.isPathLike(o)).toBeTruthy();
    });
  });

  describe('Cut Check', () => {
    const run = (items, k = 'vinyl', extra = {}) => CI.cutcheck.run(items, Object.assign({ material: mat(k) }, extra));
    const rules = (r) => r.issues.map(i => i.rule);
    it('a clean 2" square passes vinyl with no warnings', () => {
      const r = run([rectPath(inch(1), inch(1), inch(2), inch(2))]);
      expect(r.summary.ready).toBeTruthy();
    });
    it('flags a hairline thinner than the material minimum', () => {
      const r = run([rectPath(0, 0, inch(2), inch(0.02))]);
      expect(rules(r)).toContain('thin');
    });
    it('thin threshold depends on material (1/32" ok for cardstock, not foam)', () => {
      const line = () => rectPath(0, 0, inch(2), inch(0.05));
      expect(rules(run([line()], 'cardstock'))).not.toContain('thin');
      expect(rules(run([line()], 'foam2mm'))).toContain('thin');
    });
    it('flags tiny pieces and tiny holes', () => {
      const hole = new paper.Path.Rectangle({ point: [inch(0.5), inch(0.5)], size: [inch(0.04), inch(0.04)], insert: false }); hole.reverse();
      const donut = new paper.CompoundPath({ children: [rectPath(0, 0, inch(1.5), inch(1.5)), hole], fillColor: '#000', insert: false });
      const r = run([donut, rectPath(inch(3), 0, inch(0.05), inch(0.05))]);
      expect(rules(r)).toContain('tinypiece'); expect(rules(r)).toContain('tinyhole');
      const tp = r.issues.find(i => i.rule === 'tinypiece');
      expect(inRect(tp.regions[0], inch(3.02), inch(0.02))).toBeTruthy();
    });
    it('flags unwelded overlaps in the same color, not across colors', () => {
      const r1 = run([rectPath(0, 0, inch(1), inch(1)), rectPath(inch(0.5), 0, inch(1), inch(1))]);
      expect(rules(r1)).toContain('overlap');
      const r2 = run([rectPath(0, 0, inch(1), inch(1), '#ff0000'), rectPath(inch(0.5), 0, inch(1), inch(1), '#0000ff')]);
      expect(rules(r2)).not.toContain('overlap');
    });
    it('flags shapes fully inside another shape of the same color', () => {
      const r = run([rectPath(0, 0, inch(2), inch(2)), rectPath(inch(0.5), inch(0.5), inch(0.5), inch(0.5))]);
      expect(rules(r)).toContain('overlap');
    });
    it('flags jagged pixel edges (step cutting)', () => {
      const p = new paper.Path({ closed: true, fillColor: '#000', insert: false }); let x = 0, y = 0;
      for (let i = 0; i < 120; i++) { p.add([x, y]); x += 1; p.add([x, y]); y += 1; }
      p.add([0, 120]);
      expect(rules(run([p]))).toContain('jaggy');
    });
    it('flags designs bigger than the mat and suggests the 12x24 mat', () => {
      const r = run([rectPath(0, 0, inch(11), inch(18))]);
      const i = r.issues.find(x => x.rule === 'mat'); expect(i.severity).toBe('warning'); expect(i.title).toContain('12x24');
      const r2 = run([rectPath(0, 0, inch(20), inch(20))]);
      expect(r2.issues.find(x => x.rule === 'mat').severity).toBe('error');
    });
    it('HTV demands mirroring until mirror is on', () => {
      expect(rules(run([rectPath(0, 0, inch(1), inch(1))], 'htv'))).toContain('mirror');
      expect(rules(run([rectPath(0, 0, inch(1), inch(1))], 'htv', { mirrorOnExport: true }))).not.toContain('mirror');
    });
    it('raster images are errors (must be traced)', () => {
      const r = new paper.Raster({ insert: false }); r.size = new paper.Size(10, 10);
      const res = run([r]); expect(res.issues[0].rule).toBe('image'); expect(res.summary.ready).toBeFalsy();
    });
    it('stroke-only paths are outlined and checked', () => {
      const l = new paper.Path.Line({ from: [0, 0], to: [inch(2), 0], strokeColor: '#000', strokeWidth: inch(0.02), insert: false });
      const r = run([l]); expect(rules(r)).toContain('stroke'); expect(rules(r)).toContain('thin');
    });
    it('open filled paths are flagged', () => {
      const p = new paper.Path({ segments: [[0, 0], [inch(1), 0], [inch(1), inch(1)]], fillColor: '#000', insert: false });
      expect(rules(run([p]))).toContain('open');
    });
    it('hidden items are reported and skipped', () => {
      const h = rectPath(0, 0, inch(0.01), inch(0.01)); h.visible = false;
      const r = run([rectPath(0, 0, inch(1), inch(1)), h]);
      expect(rules(r)).toContain('hidden'); expect(rules(r)).not.toContain('tinypiece');
    });
    it('empty design gives a friendly note', () => { expect(rules(run([]))).toEqual(['empty']); });
    it('errors sort first', () => {
      const r = run([rectPath(0, 0, inch(30), inch(30)), rectPath(0, 0, inch(2), inch(0.01))]);
      expect(r.issues[0].severity).toBe('error');
    });
  });

  describe('Export (Design Space SVG)', () => {
    it('SVG has inch dimensions, one path per color, no strokes or transforms', () => {
      const { svg, widthIn, heightIn } = CI.exporter.toSVG([rectPath(inch(1), inch(1), inch(2), inch(1), '#ff0000'), rectPath(inch(4), inch(1), inch(1), inch(1), '#0000ff')]);
      expect(widthIn).toBeCloseTo(4, 1e-3); expect(heightIn).toBeCloseTo(1, 1e-3);
      expect(svg).toContain('width="4in"'); expect(svg).toContain('height="1in"');
      expect((svg.match(/<path /g) || []).length).toBe(2);
      expect(svg).not.toContain('transform='); expect(svg).not.toContain('stroke-width');
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBe(null);
    });
    it('weld merges overlapping same-color shapes into one path', () => {
      const items = [rectPath(0, 0, 100, 100), rectPath(50, 0, 100, 100)];
      const { layers } = CI.exporter.cutLayers(items, { weld: true });
      expect(layers.length).toBe(1); expect(Math.abs(layers[0].path.area)).toBeCloseTo(15000, 1);
    });
    it('mirror flips horizontally', () => {
      const items = [rectPath(0, 0, 100, 50), rectPath(0, 60, 10, 10)];
      const { layers } = CI.exporter.cutLayers(items, { mirror: true });
      const small = CI.geom.subpaths(layers[0].path).find(s => Math.abs(s.area) < 200);
      expect(small.bounds.x).toBeCloseTo(90, 1e-3);
    });
    it('exported SVG re-imports with the same geometry', () => {
      const t = CI.text.create({ text: 'Round trip', family: 'Kaushan Script', size: 60 });
      const { svg } = CI.exporter.toSVG([t]);
      const back = CI.exporter.importSVG(svg);
      const a = Math.abs(CI.exporter.cutLayers([t]).layers[0].path.area);
      const b = CI.geom.leafPaths(back).reduce((s, p) => s + Math.abs(p.area), 0);
      expect(Math.abs(a - b) / a).toBeLessThan(0.01);
    });
    it('SVG import honors inch / mm / Illustrator-px units', () => {
      const mk = (w, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${extra} width="${w}" viewBox="0 0 100 100"><rect width="100" height="100"/></svg>`;
      expect(CI.exporter.importSVG(mk('2in')).bounds.width).toBeCloseTo(inch(2), 0.01);
      expect(CI.exporter.importSVG(mk('50.8mm')).bounds.width).toBeCloseTo(inch(2), 0.01);
      expect(CI.exporter.importSVG('<!-- Generator: Adobe Illustrator 27 -->' + mk('144px')).bounds.width).toBeCloseTo(inch(2), 0.01);
      expect(CI.exporter.importSVG(mk('192')).bounds.width).toBeCloseTo(inch(2), 0.01);
      expect(() => CI.exporter.importSVG('not svg')).toThrow();
    });
    it('PNG export renders', () => {
      const url = CI.exporter.toPNG([rectPath(0, 0, inch(1), inch(1), '#00aa00')], 100);
      expect(url).toMatch(/^data:image\/png;base64,/);
    });
    it('only-color export filters to one layer', () => {
      const { svg } = CI.exporter.toSVG([rectPath(0, 0, 10, 10, '#ff0000'), rectPath(20, 0, 10, 10, '#0000ff')], { only: '#0000ff' });
      expect(svg).toContain('#0000ff'); expect(svg).not.toContain('#ff0000');
    });
  });
})();

(function () {
  const UPI = CI.util.UPI;
  const inch = (v) => v * UPI;
  describe('Vintage distress', () => {
    const letterMask = () => { const m = CI.mask.create(600, 300); for (let y = 30; y < 270; y++) for (let x = 30; x < 570; x++) if (!(x > 200 && x < 400 && y > 100 && y < 200)) m.data[y * 600 + x] = 1; return m; };
    const opts = (extra) => Object.assign({ ppi: 200, origin: { x: 0, y: 0 }, seed: 5 }, CI.distress.PRESETS.grunge, extra);
    it('only removes material (result is inside the original)', () => {
      const m = letterMask(); const d = CI.distress.apply(m, opts(), CI.getMaterial('vinyl'));
      expect(CI.mask.count(CI.mask.sub(d, m))).toBe(0);
      expect(CI.mask.count(d)).toBeLessThan(CI.mask.count(m));
    });
    it('is repeatable per seed and changes with a new seed', () => {
      const m = letterMask(); const mat = CI.getMaterial('vinyl');
      const a = CI.distress.apply(m, opts(), mat), b = CI.distress.apply(m, opts(), mat), c = CI.distress.apply(m, opts({ seed: 99 }), mat);
      expect(a.data.join('') === b.data.join('')).toBeTruthy(); expect(a.data.join('') === c.data.join('')).toBeFalsy();
    });
    it('zero amounts leave the shape untouched', () => {
      const m = letterMask(); const d = CI.distress.apply(m, opts({ wear: 0, rough: 0, cracks: 0, texture: 0 }), CI.getMaterial('vinyl'));
      expect(CI.mask.count(d)).toBe(CI.mask.count(m));
    });
    it('edges only: nothing deeper than the edge band is touched', () => {
      const m = CI.mask.create(400, 400); for (let y = 20; y < 380; y++) for (let x = 20; x < 380; x++) m.data[y * 400 + x] = 1;
      const ppi = 200, band = 0.15; const d = CI.distress.apply(m, opts({ ppi, edgeOnly: true, band, wear: 0.9, rough: 0.9, cracks: 0.6 }), CI.getMaterial('vinyl'));
      const inset = Math.ceil(band * ppi) + 8; let lost = 0, edgeLost = 0;
      for (let y = 20; y < 380; y++) for (let x = 20; x < 380; x++) { const i = y * 400 + x; if (d.data[i]) continue; if (x >= 20 + inset && x < 380 - inset && y >= 20 + inset && y < 380 - inset) lost++; else edgeLost++; }
      expect(lost).toBe(0); expect(edgeLost).toBeGreaterThan(200);
    });
    it('edges-only preset passes Cut check', () => {
      const mat = CI.getMaterial('vinyl'); const m = letterMask();
      const d = CI.distress.apply(m, Object.assign({ ppi: 200, origin: { x: 0, y: 0 }, seed: 3 }, CI.distress.PRESETS.edges), mat);
      const cp = CI.trace.loopsToCompound(CI.trace.traceLoops(d, { minArea: 4 }), { tolerance: 0.9, scale: UPI / 200 }); cp.fillColor = '#000000';
      const bad = CI.cutcheck.run([cp], { material: mat }).issues.filter(i => ['thin', 'tinypiece', 'tinyhole', 'jaggy'].includes(i.rule));
      expect(bad.length).toBe(0);
    });
    it('edge texture is a fine vector wobble: keeps every letter and counter, no chunks, passes Cut check', () => {
      for (const [font, k] of [['Alfa Slab One', 'vinyl'], ['Bungee', 'htv'], ['Kaushan Script', 'vinyl'], ['DM Serif Display', 'cardstock']]) {
        const mat = CI.getMaterial(k);
        const g = CI.text.create({ text: 'Retro Ink', family: font, size: 120 }, new paper.Point(96, 96));
        const shape = CI.geom.uniteAll(CI.geom.leafPaths(g).map(p => CI.geom.globalCopy(p))); shape.fillColor = '#000000';
        const w = CI.distress.wobble(shape, Object.assign({ seed: 17 }, CI.distress.PRESETS.subtle), mat);
        const sa = CI.geom.subpaths(shape), sw = CI.geom.subpaths(w);
        expect(font + ':' + sw.length).toBe(font + ':' + sa.length);                       // nothing lost (counters included)
        expect(Math.abs(Math.abs(w.area) - Math.abs(shape.area)) / Math.abs(shape.area)).toBeLessThan(0.04); // subtle
        const moved = sa.reduce((m, sp) => Math.max(m, ...sp.segments.map(sg => { const q = w.getNearestPoint(sg.point); return q ? q.getDistance(sg.point) : 0; })), 0);
        expect(moved).toBeLessThan(0.03 * UPI);                                              // fine: never a chunk
        // only count problems the wobble introduced (some script fonts are already too thin for a material)
        const rules = (it) => CI.cutcheck.run([it], { material: mat, mirrorOnExport: true }).issues.filter(i => ['thin', 'tinypiece', 'tinyhole', 'jaggy', 'complex'].includes(i.rule)).map(i => i.rule);
        const before = rules(shape); const bad = rules(w).filter(r => !before.includes(r));
        expect(font + ':' + bad.join(',')).toBe(font + ':');
      }
    }, 60000);
    it('edge texture is repeatable per seed and different for a new seed', () => {
      const shape = new paper.Path.Rectangle({ point: [0, 0], size: [inch(2), inch(1)], insert: false }); shape.fillColor = '#000';
      const mat = CI.getMaterial('vinyl'); const o = { texture: 0.5, grain: 0.08 };
      const a = CI.distress.wobble(shape, Object.assign({ seed: 1 }, o), mat).pathData, b = CI.distress.wobble(shape, Object.assign({ seed: 1 }, o), mat).pathData, c = CI.distress.wobble(shape, Object.assign({ seed: 2 }, o), mat).pathData;
      expect(a === b).toBe(true); expect(a === c).toBe(false);
    });
    it('distressed result passes Cut check for vinyl, HTV and foam (no thin parts, tiny pieces or tiny holes)', () => {
      for (const k of ['vinyl', 'htv', 'foam2mm']) {
        const mat = CI.getMaterial(k); const ppi = 200; const m = letterMask();
        const d = CI.distress.apply(m, opts({ ppi }), mat);
        const cp = CI.trace.loopsToCompound(CI.trace.traceLoops(d, { minArea: 4 }), { tolerance: 0.9, scale: UPI / ppi });
        cp.fillColor = '#000000';
        const r = CI.cutcheck.run([cp], { material: mat, mirrorOnExport: true });
        const bad = r.issues.filter(i => ['thin', 'tinypiece', 'tinyhole', 'jaggy'].includes(i.rule)).map(i => i.rule);
        expect(k + ':' + bad.join(',')).toBe(k + ':');
      }
    }, 60000);
  });
})();

(function () {
  const UPI = CI.util.UPI; const inch = (v) => v * UPI;
  const rect = (x, y, w, h, c = '#000000') => new paper.Path.Rectangle({ point: [inch(x), inch(y)], size: [inch(w), inch(h)], fillColor: c, insert: false });
  describe('Weed box & weeding lines', () => {
    it('box surrounds the design with the margin; lines never touch the design', () => {
      const parts = [rect(1, 1, 1, 2), rect(2.5, 1, 1, 2), rect(4, 1, 1, 2)];
      const r = CI.weed.build(parts, { margin: inch(0.25), lines: 'vertical', spacing: inch(0.75) });
      expect(r.bounds.x).toBeCloseTo(inch(0.75), 0.01); expect(r.bounds.width).toBeCloseTo(inch(4.5), 0.01);
      expect(r.lines.length).toBeGreaterThan(3);
      for (const l of r.lines) for (const p of parts) { expect(l.intersects(p)).toBe(false); expect(p.contains(l.bounds.center)).toBe(false); }
      expect(CI.weed.build(parts, { lines: 'none' }).lines.length).toBe(0);
    });
    it('weed group exports as separate cut paths and does not swallow or alter the design', () => {
      const d = rect(1, 1, 2, 1); const r = CI.weed.build([d], { margin: inch(0.25), lines: 'both', spacing: inch(0.5) });
      const g = new paper.Group({ children: [r.box].concat(r.lines), insert: false }); g.data = { weed: true, color: '#000000' };
      const { layers } = CI.exporter.cutLayers([d, g]);
      expect(layers.length).toBe(1); expect(Math.abs(layers[0].path.area)).toBeCloseTo(inch(2) * inch(1), 1);
      expect(layers[0].extras.length).toBe(1 + r.lines.length);
      const { svg } = CI.exporter.toSVG([d, g]); expect((svg.match(/<path /g) || []).length).toBe(2 + r.lines.length);
      expect(svg).toContain('width="2.5in"');
    });
    it('Cut check ignores weed lines for thin/overlap rules but warns when the box no longer fits', () => {
      const d = rect(1, 1, 2, 1); const r = CI.weed.build([d], { margin: inch(0.25), lines: 'vertical', spacing: inch(0.5) });
      const g = new paper.Group({ children: [r.box].concat(r.lines), insert: false }); g.data = { weed: true, color: '#000000' };
      const res = CI.cutcheck.run([d, g], { material: CI.getMaterial('vinyl') });
      expect(res.summary.ready).toBe(true);
      d.translate(new paper.Point(inch(3), 0));
      expect(CI.cutcheck.run([d, g], { material: CI.getMaterial('vinyl') }).issues.some(i => i.rule === 'weedbox')).toBe(true);
    });
  });
  describe('My vinyl palette & placements', () => {
    it('trace snaps colors to a palette and merges colors that land on the same vinyl', () => {
      const d = new Uint8ClampedArray(90 * 30 * 4);
      for (let i = 0; i < 90 * 30; i++) { const x = i % 90; const c = x < 30 ? [200, 20, 20] : x < 60 ? [230, 40, 40] : [20, 30, 200]; d.set([c[0], c[1], c[2], 255], i * 4); }
      const im = CI.imageops.makeImageData(90, 30, d);
      const ls = CI.trace.traceImage(im, { mode: 'colors', colors: 3, despeckle: 4, palette: ['#c8102e', '#1f4ba5', '#111111'] });
      expect(ls.map(l => l.color).sort()).toEqual(['#1f4ba5', '#c8102e']);
    });
    it('placement presets are sane (typical width within max)', () => {
      for (const [k, p] of Object.entries(CI.PLACEMENTS)) { expect(k + (p.w <= p.maxW)).toBe(k + true); expect(p.maxH > 0).toBe(true); }
    });
  });
})();

(function () {
  const UPI = CI.util.UPI; const inch = (v) => v * UPI;
  describe('Material saver (packing)', () => {
    it('packs 200 random layouts with no overlaps, gaps kept, inside the width', () => {
      let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let t = 0; t < 200; t++) {
        const n = 1 + Math.floor(rnd() * 25), rs = []; for (let i = 0; i < n; i++) rs.push({ id: i, w: 0.3 + rnd() * 5, h: 0.3 + rnd() * 4 });
        const W = 11.5, g = 0.25, r = CI.nest.pack(rs, W, g, rnd() < 0.5);
        expect(r.placements.length).toBe(n);
        for (const p of r.placements) { expect(p.x >= g - 1e-9 && p.x + p.w <= W - g + 1e-6).toBe(true); }
        const P = r.placements;
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j]; expect(a.x < b.x + b.w + g - 1e-6 && b.x < a.x + a.w + g - 1e-6 && a.y < b.y + b.h + g - 1e-6 && b.y < a.y + a.h + g - 1e-6).toBe(false); }
      }
    });
    it('export packing shrinks material length, keeps every piece and keeps each object whole', () => {
      const items = [];
      for (let i = 0; i < 6; i++) items.push(new paper.Path.Circle({ center: [inch(1.2 + (i % 3) * 4), inch(1.2 + Math.floor(i / 3) * 8)], radius: inch(1), fillColor: '#111111', insert: false }));
      const word = CI.text.create({ text: 'HI', family: 'Bungee', size: 60, color: '#111111' }, new paper.Point(inch(5), inch(4)));
      items.push(word);
      const flat = CI.exporter.cutLayers(items, {}).layers[0], packed = CI.exporter.cutLayers(items, { pack: { width: inch(11.5), gap: inch(0.25), rotate: true } }).layers[0];
      expect(packed.bounds.height).toBeLessThan(flat.bounds.height * 0.7);
      expect(Math.abs(Math.abs(packed.path.area) - Math.abs(flat.path.area)) / Math.abs(flat.path.area)).toBeLessThan(0.001);
      expect(CI.geom.subpaths(packed.path).length).toBe(CI.geom.subpaths(flat.path).length);
      expect(packed.usage.pieces).toBe(7);
      const r = CI.cutcheck.run([CI.exporter.importSVG(CI.exporter.toSVG(items, { pack: { width: inch(11.5), gap: inch(0.25) } }).svg)], { material: CI.getMaterial('vinyl') });
      expect(r.issues.filter(i => ['tinypiece', 'tinyhole', 'thin', 'overlap', 'mat'].includes(i.rule)).length).toBe(0);
    });
    it('packing is blocked by weed boxes and registration marks', () => {
      const a = new paper.Path.Rectangle({ point: [0, 0], size: [inch(1), inch(1)], fillColor: '#000', insert: false });
      const reg = new paper.Group({ insert: false }); reg.data = { reg: true };
      const weed = new paper.Group({ insert: false }); weed.data = { weed: true };
      expect(CI.exporter.packBlockers([a]).length).toBe(0);
      expect(CI.exporter.packBlockers([a, reg])).toEqual(['registration marks']);
      expect(CI.exporter.packBlockers([a, weed, reg]).length).toBe(2);
    });
  });
})();

(function () {
  const UPI = CI.util.UPI; const inch = (v) => v * UPI;
  describe('Slice helpers', () => {
    it('splitIslands separates pieces and keeps each hole with its own piece', () => {
      const hole = new paper.Path.Rectangle({ point: [inch(0.5), inch(0.5)], size: [inch(0.5), inch(0.5)], insert: false }); hole.reverse();
      const cp = new paper.CompoundPath({ children: [new paper.Path.Rectangle({ point: [0, 0], size: [inch(1.5), inch(1.5)], insert: false }), hole, new paper.Path.Rectangle({ point: [inch(3), 0], size: [inch(1), inch(1)], insert: false })], insert: false, fillColor: '#000' });
      const parts = CI.geom.splitIslands(cp);
      expect(parts.length).toBe(2);
      const big = parts.find(p => p.bounds.width > inch(1.2)); expect(big.className).toBe('CompoundPath'); expect(big.contains(new paper.Point(inch(0.75), inch(0.75)))).toBe(false);
    });
    it('splitIslands: an island inside an O-shaped hole stays separate from the sheet around it', () => {
      const sheet = new paper.Path.Rectangle({ point: [0, 0], size: [inch(4), inch(4)], insert: false });
      const o = new paper.Path.Circle({ center: [inch(2), inch(2)], radius: inch(1.5), insert: false });
      const counter = new paper.Path.Circle({ center: [inch(2), inch(2)], radius: inch(0.7), insert: false });
      const letterO = o.subtract(counter, { insert: false });
      const st = sheet.subtract(letterO, { insert: false }); st.fillColor = '#000';
      const parts = CI.geom.splitIslands(st);
      expect(parts.length).toBe(2);
      const island = parts.find(p => p.bounds.width < inch(2)); const main = parts.find(p => p.bounds.width > inch(3));
      expect(Math.abs(island.area)).toBeCloseTo(Math.PI * inch(0.7) ** 2, inch(0.1) ** 2 * 3);
      expect(main.contains(new paper.Point(inch(2), inch(0.9)))).toBe(false);   // the O ring is a hole in the sheet
      expect(main.contains(new paper.Point(inch(0.2), inch(0.2)))).toBe(true);
    });
    it('strip makes a rectangle of the given width along a segment', () => {
      const s = CI.geom.strip(new paper.Point(0, 0), new paper.Point(inch(2), 0), inch(0.1));
      expect(s.bounds.width).toBeCloseTo(inch(2), 0.01); expect(s.bounds.height).toBeCloseTo(inch(0.1), 0.01);
      expect(CI.geom.strip(new paper.Point(1, 1), new paper.Point(1, 1), 5)).toBe(null);
    });
  });
})();
