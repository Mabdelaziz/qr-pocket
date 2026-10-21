import { describe, expect, it } from 'vitest';
import { hasLoneSurrogate } from '../../src/qr/encode';
import { defaultTitle, formatIsoDate, normalizeTitle } from '../../src/store/titles';

const NOW = new Date(2026, 9, 21, 12, 0, 0); // 21 Oct 2026, local time

describe('SPEC-002: titles', () => {
  it('formats local ISO dates', () => {
    expect(formatIsoDate(NOW)).toBe('2026-10-21');
    expect(formatIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses the first non-blank line, trimmed, as the default title', () => {
    expect(defaultTitle('https://example.com', NOW)).toBe('https://example.com');
    expect(defaultTitle('\n\n   مرحبا بالعالم  \nrest', NOW)).toBe('مرحبا بالعالم');
  });

  it('limits default titles to 40 code points without splitting emoji', () => {
    const title = defaultTitle('\u{1F600}'.repeat(100), NOW);
    expect(Array.from(title)).toHaveLength(40);
    expect(hasLoneSurrogate(title)).toBe(false);
  });

  it('falls back to a dated title when there is no usable line', () => {
    expect(defaultTitle('   \n\t ', NOW)).toBe('QR code 2026-10-21');
  });

  it('cleans control characters and whitespace in user titles', () => {
    expect(normalizeTitle(' a\u0000b\tc \n d ', 'payload', NOW)).toBe('a b c d');
  });

  it('turns a blank user title into the default title', () => {
    expect(normalizeTitle('   ', 'Wi-Fi poster\nline 2', NOW)).toBe('Wi-Fi poster');
  });

  it('limits user titles to 80 code points and keeps Arabic intact', () => {
    expect(Array.from(normalizeTitle('x'.repeat(200), 'p', NOW))).toHaveLength(80);
    expect(normalizeTitle('  مرحبا بالعالم ', 'p', NOW)).toBe('مرحبا بالعالم');
  });
});
