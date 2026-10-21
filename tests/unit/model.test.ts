import { describe, expect, it } from 'vitest';
import { deriveView, TEXT } from '../../src/ui/model';

describe('SPEC-001: Generate view model', () => {
  it('starts empty without any error message', () => {
    const vm = deriveView({ text: '', ecc: 'M', touched: false });
    expect(vm.preview.kind).toBe('empty');
    expect(vm.panel).toBeNull();
    expect(vm.invalid).toBe(false);
    expect(vm.clearVisible).toBe(false);
    expect(vm.showHint).toBe(true);
    expect(vm.announce).toBe('');
    expect(vm.counter).toBe('0 / 2,331 bytes · Medium');
  });

  it('AC1: shows the blank error only after the user has interacted', () => {
    const vm = deriveView({ text: '   ', ecc: 'M', touched: true });
    expect(vm.panel).toMatchObject({ kind: 'error', key: 'blank', title: TEXT.blankTitle });
    expect(vm.announce).toBe(''); // the alert panel announces itself (single channel)
    expect(vm.invalid).toBe(true);
    expect(vm.preview.kind).toBe('empty');
    const typedThenCleared = deriveView({ text: '', ecc: 'M', touched: true });
    expect(typedThenCleared.panel?.key).toBe('blank');
  });

  it('AC2: renders a QR and announces it for valid text', () => {
    const vm = deriveView({ text: 'a'.repeat(1000), ecc: 'M', touched: true });
    expect(vm.preview.kind).toBe('qr');
    expect(vm.panel).toBeNull();
    expect(vm.announce).toBe(TEXT.ready);
    expect(vm.counter).toBe('1,000 / 2,331 bytes · Medium');
  });

  it('AC3: counts bytes, not characters, for Arabic', () => {
    expect(deriveView({ text: 'مرحبا', ecc: 'M', touched: true }).counter).toBe('10 / 2,331 bytes · Medium');
  });

  it('AC5: Medium overflow that fits Low offers an explicit action and draws no QR', () => {
    const vm = deriveView({ text: 'a'.repeat(2400), ecc: 'M', touched: true });
    expect(vm.preview.kind).toBe('none');
    expect(vm.invalid).toBe(true);
    expect(vm.panel).toMatchObject({ kind: 'warn', key: 'too-long-medium', action: { id: 'use-low', label: TEXT.useLow } });
    expect(vm.counter).toBe('2,400 / 2,331 bytes · Medium');
    expect(vm.eccLowVisible).toBe(false);
    expect(vm.announce).toContain(TEXT.tooLongMediumTitle); // warning has no live role; announced via the status region
  });

  it('AC5: after the explicit choice the QR is drawn at Low and Back to Medium is offered', () => {
    const vm = deriveView({ text: 'a'.repeat(2400), ecc: 'L', touched: true });
    expect(vm.preview.kind).toBe('qr');
    expect(vm.panel).toBeNull();
    expect(vm.eccLowVisible).toBe(true);
    expect(vm.showHint).toBe(false);
    expect(vm.counter).toBe('2,400 / 2,953 bytes · Low');
    if (vm.preview.kind === 'qr') expect(vm.preview.matrix.ecc).toBe('L');
  });

  it('AC4: text beyond the Low limit is an error with no Low option, at either level', () => {
    for (const ecc of ['M', 'L'] as const) {
      const vm = deriveView({ text: 'a'.repeat(3100), ecc, touched: true });
      expect(vm.preview.kind).toBe('none');
      expect(vm.panel).toMatchObject({ kind: 'error', key: 'too-long' });
      expect(vm.panel?.action).toBeUndefined();
      expect(vm.counter).toBe('3,100 / 2,953 bytes');
    }
  });

  it('keeps the panel key stable while typing within the same state (no re-announce)', () => {
    const a = deriveView({ text: 'a'.repeat(2400), ecc: 'M', touched: true });
    const b = deriveView({ text: 'a'.repeat(2500), ecc: 'M', touched: true });
    expect(a.panel?.key).toBe(b.panel?.key);
  });
});
