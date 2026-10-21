// Shared payloads for SPEC-001 round-trip tests (unit + browser). Every case fits at Medium.
export interface PayloadCase {
  readonly name: string;
  readonly text: string;
}

const ARABIC_SENTENCE = 'مرحبا بالعالم، هذا نص عربي طويل لاختبار ترميز رمز الاستجابة السريعة بشكل صحيح. ';

export const CASES: readonly PayloadCase[] = [
  { name: 'ascii', text: 'Hello, QR Pocket!' },
  { name: 'url', text: 'https://example.com/menu?table=12&lang=en#top' },
  { name: 'url-with-arabic-path', text: 'https://example.com/مرحبا?q=١٢٣' },
  { name: 'arabic-short', text: 'مرحبا بالعالم' },
  { name: 'arabic-long-200-plus-chars', text: ARABIC_SENTENCE.repeat(4) },
  { name: 'arabic-with-diacritics', text: 'السَّلامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ' },
  { name: 'mixed-rtl-ltr', text: 'اضغط هنا: https://example.com/path ثم تابع' },
  { name: 'bidi-control-characters', text: 'abc‏مرحبا‎def' },
  { name: 'emoji', text: 'Coffee ☕ and 😀 🇪🇬' },
  { name: 'emoji-zwj-sequence', text: '👨‍👩‍👧‍👦' },
  { name: 'latin1-and-currency', text: 'café €5 £3' },
  { name: 'multiline', text: 'line 1\nسطر 2\n\nline 4' },
  { name: 'leading-trailing-spaces', text: '  spaced out  ' },
  { name: 'decomposed-unicode-not-normalised', text: 'é' },
];
