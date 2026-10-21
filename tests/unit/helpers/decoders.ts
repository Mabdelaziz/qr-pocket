import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import jsQR from 'jsqr';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import type { RgbaImage } from '../../../src/render/pixels';

/** Independent decoder #1: jsQR (separate code base from the encoder). Returns the raw payload bytes. */
export function decodeWithJsQr(image: RgbaImage): Uint8Array | null {
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
  return result ? Uint8Array.from(result.binaryData) : null;
}

let zxingReady = false;

/** Independent decoder #2: ZXing (C++ compiled to WASM). Loads the wasm from node_modules, no network. */
export async function decodeWithZxing(image: RgbaImage): Promise<{ text: string; bytes: Uint8Array | undefined } | null> {
  if (!zxingReady) {
    const require = createRequire(import.meta.url);
    const file = readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
    const wasmBinary = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    prepareZXingModule({ overrides: { wasmBinary } });
    zxingReady = true;
  }
  // zxing-wasm accepts a duck-typed ImageData ({ data, width, height }) — Node has no ImageData class.
  const input = { data: image.data, width: image.width, height: image.height } as unknown as ImageData;
  const results = await readBarcodes(input, { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 });
  const first = results[0];
  if (!first) return null;
  return { text: first.text, bytes: (first as { bytes?: Uint8Array }).bytes };
}
