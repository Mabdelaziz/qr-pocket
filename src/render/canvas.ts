import type { QrMatrix } from '../qr/encode';
import { computeLayout, QUIET_ZONE, type QrLayout } from './layout';

/**
 * Draw `matrix` black-on-white with a 4-module quiet zone at an integer module scale.
 * `cssPx` is the available width in CSS pixels; the bitmap is sized in device pixels so edges are sharp.
 * Sets data-modules / data-scale on the canvas for tests and debugging (no user data).
 */
export function drawQr(canvas: HTMLCanvasElement, matrix: QrMatrix, cssPx: number, dpr: number): QrLayout {
  const ratio = dpr > 0 ? dpr : 1;
  const layout = computeLayout(matrix.size, Math.floor(cssPx * ratio));
  canvas.width = layout.pixels;
  canvas.height = layout.pixels;
  canvas.style.width = `${layout.pixels / ratio}px`;
  canvas.style.height = `${layout.pixels / ratio}px`;

  const ctx = canvas.getContext('2d', { willReadFrequently: true }); // static, read back by tests/export paths: keep it in CPU memory
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.pixels, layout.pixels);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.get(x, y)) {
        ctx.fillRect((x + QUIET_ZONE) * layout.scale, (y + QUIET_ZONE) * layout.scale, layout.scale, layout.scale);
      }
    }
  }
  canvas.dataset['modules'] = String(matrix.size);
  canvas.dataset['scale'] = String(layout.scale);
  return layout;
}
