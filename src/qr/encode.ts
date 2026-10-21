import qrcode from 'qrcode-generator';

export type Ecc = 'L' | 'M';

/** Byte-mode capacity of a version 40 symbol (SPEC-001). */
export const MAX_BYTES: Readonly<Record<Ecc, number>> = { L: 2953, M: 2331 };

export interface QrMatrix {
  /** Modules per side (17 + 4 * version). */
  readonly size: number;
  readonly version: number;
  /** The level actually used. Never changed implicitly (ADR-007). */
  readonly ecc: Ecc;
  /** x = column, y = row. */
  get(x: number, y: number): boolean;
}

export type EncodeResult =
  | { ok: true; matrix: QrMatrix; bytes: number }
  | { ok: false; reason: 'empty'; bytes: number }
  | { ok: false; reason: 'too-long'; bytes: number; maxBytes: number; fitsAtL: boolean }
  | { ok: false; reason: 'failed'; bytes: number };

const utf8 = new TextEncoder();

// qrcode-generator's default string->bytes keeps only `charCodeAt(i) & 0xff`, which silently corrupts
// Arabic, emoji and any non-Latin-1 text. Replace it with real UTF-8 (ADR-014, SPEC-001 AC3).
qrcode.stringToBytes = (s: string): number[] => Array.from(utf8.encode(s));

export function utf8ByteLength(text: string): number {
  return utf8.encode(text).length;
}

/**
 * True if `text` contains an unpaired UTF-16 surrogate (what `String.prototype.isWellFormed()` checks).
 * Implemented by hand so it also works in browsers and runtimes that lack isWellFormed (SPEC-001 AC3).
 */
export function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(i + 1); // NaN past the end, which fails both comparisons
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++; // valid pair
        continue;
      }
      return true; // high surrogate not followed by a low one
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return true; // low surrogate without a preceding high one
  }
  return false;
}

/**
 * Encode `text` exactly as given (no trimming, no normalisation) in byte mode at the requested level.
 * Pure: no DOM. Never falls back to another error-correction level; callers decide (SPEC-001 AC5).
 */
export function encode(text: string, ecc: Ecc = 'M'): EncodeResult {
  const bytes = utf8ByteLength(text);
  if (text.trim() === '') return { ok: false, reason: 'empty', bytes };

  // TextEncoder silently turns a lone surrogate into U+FFFD, which would change the payload. Refuse instead.
  if (hasLoneSurrogate(text)) return { ok: false, reason: 'failed', bytes };

  const maxBytes = MAX_BYTES[ecc];
  if (bytes > maxBytes) {
    return { ok: false, reason: 'too-long', bytes, maxBytes, fitsAtL: ecc === 'M' && bytes <= MAX_BYTES.L };
  }

  try {
    const qr = qrcode(0, ecc);
    qr.addData(text, 'Byte');
    qr.make();
    const size = qr.getModuleCount();
    const modules = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        modules[y * size + x] = qr.isDark(y, x) ? 1 : 0;
      }
    }
    const matrix: QrMatrix = {
      size,
      version: (size - 17) / 4,
      ecc,
      get: (x, y) => modules[y * size + x] === 1,
    };
    return { ok: true, matrix, bytes };
  } catch {
    // The library throws strings (e.g. 'code length overflow'); treat anything unexpected as a failure.
    return { ok: false, reason: 'failed', bytes };
  }
}
