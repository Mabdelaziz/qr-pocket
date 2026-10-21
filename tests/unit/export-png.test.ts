// SPEC-003 AC1/AC2/AC9: the exact pixels of the 1024x1024 export, decoded with two independent decoders.
import { describe, expect, it } from 'vitest';
import { computeExportLayout, EXPORT_SIZE, renderExportRgba } from '../../src/export/png';
import { encode, type Ecc, type QrMatrix } from '../../src/qr/encode';
import { QUIET_ZONE } from '../../src/render/layout';
import { CASES } from './helpers/cases';
import { decodeWithJsQr, decodeWithZxing } from './helpers/decoders';

const utf8 = new TextEncoder();

function matrixFor(text: string, ecc: Ecc = 'M'): QrMatrix {
  const result = encode(text, ecc);
  if (!result.ok) throw new Error(`encode failed: ${result.reason}`);
  return result.matrix;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  bad: number;
  black: number;
}

function scan(image: { width: number; height: number; data: Uint8ClampedArray }): Bounds {
  const b: Bounds = { minX: image.width, maxX: -1, minY: image.height, maxY: -1, bad: 0, black: 0 };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      const r = image.data[i] ?? -1;
      if ((r !== 0 && r !== 255) || image.data[i + 1] !== r || image.data[i + 2] !== r || image.data[i + 3] !== 255) b.bad++;
      if (r === 0) {
        b.black++;
        b.minX = Math.min(b.minX, x);
        b.maxX = Math.max(b.maxX, x);
        b.minY = Math.min(b.minY, y);
        b.maxY = Math.max(b.maxY, y);
      }
    }
  }
  return b;
}

describe('SPEC-003 AC2: export layout is an even integer scale with exactly symmetric padding', () => {
  it('holds for every QR version 1..40', () => {
    for (let version = 1; version <= 40; version++) {
      const modules = 17 + 4 * version;
      const layout = computeExportLayout(modules);
      const total = modules + 2 * QUIET_ZONE;
      expect(layout.size).toBe(EXPORT_SIZE);
      expect(layout.scale % 2).toBe(0);
      expect(layout.scale).toBeGreaterThanOrEqual(4);
      expect(layout.pixels).toBe(layout.scale * total);
      expect(layout.pixels).toBeLessThanOrEqual(EXPORT_SIZE);
      expect(Number.isInteger(layout.offset)).toBe(true);
      expect(2 * layout.offset + layout.pixels).toBe(EXPORT_SIZE); // left/right and top/bottom identical
    }
  });

  it('uses 4 px per module for the largest symbol and fills small symbols generously', () => {
    expect(computeExportLayout(177).scale).toBe(4);
    expect(computeExportLayout(21).scale).toBe(34);
  });
});

describe('SPEC-003 AC1/AC2: the rendered export', () => {
  const matrix = matrixFor('https://example.com/export-check');
  const image = renderExportRgba(matrix);
  const layout = computeExportLayout(matrix.size);

  it('is exactly 1024 x 1024 RGBA', () => {
    expect(image.width).toBe(1024);
    expect(image.height).toBe(1024);
    expect(image.data.length).toBe(1024 * 1024 * 4);
  });

  it('contains only pure black and white, fully opaque (no anti-aliasing)', () => {
    expect(scan(image).bad).toBe(0);
  });

  it('keeps symmetric white margins of at least four modules on every side', () => {
    const b = scan(image);
    const left = b.minX;
    const right = image.width - 1 - b.maxX;
    const top = b.minY;
    const bottom = image.height - 1 - b.maxY;
    expect(left).toBe(right);
    expect(top).toBe(bottom);
    expect(left).toBe(top);
    expect(left).toBeGreaterThanOrEqual(QUIET_ZONE * layout.scale);
    expect(left).toBe(layout.offset + QUIET_ZONE * layout.scale);
  });

  it('paints every dark module as a whole scale x scale block', () => {
    let dark = 0;
    for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) if (matrix.get(x, y)) dark++;
    expect(scan(image).black).toBe(dark * layout.scale * layout.scale);
  });

  it('is deterministic', () => {
    expect(renderExportRgba(matrix).data).toEqual(image.data);
  });
});

describe('SPEC-003 AC1: independent decoders read the exported pixels byte-exact', () => {
  it.each(CASES.map((c) => [c.name, c.text] as const))('jsQR: %s', (_name, text) => {
    expect(Array.from(decodeWithJsQr(renderExportRgba(matrixFor(text))) ?? [])).toEqual(Array.from(utf8.encode(text)));
  });

  it.each(CASES.map((c) => [c.name, c.text] as const))('ZXing: %s', async (_name, text) => {
    const decoded = await decodeWithZxing(renderExportRgba(matrixFor(text)));
    expect(decoded?.text).toBe(text);
  });
});

describe('SPEC-003 AC9: large payloads export and decode', () => {
  it('2,953 bytes at Low (version 40, 4 px/module) decodes with both decoders', async () => {
    const text = 'y'.repeat(2953);
    const image = renderExportRgba(matrixFor(text, 'L'));
    expect(scan(image).bad).toBe(0);
    expect(Array.from(decodeWithJsQr(image) ?? [])).toEqual(Array.from(utf8.encode(text)));
    expect((await decodeWithZxing(image))?.text).toBe(text);
  });

  it('2,331 bytes at Medium decodes with both decoders', async () => {
    const text = 'z'.repeat(2331);
    const image = renderExportRgba(matrixFor(text, 'M'));
    expect(Array.from(decodeWithJsQr(image) ?? [])).toEqual(Array.from(utf8.encode(text)));
    expect((await decodeWithZxing(image))?.text).toBe(text);
  });

  it('a dense mixed Arabic/emoji payload (QR version 23 at Low) decodes with ZXing; jsQR cannot read that version', async () => {
    // Cut by code points, never inside a surrogate pair.
    const text = Array.from('مرحبا \u{1F600} hello, '.repeat(120)).slice(0, 700).join('');
    const matrix = matrixFor(text, 'L');
    expect(matrix.version).toBe(23);
    // CI diagnostic (run 39640374525): jsQR returns nothing for this symbol at every scale, even for plain ASCII of the
    // same byte length, while ZXing reads it exactly. A version-specific limit of the 2021 jsQR reader, not an encoder bug.
    expect((await decodeWithZxing(renderExportRgba(matrix)))?.text).toBe(text);
  });
});

// Byte-mode capacity per QR version at error-correction level L (ISO/IEC 18004). Filling each version to capacity
// checks both our capacity assumptions and the encoder's output for EVERY symbol size.
const BYTE_CAPACITY_L = [
  17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732,
  1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953,
];

/** Deterministic printable-ASCII noise (no repetition a decoder could exploit). */
function noise(length: number, seed: number): string {
  let x = seed;
  let out = '';
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out += String.fromCharCode(33 + (x % 94));
  }
  return out;
}

describe('SPEC-003 AC1/AC9: every QR version 1..40, filled to capacity at Low, decodes from the exported pixels', () => {
  it('ZXing reads all 40 versions exactly (jsQR results are recorded, not hidden)', async () => {
    const jsQrUnreadable: number[] = [];
    for (let version = 1; version <= 40; version++) {
      const capacity = BYTE_CAPACITY_L[version - 1] as number;
      const text = noise(capacity, version);
      const matrix = matrixFor(text, 'L');
      expect(matrix.version, `capacity table entry for version ${version}`).toBe(version);
      const image = renderExportRgba(matrix);
      const zx = await decodeWithZxing(image);
      expect(zx?.text, `ZXing, version ${version}`).toBe(text);
      const js = decodeWithJsQr(image);
      if (!js || Array.from(js).join(',') !== Array.from(utf8.encode(text)).join(',')) jsQrUnreadable.push(version);
    }
    // jsQR (last released 2021) is a weaker reference decoder and fails on some symbol sizes; ZXing is the authority.
    console.info('jsQR could not read QR versions:', JSON.stringify(jsQrUnreadable));
    expect(jsQrUnreadable.length).toBeLessThan(10); // it must still read the large majority, or the fixture itself is suspect
  }, 120_000);
});
