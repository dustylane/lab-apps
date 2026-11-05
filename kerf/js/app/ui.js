/* DOM panels, menus, toolbar, shortcuts, drag & drop. Every button routes through ui.run(action) so tests can drive it. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';
  const U = CI.util; const UPI = U.UPI;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = U.escapeXml;
  const ico = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

  const I = {
    select: ico('<path d="M5 3l13 8-6 1.5L9 19z" fill="currentColor"/>'),
    direct: ico('<path d="M5 3l13 8-6 1.5L9 19z"/>'),
    pen: ico('<path d="M12 3l6 9-6 9-6-9z"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>'),
    rect: ico('<rect x="4" y="5" width="16" height="14" rx="1"/>'),
    ellipse: ico('<ellipse cx="12" cy="12" rx="8.5" ry="7"/>'),
    polygon: ico('<path d="M12 3.5l7.5 5.2-2.8 9.3H7.3L4.5 8.7z"/>'),
    star: ico('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.4 6.6 19.4l1.3-6L3.4 9.3l6-.7z"/>'),
    line: ico('<path d="M5 19L19 5"/>'),
    text: ico('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
    eraser: ico('<path d="M4 20l9-9M15 3v3M15 12v3M10.5 7.5L8.5 5.5M19.5 7.5l2-2M12 7h-3M21 7h-3M18.5 10.5l2 2" /><circle cx="15" cy="7.5" r="1.4" fill="currentColor"/>'),
    knife: ico('<path d="M4 20L15 9l3 3L7 20z" fill="currentColor" fill-opacity=".25"/><path d="M15 9l4-4a2 2 0 013 3l-4 4"/><path d="M3 21l1-1"/>'),
    hand: ico('<path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 12.5a1.5 1.5 0 012.5-1.6L8 14"/>'),
    zoom: ico('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/>'),
    undo: ico('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 010 12" transform="translate(0 -6)"/>'),
    redo: ico('<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 000 12" transform="translate(0 -6)"/>'),
    unite: ico('<path d="M3 3h11v5h7v13H10v-5H3z" fill="currentColor" fill-opacity=".85"/>'),
    minus: ico('<path d="M3 3h11v5h-4v8H3z" fill="currentColor" fill-opacity=".85"/><rect x="10" y="8" width="11" height="13" stroke-dasharray="2 2"/>'),
    intersect: ico('<rect x="3" y="3" width="11" height="13" stroke-dasharray="2 2"/><rect x="10" y="8" width="11" height="13" stroke-dasharray="2 2"/><rect x="10" y="8" width="4" height="8" fill="currentColor"/>'),
    exclude: ico('<path d="M3 3h11v5h-4v8H3z" fill="currentColor" fill-opacity=".85"/><path d="M14 8h7v13H10v-5h4z" fill="currentColor" fill-opacity=".85"/>'),
    divide: ico('<rect x="3" y="3" width="11" height="13"/><rect x="10" y="8" width="11" height="13"/><path d="M10 8h4v8h-4z" fill="currentColor" fill-opacity=".5"/>'),
    alL: ico('<path d="M4 3v18M8 7h10v4H8zM8 14h6v4H8z"/>'), alH: ico('<path d="M12 3v18M6 7h12v4H6zM8 14h8v4H8z"/>'), alR: ico('<path d="M20 3v18M6 7h10v4H6zM10 14h6v4h-6z"/>'),
    alT: ico('<path d="M3 4h18M7 8v10h4V8zM14 8v6h4V8z"/>'), alV: ico('<path d="M3 12h18M7 6v12h4V6zM14 8v8h4V8z"/>'), alB: ico('<path d="M3 20h18M7 6v10h4V6zM14 10v6h4v-6z"/>'),
    disH: ico('<path d="M4 4v16M20 4v16M9 8h6v8H9z"/>'), disV: ico('<path d="M4 4h16M4 20h16M8 9h8v6H8z"/>'),
    eye: ico('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'),
    eyeOff: ico('<path d="M3 3l18 18M10.6 6.1A10 10 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3 3.6M6.2 7.6A16 16 0 002 12s3.5 6 10 6a9.6 9.6 0 004.4-1"/>'),
    lock: ico('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
    unlock: ico('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 017.5-2"/>'),
    up: ico('<path d="M6 15l6-6 6 6"/>'), down: ico('<path d="M6 9l6 6 6-6"/>'), trash: ico('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  };
  const TOOLS = [
    ['select', 'Selection', 'V'], ['direct', 'Direct selection — edit points', 'A'], null,
    ['pen', 'Pen', 'P'], ['rect', 'Rectangle', 'M'], ['ellipse', 'Ellipse', 'L'], ['polygon', 'Polygon', 'Y'], ['star', 'Star', 'S'], ['line', 'Line', '\\'], ['text', 'Text', 'T'], ['knife', 'Knife — drag across shapes to slice them (Shift = 45°)', 'K'], null,
    ['eraser', 'Magic eraser — click a color on an image to remove it', 'W'], null,
    ['hand', 'Hand (or hold Space)', 'H'], ['zoom', 'Zoom (Alt = out)', 'Z'],
  ];
  const SWATCHES = ['#000000', '#ffffff', '#c8102e', '#ff6a13', '#ffcd00', '#2fa84f', '#00859b', '#1f4ba5', '#6d3fa0', '#f28cb1', '#b5975b', '#8e9196', '#6b3e26'];
  const MENUS = [
    ['File', [['new', 'New design…'], ['open', 'Open project…', 'Ctrl+O'], ['save', 'Save project', 'Ctrl+S'], '-', ['import', 'Import image / SVG / font…', 'Ctrl+I'], '-', ['exportSVG', 'Export SVG for Design Space', 'Ctrl+E'], ['exportColors', 'Export each color as SVG'], ['exportPNG', 'Export PNG (300 dpi)'], '-', ['restore', 'Restore autosave']]],
    ['Edit', [['undo', 'Undo', 'Ctrl+Z'], ['redo', 'Redo', 'Ctrl+Shift+Z'], '-', ['cut', 'Cut', 'Ctrl+X'], ['copy', 'Copy', 'Ctrl+C'], ['paste', 'Paste', 'Ctrl+V'], ['duplicate', 'Duplicate', 'Ctrl+D'], ['delete', 'Delete', 'Del'], '-', ['selectAll', 'Select all', 'Ctrl+A'], ['deselect', 'Deselect', 'Esc'], '-', ['myVinyl', 'My vinyl colors…'], ['snapVinyl', 'Snap colors to my vinyl']]],
    ['Object', [['group', 'Group', 'Ctrl+G'], ['ungroup', 'Ungroup', 'Ctrl+Shift+G'], '-', ['front', 'Bring to front', 'Ctrl+Shift+]'], ['forward', 'Bring forward', 'Ctrl+]'], ['backward', 'Send backward', 'Ctrl+['], ['back', 'Send to back', 'Ctrl+Shift+['], '-', ['flipH', 'Flip horizontal'], ['flipV', 'Flip vertical'], ['rot90', 'Rotate 90° clockwise'], '-', ['compound', 'Make compound path', 'Ctrl+8'], ['release', 'Release compound path'], ['outlines', 'Convert text to outlines', 'Ctrl+Shift+O'], ['separate', 'Separate traced colors'], '-', ['fitMat', 'Fit to mat'], ['copiesFill', 'Fill the mat with copies']]],
    ['Pathfinder', [['weld', 'Weld (unite)'], ['minus', 'Minus front'], ['intersect', 'Intersect'], ['exclude', 'Exclude'], ['divide', 'Divide'], '-', ['offsetDlg', 'Offset / contour…'], ['outlineStroke', 'Outline stroke'], ['smooth', 'Smooth paths'], '-', ['sliceTop', 'Slice (top object cuts)'], ['bridges', 'Stencil bridges'], '-', ['expandThin', 'Expand thin lines'], ['bolder', 'Make bolder'], '-', ['weedBox', 'Add / update weed box'], ['weedRemove', 'Remove weed boxes'], '-', ['regAdd', 'Add registration marks'], ['regRemove', 'Remove registration marks']]],
    ['View', [['zoomFit', 'Fit mat', 'Ctrl+0'], ['zoomSel', 'Fit selection', 'Ctrl+2'], ['zoom100', 'Actual size', 'Ctrl+1'], '-', ['cutPreview', 'Cut preview (outline)', 'Ctrl+Y'], ['mockup', 'Shirt mockup…', 'Ctrl+M'], ['wizard', 'Start wizard…'], ['matsPreview', 'Preview mats…'], ['snap', 'Smart guides on/off', 'Ctrl+U']]],
    ['Help', [['shortcuts', 'Keyboard shortcuts', '?'], ['dsGuide', 'Sending to Design Space'], ['about', 'About & open-source licenses']]],
  ];

  // Garment outlines for the mockup, in real inches (adult tee body = 20" wide). collar = y of the collar bottom.
  const TEE = 'M11.5,0.8 Q16,4 20.5,0.8 L25,1.6 L31,7.5 L27.5,11 L26,9.6 L26,29 L6,29 L6,9.6 L4.5,11 L1,7.5 L7,1.6 Z';
  const scalePath = (d, k) => d.replace(/-?\d+(\.\d+)?/g, n => U.round(parseFloat(n) * k, 3));
  const tee = (name, k) => ({ name, path: scalePath(TEE, k), cx: 16 * k, collar: 2.4 * k, view: [-1 * k, -1 * k, 34 * k, 31 * k] });
  const GARMENTS = {
    adult: tee('an adult medium tee (20" body)', 1), youth: tee('a youth medium tee (16" body)', 0.8), toddler: tee('a toddler tee (12.4" body)', 0.62),
    onesie: { name: 'a 6–12 month onesie (9" body)', path: 'M3.2,0.6 Q6,2.6 8.8,0.6 L10.8,1.1 L12.6,4.2 L10.9,5.2 L10.5,4.6 L10.5,10 Q10.5,12.2 8.2,12.8 L7.2,13.3 L4.8,13.3 L3.8,12.8 Q1.5,12.2 1.5,10 L1.5,4.6 L1.1,5.2 L-0.6,4.2 L1.2,1.1 Z', cx: 6, collar: 1.6, view: [-1.5, -0.6, 15, 14.6] },
    hat: { name: 'a baseball cap front', path: 'M0.5,6 Q0.5,0.3 5,0.3 Q9.5,0.3 9.5,6 Z M-0.8,6 Q5,8.8 10.8,6 Q5,7.3 -0.8,6 Z', cx: 5, collar: 0.3, view: [-1.5, -0.6, 13, 10] },
    tote: { name: 'a 15" × 16" tote', path: 'M0,3 L15,3 L15,19 L0,19 Z', extra: 'M3.5,3 Q3.5,-2 7.5,-2 Q11.5,-2 11.5,3', cx: 7.5, collar: 3, view: [-1, -3, 17, 23] },
  };
  const GARMENT_COLORS = [['White', '#ffffff'], ['Black', '#1b1b1d'], ['Heather gray', '#a6a6a2'], ['Navy', '#22304f'], ['Red', '#b3202a'], ['Pink', '#f3b6c6'], ['Sand', '#d9c7a3'], ['Forest', '#2f4a36']];

  const TRACE_PRESETS = {
    bwlogo:  { name: 'B&W logo',       tip: 'Crisp black-and-white logos and text', set: { mode: 'dark', tthreshold: 128, fidelity: 70, corners: 75, tdespeckle: 20 } },
    silhouette: { name: 'Silhouette',  tip: 'One solid shape from the image outline (remove the background first)', set: { mode: 'alpha', fidelity: 55, corners: 50, tdespeckle: 40 } },
    lineart: { name: 'Line art',       tip: 'Sketches and hand lettering — keeps thin dark lines', set: { mode: 'dark', tthreshold: 165, fidelity: 82, corners: 40, tdespeckle: 8 } },
    c3:      { name: '3 colors',       tip: 'Simple, bold, few mats', set: { mode: 'colors', colors: 3, fidelity: 50, corners: 50, tdespeckle: 40, stack: false } },
    c6:      { name: '6 colors',       tip: 'Typical AI art', set: { mode: 'colors', colors: 6, fidelity: 65, corners: 50, tdespeckle: 20, stack: false } },
    c12:     { name: 'High fidelity',  tip: '12 colors, follows detail closely (more mats, more weeding)', set: { mode: 'colors', colors: 12, fidelity: 85, corners: 55, tdespeckle: 10, stack: false } },
    gray:    { name: 'Shades of gray', tip: '4 gray levels, one layer each', set: { mode: 'gray', levels: 4, fidelity: 65, corners: 50, tdespeckle: 20, stack: false } },
    layered: { name: 'Layered vinyl',  tip: '4 colors stacked — each lower color runs under the ones above', set: { mode: 'colors', colors: 4, fidelity: 60, corners: 50, tdespeckle: 30, stack: true } },
  };

  class UI {
    constructor(app, tools) {
      this.app = app; this.tools = tools; this.tab = 'design';
      this.open = { sel: true, text: true, image: true, path: true, align: true };
      this.img = { bgTol: 14, threshold: 128, despeckle: 24, fillHoles: 24, smooth: 1, choke: 0, mode: 'colors', colors: 6, levels: 4, tthreshold: 128, fidelity: 60, corners: 50, tdespeckle: 16, ignoreWhite: null, stack: false, view: 'result', tpreset: null, preview: true, keepImage: true };
      this.offset = { dist: 0.125, fillHoles: true, keep: true };
      this.smoothAmt = 0.01;
      this.expandW = null; this.boldAmt = 0.02;
      this.weedOpts = { margin: 0.25, lines: 'vertical', spacing: 1 };
      this.place = 'adult_front';
      this.regOpts = { shape: 'cross', where: 'sides' };
      this.fx = { offset: 0.08, color: '#c8102e', shift: 0, koShape: 'circle', koPad: 0.15, splitPad: 0.08 };
      this.bridge = { width: null, dir: 'auto' }; this.copies = 4;
      this.dist = Object.assign({ preset: 'worn', seed: 11, smooth: 0.9, keep: true, band: 0.12 }, CI.distress.PRESETS.worn);
      this.actions = this.makeActions();
      this.buildMenus(); this.buildToolbar(); this.bindTop(); this.bindTabs(); this.bindPanels(); this.bindKeys(); this.bindDrop();
      app.on('selection', () => this.onSelection());
      app.on('change', () => { this.renderLayers(); this.syncUndo(); if (this.tab === 'export') this.renderExport(); this.onSelection(); });
      app.on('transforming', () => this.updateSelFields());
      app.on('issues', () => { this.renderCheck(); this.renderStatus(); if (this.tab === 'export') this.renderExport(); });
      app.on('doc', () => { this.syncTop(); this.renderCheck(); if (this.tab === 'export') this.renderExport(); });
      app.on('tool', t => { $$('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t)); this.renderToolOptions(); });
      app.on('view', () => { $('#zoom-label').textContent = Math.round(app.view.zoom * 100) + '%'; });
      app.on('cursor', p => { $('#st-cursor').textContent = `x ${U.round(p.x / UPI, 2).toFixed(2)}"  y ${U.round(p.y / UPI, 2).toFixed(2)}"`; });
      app.on('toast', t => this.toast(t.msg, t.kind));
      app.on('edit-text', g => { this.showTab('design'); this.open.text = true; this.renderDesign(true); setTimeout(() => { const ta = $('[data-text="text"]'); if (ta) { ta.focus(); ta.select(); } }, 30); });
      app.on('open-panel', p => { this.showTab('design'); this.open.image = true; this.renderDesign(true); });
      app.on('fonts', () => this.renderDesign(true));
      app.on('raster', () => this.renderDesign(true));
      this.syncTop(); this.renderDesign(true); this.renderLayers(); this.renderCheck(); this.syncUndo(); this.renderToolOptions();
    }

    // ---------- actions ----------
    makeActions() {
      const a = this.app, t = this.tools;
      const need = (n, msg) => { if (a.selection.length < n) { this.toast(msg || 'Select something first.', 'warn'); return false; } return true; };
      return {
        new: () => { if (!a.designItems().length || confirmish('Start a new design? Unsaved changes will be lost (autosave keeps the last session).')) { a.newDocument(); a.zoomFitMat(); this.modalWizard(); } },
        wizard: () => this.modalWizard(),
        open: () => $('#file-open').click(),
        save: () => { U.download((a.doc.name || 'design') + '.kerf', a.projectJSON(), 'application/json'); this.toast('Project saved.', 'ok'); },
        import: () => $('#file-import').click(),
        exportSVG: () => this.doExportSVG(),
        exportColors: () => this.doExportSVG(true),
        exportPNG: () => { if (!a.designItems().length) return this.toast('Nothing to export.', 'warn'); const url = a.exportPNG(300); fetch(url).then(r => r.blob()).then(b => U.download((a.doc.name || 'design') + '.png', b)); },
        restore: () => this.restoreAutosave(true),
        undo: () => { const l = a.history.undo(); if (l) this.toast('Undo: ' + l); },
        redo: () => { const l = a.history.redo(); if (l) this.toast('Redo: ' + l); },
        cut: () => need(1) && a.cut(), copy: () => need(1) && a.copy(), paste: () => a.paste(), duplicate: () => need(1) && a.duplicate(), delete: () => a.deleteSelection(),
        selectAll: () => a.selectAll(), deselect: () => { a.clearSelection(); a.clearHighlights(); a.clearPreview(); },
        group: () => need(2, 'Select two or more objects to group.') && a.group(), ungroup: () => need(1) && a.ungroup(),
        front: () => a.arrange('front'), forward: () => a.arrange('forward'), backward: () => a.arrange('backward'), back: () => a.arrange('back'),
        flipH: () => need(1) && a.flip('h'), flipV: () => need(1) && a.flip('v'), rot90: () => need(1) && a.rotateSelection(90), rotM90: () => need(1) && a.rotateSelection(-90),
        compound: () => need(2, 'Select two or more paths.') && a.makeCompound(), release: () => need(1) && a.releaseCompound(),
        outlines: () => need(1) && a.convertToOutlines(), separate: () => need(1) && a.separateColors(), fitMat: () => a.fitToMat(),
        weld: () => a.pathfinder('unite'), minus: () => a.pathfinder('subtract'), intersect: () => a.pathfinder('intersect'), exclude: () => a.pathfinder('exclude'), divide: () => a.pathfinder('divide'),
        offsetDlg: () => { this.showTab('design'); this.open.path = true; this.renderDesign(true); setTimeout(() => { const f = $('[data-off="dist"]'); if (f) f.focus(); }, 20); },
        offsetApply: () => { if (!need(1)) return; a.offsetSelection(this.offset.dist * UPI, { fillHoles: this.offset.fillHoles, keep: this.offset.keep }); },
        outlineStroke: () => need(1) && a.outlineStrokeSelection(),
        smooth: () => { if (!need(1)) return; const r = a.smoothSelection(this.smoothAmt); this.toast(`Smoothed: ${r.before} → ${r.after} nodes.`, 'ok'); },
        alL: () => need(1) && a.align('left'), alH: () => need(1) && a.align('hcenter'), alR: () => need(1) && a.align('right'), alT: () => need(1) && a.align('top'), alV: () => need(1) && a.align('vcenter'), alB: () => need(1) && a.align('bottom'),
        disH: () => a.distribute('h'), disV: () => a.distribute('v'),
        zoomIn: () => a.zoomBy(1.25), zoomOut: () => a.zoomBy(0.8), zoomFit: () => a.zoomFitMat(), zoomSel: () => a.zoomFitSelection(),
        zoom100: () => { a.view.zoom = 1; a.emit('view'); },
        cutPreview: () => { a.setCutPreview(!a.doc.cutPreview); this.toast(a.doc.cutPreview ? 'Cut preview: showing exactly the lines the blade will cut.' : 'Cut preview off.'); },
        snap: () => { t.opts.snap = !t.opts.snap; this.toast('Smart guides ' + (t.opts.snap ? 'on' : 'off')); },
        shortcuts: () => this.modalShortcuts(), dsGuide: () => this.modalDS(), about: () => this.modalAbout(),
        showCheck: () => { this.showTab('check'); a.runCutCheck(); }, showExport: () => this.showTab('export'),
        checkNow: () => a.runCutCheck(),
        loadFont: () => $('#file-font').click(),
        systemFonts: async () => { try { const n = await CI.fonts.loadSystemFonts(); this.toast(n + ' installed font families available.', 'ok'); this.renderDesign(true); } catch (e) { this.toast(e.message, 'warn'); } },
        noFill: () => { a.selection.forEach(i => CI.geom.leafPaths(i).forEach(p => p.fillColor = null)); a.commit('No fill'); },
        noStroke: () => { a.selection.forEach(i => CI.geom.leafPaths(i).forEach(p => p.strokeColor = null)); a.commit('No stroke'); },
        bgAuto: async () => { const r = a.selectedRaster(); if (!r) return this.toast('Select an image first.', 'warn'); const n = await a.removeBackground(r, this.img.bgTol); this.toast(n ? `Removed ${n.toLocaleString()} background pixels.` : 'No plain background found — use the Magic eraser instead.', n ? 'ok' : 'warn'); },
        eraserTool: () => t.setTool('eraser'),
        cleanEdges: async () => { const r = a.selectedRaster(); if (!r) return this.toast('Select an image first.', 'warn'); const soft = await a.cleanRasterEdges(r, { threshold: this.img.threshold, despeckle: this.img.despeckle, fillHoles: this.img.fillHoles, smooth: this.img.smooth, choke: this.img.choke }); this.toast(soft === 0 ? 'Edges are now pixel-perfect (no soft pixels).' : soft + ' soft pixels remain.', 'ok'); },
        tracePreview: () => this.previewTrace(),
        retrace: () => { const l = a.liveTrace(); if (!l) return this.toast('Select a live trace first.', 'warn'); const r = a.retrace(l, this.traceOpts(), this.traceUI()); if (r) this.toast('Re-traced.', 'ok'); },
        expandTrace: () => { const l = a.liveTrace(); if (!l) return this.toast('Select a live trace first.', 'warn'); a.expandTrace(l); this.toast('Expanded — these are now plain paths.', 'ok'); },
        traceNow: () => { const r = a.selectedRaster(); if (!r) return this.toast('Select an image first.', 'warn'); const res = a.trace(r, this.traceOpts(), this.traceUI()); if (res) this.toast('Traced into cut paths. The original image is hidden in Layers.', 'ok'); },
        distressPreview: () => this.previewDistress(true),
        distressSeed: () => {
          this.dist.seed = 1 + Math.floor(Math.random() * 99999);
          // on a live result, re-scramble right away — always from the original artwork
          if (a.liveDistress()) { a.distressSelection(this.distOpts(), true, this.distUI()); this._distId = a.selection[0] && a.selection[0].id; return; }
          this.previewDistress(true);
        },
        distressApply: () => {
          if (!a.selection.some(i => i.className !== 'Raster')) return this.toast('Select text or shapes to distress.', 'warn');
          const live = !!a.liveDistress();
          const made = a.distressSelection(this.distOpts(), this.dist.keep, this.distUI());
          if (made.length) { this._distId = a.selection[0] && a.selection[0].id; this.toast(live ? 'Distress updated from the original artwork.' : 'Distressed. It stays live: New pattern re-scrambles it from the original.', 'ok'); }
        },
        distressRemove: () => { const l = a.liveDistress(); if (l && a.removeDistress(l)) this.toast('Distress removed — original artwork restored.', 'ok'); },
        expandThin: () => { const n = a.expandThinSelection(this.expandW || a.material().minFeature); this.toast(n ? `Expanded ${n} thin area(s) to ${CI.cutcheck.fmtFrac(this.expandW || a.material().minFeature)} — everything else is untouched.` : 'Nothing in the selection is thinner than that.', n ? 'ok' : 'info'); },
        bolder: () => { const m = a.bolderSelection(this.boldAmt); if (m.length) this.toast(`Edges expanded by ${this.boldAmt}" all around.`, 'ok'); },
        weedBox: () => { const m = a.addWeedBox(this.weedOpts); if (m.length) this.toast(`Weed box added (${m.length} color${m.length > 1 ? 's' : ''}). It exports as cut lines on the same mat.`, 'ok'); },
        weedUpdate: () => { const n = a.updateWeedBoxes(); this.toast(n ? 'Weed box updated.' : 'No weed boxes yet.', n ? 'ok' : 'warn'); },
        sliceTop: () => { const m = a.sliceWithTop(this.tools.opts.sliceGap); if (m.length) this.toast(`Sliced into ${m.length} pieces.`, 'ok'); },
        bridges: () => { const n = a.stencilBridges(this.bridge.width, this.bridge.dir); if (n) this.toast(`${n} bridge${n > 1 ? 's' : ''} added — no middles fall out, and ${/^across/.test(this.bridge.dir) ? 'the stencil sheet stays in one piece' : 'every letter stays in one piece'}.`, 'ok'); },
        fxOutline: () => { if (a.effectOutline(this.fx.offset, this.fx.color, this.fx.shift)) this.toast((this.fx.shift ? 'Shadow' : 'Outline') + ' layer added in ' + this.fx.color + ' — it cuts as its own color.', 'ok'); },
        fxKnockout: () => { if (a.effectKnockout(this.fx.koShape, this.fx.koPad)) this.toast('Knockout made — the text is cut out of the badge as one piece.', 'ok'); },
        fxSplit: () => { const m = a.effectSplit(this.fx.splitPad); if (m.length) this.toast('Split around the text.', 'ok'); },
        copies: () => { const n = a.makeCopies(this.copies); if (n) this.toast(`${n} copies laid out.`, 'ok'); },
        copiesFill: () => { const n = a.makeCopies('fill'); if (n) this.toast(`${n} copies fit on the ${a.doc.mat} mat.`, 'ok'); },
        regAdd: () => { const m = a.addRegMarks(this.regOpts); if (m.length) this.toast(m.length > 1 ? `Registration marks added to all ${m.length} colors — line them up through the carriers, press, then peel them off.` : 'Marks added. They are most useful on designs with 2+ colors.', m.length > 1 ? 'ok' : 'info'); },
        regRemove: () => { const n = a.removeRegMarks(); this.toast(n ? 'Registration marks removed.' : 'No registration marks to remove.'); },
        matsPreview: () => this.modalMats(),
        weedRemove: () => { const n = a.removeWeedBoxes(); this.toast(n ? 'Weed boxes removed.' : 'No weed boxes to remove.'); },
        placeFit: () => { const s = a.placeFor(this.place); if (s) this.toast(`Sized for ${CI.PLACEMENTS[this.place].name}.`, 'ok'); },
        mockup: () => this.modalMockup(),
        myVinyl: () => this.modalVinyl(),
        snapVinyl: () => { const n = a.snapToVinyl(); this.toast(n ? `${n} item(s) recolored to your vinyl.` : 'Already using your vinyl colors.', 'ok'); },
        resetMaterial: () => { delete a.doc.overrides[a.doc.material]; a.emit('doc'); a.commit('Reset material'); },
      };
    }
    run(name, ...args) {
      const fn = this.actions[name]; if (!fn) { console.warn('Unknown action', name); return; }
      try { const r = fn(...args); if (r && r.catch) r.catch(e => { console.error(e); this.toast(e.message || String(e), 'error'); }); return r; }
      catch (e) { console.error(e); this.toast(e.message || String(e), 'error'); }
    }

    // ---------- top bar ----------
    buildMenus() {
      const nav = $('#menus');
      nav.innerHTML = MENUS.map(([name, items], i) => `<div class="menu" data-menu="${i}"><button>${name}</button><div class="dropdown">${items.map(it => it === '-' ? '<hr>' : `<button data-action="${it[0]}">${it[1]}${it[2] ? `<kbd>${it[2]}</kbd>` : ''}</button>`).join('')}</div></div>`).join('');
      nav.addEventListener('click', e => {
        const m = e.target.closest('.menu'); const act = e.target.closest('[data-action]');
        if (act) { $$('.menu').forEach(x => x.classList.remove('open')); return; }
        if (m && e.target.closest('.menu > button')) { const was = m.classList.contains('open'); $$('.menu').forEach(x => x.classList.remove('open')); if (!was) m.classList.add('open'); }
      });
      nav.addEventListener('mouseover', e => { const m = e.target.closest('.menu'); if (m && $$('.menu.open').length && !m.classList.contains('open')) { $$('.menu').forEach(x => x.classList.remove('open')); m.classList.add('open'); } });
      document.addEventListener('pointerdown', e => { if (!e.target.closest('.menus')) $$('.menu').forEach(x => x.classList.remove('open')); });
      $('#btn-undo').innerHTML = I.undo; $('#btn-redo').innerHTML = I.redo;
    }
    buildToolbar() {
      const tb = $('#toolbar');
      tb.innerHTML = TOOLS.map(t => t ? `<button class="tool" data-tool="${t[0]}" title="${esc(t[1])} (${t[2]})">${I[t[0]]}</button>` : '<div class="tool-sep"></div>').join('') +
        `<label class="swatch-tool" title="Color for new shapes and text"><input type="color" id="new-fill" value="${this.app.fill}"></label>`;
      tb.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) this.tools.setTool(b.dataset.tool); });
      $('#new-fill').addEventListener('input', e => { this.app.fill = e.target.value; });
    }
    renderToolOptions() {
      const t = this.tools.tool, o = this.tools.opts, el = $('#tool-options');
      const num = (k, label, step, min, max) => `<label>${label}<input type="number" data-topt="${k}" value="${o[k]}" step="${step}" min="${min}" max="${max}"></label>`;
      let h = '';
      if (t === 'polygon') h = num('sides', 'Sides', 1, 3, 40);
      else if (t === 'star') h = num('points', 'Points', 1, 3, 40) + num('inner', 'Inner ratio', 0.05, 0.1, 0.95);
      else if (t === 'rect') h = num('radius', 'Corner radius (in)', 0.05, 0, 5);
      else if (t === 'eraser') h = `<label>Tolerance<input type="range" data-topt="eraseTol" min="0" max="60" value="${o.eraseTol}" style="width:110px"><output>${o.eraseTol}</output></label><label><input type="checkbox" data-topt="contiguous" ${o.contiguous ? 'checked' : ''}> Contiguous</label><span style="color:var(--faint)">Shift-click = that color everywhere</span>`;
      else if (t === 'knife') h = `<label>Gap (in)<input type="number" data-topt="sliceGap" value="${o.sliceGap}" step="0.01" min="0.005" max="0.5"></label><span style="color:var(--muted)">Drag a line across shapes to cut them apart · Shift = 45°</span>`;
      else if (t === 'pen') h = '<span style="color:var(--muted)">Click = corner · drag = curve · click first point to close · Enter to finish</span>';
      else if (t === 'direct') h = '<span style="color:var(--muted)">Drag points/handles · Alt-click point = smooth/corner · double-click path = add point · Del = remove point</span>';
      el.innerHTML = h;
      el.oninput = (e) => { const k = e.target.dataset.topt; if (!k) return; o[k] = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value); const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = e.target.value; };
    }
    bindTop() {
      document.addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b && !b.disabled) { e.preventDefault(); this.run(b.dataset.action, b.dataset.arg); } });
      const mat = $('#sel-material');
      mat.innerHTML = Object.entries(CI.MATERIALS).map(([k, m]) => `<option value="${k}">${esc(m.name)}</option>`).join('');
      mat.addEventListener('change', () => this.app.setMaterial(mat.value));
      const ms = $('#sel-mat');
      ms.innerHTML = Object.keys(CI.MACHINES.maker4.mats).map(k => `<option value="${k}">${k} in</option>`).join('');
      ms.addEventListener('change', () => this.app.setMat(ms.value));
      $('#file-import').addEventListener('change', e => { this.importFiles([...e.target.files]); e.target.value = ''; });
      $('#file-open').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { await this.app.openProject(await U.readFileAs(f, 'text')); this.app.doc.name = f.name.replace(/\.(kerf|json)$/i, ''); this.toast('Opened ' + f.name, 'ok'); } catch (err) { this.toast(err.message, 'error'); } });
      $('#file-font').addEventListener('change', e => { this.importFiles([...e.target.files]); e.target.value = ''; });
    }
    syncTop() { $('#sel-material').value = this.app.doc.material; $('#sel-mat').value = this.app.doc.mat; }
    syncUndo() { $('#btn-undo').disabled = !this.app.history.canUndo(); $('#btn-redo').disabled = !this.app.history.canRedo(); }
    renderStatus() {
      const s = this.app.summary; const p = $('#status-pill'); const b = $('#tab-badge'); if (!s) return;
      p.classList.remove('ok', 'warn', 'err'); b.classList.remove('ok', 'warn', 'err');
      if (!this.app.designItems().length) { p.textContent = 'Empty design'; b.textContent = ''; return; }
      if (s.errors) { p.classList.add('err'); p.textContent = `✕ ${s.errors} to fix` + (s.warnings ? ` · ${s.warnings} warning${s.warnings > 1 ? 's' : ''}` : ''); b.classList.add('err'); b.textContent = s.errors + s.warnings; }
      else if (s.warnings) { p.classList.add('warn'); p.textContent = `! ${s.warnings} warning${s.warnings > 1 ? 's' : ''}`; b.classList.add('warn'); b.textContent = s.warnings; }
      else { p.classList.add('ok'); p.textContent = '✓ Ready to cut'; b.classList.add('ok'); b.textContent = '✓'; }
    }

    // ---------- tabs ----------
    bindTabs() { $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) this.showTab(b.dataset.tab); }); }
    showTab(t) {
      this.tab = t;
      $$('#tabs [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
      $$('.panel').forEach(p => p.hidden = p.dataset.panel !== t);
      if (t === 'export') this.renderExport();
      if (t === 'check') this.renderCheck();
      if (t !== 'design') this.app.clearPreview();
    }

    // ---------- design panel ----------
    selKey() { return this.app.selection.map(i => i.id).join(','); }
    onSelection() {
      const key = this.selKey(); const panel = $('#panel-design');
      const focused = panel.contains(document.activeElement) && document.activeElement !== document.body;
      if (key === this._selKey && focused) { this.updateSelFields(); return; }
      this.renderDesign();
    }
    renderDesign(force) {
      const a = this.app; const el = $('#panel-design');
      if (!force && el.contains(document.activeElement) && this.selKey() === this._selKey) return;
      this._selKey = this.selKey();
      const sel = a.selection; const t = a.selectedText(); const r = a.selectedRaster();
      if (!r) a.clearPreview();
      const sec = (k, title, body) => `<details class="sec" data-sec="${k}" ${this.open[k] !== false ? 'open' : ''}><summary>${title}</summary><div class="body">${body}</div></details>`;
      let h = sec('sel', sel.length ? (sel.length === 1 ? esc(a.itemName(sel[0])) : sel.length + ' objects') : 'Selection', this.htmlSelection());
      if (t) h += sec('text', 'Text', this.htmlText(t));
      if (r) h += sec('image', 'Image → cut file', this.htmlImage(r));
      const live = a.liveTrace();
      if (live && this._liveId !== live.id) { this._liveId = live.id; if (live.data.trace.ui) Object.assign(this.img, live.data.trace.ui); this.img.view = 'result'; }
      if (live) h += sec('trace', 'Image Trace (live)', this.htmlTraceControls(a.rasterStats(a.traceSource(live)), true));
      const tparts = sel.length === 1 && !t && sel[0].className !== 'Raster' && (live || (sel[0].className === 'Group' && sel[0].children.every(c => CI.geom.isPathLike(c)) && sel[0].children.length > 1)) ? a.traceParts(sel[0]) : [];
      if (tparts.length) h += sec('tcolors', `Colors (${tparts.length})`, this.htmlTraceColors(sel[0]));
      const ld = a.liveDistress();
      if (ld && this._distId !== ld.id) { this._distId = ld.id; Object.assign(this.dist, ld.data.distress.ui || ld.data.distress.opts || {}); }
      if (sel.some(i => i.className !== 'Raster')) h += sec('distress', ld ? 'Vintage distress (live)' : 'Vintage distress', this.htmlDistress());
      if (sel.some(i => i.className !== 'Raster' && !(i.data && (i.data.weed || i.data.reg)))) h += sec('fx', 'Text effects', this.htmlEffects());
      if (a.designItems().some(i => i.visible && !(i.data && i.data.weed))) h += sec('place', 'Garment placement', this.htmlPlacement());
      h += sec('path', 'Pathfinder', this.htmlPathfinder());
      h += sec('align', 'Align & arrange', this.htmlAlign());
      el.innerHTML = h;
      this.updateSelFields();
      $('#st-sel').textContent = sel.length ? `${sel.length} selected` : '';
      if ((r && this.img.preview) || (live && this.img.view !== 'result')) this.previewTrace();
    }
    htmlSelection() {
      const a = this.app; const sel = a.selection;
      if (!sel.length) return `<p class="help">Nothing selected. Type with <b>T</b>, draw with the shape tools, or drop an AI image / SVG onto the mat.</p>
        <div class="row"><span class="help">New shape color</span><input type="color" data-prop="newfill" value="${a.fill}"><div class="swatches">${SWATCHES.map(c => `<button style="background:${c}" data-swatch="${c}" data-target="new" title="${c}"></button>`).join('')}</div></div>`;
      const first = CI.geom.leafPaths(sel[0])[0];
      const fill = first ? (U.colorHex(first.fillColor) || '#000000') : '#000000';
      const stroke = first ? (U.colorHex(first.strokeColor) || '#000000') : '#000000';
      const sw = first && first.strokeColor ? U.round((first.strokeWidth || 0) / CI.text.PT, 2) : 0;
      const colors = new Set(); sel.forEach(i => CI.geom.leafPaths(i).forEach(p => colors.add(CI.geom.cutColor(p))));
      const onlyImages = sel.every(i => i.className === 'Raster');
      return `<div class="grid2">
          <label class="field"><span>W</span><input type="number" step="0.01" min="0.01" data-prop="w"></label>
          <label class="field"><span>H</span><input type="number" step="0.01" min="0.01" data-prop="h"></label>
          <label class="field"><span>X</span><input type="number" step="0.01" data-prop="x"></label>
          <label class="field"><span>Y</span><input type="number" step="0.01" data-prop="y"></label>
        </div>
        <div class="row"><label class="help"><input type="checkbox" data-prop="ratio" ${this.keepRatio !== false ? 'checked' : ''}> Keep proportions</label><span class="grow"></span><span class="help">inches</span></div>
        <div class="row"><label class="field" style="width:118px"><span>Rotate</span><input type="number" step="1" value="0" data-prop="rot" title="Rotate by degrees, press Enter"></label>
          <button class="btn small" data-action="rotM90" title="Rotate 90° counter-clockwise">⟲ 90</button><button class="btn small" data-action="rot90" title="Rotate 90° clockwise">⟳ 90</button><button class="btn small" data-action="flipH">Flip H</button><button class="btn small" data-action="flipV">Flip V</button></div>
        ${onlyImages ? '' : `<div class="row"><span class="help" style="width:42px">Fill</span><input type="color" data-prop="fill" value="${fill}"><div class="swatches">${SWATCHES.map(c => `<button style="background:${c}" data-swatch="${c}" title="${c}"></button>`).join('')}</div></div>
        <div class="row"><span class="help" style="width:42px">Stroke</span><input type="color" data-prop="stroke" value="${stroke}"><label class="field" style="width:96px"><span>pt</span><input type="number" min="0" step="0.5" data-prop="strokeW" value="${sw}"></label><button class="btn small" data-action="noStroke">None</button><button class="btn small" data-action="noFill" title="Remove fill">No fill</button></div>`}
        <p class="help">${colors.size} cut color${colors.size === 1 ? '' : 's'} in selection${a.selection.some(i => i.className === 'Raster') ? ' · <b>image</b> — trace it to cut' : ''}</p>`;
    }
    updateSelFields() {
      const b = this.app.selectionBounds(); if (!b) return;
      const set = (k, v) => { const el = $(`[data-prop="${k}"]`); if (el && document.activeElement !== el) el.value = U.round(v / UPI, 3); };
      set('w', b.width); set('h', b.height); set('x', b.x); set('y', b.y);
    }
    htmlText(t) {
      const p = t.data.params;
      const fams = CI.fonts.families(); const cats = {};
      fams.forEach(f => (cats[f.category] = cats[f.category] || []).push(f.family));
      const weights = CI.fonts.weights(p.family);
      return `<textarea data-text="text" rows="2" spellcheck="false">${esc(p.text)}</textarea>
        <select data-text="family">${Object.entries(cats).map(([c, list]) => `<optgroup label="${esc(c)}">${list.map(f => `<option ${f === p.family ? 'selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>`).join('')}</select>
        <div class="grid2"><select data-text="weight">${(weights.length ? weights : [400]).map(w => `<option value="${w}" ${w === p.weight ? 'selected' : ''}>${({ 400: 'Regular', 700: 'Bold' })[w] || w}</option>`).join('')}</select>
          <label class="field"><span>pt</span><input type="number" min="4" step="1" data-text="size" value="${p.size}"></label></div>
        <div class="grid2"><label class="field" title="Letter spacing, 1/1000 em"><span>Spacing</span><input type="number" step="10" data-text="letterSpacing" value="${p.letterSpacing}"></label>
          <label class="field"><span>Line</span><input type="number" step="0.05" min="0.5" data-text="lineHeight" value="${p.lineHeight}"></label></div>
        <div class="segmented">${['left', 'center', 'right'].map(al => `<button data-align="${al}" class="${p.align === al ? 'on' : ''}">${al[0].toUpperCase() + al.slice(1)}</button>`).join('')}</div>
        <div class="slider-row"><span>Curve</span><input type="range" min="-100" max="100" step="1" data-text="curve" value="${p.curve}"><output>${p.curve}</output></div>
        <label class="help"><input type="checkbox" data-text="weld" ${p.weld !== false ? 'checked' : ''}> <b>Weld letters</b> — overlapping script letters cut as one piece</label>
        <div class="row" style="flex-wrap:wrap"><button class="btn small" data-action="outlines">Convert to outlines</button><button class="btn small" data-action="loadFont">Load font file…</button><button class="btn small" data-action="systemFonts" title="Chrome/Edge will ask permission">Use installed fonts</button></div>`;
    }
    htmlImage(r) {
      const s = this.app.rasterStats(r); const o = this.img;
      const sl = (k, label, min, max, step) => `<div class="slider-row"><span>${label}</span><input type="range" data-img="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}"><output>${o[k]}</output></div>`;
      return `<div class="kv"><span>Pixels</span><b>${s.width} × ${s.height}</b><span>Effective resolution</span><b>${Math.round(s.dpi)} dpi${s.dpi < 150 ? ' ⚠ low' : ''}</b>
          <span>Soft edge pixels</span><b>${s.soft ? s.soft.toLocaleString() + ' (not pixel-perfect)' : '0 ✓ pixel-perfect'}</b><span>Transparent</span><b>${Math.round(s.clearPct * 100)}%</b></div>
        <p class="help"><b>1 · Remove the background</b></p>
        ${sl('bgTol', 'Tolerance', 0, 60, 1)}
        <div class="grid2"><button class="btn" data-action="bgAuto">Auto-remove background</button><button class="btn" data-action="eraserTool">Magic eraser (W)</button></div>
        <p class="help"><b>2 · Clean the edges</b> — hard alpha, no specks, no stair-steps</p>
        ${sl('threshold', 'Alpha cut', 1, 254, 1)}${sl('despeckle', 'Despeckle px', 0, 400, 1)}${sl('fillHoles', 'Fill pinholes', 0, 400, 1)}${sl('smooth', 'Smooth edge', 0, 6, 0.5)}${sl('choke', 'Shrink edge', 0, 4, 0.5)}
        <button class="btn" data-action="cleanEdges">Apply edge clean-up</button>
        <p class="help"><b>3 · Image Trace</b> — turn the picture into cut paths</p>
        ${this.htmlTraceControls(s, false)}`;
    }
    /** Illustrator-style Image Trace panel. live = editing an existing traced result. */
    htmlTraceControls(stats, live) {
      const o = this.img;
      const sl = (k, label, min, max, step, title = '') => `<div class="slider-row" title="${esc(title)}"><span>${label}</span><input type="range" data-img="${k}" min="${min}" max="${max}" step="${step}" value="${o[k]}"><output>${o[k]}</output></div>`;
      const seg = (attr, cur, opts) => `<div class="segmented">${opts.map(([v, l]) => `<button data-${attr}="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      const multi = o.mode === 'colors' || o.mode === 'gray';
      return `<div class="grid2">${Object.entries(TRACE_PRESETS).map(([k, p]) => `<button class="btn small ${o.tpreset === k ? 'go' : ''}" data-tpreset="${k}" title="${esc(p.tip)}">${p.name}</button>`).join('')}</div>
        <label class="lbl">Mode<select data-img="mode">${[['colors', 'Color'], ['gray', 'Grayscale'], ['dark', 'Black & white'], ['alpha', 'Silhouette (shape of the image)']].map(([v, l]) => `<option value="${v}" ${o.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        ${o.mode === 'colors' ? sl('colors', 'Colors', 1, 16, 1, 'How many cut colors (= mats)') : ''}${o.mode === 'gray' ? sl('levels', 'Gray levels', 2, 8, 1) : ''}${o.mode === 'dark' ? sl('tthreshold', 'Threshold', 1, 254, 1, 'Pixels darker than this become ink') : ''}
        ${sl('fidelity', 'Paths', 0, 100, 1, 'Low = smooth and simple, high = follows every detail')}
        ${sl('corners', 'Corners', 0, 100, 1, 'Low = rounder, high = sharper corners')}
        ${sl('tdespeckle', 'Noise', 0, 400, 1, 'Ignore areas smaller than this many pixels')}
        ${multi ? `<span class="help">Method</span>${seg('tmethod', o.stack ? 'stacked' : 'abutting', [['abutting', 'Abutting'], ['stacked', 'Stacked (layered vinyl)']])}
          <label class="help"><input type="checkbox" data-img="ignoreWhite" ${this.ignoreWhiteFor(stats) ? 'checked' : ''}> Ignore white</label>
          <label class="help"><input type="checkbox" data-img="useVinyl" ${o.useVinyl ? 'checked' : ''}> Use <b>my vinyl</b> colors (${CI.vinyl.list().length}) — <a href="#" data-action="myVinyl" style="color:var(--accent-2)">edit</a></label>` : ''}
        <span class="help">View</span>${seg('tview', o.view, [['result', 'Result'], ['outlines', 'Outlines'], ['source', 'Source']])}
        ${live ? `<div class="grid2"><button class="btn go" data-action="retrace">Re-trace</button><button class="btn" data-action="expandTrace" title="Finalize the paths and delete the hidden source image">Expand</button></div>
          <p class="help">This trace is <b>live</b>: change settings and press Re-trace. Expand when you’re happy.</p>`
        : `<label class="help"><input type="checkbox" data-img="keepImage" ${o.keepImage ? 'checked' : ''}> Keep it live (image kept hidden so you can re-trace)</label>
          <div class="row"><button class="btn go" data-action="traceNow" style="flex:1">Trace image</button></div>`}
        <p class="help" id="trace-stats"></p>`;
    }
    htmlTraceColors(item) {
      const parts = this.app.traceParts(item); const hexes = parts.map(p => U.colorHex(p.fillColor) || '#000000');
      return `<p class="help">Each color is one cut layer (one mat). Merge look-alike colors to save material.</p>` + parts.map((p, i) => `<div class="row" style="flex-wrap:nowrap">
          <input type="color" data-tcolor="${i}" value="${hexes[i]}" title="Recolor">
          <span class="help" style="flex:1">${hexes[i]} · ${CI.geom.nodeCount(p)} nodes</span>
          ${parts.length > 1 ? `<select data-tmerge="${i}" title="Merge into another color" style="width:92px"><option value="">Merge…</option>${hexes.map((h, j) => j === i ? '' : `<option value="${j}">→ ${h}</option>`).join('')}</select>` : ''}
          <button class="btn small icon" data-tdel="${i}" title="Delete this color">${CI.ICONS ? CI.ICONS.trash : '×'}</button></div>`).join('');
    }
    traceUI() { const o = this.img; return { mode: o.mode, colors: o.colors, levels: o.levels, tthreshold: o.tthreshold, fidelity: o.fidelity, corners: o.corners, tdespeckle: o.tdespeckle, ignoreWhite: o.ignoreWhite, stack: o.stack, useVinyl: !!o.useVinyl, tpreset: o.tpreset }; }
    /** Skip white by default only when the image still has its background (otherwise white is real artwork). */
    ignoreWhiteFor(stats) { return this.img.ignoreWhite != null ? this.img.ignoreWhite : !(stats && stats.clearPct > 0.02); }
    traceOpts() {
      const o = this.img; const r = this.app.selectedRaster() || this.app.traceSource(this.app.liveTrace());
      const ign = this.ignoreWhiteFor(r ? this.app.rasterStats(r) : null);
      return { mode: o.mode, colors: o.colors, levels: o.levels, threshold: o.mode === 'dark' ? o.tthreshold : 128,
        tolerance: U.round(3.5 - o.fidelity * 0.031, 3), corner: Math.round(85 - o.corners * 0.6), despeckle: o.tdespeckle, smooth: 1,
        ignore: ign ? ['#ffffff'] : [], ignoreTol: 10, stack: !!o.stack, keepImage: o.keepImage,
        palette: o.useVinyl && (o.mode === 'colors' || o.mode === 'gray') ? CI.vinyl.hexes() : undefined };
    }
    previewTrace() {
      clearTimeout(this._pt);
      this._pt = setTimeout(() => {
        const live = this.app.liveTrace(); const r = this.app.selectedRaster() || this.app.traceSource(live); const st = $('#trace-stats'); if (!r) return;
        if (!this.img.preview && !live) { this.app.clearPreview(); if (st) st.textContent = ''; return; }
        try {
          const res = this.app.previewTrace(r, this.traceOpts(), this.img.view, live);
          if (res.source) { if (st) st.textContent = 'Showing the source image.'; if (live) this.app.preview.removeChildren(); this._showSource(r, live); return; }
          if (st) st.innerHTML = res.colors ? `${res.colors} cut layer${res.colors > 1 ? 's' : ''} · ${res.nodes.toLocaleString()} nodes ` + res.layers.map(l => `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${l.color};border:1px solid #fff4"></span>`).join(' ') : 'Nothing would be traced with these settings.';
        } catch (e) { if (st) st.textContent = 'Preview failed: ' + e.message; }
      }, 180);
    }
    /** "Source" view: show the hidden image in place of the result (preview only — nothing changes). */
    _showSource(r, live) {
      const k = r.clone({ insert: false }); k.visible = true; k.opacity = 1;
      const fit = live && this.app._liveFit(live); if (fit) k.transform(fit);
      this.app.preview.addChild(new paper.Path.Rectangle({ rectangle: (live ? live.bounds : r.bounds).expand(3), fillColor: '#fbfaf7', insert: false }));
      this.app.preview.addChild(k);
    }
    distUI() { const d = this.dist; return { preset: d.preset, wear: d.wear, rough: d.rough, cracks: d.cracks, texture: d.texture || 0, grain: d.grain, seed: d.seed, edgeOnly: !!d.edgeOnly, band: d.band }; }
    distOpts() { const d = this.dist; return { wear: d.wear, rough: d.rough, cracks: d.cracks, texture: d.texture || 0, grain: d.grain, seed: d.seed, smooth: d.smooth, edgeOnly: !!d.edgeOnly, band: d.band }; }
    htmlDistress() {
      const d = this.dist; const m = this.app.material(); const live = this.app.liveDistress();
      const sl = (k, label, min, max, step, unit = '') => `<div class="slider-row"><span>${label}</span><input type="range" data-dist="${k}" min="${min}" max="${max}" step="${step}" value="${d[k]}"><output>${d[k]}${unit}</output></div>`;
      return `<p class="help">${live ? '<b>Live distress</b> — changes are redone from your original artwork. ' : ''}Worn-ink look for shirts. <b>Edge texture</b> is a fine wobble on the outline (no holes). Worn spots, rough edges and cracks keep every hole at least <b>${CI.cutcheck.fmtFrac(Math.max(m.minFeature, m.minGap))}</b> wide so it can be weeded in ${esc(m.name)}.</p>
        <div class="grid2">${Object.entries(CI.distress.PRESETS).map(([k, p]) => `<button class="btn small ${d.preset === k ? 'go' : ''}" data-dpreset="${k}">${p.name}</button>`).join('')}</div>
        <label class="help"><input type="checkbox" data-dist="edgeOnly" ${d.edgeOnly ? 'checked' : ''}> <b>Edges only</b> — wear stays along the outlines, centers stay solid</label>
        ${d.edgeOnly ? sl('band', 'Edge band', 0.04, 0.4, 0.01, '"') : ''}
        ${sl('texture', 'Edge texture', 0, 1, 0.05)}${sl('grain', 'Grain size', 0.03, 0.6, 0.01, '"')}${sl('wear', 'Worn spots', 0, 1, 0.05)}${sl('rough', 'Chipped edges', 0, 1, 0.05)}${sl('cracks', 'Cracks', 0, 1, 0.05)}
        <div class="grid2"><button class="btn small" data-action="distressSeed" title="${live ? 'Re-scramble now, from the original' : 'Shuffle where the wear lands'}">New pattern</button><button class="btn small" data-action="distressPreview">Preview</button></div>
        ${live ? `<div class="grid2"><button class="btn go" data-action="distressApply">Update distress</button><button class="btn" data-action="distressRemove">Remove distress</button></div>`
        : `<label class="help"><input type="checkbox" data-dist="keep" ${d.keep ? 'checked' : ''}> Keep it live (original kept hidden so you can re-scramble)</label>
        <button class="btn go" data-action="distressApply">Apply distress</button>`}
        <p class="help" id="distress-stats"></p>`;
    }
    previewDistress(now) {
      clearTimeout(this._pd);
      this._pd = setTimeout(() => {
        const st = $('#distress-stats');
        try { const r = this.app.previewDistress(this.distOpts()); if (st) st.textContent = r.colors ? `Preview: ${r.nodes.toLocaleString()} nodes · pink = cut line` : 'Nothing left — lower Worn spots.'; }
        catch (e) { if (st) st.textContent = 'Preview failed: ' + e.message; }
      }, now ? 0 : 250);
    }
    htmlPathfinder() {
      const b = (act, icon, label, title) => `<button class="btn btn-col" data-action="${act}" title="${esc(title || label)}">${I[icon]}${label}</button>`;
      return `<div class="grid5">${b('weld', 'unite', 'Weld', 'Weld / Unite — merge into one cut shape')}${b('minus', 'minus', 'Minus', 'Minus front — cut the top shapes out of the bottom one')}${b('intersect', 'intersect', 'Intersect', 'Keep only the overlap')}${b('exclude', 'exclude', 'Exclude', 'Remove the overlap')}${b('divide', 'divide', 'Divide', 'Split into all overlapping pieces')}</div>
        <div class="grid3"><button class="btn small" data-action="compound">Compound</button><button class="btn small" data-action="release">Release</button><button class="btn small" data-action="separate" title="Split a multi-color trace into separate layers">Split colors</button></div>
        <p class="help"><b>Offset / contour</b> — sticker borders, thickening, layered backing</p>
        <div class="row"><label class="field" style="width:120px"><span>in</span><input type="number" step="0.0625" data-off="dist" value="${this.offset.dist}"></label>
          <label class="help"><input type="checkbox" data-off="fillHoles" ${this.offset.fillHoles ? 'checked' : ''}> Solid</label>
          <label class="help"><input type="checkbox" data-off="keep" ${this.offset.keep ? 'checked' : ''}> Keep original</label></div>
        <button class="btn" data-action="offsetApply">Apply offset</button>
        <div class="slider-row"><span>Smooth</span><input type="range" min="0.002" max="0.05" step="0.002" data-smooth value="${this.smoothAmt}"><output>${this.smoothAmt}"</output></div>
        <div class="grid2"><button class="btn small" data-action="smooth" title="Re-fit curves: fewer nodes, no jaggies, faster cutting">Smooth paths</button><button class="btn small" data-action="outlineStroke">Outline stroke</button></div>
        <p class="help"><b>Slice</b> — use the <b>Knife (K)</b>, or put a line/shape on top and press Slice</p>
        <div class="grid2"><button class="btn small" data-action="sliceTop" title="The top selected object cuts the ones below it">Slice</button><button class="btn small" data-action="bridges" title="Keep the middles of O, A, R… attached in a stencil">Stencil bridges</button></div>
        <div class="row"><label class="field" style="width:132px" title="Bridge width (blank = safe for this material)"><span>Bridge in</span><input type="number" step="0.01" min="0.03" data-bridge="width" placeholder="${U.round(Math.max(0.08, this.app.material().minFeature * 1.6), 3)}" value="${this.bridge.width || ''}"></label>
          <select data-bridge="dir" style="width:150px" title="Where the bridges go">${[['auto', 'One gap, thinnest wall'], ['left', 'One gap, left side'], ['right', 'One gap, right side'], ['top', 'One gap, top'], ['bottom', 'One gap, bottom'], ['across-v', 'Stencil-font look (vertical)'], ['across-h', 'Stencil-font look (horizontal)']].map(([v, l]) => `<option value="${v}" ${this.bridge.dir === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <p class="help">One gap per middle keeps every letter in one piece and the stencil sheet in one piece.</p>
        <p class="help"><b>Expand for weeding</b> — fix lines too thin to weed</p>
        <div class="row"><label class="field" style="width:132px" title="Every part thinner than this grows to this width"><span>Min width in</span><input type="number" step="0.005" min="0.01" data-xw value="${U.round(this.expandW || this.app.material().minFeature, 4)}"></label><button class="btn small" data-action="expandThin" title="Only the too-thin parts grow; the rest stays exact">Expand thin lines</button></div>
        <div class="slider-row"><span>Bolder</span><input type="range" min="0.005" max="0.1" step="0.005" data-bold value="${this.boldAmt}"><output>${this.boldAmt}"</output></div>
        <button class="btn small" data-action="bolder" title="Push every edge outward by this amount">Make bolder (expand all edges)</button>`;
    }
    htmlEffects() {
      const f = this.fx; const n = this.app.selection.length;
      const sl = (k, label, min, max, step) => `<div class="slider-row"><span>${label}</span><input type="range" data-fx="${k}" min="${min}" max="${max}" step="${step}" value="${f[k]}"><output>${f[k]}"</output></div>`;
      return `<p class="help"><b>Outline / shadow layer</b> — a solid layer behind in another color</p>
        ${sl('offset', 'Outline', 0.02, 0.4, 0.01)}${sl('shift', 'Shadow shift', 0, 0.3, 0.01)}
        <div class="row"><input type="color" data-fx="color" value="${f.color}"><div class="swatches">${SWATCHES.slice(0, 10).map(c => `<button style="background:${c}" data-fxcolor="${c}"></button>`).join('')}</div></div>
        <button class="btn small" data-action="fxOutline">Add ${f.shift ? 'shadow' : 'outline'} layer</button>
        <p class="help"><b>Knockout</b> — text cut out of a badge (one piece)</p>
        <div class="row"><select data-fx="koShape" style="width:120px">${[['circle', 'Circle'], ['oval', 'Oval'], ['rounded', 'Rounded'], ['rect', 'Rectangle']].map(([v, l]) => `<option value="${v}" ${f.koShape === v ? 'selected' : ''}>${l}</option>`).join('')}</select><label class="field" style="width:110px"><span>Pad in</span><input type="number" step="0.05" min="0" data-fx="koPad" value="${f.koPad}"></label><button class="btn small" data-action="fxKnockout">Knockout</button></div>
        <p class="help"><b>Split monogram</b> — select a big letter/shape <i>and</i> the name across it${n < 2 ? ' (select both)' : ''}</p>
        <div class="row"><label class="field" style="width:110px"><span>Gap in</span><input type="number" step="0.02" min="0" data-fx="splitPad" value="${f.splitPad}"></label><button class="btn small" data-action="fxSplit" ${n < 2 ? 'disabled' : ''}>Split around text</button></div>`;
    }
    /** "What are you making?" — sets material, mat and garment size in one step. */
    modalWizard() {
      const opts = [
        ['shirt', 'T-shirt or apparel', 'Iron-on (HTV), mirrored, sized for the garment'],
        ['decal', 'Decal or sticker', 'Adhesive vinyl for cups, cars, walls'],
        ['layered', 'Layered vinyl / HTV', 'Several colors stacked, with registration marks'],
        ['stencil', 'Stencil', 'Vinyl stencil for paint — middles bridged'],
        ['card', 'Card or paper craft', 'Cardstock; fine detail is OK'],
        ['foam', 'Foam, felt or costume piece', 'Thick material: bold shapes only'],
      ];
      this.modal(`<h2>What are you making?</h2><p class="help">Kerf sets the material, cutting rules, mirror and mat for you. Change anything later at the top bar.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">${opts.map(([k, t, d]) => `<button class="btn" data-wiz="${k}" style="display:grid;justify-items:start;justify-content:start;text-align:left;gap:3px;padding:10px 12px;white-space:normal"><b>${t}</b><span class="help">${d}</span></button>`).join('')}</div>
        <div id="wiz-garment" hidden style="margin-top:12px"><p class="help"><b>Which garment?</b></p><div class="row">${['adult_front', 'adult_back', 'left_chest', 'youth_front', 'toddler', 'onesie', 'hat', 'tote'].map(k => `<button class="btn small" data-wizg="${k}">${esc(CI.PLACEMENTS[k].name)}</button>`).join('')}</div></div>`);
      const card = $('#modal-card'); const a = this.app; const done = (msg) => { $('#modal').hidden = true; this.renderDesign(true); this.toast(msg, 'ok'); };
      card.querySelectorAll('[data-wiz]').forEach(b => b.onclick = () => {
        const k = b.dataset.wiz;
        if (k === 'shirt' || k === 'layered') { a.setMaterial('htv'); a.setMat('12x12'); this.wizKind = k; $('#wiz-garment').hidden = false; return; }
        if (k === 'decal') { a.setMaterial('vinyl'); a.setMat('12x12'); return done('Set up for adhesive vinyl. Type with T or drop in artwork.'); }
        if (k === 'stencil') { a.setMaterial('vinyl'); a.setMat('12x12'); return done('Stencil: when your design is ready, use Pathfinder \u2192 Stencil bridges so no middles fall out.'); }
        if (k === 'card') { a.setMaterial('cardstock'); a.setMat('12x12'); return done('Set up for cardstock.'); }
        if (k === 'foam') { a.setMaterial('foam2mm'); a.setMat('12x24'); return done('Set up for 2 mm foam on the 12x24 mat. Keep shapes bold — Cut check will flag thin parts.'); }
      });
      card.querySelectorAll('[data-wizg]').forEach(b => b.onclick = () => {
        this.place = b.dataset.wizg; a.doc.placement = this.place;
        done(`Set up for ${CI.PLACEMENTS[this.place].name} in iron-on (mirrored). Design, then use Garment placement \u2192 Size to fit.` + (this.wizKind === 'layered' ? ' For layers, add Registration marks in Export.' : ''));
      });
    }
    htmlPlacement() {
      const p = CI.PLACEMENTS[this.place];
      const b = (this.app.selection.length ? this.app.selection : this.app.designItems().filter(i => i.visible && !(i.data && i.data.weed))).map(i => i.bounds).reduce((x, y) => x ? x.unite(y) : y, null);
      const w = b ? b.width / UPI : 0, h = b ? b.height / UPI : 0;
      const warn = b && (w > p.maxW + 0.01 || h > p.maxH + 0.01) ? `<p class="help" style="color:var(--warn)">Currently ${U.round(w, 2)}" × ${U.round(h, 2)}" — bigger than the usual max (${p.maxW}" × ${p.maxH}") for this spot.</p>` : '';
      return `<select data-place>${Object.entries(CI.PLACEMENTS).map(([k, v]) => `<option value="${k}" ${k === this.place ? 'selected' : ''}>${esc(v.name)} — ${v.w}" wide</option>`).join('')}</select>
        <p class="help">Typical width <b>${p.w}"</b>, max ${p.maxW}" × ${p.maxH}". Applies to the selection, or the whole design if nothing is selected.</p>${warn}
        <div class="grid2"><button class="btn small" data-action="placeFit">Size to fit</button><button class="btn small" data-action="mockup">Preview on garment</button></div>`;
    }
    /** Garment mockup at true scale. */
    modalMockup() {
      const a = this.app; const key = this.place; const p = CI.PLACEMENTS[key]; const col = a.doc.garmentColor || '#ffffff';
      const items = a.designItems().filter(i => i.visible && !(i.data && i.data.weed));
      const { layers } = CI.exporter.cutLayers(items, { weld: true, mirror: false });
      const G = GARMENTS[p.garment];
      let design = '', dims = 'Nothing to show yet — add a design first.', warn = '';
      if (layers.length) {
        const bb = layers.map(l => l.path.bounds).reduce((x, y) => x.unite(y)); const bw = bb.width / UPI, bh = bb.height / UPI;
        const gx = G.cx + p.x - bw / 2, gy = G.collar + p.top;
        design = `<g transform="translate(${gx} ${gy}) scale(${1 / UPI}) translate(${-bb.x} ${-bb.y})">${layers.map(l => `<path d="${CI.exporter.pathDataOf(l.path)}" fill="${l.color}" fill-rule="evenodd"/>`).join('')}</g>`;
        dims = `${U.round(bw, 2)}" × ${U.round(bh, 2)}" on ${esc(p.name)}`;
        if (bw > p.maxW + 0.01 || bh > p.maxH + 0.01) warn = `<p class="help" style="color:var(--warn)">Bigger than the usual maximum (${p.maxW}" × ${p.maxH}") — use <b>Size to fit</b>.</p>`;
        if (layers.some(l => l.color.toLowerCase() === col.toLowerCase())) warn += `<p class="help" style="color:var(--warn)">One of your colors matches the garment color, so that layer won't show.</p>`;
      }
      const [vx, vy, vw, vh] = G.view;
      const svg = `<svg viewBox="${vx} ${vy} ${vw} ${vh}" style="width:100%;max-height:58vh;background:#e9e5dc;border-radius:10px"><path d="${G.path}" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width="${vw / 400}" stroke-linejoin="round"/>${G.extra ? `<path d="${G.extra}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${vw / 300}"/>` : ''}${design}</svg>`;
      this.modal(`<h2>Garment mockup</h2>
        <div class="row" style="margin-bottom:8px"><select id="mock-place">${Object.entries(CI.PLACEMENTS).map(([k, v]) => `<option value="${k}" ${k === key ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
          <div class="swatches">${GARMENT_COLORS.map(([n, c]) => `<button style="background:${c};width:24px;height:24px" data-mock-color="${c}" title="${n}"></button>`).join('')}</div></div>
        ${svg}<p class="help">${dims} · shown at true scale on ${esc(G.name)}.</p>${warn}
        <div class="row"><button class="btn small" data-mock-fit>Size to fit this spot</button></div>`);
      const card = $('#modal-card');
      $('#mock-place').onchange = (e) => { this.place = e.target.value; this.renderDesign(true); this.modalMockup(); };
      card.querySelectorAll('[data-mock-color]').forEach(b => b.onclick = () => { a.doc.garmentColor = b.dataset.mockColor; this.modalMockup(); });
      card.querySelector('[data-mock-fit]').onclick = () => { a.select(items); a.placeFor(this.place); this.modalMockup(); };
    }
    modalVinyl() {
      const list = CI.vinyl.list();
      this.modal(`<h2>My vinyl</h2><p class="help">The colors you own. Image Trace can snap to these, and Export shows which roll goes on each mat. Saved in this browser.</p>
        <div id="vinyl-rows" style="display:grid;gap:6px;margin:10px 0">${list.map((v, i) => `<div class="row" style="flex-wrap:nowrap"><input type="color" data-vhex="${i}" value="${v.hex}"><input type="text" data-vname="${i}" value="${esc(v.name)}" style="flex:1"><button class="btn small" data-vdel="${i}">Remove</button></div>`).join('')}</div>
        <div class="row"><button class="btn small" data-vadd>Add color</button><button class="btn small" data-vreset>Reset to starter set</button><span style="flex:1"></span><button class="btn small" data-vsnap>Snap ${this.app.selection.length ? 'selection' : 'design'} to my vinyl</button></div>`);
      const card = $('#modal-card');
      card.querySelectorAll('[data-vhex]').forEach(el => el.onchange = () => { CI.vinyl.update(+el.dataset.vhex, { hex: el.value }); this.afterVinyl(); });
      card.querySelectorAll('[data-vname]').forEach(el => el.onchange = () => { CI.vinyl.update(+el.dataset.vname, { name: el.value }); this.afterVinyl(); });
      card.querySelectorAll('[data-vdel]').forEach(el => el.onclick = () => { CI.vinyl.remove(+el.dataset.vdel); this.afterVinyl(); this.modalVinyl(); });
      card.querySelector('[data-vadd]').onclick = () => { CI.vinyl.add('New color', '#888888'); this.modalVinyl(); };
      card.querySelector('[data-vreset]').onclick = () => { CI.vinyl.reset(); this.afterVinyl(); this.modalVinyl(); };
      card.querySelector('[data-vsnap]').onclick = () => { this.run('snapVinyl'); };
    }
    afterVinyl() { if (this.tab === 'export') this.renderExport(); if (this.img.useVinyl) this.previewTrace(); }
    htmlAlign() {
      const b = (act, label) => `<button class="btn icon" data-action="${act}" title="${label}">${I[act]}</button>`;
      return `<div class="row" style="justify-content:space-between">${b('alL', 'Align left')}${b('alH', 'Align horizontal centers')}${b('alR', 'Align right')}${b('alT', 'Align top')}${b('alV', 'Align vertical centers')}${b('alB', 'Align bottom')}</div>
        <div class="row">${b('disH', 'Distribute horizontally (3+ objects)')}${b('disV', 'Distribute vertically (3+ objects)')}<span class="help">One object aligns to the mat.</span></div>
        <div class="grid2"><button class="btn small" data-action="group">Group</button><button class="btn small" data-action="ungroup">Ungroup</button><button class="btn small" data-action="front">To front</button><button class="btn small" data-action="back">To back</button></div>
        <button class="btn small" data-action="fitMat">Fit design to mat</button>
        <p class="help"><b>Make copies</b> — lay out several on the mat</p>
        <div class="row"><label class="field" style="width:90px"><span>×</span><input type="number" min="1" max="200" step="1" data-copies value="${this.copies}"></label><button class="btn small" data-action="copies">Make copies</button><button class="btn small" data-action="copiesFill">Fill the mat</button></div>`;
    }
    bindPanels() {
      const pd = $('#panel-design'); const a = this.app;
      pd.addEventListener('toggle', e => { const d = e.target.closest('details[data-sec]'); if (d) this.open[d.dataset.sec] = d.open; }, true);
      pd.addEventListener('click', e => {
        const sw = e.target.closest('[data-swatch]'); if (sw) { if (sw.dataset.target === 'new') { a.fill = sw.dataset.swatch; $('#new-fill').value = a.fill; this.renderDesign(true); } else a.setFill(sw.dataset.swatch); return; }
        const fc = e.target.closest('[data-fxcolor]'); if (fc) { this.fx.color = fc.dataset.fxcolor; const ci = $('[data-fx="color"]'); if (ci) ci.value = this.fx.color; return; }
        const tp = e.target.closest('[data-tpreset]');
        if (tp) { const p = TRACE_PRESETS[tp.dataset.tpreset]; Object.assign(this.img, p.set, { tpreset: tp.dataset.tpreset }); if (p.set.ignoreWhite === undefined) this.img.ignoreWhite = null; this.renderDesign(true); this.previewTrace(); return; }
        const tm = e.target.closest('[data-tmethod]'); if (tm) { this.img.stack = tm.dataset.tmethod === 'stacked'; this.img.tpreset = null; this.renderDesign(true); this.previewTrace(); return; }
        const tv = e.target.closest('[data-tview]'); if (tv) { this.img.view = tv.dataset.tview; $$('[data-tview]').forEach(b => b.classList.toggle('on', b === tv)); this.previewTrace(); return; }
        const td = e.target.closest('[data-tdel]'); if (td) { a.deletePart(a.selection[0], +td.dataset.tdel); this.renderDesign(true); return; }
        const dp = e.target.closest('[data-dpreset]'); if (dp) { Object.assign(this.dist, CI.distress.PRESETS[dp.dataset.dpreset], { preset: dp.dataset.dpreset }); this.renderDesign(true); this.previewDistress(true); return; }
        const al = e.target.closest('[data-align]'); if (al) { const t = a.selectedText(); if (t) a.updateText(t, { align: al.dataset.align }); this.renderDesign(true); }
      });
      const textUpdate = U.debounce((k, v) => { const t = a.selectedText(); if (t) a.updateText(t, { [k]: v }); }, 220);
      pd.addEventListener('input', e => {
        const el = e.target; const out = el.parentElement && el.parentElement.querySelector('output');
        if (el.dataset.text) {
          let v = el.type === 'checkbox' ? el.checked : el.value;
          if (['size', 'letterSpacing', 'lineHeight', 'curve', 'weight'].includes(el.dataset.text)) v = parseFloat(v); if (Number.isNaN(v)) return;
          if (out) out.textContent = v;
          if (el.dataset.text === 'text' || el.type === 'range') textUpdate(el.dataset.text, v);
        }
        if (el.dataset.img) {
          const k = el.dataset.img; this.img[k] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' ? el.value : parseFloat(el.value));
          if (out) out.textContent = el.value;
          if (['mode', 'colors', 'levels', 'tthreshold', 'fidelity', 'corners', 'tdespeckle', 'ignoreWhite', 'stack'].includes(k)) this.img.tpreset = null;
          if (['mode', 'colors', 'levels', 'tthreshold', 'fidelity', 'corners', 'tolerance', 'tdespeckle', 'ignoreWhite', 'stack', 'useVinyl', 'preview'].includes(k)) { if (k === 'mode') { this.renderDesign(true); this.previewTrace(); } else this.previewTrace(); }
        }
        if (el.dataset.dist) {
          const k = el.dataset.dist; this.dist[k] = el.type === 'checkbox' ? el.checked : parseFloat(el.value);
          if (k === 'edgeOnly') { this.dist.preset = null; this.renderDesign(true); this.previewDistress(true); }
          else if (k !== 'keep') { this.dist.preset = null; if (out) out.textContent = el.value + (k === 'grain' || k === 'band' ? '"' : ''); this.previewDistress(); }
        }
        if (el.dataset.fx && el.type === 'range') { this.fx[el.dataset.fx] = parseFloat(el.value); if (out) out.textContent = el.value + '"'; if (el.dataset.fx === 'shift') { const b = $('[data-action="fxOutline"]'); if (b) b.textContent = 'Add ' + (this.fx.shift ? 'shadow' : 'outline') + ' layer'; } }
        if (el.hasAttribute('data-bold')) { this.boldAmt = parseFloat(el.value); if (out) out.textContent = el.value + '"'; }
        if (el.hasAttribute('data-smooth')) { this.smoothAmt = parseFloat(el.value); if (out) out.textContent = el.value + '"'; }
        if (el.dataset.prop === 'newfill') { a.fill = el.value; $('#new-fill').value = el.value; }
      });
      pd.addEventListener('change', e => {
        const el = e.target; const k = el.dataset.prop;
        if (el.dataset.text && !(el.dataset.text === 'text' || el.type === 'range')) {
          const t = a.selectedText(); if (!t) return; let v = el.type === 'checkbox' ? el.checked : el.value;
          if (['size', 'letterSpacing', 'lineHeight', 'weight'].includes(el.dataset.text)) { v = parseFloat(v); if (Number.isNaN(v)) return; }
          if (el.dataset.text === 'family') { const f = CI.fonts.get(v); const go = () => { a.updateText(t, { family: v, weight: CI.fonts.weights(v)[0] || 400 }); this.renderDesign(true); }; if (!f) CI.fonts.ensure(v).then(go).catch(err => this.toast(err.message, 'error')); else go(); return; }
          a.updateText(t, { [el.dataset.text]: v }); return;
        }
        if (el.dataset.fx && el.type !== 'range') { this.fx[el.dataset.fx] = el.type === 'number' ? parseFloat(el.value) || 0 : el.value; return; }
        if (el.dataset.bridge) { this.bridge[el.dataset.bridge] = el.dataset.bridge === 'width' ? (parseFloat(el.value) > 0 ? parseFloat(el.value) : null) : el.value; return; }
        if (el.hasAttribute('data-copies')) { this.copies = Math.max(1, Math.min(200, parseInt(el.value, 10) || 1)); return; }
        if (el.hasAttribute('data-xw')) { const v = parseFloat(el.value); this.expandW = v > 0 ? v : null; return; }
        if (el.hasAttribute('data-place')) { this.place = el.value; this.renderDesign(true); return; }
        if (el.dataset.tcolor != null && a.selection[0]) { a.recolorPart(a.selection[0], +el.dataset.tcolor, el.value); this.renderDesign(true); return; }
        if (el.dataset.tmerge != null && el.value !== '' && a.selection[0]) { a.mergePart(a.selection[0], +el.dataset.tmerge, +el.value); this.renderDesign(true); return; }
        if (el.dataset.off) { this.offset[el.dataset.off] = el.type === 'checkbox' ? el.checked : parseFloat(el.value); return; }
        if (!k) return;
        const v = parseFloat(el.value);
        if (k === 'ratio') { this.keepRatio = el.checked; return; }
        if (k === 'fill') return a.setFill(el.value);
        if (k === 'stroke') return a.setStroke(el.value, null);
        if (k === 'strokeW') return a.setStroke(null, Math.max(0, v) * CI.text.PT);
        if (k === 'rot') { if (v) a.rotateSelection(v); el.value = 0; return; }
        if (['w', 'h', 'x', 'y'].includes(k) && !Number.isNaN(v)) {
          if ((k === 'w' || k === 'h') && v <= 0) return this.updateSelFields();
          a.setBounds({ [k]: v * UPI }, this.keepRatio !== false && (k === 'w' || k === 'h'));
        }
      });
      pd.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });
      // stroke color input with no stroke yet: give it a sensible width
      // layers
      const pl = $('#panel-layers');
      pl.addEventListener('click', e => {
        const row = e.target.closest('[data-item]'); if (!row) return;
        const item = this.app.designItems().find(i => String(i.id) === row.dataset.item); if (!item) return;
        const op = e.target.closest('[data-op]');
        if (op) {
          const o = op.dataset.op;
          if (o === 'vis') a.setVisible(item, !item.visible);
          if (o === 'lock') a.setLocked(item, !item.locked);
          if (o === 'up') { const n = item.nextSibling; if (n) { item.insertAbove(n); a.commit('Move up'); } }
          if (o === 'down') { const p = item.previousSibling; if (p) { item.insertBelow(p); a.commit('Move down'); } }
          if (o === 'del') { item.remove(); a.commit('Delete'); }
          return;
        }
        if (item.locked || !item.visible) return;
        a.select([item], e.shiftKey || e.ctrlKey || e.metaKey);
      });
      pl.addEventListener('dblclick', e => {
        const row = e.target.closest('[data-item]'); if (!row) return;
        const item = this.app.designItems().find(i => String(i.id) === row.dataset.item); if (!item) return;
        const name = prompt('Layer name', a.itemName(item)); if (name) a.rename(item, name);
      });
      // check panel
      const pc = $('#panel-check');
      pc.addEventListener('click', e => {
        const b = e.target.closest('[data-issue]'); if (!b) return;
        const issue = this.app.issues[+b.dataset.issue]; if (!issue) return;
        if (b.dataset.do === 'show') this.app.highlightIssue(issue);
        if (b.dataset.do === 'fix') { const msg = this.app.applyFix(issue); this.app.clearHighlights(); this.toast(msg, 'ok'); this.app.runCutCheck(); }
      });
      pc.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset.mat) { const k = a.doc.material; const o = a.doc.overrides[k] = a.doc.overrides[k] || {}; const v = parseFloat(el.value); if (!Number.isNaN(v) && v >= 0) { o[el.dataset.mat] = v; a.commit('Material rule'); } }
        if (el.id === 'chk-material') a.setMaterial(el.value);
        if (el.id === 'chk-mat') a.setMat(el.value);
      });
      // export panel
      const pe = $('#panel-export');
      pe.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset.exp === 'weld') { a.doc.weld = el.checked; a.commit('Weld on export'); }
        if (el.dataset.exp === 'mirror') { a.doc.mirror = el.checked; a.commit('Mirror'); }
        if (el.dataset.exp === 'margin') { this.margin = Math.max(0, parseFloat(el.value) || 0); }
        if (el.dataset.exp === 'name') { a.doc.name = el.value.trim() || 'design'; }
      });
      pe.addEventListener('click', e => {
        const b = e.target.closest('[data-color-dl]'); if (b) this.doExportSVG(false, b.dataset.colorDl);
        const wl = e.target.closest('[data-weedlines]'); if (wl) { this.weedOpts.lines = wl.dataset.weedlines; this.renderExport(); }
      });
      pe.addEventListener('input', e => { const k = e.target.dataset.weed; if (k) { const v = parseFloat(e.target.value); if (v > 0) this.weedOpts[k] = v; } });
      pe.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset.reg) { this.regOpts[el.dataset.reg] = el.value; return; }
        const k = el.dataset.pack; if (!k) return;
        if (k === 'on') a.doc.pack = el.checked;
        if (k === 'rotate') a.doc.packRotate = el.checked;
        if (k === 'gap') { const v = parseFloat(el.value); if (v >= 0.05) a.doc.packGap = v; }
        a.commit('Material saver'); this.renderExport();
      });
    }

    // ---------- layers panel ----------
    renderLayers() {
      const a = this.app; const items = a.designItems().slice().reverse(); const el = $('#panel-layers');
      if (!items.length) { el.innerHTML = '<div class="empty-note">No layers yet.</div>'; return; }
      el.innerHTML = `<div class="row" style="padding:8px 12px;gap:6px"><button class="btn small" data-action="group">Group</button><button class="btn small" data-action="ungroup">Ungroup</button><button class="btn small" data-action="weld">Weld</button><span class="grow" style="flex:1"></span><span class="help">${items.length} item${items.length > 1 ? 's' : ''}</span></div>` +
        items.map(i => {
          const c = a.itemColor(i); const kind = i.className === 'Raster' ? 'image' : i.data && i.data.type === 'text' ? 'text' : i.className === 'Group' ? i.children.length + ' items' : '';
          return `<div class="layer ${a.selection.includes(i) ? 'sel' : ''} ${i.visible ? '' : 'hidden-item'}" data-item="${i.id}">
            <button data-op="vis" title="${i.visible ? 'Hide' : 'Show'}">${i.visible ? I.eye : I.eyeOff}</button>
            <span class="chip" style="${c ? 'background:' + c : ''}"></span>
            <span class="name">${esc(a.itemName(i))}${kind ? `<small>${kind}</small>` : ''}</span>
            <span class="ops"><button data-op="lock" title="${i.locked ? 'Unlock' : 'Lock'}">${i.locked ? I.lock : I.unlock}</button><button data-op="up" title="Move up">${I.up}</button><button data-op="down" title="Move down">${I.down}</button><button data-op="del" title="Delete">${I.trash}</button></span>
          </div>`;
        }).join('');
      $$('.layer svg', el).forEach(s => { s.style.width = '15px'; s.style.height = '15px'; });
    }

    // ---------- cut check panel ----------
    renderCheck() {
      const a = this.app; const el = $('#panel-check'); const m = a.material();
      const mats = Object.entries(CI.MATERIALS).map(([k, x]) => `<option value="${k}" ${k === a.doc.material ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
      const matSizes = Object.keys(CI.MACHINES[a.doc.machine].mats).map(k => `<option ${k === a.doc.mat ? 'selected' : ''}>${k}</option>`).join('');
      const f = (k, label, step) => `<label class="field" title="${label}"><span style="min-width:150px">${label}</span><input type="number" step="${step}" min="0" data-mat="${k}" value="${U.round(m[k], 4)}"></label>`;
      const ov = a.doc.overrides[a.doc.material] && Object.keys(a.doc.overrides[a.doc.material]).length;
      let h = `<details class="sec" open><summary>Material rules</summary><div class="body">
        <div class="grid2"><select id="chk-material">${mats}</select><select id="chk-mat">${matSizes}</select></div>
        <div style="display:grid;gap:6px">${f('minFeature', 'Thinnest line (in)', 0.005)}${f('minGap', 'Closest cut lines (in)', 0.005)}${f('minPiece', 'Smallest piece (sq in)', 0.002)}${f('minHole', 'Smallest hole (sq in)', 0.002)}</div>
        <p class="help">${esc(m.note)} Mat: <b>${(CI.MAT_STYLE[CI.MAT_FOR[a.doc.material]] || {}).name || ''}</b>.</p>
        <div class="row"><button class="btn go" data-action="checkNow">Check now</button>${ov ? '<button class="btn small" data-action="resetMaterial">Reset to preset</button>' : ''}<span class="help">Runs automatically after each change.</span></div>
      </div></details>`;
      const issues = a.issues || []; const s = a.summary;
      if (s && s.ready && a.designItems().length) h += `<div class="ready-card"><b>Ready to cut</b>Every rule passes for ${esc(m.name)}. ${s.colors} color${s.colors > 1 ? 's' : ''} → ${s.colors} mat${s.colors > 1 ? 's' : ''}.</div>`;
      const FIX = { smooth: 'Smooth', weld: 'Weld', removesmall: 'Remove', fillholes: 'Fill holes', thicken: 'Expand thin parts', weedupdate: 'Update weed box', mirror: 'Mirror on', fitmat: 'Fit to mat', trace: 'Open trace', close: 'Close path' };
      h += issues.map((i, idx) => `<div class="issue ${i.severity}"><div class="t"><span class="sev">${i.severity === 'error' ? 'Fix' : i.severity === 'warning' ? 'Warn' : 'Note'}</span><span>${esc(i.title)}</span></div><div class="d">${esc(i.detail)}</div>
        <div class="acts">${i.regions && i.regions.length ? `<button class="btn small" data-issue="${idx}" data-do="show">Show ${i.regions.length > 1 ? '(' + i.regions.length + ')' : ''}</button>` : ''}${i.fix ? `<button class="btn small" data-issue="${idx}" data-do="fix">${FIX[i.fix] || 'Fix'}</button>` : ''}</div></div>`).join('');
      el.innerHTML = h;
    }

    // ---------- export panel ----------
    renderExport() {
      const a = this.app; const el = $('#panel-export');
      let layers = [];
      try { layers = CI.exporter.cutLayers(a.designItems(), { weld: a.doc.weld, pack: a.packOpts() }).layers; } catch (e) { console.error(e); }
      const s = a.summary || { errors: 0, warnings: 0 };
      const warn = s.errors || s.warnings ? `<p class="help" style="color:var(--warn)">${s.errors ? s.errors + ' problem(s) and ' : ''}${s.warnings} warning(s) — <button class="btn small" data-action="showCheck">review Cut check</button></p>` : '';
      const imgs = a.designItems().filter(i => i.className === 'Raster' && i.visible).length;
      el.innerHTML = `<details class="sec" open><summary>Cut layers (${layers.length})</summary><div class="body">
          ${layers.length ? layers.map(l => { const b = l.bounds || l.path.bounds; const vn = CI.vinyl.nameOf(l.color); return `<div class="cut-layer"><span class="chip" style="background:${l.color}"></span><span>${vn ? '<b>' + esc(vn) + '</b> ' : ''}${l.color} · ${U.round(b.width / UPI, 2)}" × ${U.round(b.height / UPI, 2)}" · ${CI.geom.nodeCount(l.path)} nodes${l.extras && l.extras.length ? ' · weed box' : ''}</span><button class="btn small" data-color-dl="${l.color}" title="Download only this color">SVG</button></div>`; }).join('') : '<p class="help">Nothing to cut yet.</p>'}
          ${imgs ? `<p class="help" style="color:var(--warn)">${imgs} visible image(s) are not included — trace them first.</p>` : ''}
          ${warn}
        </div></details>
        <details class="sec" open><summary>Layering</summary><div class="body">
          <p class="help"><b>Registration marks</b> are cut in every color at the same spots beside the design. Line them up to stack layers perfectly, then peel them off. They follow the design when you move it.</p>
          <div class="grid2"><select data-reg="shape">${[['cross', 'Cross marks'], ['circle', 'Dots'], ['square', 'Squares']].map(([v, l]) => `<option value="${v}" ${this.regOpts.shape === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <select data-reg="where">${[['sides', 'Left + right'], ['corners', '4 corners']].map(([v, l]) => `<option value="${v}" ${this.regOpts.where === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="grid2"><button class="btn small" data-action="regAdd">${a.regMarks().length ? 'Rebuild marks' : 'Add registration marks'}</button><button class="btn small" data-action="regRemove" ${a.regMarks().length ? '' : 'disabled'}>Remove</button></div>
        </div></details>
        <details class="sec" open><summary>Material use</summary><div class="body">${this.htmlMaterialUse()}</div></details>
        <details class="sec" open><summary>Weeding</summary><div class="body">
          <p class="help">A <b>weed box</b> is cut around each color; <b>weeding lines</b> split the waste so it peels off in strips. They stop short of your design, so they never cut into it.</p>
          <div class="grid2"><label class="field"><span>Margin in</span><input type="number" step="0.05" min="0.05" data-weed="margin" value="${this.weedOpts.margin}"></label><label class="field"><span>Line every in</span><input type="number" step="0.25" min="0.25" data-weed="spacing" value="${this.weedOpts.spacing}"></label></div>
          <div class="segmented">${[['none', 'No lines'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['both', 'Both']].map(([v, l]) => `<button data-weedlines="${v}" class="${this.weedOpts.lines === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="grid3"><button class="btn small" data-action="weedBox">${a.weedBoxes().length ? 'Rebuild' : 'Add weed box'}</button><button class="btn small" data-action="weedUpdate" ${a.weedBoxes().length ? '' : 'disabled'}>Update fit</button><button class="btn small" data-action="weedRemove" ${a.weedBoxes().length ? '' : 'disabled'}>Remove</button></div>
        </div></details>
        <details class="sec" open><summary>Options</summary><div class="body">
          <label class="field"><span>Name</span><input type="text" data-exp="name" value="${esc(a.doc.name)}"></label>
          <label class="help"><input type="checkbox" data-exp="weld" ${a.doc.weld ? 'checked' : ''}> <b>Weld each color</b> — overlaps become one clean cut (recommended)</label>
          <label class="help"><input type="checkbox" data-exp="mirror" ${a.doc.mirror ? 'checked' : ''}> <b>Mirror</b> — for iron-on / HTV ${a.material().mirror ? '(needed for this material)' : ''}</label>
          <label class="field" style="width:150px"><span>Margin in</span><input type="number" step="0.05" min="0" data-exp="margin" value="${this.margin || 0}"></label>
        </div></details>
        <details class="sec" open><summary>Download</summary><div class="body">
          <button class="btn go" data-action="exportSVG">Download SVG for Design Space</button>
          <div class="grid2"><button class="btn small" data-action="exportColors">Each color as SVG</button><button class="btn small" data-action="exportPNG">PNG 300 dpi</button></div>
          <button class="btn small" data-action="save">Save editable project (.kerf)</button>
        </div></details>
        <details class="sec" open><summary>In Design Space (free)</summary><div class="body"><ol class="steps">
          <li><b>New project → Upload → Upload image</b>, choose the SVG.</li>
          <li>Each color arrives as its own layer, already the right size.</li>
          <li>Click <b>Add to canvas</b>. Don't resize unless you meant to.</li>
          <li><b>Make it</b> → pick your material. ${a.doc.mirror ? 'The file is already mirrored — leave Design Space’s mirror off.' : (a.material().mirror ? 'Turn on <b>Mirror</b> for iron-on.' : '')}</li>
        </ol><p class="help">Uploading your own SVGs is free; you don't need Cricut Access.</p></div></details>`;
    }
    htmlMaterialUse() {
      const a = this.app; let mu;
      try { mu = a.materialUse(); } catch (e) { console.error(e); return '<p class="help">Could not measure material use.</p>'; }
      if (!mu.colors.length) return '<p class="help">Nothing to cut yet.</p>';
      const W = a.matArea().width / UPI; const f = (v) => U.round(v / UPI, 1);
      const rows = mu.colors.map(c => {
        const vn = CI.vinyl.nameOf(c.color);
        const p = c.packed; const save = p ? Math.max(0, c.h - p.packed.h) : 0;
        return `<div class="mu-row"><span class="chip" style="background:${c.color}"></span><span>${vn ? '<b>' + esc(vn) + '</b> · ' : ''}${f(c.w)}" × ${f(c.h)}" as laid out${p && p.pieces > 1 ? `<br><span style="color:${save > UPI * 0.25 ? 'var(--accent-2)' : 'var(--muted)'}">packed: ${f(p.packed.h)}" of ${U.round(W, 1)}"-wide material${save > UPI * 0.25 ? ` — saves ${f(save)}"` : ''}${p.overflow ? ' · a piece is wider than the mat' : ''}</span>` : ''}</span><span></span></div>`;
      }).join('');
      const tot = mu.colors.reduce((s, c) => s + (a.doc.pack && c.packed ? c.packed.packed.h : c.h), 0);
      const blocked = mu.blockers.length ? `<p class="help">Packing is off while you use ${mu.blockers.join(' and ')} — they need the layout kept exactly as drawn.</p>` : '';
      return rows + `<p class="help">Total: about <b>${f(tot)}"</b> of material length${a.doc.pack && !mu.blockers.length ? ' (packed)' : ''}, plus a little lead-in.</p>${blocked}
        <label class="help"><input type="checkbox" data-pack="on" ${a.doc.pack ? 'checked' : ''} ${mu.blockers.length ? 'disabled' : ''}> <b>Pack pieces to save material</b> — export only; your canvas stays as is. Each object stays in one piece.</label>
        <div class="row"><label class="field" style="width:130px"><span>Gap in</span><input type="number" step="0.05" min="0.1" data-pack="gap" value="${a.doc.packGap != null ? a.doc.packGap : 0.25}"></label><label class="help"><input type="checkbox" data-pack="rotate" ${a.doc.packRotate !== false ? 'checked' : ''}> Allow rotating</label></div>
        <button class="btn small" data-action="matsPreview">Preview mats</button>`;
    }
    /** Draw each color's mat as it will be cut (packed if packing is on). */
    modalMats() {
      const a = this.app; const pack = a.packOpts() && !CI.exporter.packBlockers(a.designItems()).length;
      const { layers } = CI.exporter.cutLayers(a.designItems(), { weld: a.doc.weld, mirror: false, pack: pack ? a.packOpts() : null });
      const area = a.matArea(); const MW = area.width, MH = area.height;
      const mats = layers.map(l => {
        const all = [l.path].concat(l.extras || []); const b = l.bounds;
        const dx = -b.x, dy = -b.y; const H = Math.max(MH, b.height), Wd = Math.max(MW, b.width);
        const over = b.width > MW + 0.5 || b.height > MH + 0.5;
        const paths = all.map(p => `<path d="${CI.exporter.pathDataOf(p)}" fill="${l.color === '#ffffff' ? '#d8d8d8' : l.color}" fill-rule="evenodd"/>`).join('');
        return `<div style="display:inline-block;margin:6px;vertical-align:top;text-align:center"><svg viewBox="-12 -12 ${Wd + 24} ${H + 24}" style="width:260px;background:#fbfaf7;border-radius:6px;border:1px solid #0003">
          <rect x="0" y="0" width="${MW}" height="${MH}" fill="none" stroke="#8cc5a2" stroke-width="3" stroke-dasharray="10 6"/><g transform="translate(${dx} ${dy})">${paths}</g></svg>
          <div class="help">${esc(CI.vinyl.nameOf(l.color) || l.color)} · ${U.round(b.width / UPI, 1)}" × ${U.round(b.height / UPI, 1)}"${over ? ' <b style="color:var(--warn)">bigger than the mat</b>' : ''}</div></div>`;
      }).join('');
      this.modal(`<h2>Mats ${pack ? '(packed)' : '(as laid out)'}</h2><p class="help">Dashed line = the ${a.doc.mat} mat's cut area. Each color is cut on its own mat.</p><div>${mats || '<p class="help">Nothing to cut yet.</p>'}</div>`);
    }
    doExportSVG(perColor, onlyColor) {
      const a = this.app;
      if (!a.designItems().some(i => i.visible && i.className !== 'Raster')) return this.toast('Nothing to export yet — add shapes or trace an image.', 'warn');
      if (a.summary && a.summary.errors) this.toast('Exporting anyway — but Cut check still lists problems.', 'warn');
      const name = (a.doc.name || 'design').replace(/[^\w\- ]+/g, '').trim() || 'design';
      const base = { margin: this.margin || 0 };
      if (perColor || onlyColor) {
        const { layers } = CI.exporter.cutLayers(a.designItems(), { weld: a.doc.weld });
        const list = onlyColor ? layers.filter(l => l.color === onlyColor) : layers;
        list.forEach((l, i) => setTimeout(() => { const { svg } = a.exportSVG(Object.assign({ only: l.color }, base)); U.download(`${name}-${l.color.replace('#', '')}.svg`, svg, 'image/svg+xml'); }, i * 350));
        this.toast(`Downloading ${list.length} SVG file${list.length > 1 ? 's' : ''}.`, 'ok'); return;
      }
      const { svg, widthIn, heightIn } = a.exportSVG(base);
      U.download(name + '.svg', svg, 'image/svg+xml');
      this.toast(`Saved ${name}.svg — ${U.round(widthIn, 2)}" × ${U.round(heightIn, 2)}"`, 'ok');
      return svg;
    }

    // ---------- keyboard ----------
    bindKeys() {
      const a = this.app, t = this.tools;
      window.addEventListener('keydown', e => {
        const typing = e.target.matches && e.target.matches('input, textarea, select, [contenteditable]');
        if (e.key === ' ' && !typing) { if (!t.space) { t.space = true; this.app.canvas.style.cursor = 'grab'; } e.preventDefault(); return; }
        if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
        if (t.handleKey(e)) { e.preventDefault(); return; }
        const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
        const map = {
          'z': () => this.run(e.shiftKey ? 'redo' : 'undo'), 'y': () => this.run(e.shiftKey ? 'cutPreview' : 'redo'),
          'c': () => this.run('copy'), 'x': () => this.run('cut'), 'v': () => this.run('paste'), 'd': () => this.run('duplicate'), 'a': () => this.run('selectAll'),
          'g': () => this.run(e.shiftKey ? 'ungroup' : 'group'), 's': () => this.run('save'), 'o': () => this.run(e.shiftKey ? 'outlines' : 'open'), 'i': () => this.run('import'), 'e': () => this.run('exportSVG'),
          '0': () => this.run('zoomFit'), '1': () => this.run('zoom100'), '2': () => this.run('zoomSel'), '=': () => this.run('zoomIn'), '+': () => this.run('zoomIn'), '-': () => this.run('zoomOut'),
          ']': () => this.run(e.shiftKey ? 'front' : 'forward'), '[': () => this.run(e.shiftKey ? 'back' : 'backward'), '}': () => this.run('front'), '{': () => this.run('back'), '8': () => this.run('compound'), 'u': () => this.run('snap'), 'm': () => this.run('mockup'),
        };
        if (mod && map[k]) { e.preventDefault(); map[k](); return; }
        if (mod) return;
        if (k === 'delete' || k === 'backspace') { e.preventDefault(); return this.run('delete'); }
        if (k === 'escape') { if (t.tool !== 'select') t.setTool('select'); return this.run('deselect'); }
        if (k.startsWith('arrow')) {
          e.preventDefault(); const step = (e.shiftKey ? 0.25 : 1 / 32) * UPI;
          const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k]; a.nudge(d[0], d[1]); return;
        }
        if (k === '?') return this.run('shortcuts');
        const tool = TOOLS.find(x => x && x[2].toLowerCase() === k); if (tool) { t.setTool(tool[0]); return; }
      });
      window.addEventListener('keyup', e => { if (e.key === ' ') { t.space = false; this.app.canvas.style.cursor = { hand: 'grab' }[t.tool] || (t.tool === 'select' ? 'default' : 'crosshair'); } });
      window.addEventListener('paste', async e => {
        if (e.target.matches && e.target.matches('input, textarea')) return;
        const files = [...(e.clipboardData && e.clipboardData.files || [])];
        if (files.length) { e.preventDefault(); this.importFiles(files); return; }
        const text = e.clipboardData && e.clipboardData.getData('text/plain');
        if (text && /<svg[\s>]/i.test(text)) { e.preventDefault(); try { a.importSVGText(text, 'Pasted SVG'); } catch (err) { this.toast(err.message, 'error'); } }
      });
    }

    // ---------- drag & drop ----------
    bindDrop() {
      const st = $('#stage');
      ['dragenter', 'dragover'].forEach(ev => st.addEventListener(ev, e => { e.preventDefault(); st.classList.add('dragover'); }));
      ['dragleave', 'drop'].forEach(ev => st.addEventListener(ev, e => { e.preventDefault(); if (ev === 'dragleave' && st.contains(e.relatedTarget)) return; st.classList.remove('dragover'); }));
      st.addEventListener('drop', e => { const files = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (files.length) this.importFiles(files); });
    }
    async importFiles(files) {
      for (const f of files) {
        try { const r = await this.app.importFile(f); if (r && r.className === 'Raster') { this.showTab('design'); this.open.image = true; this.renderDesign(true); this.toast('Image added. Next: remove the background, clean the edges, then Trace.', 'ok'); } }
        catch (e) { console.error(e); this.toast(`${f.name}: ${e.message}`, 'error'); }
      }
    }

    // ---------- autosave ----------
    async restoreAutosave(manual) {
      const saved = await CI.store.get('autosave');
      if (!saved) { if (manual) this.toast('No autosave found.', 'warn'); return false; }
      await this.app.openProject(saved); this.toast('Restored your last session.', 'ok'); return true;
    }

    // ---------- toasts & modals ----------
    toast(msg, kind = 'info') {
      const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; $('#toasts').appendChild(el);
      setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3200);
    }
    modal(html) {
      const m = $('#modal'); $('#modal-card').innerHTML = html + '<div class="acts"><button class="btn go" data-close>Close</button></div>'; m.hidden = false;
      const close = () => { m.hidden = true; }; m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) close(); };
    }
    modalShortcuts() {
      const rows = [['Select / Direct select', 'V / A'], ['Pen, Rectangle, Ellipse, Polygon, Star, Line', 'P, M, L, Y, S, \\'], ['Text', 'T'], ['Magic eraser (remove a color from an image)', 'W'], ['Hand / Zoom', 'H or Space / Z'], ['Undo / Redo', 'Ctrl+Z / Ctrl+Shift+Z'], ['Copy / Paste / Duplicate', 'Ctrl+C / Ctrl+V / Ctrl+D'], ['Group / Ungroup', 'Ctrl+G / Ctrl+Shift+G'], ['Nudge 1/32" (Shift = 1/4")', 'Arrow keys'], ['Duplicate while dragging', 'Alt + drag'], ['Constrain / proportional', 'Shift'], ['Scale from center', 'Alt + drag handle'], ['Disable smart guides while dragging', 'Ctrl + drag'], ['Zoom at cursor', 'Ctrl + wheel'], ['Fit mat / Actual size / Fit selection', 'Ctrl+0 / Ctrl+1 / Ctrl+2'], ['Cut preview', 'Ctrl+Y'], ['Convert text to outlines', 'Ctrl+Shift+O'], ['Save / Open / Import / Export', 'Ctrl+S / O / I / E']];
      this.modal('<h2>Keyboard shortcuts</h2><table>' + rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('') + '</table>');
    }
    modalDS() {
      this.modal(`<h2>Sending to Design Space (free)</h2><ol class="steps"><li>Fix anything in <b>Cut check</b> until it says <b>Ready to cut</b>.</li><li><b>Export → Download SVG for Design Space</b>. Each color becomes one welded layer, sized in real inches.</li><li>In Design Space: <b>New project → Upload → Upload image → Browse</b>, pick the SVG, then <b>Upload</b>.</li><li>Select it, <b>Add to canvas</b>. Check the size matches what Kerf showed.</li><li><b>Make it</b>. For iron-on: either export mirrored here or toggle mirror there — not both.</li></ol><p class="help">Uploading your own files is free; Cricut Access is only needed for their image/font library.</p>`);
    }
    modalAbout() {
      this.modal(`<h2>Kerf — cut design studio</h2><p class="help">Runs entirely on your computer; nothing is uploaded anywhere. Built only from free, open-source parts:</p><table>
        <tr><td>Paper.js — vector graphics & boolean ops</td><td>MIT</td></tr><tr><td>opentype.js — fonts to paths</td><td>MIT</td></tr><tr><td>paperjs-offset — stroke outlining</td><td>MIT</td></tr>
        <tr><td>Bundled fonts (Bungee, Alfa Slab One, DM Serif Display, Fredoka, Big Shoulders Stencil, Damion, Kaushan Script, Yellowtail, Leckerli One, Atkinson Hyperlegible) via Fontsource</td><td>SIL OFL 1.1</td></tr>
        <tr><td>Tracer, background removal, edge cleanup, cut checker</td><td>Kerf (this project)</td></tr></table><p class="help">License texts are in the <b>vendor/licenses</b> and <b>fonts</b> folders.</p>`);
    }
  }
  function confirmish(msg) { try { return window.confirm(msg); } catch (e) { return true; } }
  CI.UI = UI; CI.ICONS = I;
})(window.CI);
