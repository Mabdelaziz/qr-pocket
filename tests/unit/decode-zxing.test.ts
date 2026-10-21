// T-001-2b — second independent decoder (ZXing). ZXing guesses the text charset when a QR code carries
// no ECI segment, so a mismatch here is a REAL interoperability finding (Arabic risk in docs/PROGRESS.md),
// not just a test defect. Triage a failure before changing anything (ADR-014).
import { describe, expect, it } from 'vitest';
import { encode } from '../../src/qr/encode';
import { matrixToRgba } from '../../src/render/pixels';
import { CASES } from './helpers/cases';
import { decodeWithZxing } from './helpers/decoders';

describe('SPEC-001 AC2/AC3: second independent decoder (ZXing)', () => {
  it.each(CASES.map((c) => [c.name, c.text] as const))('%s decodes to the exact text', async (_name, text) => {
    const result = encode(text, 'M');
    if (!result.ok) throw new Error(`encode failed: ${result.reason}`);
    const decoded = await decodeWithZxing(matrixToRgba(result.matrix, 6));
    expect(decoded).not.toBeNull();
    expect(decoded?.text).toBe(text);
    if (decoded?.bytes) expect(Array.from(decoded.bytes)).toEqual(Array.from(new TextEncoder().encode(text)));
  });
});
