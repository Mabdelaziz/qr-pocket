// QR Pocket app icons: ONE description of the logo, rendered to SVG and PNG with no image library.
// Run by `npm run icons` (part of `npm run build`) on the CI runner; deterministic output into public/icons/.
// - "any" icons: rounded blue square with transparent corners.
// - "maskable" icon: full-bleed blue with the artwork shrunk into the safe zone (central circle, radius 40%).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

export const BLUE = [21, 94, 239]; // #155EEF
export const WHITE = [255, 255, 255];
export const VIEWBOX = 32;
export const CORNER_RADIUS = 8;
/** [x, y, width, height] in the 32-unit logo space (same artwork as the in-app header logo). */
export const WHITE_RECTS = [
  [6, 6, 7, 7],
  [19, 6, 7, 7],
  [6, 19, 7, 7],
  [19, 19, 3, 3],
  [23, 23, 3, 3],
  [23, 19, 3, 2],
];
export const BLUE_RECTS = [
  [8, 8, 3, 3],
  [21, 8, 3, 3],
  [8, 21, 3, 3],
];
/** The artwork spans units 6..26. */
export const ARTWORK_EXTENT = 20;
/** In the maskable icon the artwork is this fraction of the icon width (its diagonal then stays inside the 40% safe radius). */
export const MASKABLE_ARTWORK_FRACTION = 0.54;
export const SAFE_ZONE_RADIUS_FRACTION = 0.4;
const SUPERSAMPLE = 4;

function inRect(u, v, [x, y, w, h]) {
  return u >= x && u < x + w && v >= y && v < y + h;
}

function inRoundedSquare(u, v) {
  if (u < 0 || v < 0 || u >= VIEWBOX || v >= VIEWBOX) return false;
  const cx = Math.min(Math.max(u, CORNER_RADIUS), VIEWBOX - CORNER_RADIUS);
  const cy = Math.min(Math.max(v, CORNER_RADIUS), VIEWBOX - CORNER_RADIUS);
  return (u - cx) ** 2 + (v - cy) ** 2 <= CORNER_RADIUS ** 2;
}

/** Colour of the logo at (u, v) in logo units, or null where the icon is transparent. */
function colourAt(kind, u, v) {
  if (BLUE_RECTS.some((r) => inRect(u, v, r))) return BLUE;
  if (WHITE_RECTS.some((r) => inRect(u, v, r))) return WHITE;
  if (kind === 'maskable' || inRoundedSquare(u, v)) return BLUE;
  return null;
}

/** RGBA pixels (non-premultiplied, 4x4 supersampled anti-aliasing). kind: 'any' | 'maskable'. */
export function renderIcon(kind, size) {
  const data = new Uint8Array(size * size * 4);
  const unit = kind === 'maskable' ? (MASKABLE_ARTWORK_FRACTION * size) / ARTWORK_EXTENT : size / VIEWBOX;
  const total = SUPERSAMPLE * SUPERSAMPLE;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = px + (sx + 0.5) / SUPERSAMPLE;
          const y = py + (sy + 0.5) / SUPERSAMPLE;
          const colour =
            kind === 'maskable' ? colourAt(kind, VIEWBOX / 2 + (x - size / 2) / unit, VIEWBOX / 2 + (y - size / 2) / unit) : colourAt(kind, x / unit, y / unit);
          if (colour) {
            r += colour[0];
            g += colour[1];
            b += colour[2];
            covered++;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (covered > 0) {
        data[i] = Math.round(r / covered);
        data[i + 1] = Math.round(g / covered);
        data[i + 2] = Math.round(b / covered);
        data[i + 3] = Math.round((255 * covered) / total);
      }
    }
  }
  return { width: size, height: size, data };
}

function chunk(type, payload) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), payload]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(payload.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Minimal PNG writer: 8-bit RGBA, no interlace, zlib level 9. */
export function encodePng({ width, height, data }) {
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const from = y * width * 4;
    rows[y * (width * 4 + 1)] = 0; // filter: none
    Buffer.from(data.buffer, data.byteOffset + from, width * 4).copy(rows, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = ([r, g, b]) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const rectTag = ([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

/** Master SVG. kind: 'any' | 'maskable'. */
export function iconSvg(kind) {
  const scale = (MASKABLE_ARTWORK_FRACTION * VIEWBOX) / ARTWORK_EXTENT;
  const art =
    `<g fill="${hex(WHITE)}">${WHITE_RECTS.map(rectTag).join('')}</g>` + `<g fill="${hex(BLUE)}">${BLUE_RECTS.map(rectTag).join('')}</g>`;
  const background =
    kind === 'maskable'
      ? `<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${hex(BLUE)}"/>`
      : `<rect width="${VIEWBOX}" height="${VIEWBOX}" rx="${CORNER_RADIUS}" fill="${hex(BLUE)}"/>`;
  const body = kind === 'maskable' ? `<g transform="translate(16 16) scale(${scale}) translate(-16 -16)">${art}</g>` : art;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" width="512" height="512" role="img" aria-label="QR Pocket">${background}${body}</svg>\n`;
}

/** Writes every icon the manifest and the page reference. Returns the file names written. */
export function writeIcons(dir) {
  mkdirSync(dir, { recursive: true });
  const files = {
    'icon.svg': iconSvg('any'),
    'icon-maskable.svg': iconSvg('maskable'),
    'icon-192.png': encodePng(renderIcon('any', 192)),
    'icon-512.png': encodePng(renderIcon('any', 512)),
    'icon-maskable-512.png': encodePng(renderIcon('maskable', 512)),
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return Object.keys(files);
}
