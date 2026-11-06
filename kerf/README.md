# Kerf — cut design studio for Cricut

A small, free, offline "Illustrator for cutting machines". Make text and shapes, or turn AI art into clean cut files. It warns you before a design will cut badly, then exports an SVG you upload to Design Space for free (no Cricut Access needed).

## Start
Double-click **index.html**. It opens in your browser and runs entirely on your computer, with no install and no internet. Chrome or Edge is recommended (they can also use your installed fonts).

**On a phone or tablet:** the tools sit along the bottom and the panels slide up as a sheet. Held sideways, the tools move to the left and panels slide in from the right. On a computer, the **▸** button folds the side panel into a thin strip (click a tab to bring it back). Tap *Design / Layers / Cut check / Export* to open one; tap it again, press ▾, or swipe the tabs down to close it (swipe up for a taller sheet). Pinch to zoom and drag with two fingers to pan. Double-tap text to edit it. With something selected, a bar offers Duplicate, Delete and Edit. The ☰ button holds the menus. The pen tool has a **Done** button, and direct selection has **Smooth ↔ corner** and **Delete point** buttons, so nothing needs a keyboard. The ☰ menu shows the version number, so you can check that your phone has the latest copy.

Your work autosaves. If you close the tab, Kerf offers to restore your last session next time.

## The usual workflows

**Text design**
1. Press **T** and click the mat. Type in the **Text** panel on the right.
2. Pick a font, size, spacing and curve. Keep **Weld letters** on for script fonts so connected letters cut as one piece.
3. Use **Align** to line things up (one object aligns to the mat).

**AI image → cut file**
1. Drag the image onto the mat.
2. **1 · Remove the background**: *Auto-remove* handles plain backgrounds. For anything left, use the **Magic eraser (W)**: click a color to remove it, or Shift-click to remove that color everywhere.
3. **2 · Clean the edges**: makes edges pixel-perfect (no soft pixels), removes specks, fills pinholes and smooths stair-steps.
3. **3 · Image Trace** (like Illustrator's): pick a preset (*B&W logo, Silhouette, Line art, 3 colors, 6 colors, High fidelity, Shades of gray, Layered vinyl*), or set the Mode (Color / Grayscale / Black & white / Silhouette) and the **Paths**, **Corners** and **Noise** sliders yourself. *Method* is **Abutting** (colors sit side by side) or **Stacked** (lower colors run under upper ones, for layered vinyl). *View* switches between Result, Outlines and Source. Pink lines in the preview show exactly where the blade will go.
4. Traces stay **live**: select the result later, even after moving or resizing it, change the settings and press **Re-trace**. The **Colors** list merges look-alike colors (fewer mats), recolors or deletes a layer. **Expand** finalizes the paths and deletes the hidden source image.

**Vintage / distressed look (great for shirts)**
Select text or shapes, open **Vintage distress** in the Design panel and pick a preset: *Subtle rough edges*, *Light wear*, *Worn print*, *Cracked ink*, *Heavy grunge* or *Worn edges*. **Edge texture** is a fine, natural wobble along the vector outline: no holes, no chunks, and every letter and counter is kept. *Grain size* sets how fine it is. Distress stays **live**: with the result selected, **New pattern** re-scrambles it instantly from your original artwork (never on top of the last one), **Update distress** applies slider changes, and **Remove distress** brings the original back.
Distress only removes ink, and it follows your material's rules: every speck is wide and big enough to weed, no slivers thinner than the minimum line are left, and crumbs are removed. Distress after choosing your material, since foam gets chunkier wear than vinyl.

**Shirts and weeding**
- **Garment placement** (Design panel): pick *Adult front, Adult back, Left chest, Sleeve, Youth, Toddler, Onesie, Hat* or *Tote*. **Size to fit** sets the right width, and **Preview on garment** (Ctrl+M) shows it at true scale on a shirt in your garment color.
- **Weed box** (Export panel): adds a box around each color plus weeding lines (vertical, horizontal or both) that split the waste vinyl but stop short of your design. The box follows the design automatically when you move or resize it, and it exports as extra cut lines on the same mat.
- **Expand for weeding** (Pathfinder): **Expand thin lines** grows only the parts thinner than the width you set (your material's minimum by default). **Make bolder** pushes every edge out a little. In Cut check, the **Expand thin parts** button does the same for a flagged color.
- **My vinyl** (Edit menu): list the colors you own. Image Trace can snap to them (*Use my vinyl colors*), **Snap colors to my vinyl** recolors a design, and Export labels each mat with the roll name.

**Layered designs and saving material** (Export tab)
- **Registration marks**: crosses, dots or squares (left and right, or 4 corners) are cut in every color at exactly the same spots. On layered HTV, line the marks up through the clear carriers, press, then peel them off. They follow the design when you move or resize it.
- **Material use** shows how much of each color you'll use. **Pack pieces to save material** rearranges separate objects tightly for export only (your canvas stays as is, and each object stays in one piece). Set the gap, allow rotating, and use **Preview mats** to see each color's mat. Packing switches off while you use weed boxes or registration marks, because those need the layout kept exactly as drawn.

**Cutting tricks**
- **Knife (K)**: drag a line across shapes to cut them apart (Shift = 45°; set the gap in the tool bar). Or put a line or shape on top and press **Pathfinder → Slice**.
- **Stencil bridges** (Pathfinder): for paper or vinyl spray-paint stencils. By default each middle (O, A, R, B…) gets **one gap** through its thinnest wall, or a side you pick, so the middle stays attached to the sheet **and every letter stays one piece**. *Stencil-font look* instead cuts a bar straight across each middle, like classic stencil lettering.
- **Text effects** (Design panel): an **outline or shadow layer** behind the text in a second color, a **knockout** badge with the text cut out (circle, oval, rounded or rectangle), and a **split monogram** that cuts a big letter around a name.
- **Make copies** (Align & arrange): lay out any number of copies on the mat, or **Fill the mat** with as many as fit.
- **Start wizard** (File → New, or View → Start wizard): pick what you're making (T-shirt, decal, layered, stencil, card, foam) and Kerf sets the material, mirror, mat and garment for you.

**Before cutting**
- Pick your **Material** at the top. It sets the rules: thinnest line, smallest piece, smallest weedable hole, and how close two cut lines can be.
- The status pill turns green (**Ready to cut**) when everything passes. Otherwise open **Cut check**: **Show** zooms to the problem and **Fix** repairs it (Smooth, Weld, Thicken, Remove tiny pieces, Fill holes, Mirror, Fit to mat).
- **View → Cut preview (Ctrl+Y)** shows only the lines that will actually be cut.

**Send to Design Space**
**Export → Download SVG for Design Space**, then in Design Space: *New project → Upload → Upload image*. Each color arrives as one welded layer at its real size. Iron-on is mirrored automatically when you choose the HTV material.

## Illustrator-style tools
Selection (V), Direct selection / point editing (A), Pen (P), Rectangle (M), Ellipse (L), Polygon (Y), Star (S), Line (\\), Text (T), Hand (H / Space), Zoom (Z).
Pathfinder: Weld, Minus front, Intersect, Exclude, Divide, Compound/Release, Offset/contour (sticker borders), Outline stroke, Smooth paths.
Smart guides, align and distribute, groups, layers (hide/lock/reorder), undo/redo, copy/paste, Alt-drag to duplicate. Help → Keyboard shortcuts lists everything.

Files: open and save **.kerf** projects (images included). Import PNG/JPG/WebP/SVG (sizes in mm/in/px are honored), and .ttf/.otf/.woff fonts. Export SVG (all colors, or one file per color) or PNG at 300 dpi.

## Self-test
Double-click **Self-Test.html** (or `tests/tests.html`). The app opens with a results panel and runs about 157 checks in roughly 90 seconds:
- the cut-check rules,
- tracing accuracy,
- background removal,
- booleans, fonts and export/import,
- real mouse/keyboard use of every tool and every button,
- touch: pinch zoom, two-finger pan, double-tap, finger-sized handles and the phone layout,
- a 400-step random "fuzz" session followed by a full undo.

Everything should be green. To run a subset, add `&grep=word` to the address, e.g. `index.html?selftest=1&grep=trace`.
Developers with Node can also run `node tests/run-headless.js` (needs `npm i playwright`). Add `MOBILE=1` (iPhone), `MOBILE=landscape` or `MOBILE=ipad` in front to run everything on a touch device.

## What's inside (all free & open source)
| Part | License |
|---|---|
| Paper.js (vector engine, booleans) | MIT |
| opentype.js (fonts → paths) | MIT |
| paperjs-offset (stroke outlines) | MIT |
| Bundled fonts: Bungee, Alfa Slab One, DM Serif Display, Fredoka, Big Shoulders Stencil, Damion, Kaushan Script, Yellowtail, Leckerli One, Atkinson Hyperlegible | SIL OFL 1.1 |
| Tracer, background removal, edge cleanup, cut checker, editor | Kerf (this project) |

Folder map: `index.html` (app) · `js/core` (engines, no UI) · `js/app` (editor UI) · `css` · `vendor` (libraries and licenses) · `fonts` · `tests`.
