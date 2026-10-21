// A minimal, independent PNG reader for tests: it reads the real bytes the browser produced, so the export
// (SPEC-003) is verified from the file itself, not from our own renderer. Supports 8-bit, non-interlaced
// grayscale / RGB / palette / gray+alpha / RGBA, which covers what browsers emit.
import { inflateSync } from 'node:zlib';

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly colorType: number;
  readonly bitDepth: number;
  /** RGBA, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function hasPngSignature(buf: Buffer): boolean {
  return SIGNATURE.every((byte, i) => buf[i] === byte);
}

export function decodePng(buf: Buffer): DecodedPng {
  if (!hasPngSignature(buf)) throw new Error('not a PNG (bad signature)');
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const chunk = buf.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8] ?? 0;
      colorType = chunk[9] ?? 0;
      interlace = chunk[12] ?? 0;
    } else if (type === 'PLTE') palette = Buffer.from(chunk);
    else if (type === 'IDAT') idat.push(Buffer.from(chunk));
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (bitDepth ${bitDepth}, interlace ${interlace})`);
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length !== (stride + 1) * height) throw new Error('PNG data length does not match its header');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x] ?? 0;
      const left = x >= channels ? (pixels[dst + x - channels] ?? 0) : 0;
      const up = y > 0 ? (pixels[dst - stride + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= channels ? (pixels[dst - stride + x - channels] ?? 0) : 0;
      let out: number;
      switch (filter) {
        case 0:
          out = value;
          break;
        case 1:
          out = value + left;
          break;
        case 2:
          out = value + up;
          break;
        case 3:
          out = value + Math.floor((left + up) / 2);
          break;
        case 4:
          out = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`bad PNG filter ${filter}`);
      }
      pixels[dst + x] = out & 0xff;
    }
  }

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const p = i * channels;
    if (colorType === 6) {
      data.set(pixels.subarray(p, p + 4), o);
    } else if (colorType === 2) {
      data[o] = pixels[p] ?? 0;
      data[o + 1] = pixels[p + 1] ?? 0;
      data[o + 2] = pixels[p + 2] ?? 0;
      data[o + 3] = 255;
    } else if (colorType === 0 || colorType === 4) {
      const v = pixels[p] ?? 0;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = colorType === 4 ? (pixels[p + 1] ?? 255) : 255;
    } else {
      const index = (pixels[p] ?? 0) * 3;
      data[o] = palette?.[index] ?? 0;
      data[o + 1] = palette?.[index + 1] ?? 0;
      data[o + 2] = palette?.[index + 2] ?? 0;
      data[o + 3] = 255;
    }
  }
  return { width, height, colorType, bitDepth, data };
}

export interface PixelReport {
  /** Pixels that are not pure black/white or not fully opaque. */
  readonly badPixels: number;
  readonly black: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** One pass over the pixels (assert on the totals, never per pixel: thousands of expect() calls stall the runner). */
export function analysePixels(png: DecodedPng): PixelReport {
  let bad = 0;
  let black = 0;
  let minX = png.width;
  let maxX = -1;
  let minY = png.height;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i] ?? -1;
      if ((r !== 0 && r !== 255) || png.data[i + 1] !== r || png.data[i + 2] !== r || png.data[i + 3] !== 255) bad++;
      if (r === 0) {
        black++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { badPixels: bad, black, minX, maxX, minY, maxY };
}

/**
 * Independent measurement of the symbol inside an exported PNG: the top row of a QR code starts with the
 * 7-module finder pattern followed by a light separator module, so the first black run is exactly 7 modules.
 */
export function measureSymbol(png: DecodedPng, report: PixelReport): { scale: number; modules: number } {
  let run = 0;
  for (let x = report.minX; x < png.width && png.data[(report.minY * png.width + x) * 4] === 0; x++) run++;
  const scale = run / 7;
  return { scale, modules: (report.maxX - report.minX + 1) / scale };
}
