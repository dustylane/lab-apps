/* Cricut Illustrator — shared utilities. Plain script (no modules) so the app runs from file:// */
window.CI = window.CI || {};
(function (CI) {
  'use strict';

  // Internal document unit: 96 units per inch (paper.js points at 96 dpi).
  const UPI = 96;

  const util = {
    UPI,
    inToU: (inch) => inch * UPI,
    uToIn: (u) => u / UPI,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    round: (v, d = 3) => { const m = Math.pow(10, d); return Math.round(v * m) / m; },
    uid: (() => { let n = 0; return (p = 'id') => p + '_' + Date.now().toString(36) + '_' + (n++).toString(36); })(),

    /** Format a length in document units as inches, e.g. 1.25" */
    fmtIn(u, d = 3) { return util.round(u / UPI, d) + '"'; },

    /** Parse "#rgb", "#rrggbb", "rgb(r,g,b)" → {r,g,b} */
    parseColor(c) {
      if (!c) return { r: 0, g: 0, b: 0 };
      if (typeof c === 'object') return c;
      c = String(c).trim();
      if (c[0] === '#') {
        let h = c.slice(1);
        if (h.length === 3) h = h.split('').map(x => x + x).join('');
        const n = parseInt(h.slice(0, 6), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }
      const m = c.match(/rgba?\(([^)]+)\)/i);
      if (m) {
        const p = m[1].split(',').map(s => parseFloat(s));
        // paper.js uses 0..1 floats in some outputs; detect
        const scale = (p[0] <= 1 && p[1] <= 1 && p[2] <= 1 && /\./.test(m[1])) ? 255 : 1;
        return { r: Math.round(p[0] * scale), g: Math.round(p[1] * scale), b: Math.round(p[2] * scale) };
      }
      return { r: 0, g: 0, b: 0 };
    },
    toHex({ r, g, b }) {
      const h = (v) => util.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
      return '#' + h(r) + h(g) + h(b);
    },
    /** paper.Color or css string → '#rrggbb' (null when none) */
    colorHex(col) {
      if (!col) return null;
      if (typeof col === 'string') return util.toHex(util.parseColor(col));
      if (col.toCSS) return util.toHex(util.parseColor(col.toCSS(true)));
      return null;
    },
    colorDist2(a, b) {
      // Weighted RGB ("redmean") — cheap, perceptually better than plain RGB.
      const rm = (a.r + b.r) / 2, dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
      return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
    },
    debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; },

    download(filename, data, mime = 'application/octet-stream') {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    readFileAs(file, how = 'dataURL') {
      return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result); r.onerror = () => rej(r.error);
        if (how === 'text') r.readAsText(file);
        else if (how === 'buffer') r.readAsArrayBuffer(file);
        else r.readAsDataURL(file);
      });
    },
    loadImage(src) {
      return new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = () => rej(new Error('Could not load image'));
        im.src = src;
      });
    },
    imageToImageData(img, maxPx = 0) {
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (maxPx && w * h > maxPx) { const s = Math.sqrt(maxPx / (w * h)); w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s)); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      return ctx.getImageData(0, 0, w, h);
    },
    imageDataToDataURL(id) {
      const c = document.createElement('canvas'); c.width = id.width; c.height = id.height;
      c.getContext('2d').putImageData(id, 0, 0);
      return c.toDataURL('image/png');
    },
    base64ToArrayBuffer(b64) {
      const bin = atob(b64); const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return buf.buffer;
    },
    escapeXml(s) { return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); },
  };

  CI.util = util;
})(window.CI);
