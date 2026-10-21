# App icon reference snapshot

These files are a **reference copy** of what `npm run icons` generates at build time (`scripts/icons.mjs`, one description of the logo rendered to SVG and PNG with no image library). They were downloaded from the CI artifact of [run 39673943074](https://github.com/Mabdelaziz/qr-pocket/actions/runs/39673943074) (commit `74eedb6`). They are NOT used by the build: the build regenerates them, and the unit tests check geometry, safe zone and PNG validity.

| File | Use |
|---|---|
| `icon.svg` | master (purpose "any"), also the browser tab icon |
| `icon-maskable.svg` | master for the maskable variant (full-bleed, artwork inside the central 40%-radius safe zone) |
| `icon-192.png`, `icon-512.png` | manifest icons, purpose "any" (rounded square, transparent corners) |
| `icon-maskable-512.png` | manifest icon, purpose "maskable" |

Colours: `#155EEF` background, white mark.
