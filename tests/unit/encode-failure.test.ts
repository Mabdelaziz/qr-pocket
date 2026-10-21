import { describe, expect, it, vi } from 'vitest';

// The real library throws plain strings (e.g. 'code length overflow. (1234>1000)'), not Error objects.
// SPEC-001: any unexpected encoder failure becomes a controlled 'failed' result, never an uncaught throw.
vi.mock('qrcode-generator', () => {
  const factory = Object.assign(
    () => ({
      addData: () => undefined,
      make: () => {
        throw 'code length overflow. (1234>1000)';
      },
      getModuleCount: () => 0,
      isDark: () => false,
    }),
    { stringToBytes: (s: string): number[] => Array.from(new TextEncoder().encode(s)) },
  );
  return { default: factory };
});

describe('SPEC-001: encoder failure handling', () => {
  it('turns a thrown string from the library into a failed result', async () => {
    const { encode } = await import('../../src/qr/encode');
    const result = encode('hello');
    expect(result).toEqual({ ok: false, reason: 'failed', bytes: 5 });
  });

  it('does not let a library failure leak for other levels either', async () => {
    const { encode } = await import('../../src/qr/encode');
    const result = encode('hello', 'L');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('failed');
  });
});
