import { describe, expect, it } from 'vitest';
import { encode } from '../../src/qr/encode';
import { computeLayout, QUIET_ZONE } from '../../src/render/layout';
import { matrixToRgba } from '../../src/render/pixels';

describe('SPEC-001 AC6: layout uses an integer module scale and a 4-module quiet zone', () => {
  it('computes the largest whole scale that fits', () => {
    expect(computeLayout(29, 288)).toEqual({ modules: 29, total: 37, scale: 7, pixels: 259 });
  });

  it('never returns a fractional or zero scale', () => {
    for (let version = 1; version <= 40; version++) {
      const modules = 17 + 4 * version;
      for (const target of [50, 100, 185, 262, 288, 640, 1024]) {
        const layout = computeLayout(modules, target);
        expect(Number.isInteger(layout.scale)).toBe(true);
        expect(layout.scale).toBeGreaterThanOrEqual(1);
        expect(layout.pixels).toBe(layout.scale * layout.total);
        if (target >= layout.total) expect(layout.pixels).toBeLessThanOrEqual(target);
      }
    }
  });

  it('falls back to 1px per module when the container is too small', () => {
    expect(computeLayout(177, 100).scale).toBe(1);
  });

  it('keeps the largest symbol at 5 px/module inside a 1024 px export (SPEC-003 headroom)', () => {
    expect(computeLayout(177, 1024).scale).toBe(5);
  });

  it('uses a quiet zone of 4 modules', () => {
    expect(QUIET_ZONE).toBe(4);
  });
});

describe('SPEC-001 AC6: rendered pixels are black on white only', () => {
  const result = encode('https://example.com/pixels');
  if (!result.ok) throw new Error('encode failed');
  const scale = 5;
  const image = matrixToRgba(result.matrix, scale);

  it('has the expected size', () => {
    expect(image.width).toBe((result.matrix.size + 2 * QUIET_ZONE) * scale);
    expect(image.height).toBe(image.width);
    expect(image.data.length).toBe(image.width * image.height * 4);
  });

  it('contains only pure black or pure white, fully opaque (no anti-aliasing)', () => {
    for (let i = 0; i < image.data.length; i += 4) {
      const r = image.data[i];
      expect(r === 0 || r === 255).toBe(true);
      expect(image.data[i + 1]).toBe(r);
      expect(image.data[i + 2]).toBe(r);
      expect(image.data[i + 3]).toBe(255);
    }
  });

  it('keeps a 4-module white border on every side', () => {
    const margin = QUIET_ZONE * scale;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const inside = x >= margin && x < image.width - margin && y >= margin && y < image.height - margin;
        if (!inside) expect(image.data[(y * image.width + x) * 4]).toBe(255);
      }
    }
  });

  it('paints every dark module as a full scale x scale block', () => {
    let darkModules = 0;
    for (let y = 0; y < result.matrix.size; y++) for (let x = 0; x < result.matrix.size; x++) if (result.matrix.get(x, y)) darkModules++;
    let blackPixels = 0;
    for (let i = 0; i < image.data.length; i += 4) if (image.data[i] === 0) blackPixels++;
    expect(blackPixels).toBe(darkModules * scale * scale);
  });
});
