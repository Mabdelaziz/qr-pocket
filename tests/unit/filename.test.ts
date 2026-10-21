import { describe, expect, it } from 'vitest';
import { pngFilename, slugify } from '../../src/export/filename';

const DATE = new Date(2026, 9, 21, 9, 30); // 21 Oct 2026, local

describe('SPEC-003 AC3: safe, descriptive filenames', () => {
  it('formats qr-<slug>-yyyymmdd.png', () => {
    expect(pngFilename('Wi-Fi poster', DATE)).toBe('qr-wi-fi-poster-20261021.png');
    expect(pngFilename('Menu', new Date(2027, 0, 5))).toBe('qr-menu-20270105.png');
  });

  it('keeps Arabic letters and combining marks', () => {
    expect(slugify('مرحبا بالعالم')).toBe('مرحبا-بالعالم');
    // Combining marks survive; NFC may reorder them canonically, so compare against the normalised input.
    const diacritics = 'السَّلامُ عَلَيْكُمْ';
    expect(slugify(diacritics)).toBe(diacritics.normalize('NFC').replace(' ', '-'));
    expect(slugify('Café')).toBe('café'); // NFC-normalised
  });

  it('drops emoji, path separators, reserved and bidi/control characters', () => {
    expect(slugify('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j');
    expect(slugify('\u{1F600} Party \u{1F389}')).toBe('party');
    expect(slugify('abc‏def\u0000ghi')).toBe('abcdefghi');
    expect(slugify('../../etc/passwd')).toBe('etc-passwd');
  });

  it('falls back to "code" for empty or symbol-only titles', () => {
    expect(pngFilename('', DATE)).toBe('qr-code-20261021.png');
    expect(pngFilename('\u{1F600}\u{1F600}', DATE)).toBe('qr-code-20261021.png');
    expect(pngFilename('///', DATE)).toBe('qr-code-20261021.png');
  });

  it('limits very long titles so the whole name stays within 60 characters', () => {
    const name = pngFilename('x'.repeat(200), DATE);
    expect(name.length).toBeLessThanOrEqual(60);
    expect(name.endsWith('-20261021.png')).toBe(true);
    const arabic = pngFilename('ب'.repeat(200), DATE);
    expect(Array.from(arabic).length).toBeLessThanOrEqual(60);
  });

  it('never produces characters that are invalid in file names', () => {
    for (const title of ['CON', 'a.b.', ' lead trail ', 'tab\tname', 'q"uote', '日本語のタイトル', 'Ünïcödé']) {
      const name = pngFilename(title, DATE);
      expect(name).toMatch(/^qr-.+-20261021\.png$/);
      expect(Array.from(name).every((ch) => ch.charCodeAt(0) > 31 && !'\\/:*?"<>|'.includes(ch))).toBe(true);
      expect(name).not.toMatch(/\.\.|--/);
    }
  });
});
