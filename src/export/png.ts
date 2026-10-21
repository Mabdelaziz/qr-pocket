import type { QrMatrix } from '../qr/encode';
import { QUIET_ZONE } from '../render/layout';
import { matrixToRgba, type RgbaImage } from '../render/pixels';

export const EXPORT_SIZE = 1024;

export interface ExportLayout {
  /** Output side in pixels. */
  readonly size: number;
  /** Whole pixels per module; always even so the padding is exactly symmetric. */
  readonly scale: number;
  /** White margin between the image edge and the symbol's quiet zone, on every side. */
  readonly offset: number;
  /** Side of the symbol including its quiet zone, in pixels. */
  readonly pixels: number;
}

/**
 * Largest EVEN integer module scale that fits. `modules + 8` is always odd, so an even scale gives an even
 * symbol side and, with an even output size, identical white padding on all four sides.
 */
export function computeExportLayout(modules: number, size: number = EXPORT_SIZE): ExportLayout {
  const total = modules + 2 * QUIET_ZONE;
  let scale = Math.floor(size / total);
  if (scale % 2 !== 0) scale -= 1;
  scale = Math.max(scale, 2);
  const pixels = scale * total;
  return { size, scale, offset: Math.max(0, Math.floor((size - pixels) / 2)), pixels };
}

/** The exact pixels of the exported PNG: black modules on white, fully opaque, symbol centred. Pure (no canvas). */
export function renderExportRgba(matrix: QrMatrix, size: number = EXPORT_SIZE): RgbaImage {
  const layout = computeExportLayout(matrix.size, size);
  const symbol = matrixToRgba(matrix, layout.scale);
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  const rowBytes = symbol.width * 4;
  for (let y = 0; y < symbol.height; y++) {
    const from = y * rowBytes;
    data.set(symbol.data.subarray(from, from + rowBytes), ((layout.offset + y) * size + layout.offset) * 4);
  }
  return { width: size, height: size, data };
}

/** Encodes the export pixels as a PNG using the browser's canvas encoder. */
export function renderPngBlob(matrix: QrMatrix, size: number = EXPORT_SIZE): Promise<Blob> {
  const image = renderExportRgba(matrix, size);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas 2D is not available'));
  // Copy into a plain ArrayBuffer-backed array: ImageData requires one.
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), size, size), 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0; // release the bitmap promptly
      canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}
