export const MAX_TITLE_CODE_POINTS = 80;
const DEFAULT_TITLE_CODE_POINTS = 40;

function truncateCodePoints(text: string, max: number): string {
  return Array.from(text).slice(0, max).join('');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date as YYYY-MM-DD. */
export function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First non-blank line of the payload (<= 40 code points), else "QR code YYYY-MM-DD". */
export function defaultTitle(payload: string, now: Date): string {
  const firstLine = payload
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const title = truncateCodePoints(firstLine ?? '', DEFAULT_TITLE_CODE_POINTS);
  return title.length > 0 ? title : `QR code ${formatIsoDate(now)}`;
}

/** Cleans a user-entered title: control characters -> space, whitespace collapsed, <= 80 code points; blank -> default. */
export function normalizeTitle(input: string, payload: string, now: Date): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the purpose
  const cleaned = input.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
  const title = truncateCodePoints(cleaned, MAX_TITLE_CODE_POINTS);
  return title.length > 0 ? title : defaultTitle(payload, now);
}
