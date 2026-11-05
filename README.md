# Lab apps

Small web apps that appear on [dustygridley.com](https://dustygridley.com) under `/apps/`.

## Adding an app

1. Make a folder named the way you want the address to read: lowercase, words joined with hyphens.
2. Put the app's `index.html` in that folder, plus any files it uses (CSS, JS, images).
3. Commit. A minute or two later it's live:

| In this repo | On the site |
| --- | --- |
| `color-tool/index.html` | `dustygridley.com/apps/color-tool` |
| `color-tool/style.css` | `dustygridley.com/apps/color-tool/style.css` |

Link files with **relative** paths (`style.css`, `img/logo.png`), not ones starting with `/`.

Then, in the Lab post about it, open **Web app** in the site editor and set the link to `/apps/color-tool`.

`.nojekyll` tells GitHub Pages to publish files exactly as they are. Leave it in place.
