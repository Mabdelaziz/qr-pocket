// Local typing for `qrcode-generator` 2.0.4 (SPEC-001, ADR-002/ADR-014).
// The package ships a global-script .d.ts (`declare var qrcode` + ambient `export =`) that is not a
// module under TypeScript's resolution. tsconfig `paths` points type resolution here instead;
// at runtime Vite/Vitest still load the package's ESM build (dist/qrcode.mjs), whose default export
// is this same factory. Only the members this app uses are declared.
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type Mode = 'Numeric' | 'Alphanumeric' | 'Byte' | 'Kanji';

export interface QRCode {
  addData(data: string, mode?: Mode): void;
  make(): void;
  getModuleCount(): number;
  /** row = y, col = x */
  isDark(row: number, col: number): boolean;
}

export interface QRCodeFactory {
  /** typeNumber 0 = choose the smallest version that fits. */
  (typeNumber: number, errorCorrectionLevel: ErrorCorrectionLevel): QRCode;
  /** Byte-mode string conversion. The default keeps only the low 8 bits of each UTF-16 unit. */
  stringToBytes: (s: string) => number[];
}

declare const qrcode: QRCodeFactory;
export default qrcode;
