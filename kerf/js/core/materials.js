/* Material presets and machine limits. All lengths in inches, areas in square inches. Editable in the UI. */
window.CI = window.CI || {};
(function (CI) {
  'use strict';

  CI.MACHINES = {
    'maker4': { name: 'Cricut Maker 4 / Maker 3 / Explore', mats: { '12x12': { w: 11.5, h: 11.5 }, '12x24': { w: 11.5, h: 23.5 } } },
    'joy': { name: 'Cricut Joy / Joy Xtra', mats: { '4.5x6.5': { w: 4.25, h: 6.25 }, '4.5x12': { w: 4.25, h: 11.75 }, '8.5x12 (Xtra)': { w: 8.25, h: 11.75 } } },
  };

  // minFeature: narrowest line/stroke the blade + weeding survives
  // minGap: closest two separate cut lines may be before material tears between them
  // minPiece: smallest standalone piece (area) worth keeping — smaller ones get lost/stick to the mat
  // minHole: smallest negative space (e.g. inside an "e") that can realistically be weeded
  // maxNodesPerSqIn: complexity threshold — jagged traced edges cause slow "step cutting"
  CI.MATERIALS = {
    vinyl:     { name: 'Adhesive vinyl',          minFeature: 1 / 16, minGap: 1 / 32, minPiece: 0.008, minHole: 0.004, mirror: false, maxNodesPerSqIn: 60, note: 'Weed with a hook; tiny counters can stay in if you plan to.' },
    htv:       { name: 'Iron-on (HTV)',           minFeature: 1 / 16, minGap: 1 / 32, minPiece: 0.01,  minHole: 0.006, mirror: true,  maxNodesPerSqIn: 60, note: 'Mirror before cutting — shiny carrier side down.' },
    cardstock: { name: 'Cardstock (65–110 lb)',   minFeature: 1 / 32, minGap: 1 / 32, minPiece: 0.004, minHole: 0.003, mirror: false, maxNodesPerSqIn: 80, note: 'Fine detail is OK; very tight inside corners can tear.' },
    paper:     { name: 'Copy / printer paper',    minFeature: 1 / 32, minGap: 1 / 40, minPiece: 0.003, minHole: 0.002, mirror: false, maxNodesPerSqIn: 80, note: 'Use a light-grip mat.' },
    foam2mm:   { name: 'EVA craft foam 2 mm',     minFeature: 1 / 8,  minGap: 1 / 16, minPiece: 0.05,  minHole: 0.03,  mirror: false, maxNodesPerSqIn: 25, note: 'Thick material: keep shapes chunky; blade drags on tiny details.' },
    felt:      { name: 'Felt',                    minFeature: 1 / 8,  minGap: 1 / 16, minPiece: 0.05,  minHole: 0.03,  mirror: false, maxNodesPerSqIn: 30, note: 'Use the rotary blade (Maker) — thin parts fray.' },
    leather:   { name: 'Faux leather',            minFeature: 3 / 32, minGap: 1 / 16, minPiece: 0.03,  minHole: 0.02,  mirror: false, maxNodesPerSqIn: 30, note: 'Strong-grip mat; multiple passes.' },
    chipboard: { name: 'Chipboard / basswood (Knife Blade)', minFeature: 3 / 16, minGap: 1 / 8, minPiece: 0.15, minHole: 0.1, mirror: false, maxNodesPerSqIn: 12, note: 'Knife Blade: very slow on detail; avoid small inside corners.' },
  };

  // Garment placement presets (inches). x = offset of the design's center from the garment's center line
  // (+ = viewer's right, i.e. the wearer's left chest); top = distance from the bottom of the collar to the design top.
  CI.PLACEMENTS = {
    adult_front: { name: 'Adult tee — front',        garment: 'adult',   w: 10,   maxW: 11.5, maxH: 14,  x: 0,    top: 3 },
    adult_back:  { name: 'Adult tee — back',         garment: 'adult',   w: 11,   maxW: 12,   maxH: 15,  x: 0,    top: 4 },
    left_chest:  { name: 'Left chest / pocket',      garment: 'adult',   w: 3.5,  maxW: 4,    maxH: 4,   x: 4,    top: 3.5 },
    sleeve:      { name: 'Sleeve',                   garment: 'adult',   w: 2.75, maxW: 3.25, maxH: 3.5, x: -11,  top: 3.2 },
    youth_front: { name: 'Youth tee — front',        garment: 'youth',   w: 8,    maxW: 9,    maxH: 11,  x: 0,    top: 2.5 },
    toddler:     { name: 'Toddler tee — front',      garment: 'toddler', w: 6,    maxW: 6.5,  maxH: 7,   x: 0,    top: 2 },
    onesie:      { name: 'Baby onesie — front',      garment: 'onesie',  w: 4,    maxW: 4.5,  maxH: 5,   x: 0,    top: 1.75 },
    hat:         { name: 'Hat — front panel',        garment: 'hat',     w: 4,    maxW: 4.5,  maxH: 2.25, x: 0,   top: 0.9 },
    tote:        { name: 'Tote bag',                 garment: 'tote',    w: 10,   maxW: 12,   maxH: 12,  x: 0,    top: 3 },
  };

  CI.getMaterial = function (key, overrides) {
    const base = CI.MATERIALS[key] || CI.MATERIALS.vinyl;
    return Object.assign({ key }, base, overrides || {});
  };
})(window.CI);
