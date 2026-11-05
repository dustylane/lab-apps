/* Cut Check — evaluates a design against material + machine limits before you send it to Design Space.
   Raster rules (thin parts, tiny pieces, tiny weeding holes, tight gaps) use exact morphology on a high-res mask;
   vector rules catch jaggy/over-complex paths, unwelded overlaps, open paths, images, mat size and HTV mirroring. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const U = () => CI.util;

  /** Collect what will actually be cut, grouped by color. */
  function collect(items) {
    const leaves = []; const images = []; const hidden = []; let strokes = 0;
    const weed = new Map(); // color -> [{orig, path}] — weed boxes/lines: cut lines, not design shapes
    let top = null; // the top-level object each leaf belongs to (packing keeps an object's pieces together)
    const walk = (it) => {
      if (!it) return;
      if (it.visible === false) { hidden.push(it); return; }
      if (it.data && it.data.weed) {
        const c = it.data.color || '#000000'; if (!weed.has(c)) weed.set(c, []);
        CI.geom.leafPaths(it).forEach(p => weed.get(c).push({ orig: it, path: CI.geom.globalCopy(p) }));
        return;
      }
      if (it.className === 'Raster') { images.push(it); return; }
      if (CI.geom.isPathLike(it)) {
        const hasFill = !!it.fillColor && it.fillColor.alpha !== 0;
        const hasStroke = !!it.strokeColor && (it.strokeWidth || 0) > 0;
        if (!hasFill && !hasStroke) return;
        let g = CI.geom.globalCopy(it);
        if (!hasFill && hasStroke) { g = CI.geom.outlineStroke(g); strokes++; }
        leaves.push({ orig: it, top, path: g, color: CI.geom.cutColor(it), open: it.className === 'Path' && !it.closed && hasFill && !hasStroke });
        return;
      }
      if (it.children) it.children.forEach(walk);
    };
    items.forEach(it => { top = it; walk(it); });
    const layers = new Map();
    for (const l of leaves) { if (!layers.has(l.color)) layers.set(l.color, []); layers.get(l.color).push(l); }
    return { leaves, layers, images, hidden, strokes, weed };
  }

  function regionFromComp(c, r) {
    const p = 1 / r.ppu; return { x: r.origin.x + c.minx * p, y: r.origin.y + c.miny * p, w: (c.maxx - c.minx + 1) * p, h: (c.maxy - c.miny + 1) * p };
  }

  /**
   * Run all checks. items: top-level design items. opts: {material, machine, mat, mirrorOnExport, dpi}
   * Returns {issues:[{severity, rule, title, detail, color, regions, fix, items}], summary}
   */
  function run(items, opts = {}) {
    const mat = opts.material || CI.getMaterial('vinyl');
    const machine = CI.MACHINES[opts.machine || 'maker4'];
    const matKey = opts.mat || Object.keys(machine.mats)[0];
    const issues = []; const UPI = U().UPI;
    const add = (o) => issues.push(Object.assign({ severity: 'warning', regions: [], items: [] }, o));
    const { leaves, layers, images, hidden, strokes, weed } = collect(items);

    if (!leaves.length && !images.length) {
      add({ severity: 'info', rule: 'empty', title: 'Nothing to cut yet', detail: 'Add text, shapes, or import an image and trace it.' });
      return { issues, summary: summarize(issues, layers) };
    }
    images.forEach(im => add({ severity: 'error', rule: 'image', title: 'Image is not a cut path', detail: 'Design Space would treat a picture as Print Then Cut. Remove the background and use Trace to turn it into cut lines.', items: [im], regions: [rect(im.bounds)], fix: 'trace' }));
    if (hidden.length) add({ severity: 'info', rule: 'hidden', title: hidden.length + ' hidden object(s) won’t export', detail: 'Hidden layers are skipped when you export.', items: hidden });
    if (strokes) add({ severity: 'info', rule: 'stroke', title: strokes + ' stroked line(s) will be outlined', detail: 'Design Space cuts the outline of a stroke, not the line itself. Export converts strokes to filled outlines at their current width.' });

    // ---- mat size ----
    const all = leaves.map(l => l.path.bounds).reduce((a, b) => a ? a.unite(b) : b, null);
    const mats = machine.mats;
    const fits = (b, m) => (b.width / UPI <= m.w + 1e-6 && b.height / UPI <= m.h + 1e-6) || (b.width / UPI <= m.h + 1e-6 && b.height / UPI <= m.w + 1e-6);
    for (const [color, ls] of layers) {
      let lb = ls.map(l => l.path.bounds).reduce((a, b) => a.unite(b));
      const wd = weed.get(color);
      if (wd && wd.length) {
        const wb = wd.map(w => w.path.bounds).reduce((a, b) => a.unite(b));
        if (!wb.expand(0.02 * UPI).contains(lb)) add({ severity: 'warning', rule: 'weedbox', color, title: `Weed box for ${color} no longer fits the design`, detail: 'The design moved or grew after the weed box was made, so the box would cut through it. Update the weed box.', items: [wd[0].orig], regions: [rect(lb)], fix: 'weedupdate' });
        lb = lb.unite(wb);
      }
      const sel = mats[matKey];
      if (!fits(lb, sel)) {
        const bigger = Object.entries(mats).find(([k, m]) => fits(lb, m));
        if (bigger) { const rot = !(lb.width / UPI <= bigger[1].w + 1e-6 && lb.height / UPI <= bigger[1].h + 1e-6);
          add({ severity: 'warning', rule: 'mat', color, title: `${color} layer needs the ${bigger[0]} mat`, detail: `It is ${U().fmtIn(lb.width, 2)} × ${U().fmtIn(lb.height, 2)}; the ${matKey} mat cuts up to ${sel.w}" × ${sel.h}".${rot ? ' It fits the longer mat when rotated 90°.' : ''} Switch the mat at the top, or scale to fit.`, regions: [rect(lb)], fix: 'fitmat' }); }
        else add({ severity: 'error', rule: 'mat', color, title: `${color} layer is too big for any mat`, detail: `It is ${U().fmtIn(lb.width, 2)} × ${U().fmtIn(lb.height, 2)}. Scale it down or split it into pieces.`, regions: [rect(lb)], fix: 'fitmat' });
      }
    }

    // ---- per color layer ----
    const dpiFor = Math.max(150, Math.min(400, 10 / mat.minFeature));
    for (const [color, ls] of layers) {
      const paths = ls.map(l => l.path);
      // vector: complexity & jaggies
      let nodes = 0, curves = 0, tiny = 0; const tinyLen = 0.012 * UPI;
      for (const p of paths) { nodes += CI.geom.nodeCount(p); for (const s of CI.geom.subpaths(p)) { curves += s.curves.length; } tiny += CI.geom.tinySegments(p, tinyLen); }
            if (curves > 40 && tiny / curves > 0.3) add({ severity: 'warning', rule: 'jaggy', color, title: `Jagged edges in ${color} (${tiny} micro-segments)`, detail: 'Stair-stepped pixel edges make the blade stop-and-go ("step cutting"), which is slow and can tear. Smooth them.', items: ls.map(l => l.orig), regions: paths.map(p => rect(p.bounds)), fix: 'smooth' });
      else {
        // smooth Bézier outlines (fonts, clean vectors) are fine even with many nodes; what slows a cut is many SHORT segments
        const perim = paths.reduce((a, p) => a + CI.geom.subpaths(p).reduce((b, s) => b + s.length, 0), 0) / UPI;
        const avgSeg = perim / Math.max(1, curves); const minAvg = 1.2 / mat.maxNodesPerSqIn;
        if (nodes > 300 && avgSeg < minAvg) add({ severity: 'warning', rule: 'complex', color, title: `Very detailed paths in ${color} (${nodes} nodes)`, detail: `Segments average ${U().round(avgSeg, 3)}" — shorter than ${U().round(minAvg, 3)}" recommended for ${mat.name}, so the blade keeps stopping. Smooth to speed up the cut.`, items: ls.map(l => l.orig), regions: paths.map(p => rect(p.bounds)), fix: 'smooth' });
      }

      // vector: unwelded overlaps
      const overl = [];
      for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
        const a = paths[i], b = paths[j];
        if (!a.bounds.intersects(b.bounds)) continue;
        let hit = false;
        try { hit = a.getIntersections(b).length > 0 || (b.firstSegment && a.contains(b.interiorPoint)) || (a.firstSegment && b.contains(a.interiorPoint)); } catch (e) { hit = false; }
        if (hit) overl.push([ls[i], ls[j]]);
        if (overl.length > 50) break;
      }
      if (overl.length) {
        const its = [...new Set(overl.flat().map(l => l.orig))];
        add({ severity: 'warning', rule: 'overlap', color, title: `${overl.length} overlapping shape(s) in ${color} aren’t welded`, detail: 'Design Space cuts every shape’s full outline, so overlaps get sliced through. Weld them into one shape.', items: its, regions: overl.map(([a, b]) => rect(a.path.bounds.intersect(b.path.bounds))), fix: 'weld' });
      }
      ls.filter(l => l.open).forEach(l => add({ severity: 'warning', rule: 'open', color, title: 'Open path', detail: 'A filled shape that isn’t closed cuts as a loose line. Close it.', items: [l.orig], regions: [rect(l.path.bounds)], fix: 'close' }));

      // raster rules
      const lb = paths.map(p => p.bounds).reduce((a, b) => a.unite(b));
      const ppu = CI.geom.pickPPU(lb, opts.dpi || dpiFor);
      const r = CI.geom.rasterize(paths, lb, ppu, { pad: Math.ceil(mat.minGap * UPI * ppu) + 3 });
      const m = r.mask; const px2 = 1 / (ppu * ppu) / (UPI * UPI); // px → sq in
      const resNote = ppu * UPI < 6 / mat.minFeature ? ' (checked at reduced resolution — zoom-level detail may be missed)' : '';

      // tiny pieces
      const lab = CI.mask.label(m, 8);   // diagonal contact = attached (sharp tips on the pixel grid aren't separate pieces)
      const tinyPieces = lab.comps.filter(c => c.area * px2 < mat.minPiece);
      if (tinyPieces.length) add({ severity: 'warning', rule: 'tinypiece', color, title: `${tinyPieces.length} tiny piece(s) in ${color}`, detail: `Pieces under ${U().round(mat.minPiece, 3)} sq in tend to get lost while weeding or stay stuck to the mat.${resNote}`, regions: tinyPieces.slice(0, 200).map(c => regionFromComp(c, r)), items: ls.map(l => l.orig), fix: 'removesmall' });

      // tiny holes (negative space)
      const inv = CI.mask.not(m); const hl = CI.mask.label(inv, 4);
      const tinyHoles = hl.comps.filter(c => !c.touchesBorder && c.area * px2 < mat.minHole);
      if (tinyHoles.length) add({ severity: 'warning', rule: 'tinyhole', color, title: `${tinyHoles.length} tiny hole(s) to weed in ${color}`, detail: `Openings under ${U().round(mat.minHole, 3)} sq in (like the inside of a small "e") are very hard to weed. Fill them, or plan to leave them in.${resNote}`, regions: tinyHoles.slice(0, 200).map(c => regionFromComp(c, r)), items: ls.map(l => l.orig), fix: 'fillholes' });

      // thin parts
      const rad = (mat.minFeature / 2) * UPI * ppu;
      if (rad >= 0.75) {
        const opened = CI.mask.open(m, rad);
        const thin = CI.mask.sub(m, CI.mask.dilate(opened, Math.max(1, rad * 0.25)));
        const tl = CI.mask.label(thin, 8);
        const minArea = Math.max(4, rad * rad * 4); // ignores ordinary corners; flags hairlines and needle-sharp points
        const thinRegions = tl.comps.filter(c => c.area >= minArea);
        // whole pieces that vanish completely are thin too (e.g. a hairline)
        if (thinRegions.length) add({ severity: 'warning', rule: 'thin', color, title: `${thinRegions.length} part(s) thinner than ${fmtFrac(mat.minFeature)} in ${color}`, detail: `Thin lines can tear, curl up or vanish during weeding in ${mat.name}. Thicken them (Offset) or simplify the design.${resNote}`, regions: thinRegions.slice(0, 200).map(c => regionFromComp(c, r)), items: ls.map(l => l.orig), fix: 'thicken' });
      }
      // gaps too narrow between cut lines
      const gr = (mat.minGap / 2) * UPI * ppu;
      if (gr >= 0.75) {
        const closed = CI.mask.close(m, gr);
        let gaps = CI.mask.sub(closed, m);
        // tiny holes already reported — remove those pixels
        const holeKill = new Uint8Array(hl.comps.length + 1); tinyHoles.forEach(c => holeKill[c.id] = 1);
        for (let i = 0; i < gaps.data.length; i++) if (gaps.data[i] && holeKill[hl.labels[i]]) gaps.data[i] = 0;
        const gl = CI.mask.label(gaps, 8);
        const gapRegions = gl.comps.filter(c => c.area >= Math.max(4, gr * gr * 1.5));
        if (gapRegions.length) add({ severity: 'info', rule: 'gap', color, title: `${gapRegions.length} tight gap(s) in ${color}`, detail: `Cut lines closer than ${fmtFrac(mat.minGap)} can tear the material between them. Usually fine for vinyl; watch it on thicker materials.${resNote}`, regions: gapRegions.slice(0, 200).map(c => regionFromComp(c, r)), items: ls.map(l => l.orig) });
      }
    }
    if (layers.size > 6) add({ severity: 'info', rule: 'layers', title: `${layers.size} colors = ${layers.size} separate mats`, detail: 'Each color cuts on its own mat. Merge similar colors to save time and material.' });
    if (mat.mirror && !opts.mirrorOnExport) add({ severity: 'error', rule: 'mirror', title: 'Iron-on needs to be mirrored', detail: 'HTV is cut from the back. Turn on Mirror in Export (or in Design Space’s mat preview).', fix: 'mirror' });

    const order = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => order[a.severity] - order[b.severity]);
    return { issues, summary: summarize(issues, layers) };
  }

  function rect(b) { return { x: b.x, y: b.y, w: b.width, h: b.height }; }
  function fmtFrac(inch) {
    const fr = [[1, 64], [1, 40], [1, 32], [1, 16], [3, 32], [1, 8], [3, 16], [1, 4]];
    for (const [n, d] of fr) if (Math.abs(inch - n / d) < 1e-4) return `${n}/${d}"`;
    return U().round(inch, 3) + '"';
  }
  function summarize(issues, layers) {
    const c = { error: 0, warning: 0, info: 0 }; issues.forEach(i => c[i.severity]++);
    return { errors: c.error, warnings: c.warning, infos: c.info, colors: layers ? layers.size : 0, ready: c.error === 0 && c.warning === 0 };
  }

  CI.cutcheck = { collect, run, fmtFrac };
})(window.CI);
