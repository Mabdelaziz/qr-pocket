// SPEC-004 AC1: the generated app icons (no image library; see scripts/icons.mjs).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { BLUE, SAFE_ZONE_RADIUS_FRACTION, encodePng, iconSvg, renderIcon, writeIcons } from '../../scripts/icons.mjs';
import { decodePng } from '../e2e/helpers/png';

const isBlue = (data: Uint8Array | Uint8ClampedArray, i: number): boolean =>
  data[i] === BLUE[0] && data[i + 1] === BLUE[1] && data[i + 2] === BLUE[2] && data[i + 3] === 255;

describe('SPEC-004 AC1: master SVG', () => {
  it('uses the brand colour and the QR-inspired mark', () => {
    const any = iconSvg('any');
    expect(any).toContain('viewBox="0 0 32 32"');
    expect(any).toContain('#155EEF');
    expect(any).toContain('rx="8"'); // rounded square
    expect(any).toContain('#FFFFFF');
  });

  it('the maskable master is full-bleed (no rounding) with the artwork scaled down', () => {
    const maskable = iconSvg('maskable');
    expect(maskable).not.toContain('rx=');
    expect(maskable).toContain('transform="translate(16 16) scale(');
  });
});

describe('SPEC-004 AC1: "any" icon (192 and 512)', () => {
  for (const size of [192, 512]) {
    const icon = renderIcon('any', size);

    it(`${size}px has the right size and transparent rounded corners`, () => {
      expect(icon.width).toBe(size);
      expect(icon.height).toBe(size);
      expect(icon.data.length).toBe(size * size * 4);
      expect(icon.data[3]).toBe(0); // top-left pixel fully transparent
      const topRight = (size - 1) * 4;
      expect(icon.data[topRight + 3]).toBe(0);
      const topMiddle = Math.floor(size / 2) * 4;
      expect(isBlue(icon.data, topMiddle)).toBe(true); // the edge between the corners is opaque brand blue
    });

    it(`${size}px shows white artwork on the blue square and blue between the finder marks`, () => {
      const at = (u: number, v: number): number => (Math.floor((v / 32) * size) * size + Math.floor((u / 32) * size)) * 4;
      const whiteRing = at(6.5, 6.5); // inside the top-left finder's white ring
      expect([icon.data[whiteRing], icon.data[whiteRing + 1], icon.data[whiteRing + 2], icon.data[whiteRing + 3]]).toEqual([255, 255, 255, 255]);
      expect(isBlue(icon.data, at(9.5, 9.5))).toBe(true); // its blue centre
      expect(isBlue(icon.data, at(16, 16))).toBe(true); // the gap between marks
    });
  }
});

describe('SPEC-004 AC1: maskable icon keeps its artwork inside the safe zone', () => {
  const size = 512;
  const icon = renderIcon('maskable', size);

  it('is fully opaque and blue in all four corners (the OS may crop to any shape)', () => {
    for (const [x, y] of [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
    ]) {
      expect(isBlue(icon.data, ((y as number) * size + (x as number)) * 4)).toBe(true);
    }
  });

  it('has every non-background pixel within the central circle (radius 40% of the icon)', () => {
    const limit = SAFE_ZONE_RADIUS_FRACTION * size + 1; // 1px tolerance for anti-aliasing
    let outside = 0;
    let artwork = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (isBlue(icon.data, i)) continue;
        artwork++;
        const distance = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
        if (distance > limit) outside++;
      }
    }
    expect(artwork).toBeGreaterThan(1000); // the mark is really there
    expect(outside).toBe(0);
  });
});

describe('SPEC-004 AC1: PNG encoding and writing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qr-pocket-icons-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trips pixels exactly through the independent PNG reader', () => {
    const image = renderIcon('any', 64);
    const decoded = decodePng(encodePng(image));
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(64);
    expect(Buffer.from(decoded.data.buffer).equals(Buffer.from(image.data))).toBe(true);
  });

  it('is deterministic', () => {
    expect(Buffer.from(renderIcon('maskable', 96).data).equals(Buffer.from(renderIcon('maskable', 96).data))).toBe(true);
  });

  it('writes exactly the files the manifest and page reference, with the right dimensions', () => {
    const written = writeIcons(dir).sort();
    expect(written).toEqual(['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-maskable.svg', 'icon.svg']);
    for (const [name, size] of [
      ['icon-192.png', 192],
      ['icon-512.png', 512],
      ['icon-maskable-512.png', 512],
    ] as const) {
      const png = decodePng(readFileSync(join(dir, name)));
      expect([png.width, png.height, png.colorType, png.bitDepth]).toEqual([size, size, 6, 8]);
    }
    expect(readFileSync(join(dir, 'icon.svg'), 'utf8')).toBe(iconSvg('any'));
  });
});
