// TEMPORARY DIAGNOSTIC (to be removed): which decoder reads which rendering of the dense mixed payload?
import { describe, expect, it } from 'vitest';
import { renderExportRgba } from '../../src/export/png';
import { encode, type Ecc } from '../../src/qr/encode';
import { matrixToRgba } from '../../src/render/pixels';
import { decodeWithJsQr, decodeWithZxing } from './helpers/decoders';

const mixed = Array.from('مرحبا \u{1F600} hello, '.repeat(120)).slice(0, 700).join('');
const arabicOnly = 'مرحبا بالعالم، '.repeat(100);
const asciiSame = 'a'.repeat(new TextEncoder().encode(mixed).length);
const emojiOnly = '\u{1F600}'.repeat(250);

describe('DIAG: decoder behaviour on dense payloads', () => {
  it('prints a table', async () => {
    const rows: string[] = [];
    for (const [name, text] of [['mixed', mixed], ['arabicOnly', arabicOnly], ['asciiSameBytes', asciiSame], ['emojiOnly', emojiOnly]] as const) {
      for (const ecc of ['L', 'M'] as Ecc[]) {
        const r = encode(text, ecc);
        if (!r.ok) {
          rows.push(`${name} ${ecc}: encode ${r.reason} (${r.bytes} bytes)`);
          continue;
        }
        const expected = Array.from(new TextEncoder().encode(text)).join(',');
        const cells: string[] = [];
        for (const scale of [2, 3, 4, 5, 6, 8]) {
          const img = matrixToRgba(r.matrix, scale);
          const js = decodeWithJsQr(img);
          cells.push(`s${scale}:js=${js ? (Array.from(js).join(',') === expected ? 'ok' : 'WRONG') : 'null'}`);
        }
        const exp = renderExportRgba(r.matrix);
        const jsE = decodeWithJsQr(exp);
        const zx = await decodeWithZxing(exp);
        cells.push(`export:js=${jsE ? (Array.from(jsE).join(',') === expected ? 'ok' : 'WRONG') : 'null'}`);
        cells.push(`export:zx=${zx ? (zx.text === text ? 'ok' : 'WRONG') : 'null'}`);
        rows.push(`${name} ${ecc}: bytes=${r.bytes} version=${r.matrix.version} modules=${r.matrix.size} | ${cells.join(' ')}`);
      }
    }
    console.log('\nDIAG-TABLE\n' + rows.join('\n') + '\nEND-DIAG-TABLE');
    expect(rows.length).toBeGreaterThan(0);
  });
});
