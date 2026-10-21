import { describe, expect, it } from 'vitest';
import { encode, MAX_BYTES, utf8ByteLength, type Ecc } from '../../src/qr/encode';
import { matrixToRgba } from '../../src/render/pixels';
import { CASES } from './helpers/cases';
import { decodeWithJsQr } from './helpers/decoders';

const utf8 = new TextEncoder();

function mustEncode(text: string, ecc: Ecc = 'M') {
  const result = encode(text, ecc);
  if (!result.ok) throw new Error(`expected encode to succeed, got ${result.reason}`);
  return result;
}

function roundTrip(text: string, ecc: Ecc, scale: number): Uint8Array | null {
  return decodeWithJsQr(matrixToRgba(mustEncode(text, ecc).matrix, scale));
}

describe('SPEC-001 AC1: blank input', () => {
  it.each(['', ' ', '   ', '\n', '\t \n', ' '])('rejects %j as empty', (text) => {
    const result = encode(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty');
  });
});

describe('SPEC-001: byte counting and limits', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('€')).toBe(3);
    expect(utf8ByteLength('مرحبا')).toBe(10);
    expect(utf8ByteLength('\u{1F600}')).toBe(4);
  });

  it('refuses text with a lone surrogate instead of silently substituting U+FFFD', () => {
    const result = encode('abc\uD800def');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });
});

describe('SPEC-001 AC2/AC3: independent decoder round trip (jsQR) is byte-exact', () => {
  it.each(CASES.map((c) => [c.name, c.text] as const))('%s', (_name, text) => {
    const decoded = roundTrip(text, 'M', 6);
    expect(decoded).not.toBeNull();
    expect(Array.from(decoded ?? [])).toEqual(Array.from(utf8.encode(text)));
  });

  it('does not truncate UTF-16 units to 8 bits (qrcode-generator default is lossy)', () => {
    expect(Array.from(roundTrip('€', 'M', 8) ?? [])).toEqual([0xe2, 0x82, 0xac]);
    expect(Array.from(roundTrip('é', 'M', 8) ?? [])).toEqual([0xc3, 0xa9]);
  });

  it('keeps leading/trailing spaces and does not normalise Unicode', () => {
    expect(new TextDecoder().decode(roundTrip('  hi  ', 'M', 8) ?? new Uint8Array())).toBe('  hi  ');
    expect(Array.from(roundTrip('é', 'M', 8) ?? [])).toEqual([0x65, 0xcc, 0x81]);
  });

  it('round-trips exactly 2331 bytes at Medium (capacity boundary)', () => {
    const text = 'x'.repeat(2331);
    expect(roundTrip(text, 'M', 6)).toEqual(utf8.encode(text));
  });

  it('SPEC-001 AC5b: round-trips exactly 2953 bytes at Low (capacity boundary)', () => {
    const text = 'y'.repeat(2953);
    expect(roundTrip(text, 'L', 6)).toEqual(utf8.encode(text));
  });
});

describe('SPEC-001 AC4/AC5: capacity errors and explicit Low', () => {
  it('AC4: 2954 bytes is too long at both levels and does not fit at L', () => {
    const text = 'a'.repeat(2954);
    for (const ecc of ['M', 'L'] as const) {
      const result = encode(text, ecc);
      expect(result.ok).toBe(false);
      if (!result.ok && result.reason === 'too-long') {
        expect(result.bytes).toBe(2954);
        expect(result.maxBytes).toBe(MAX_BYTES[ecc]);
        expect(result.fitsAtL).toBe(false);
      } else {
        throw new Error('expected too-long');
      }
    }
  });

  it('AC5: between the M and L limits Medium fails with fitsAtL and never silently switches', () => {
    const text = 'b'.repeat(2332);
    const atM = encode(text, 'M');
    expect(atM.ok).toBe(false);
    if (!atM.ok && atM.reason === 'too-long') {
      expect(atM.maxBytes).toBe(2331);
      expect(atM.fitsAtL).toBe(true);
    } else {
      throw new Error('expected too-long at M');
    }
  });

  it('AC5: the same text succeeds only when Low is requested explicitly, and reports Low', () => {
    const atL = mustEncode('b'.repeat(2332), 'L');
    expect(atL.matrix.ecc).toBe('L');
  });

  it('AC5: the matrix always reports the level that was requested', () => {
    expect(mustEncode('hello', 'M').matrix.ecc).toBe('M');
    expect(mustEncode('hello', 'L').matrix.ecc).toBe('L');
  });
});

describe('SPEC-001 AC6: matrix structure', () => {
  it('has a standard size and the three finder patterns', () => {
    const { matrix } = mustEncode('https://example.com');
    expect(matrix.version).toBeGreaterThanOrEqual(1);
    expect(matrix.version).toBeLessThanOrEqual(40);
    expect(matrix.size).toBe(17 + 4 * matrix.version);
    const n = matrix.size;
    for (const [ox, oy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ] as const) {
      for (let i = 0; i < 7; i++) {
        expect(matrix.get(ox + i, oy)).toBe(true); // top edge of the finder
        expect(matrix.get(ox, oy + i)).toBe(true); // left edge
      }
      expect(matrix.get(ox + 1, oy + 1)).toBe(false); // light ring
      expect(matrix.get(ox + 3, oy + 3)).toBe(true); // centre
    }
  });

  it('is deterministic for the same input', () => {
    const a = mustEncode('same input').matrix;
    const b = mustEncode('same input').matrix;
    expect(a.size).toBe(b.size);
    for (let y = 0; y < a.size; y++) for (let x = 0; x < a.size; x++) expect(a.get(x, y)).toBe(b.get(x, y));
  });
});
