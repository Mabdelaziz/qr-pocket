const MAX_SLUG_CODE_POINTS = 40;

// Ranges removed from titles: C0/C1 controls, zero-width and bidi marks, BOM. Built from code points at runtime so
// the source contains no invisible characters (ESLint no-irregular-whitespace / no-control-regex) and the list is auditable.
const STRIPPED_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f], // zero-width space/joiners, LRM, RLM
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2066, 0x2069], // bidi isolates
  [0xfeff, 0xfeff], // byte order mark
];
const STRIPPED = new RegExp(`[${STRIPPED_RANGES.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join('')}]`, 'g');

/** Lower-case slug of letters/marks/digits (Arabic kept); everything else collapses to '-'. */
export function slugify(title: string): string {
  const cleaned = title
    .normalize('NFC')
    .replace(STRIPPED, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return Array.from(cleaned).slice(0, MAX_SLUG_CODE_POINTS).join('').replace(/-+$/g, '');
}

function compactDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** `qr-<slug>-yyyymmdd.png` (local date), at most 60 characters, safe on Android and desktop file systems. */
export function pngFilename(title: string, date: Date): string {
  const slug = slugify(title) || 'code';
  return `qr-${slug}-${compactDate(date)}.png`;
}
