import type { QrMatrix } from '../qr/encode';
import { QUIET_ZONE } from './layout';

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Black modules on a white surface with a quiet zone, as raw RGBA. Pure (no canvas), so tests can
 * hand exactly what the canvas draws to independent decoders (SPEC-001 AC2/AC3/AC6).
 */
export function matrixToRgba(matrix: QrMatrix, scale: number, quiet: number = QUIET_ZONE): RgbaImage {
  const side = (matrix.size + 2 * quiet) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let my = 0; my < matrix.size; my++) {
    for (let mx = 0; mx < matrix.size; mx++) {
      if (!matrix.get(mx, my)) continue;
      const x0 = (mx + quiet) * scale;
      const y0 = (my + quiet) * scale;
      for (let dy = 0; dy < scale; dy++) {
        let i = ((y0 + dy) * side + x0) * 4;
        for (let dx = 0; dx < scale; dx++) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0; // alpha stays 255
          i += 4;
        }
      }
    }
  }
  return { width: side, height: side, data };
}
