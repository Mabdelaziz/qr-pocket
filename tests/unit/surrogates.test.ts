import { describe, expect, it } from 'vitest';
import { encode, hasLoneSurrogate } from '../../src/qr/encode';

describe('SPEC-001 AC3: lone-surrogate detection works without String.prototype.isWellFormed', () => {
  it.each([
    ['lone high surrogate in the middle', 'abc\uD800def'],
    ['lone high surrogate at the end', 'abc\uD83D'],
    ['lone low surrogate at the start', '\uDE00abc'],
    ['lone low surrogate in the middle', 'abc\uDE00def'],
    ['reversed pair (low then high)', '\uDE00\uD83D'],
    ['two high surrogates in a row', '\uD83D😀'],
  ])('detects %s', (_name, text) => {
    expect(hasLoneSurrogate(text)).toBe(true);
  });

  it.each([
    ['plain ASCII', 'hello'],
    ['Arabic', 'مرحبا بالعالم'],
    ['a valid surrogate pair (emoji)', 'smile 😀!'],
    ['a ZWJ family emoji sequence', '👨‍👩‍👧'],
    ['a flag (two regional indicators)', '🇪🇬'],
    ['the empty string', ''],
  ])('accepts %s', (_name, text) => {
    expect(hasLoneSurrogate(text)).toBe(false);
  });

  it('agrees with String.prototype.isWellFormed where the runtime has it', () => {
    const samples = ['a', '\uD800', '\uDC00', '😀', 'x\uD83Dy', '\uDE00\uD83D', 'مرحبا'];
    for (const sample of samples) {
      const native = (sample as unknown as { isWellFormed?: () => boolean }).isWellFormed;
      if (typeof native === 'function') expect(hasLoneSurrogate(sample)).toBe(!native.call(sample));
    }
  });

  it('encode() refuses such text instead of encoding a U+FFFD substitute', () => {
    for (const text of ['abc\uD800def', '\uDE00']) {
      const result = encode(text);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('failed');
    }
  });

  it('encode() still accepts valid pairs', () => {
    expect(encode('smile 😀').ok).toBe(true);
  });
});
