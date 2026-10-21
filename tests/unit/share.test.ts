import { describe, expect, it, vi } from 'vitest';
import { canShareImageFiles, ShareError, shareImageFile } from '../../src/share/share';

const nav = (props: Record<string, unknown>): Navigator => props as unknown as Navigator;
const file = (): File => new File([new Uint8Array([1, 2, 3])], 'qr.png', { type: 'image/png' });

describe('SPEC-003 AC5: file sharing is feature-detected', () => {
  it('is unsupported without navigator.share or navigator.canShare', () => {
    expect(canShareImageFiles(nav({}))).toBe(false);
    expect(canShareImageFiles(nav({ share: async () => undefined }))).toBe(false);
    expect(canShareImageFiles(nav({ canShare: () => true }))).toBe(false);
  });

  it('is unsupported when canShare refuses files or throws', () => {
    expect(canShareImageFiles(nav({ share: async () => undefined, canShare: () => false }))).toBe(false);
    expect(
      canShareImageFiles(
        nav({
          share: async () => undefined,
          canShare: () => {
            throw new TypeError('bad');
          },
        }),
      ),
    ).toBe(false);
  });

  it('is supported when canShare accepts a PNG file', () => {
    const canShare = vi.fn(() => true);
    expect(canShareImageFiles(nav({ share: async () => undefined, canShare }))).toBe(true);
    const arg = (canShare.mock.calls[0] as unknown as [ShareData])[0];
    expect(arg.files?.[0]?.type).toBe('image/png');
  });
});

describe('SPEC-003 AC6: sharing, cancellation and errors', () => {
  it('shares only the file: no title, text or url', async () => {
    const share = vi.fn(async () => undefined);
    const result = await shareImageFile(file(), nav({ share, canShare: () => true }));
    expect(result).toBe('shared');
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(Object.keys(data)).toEqual(['files']);
    expect(data.files).toHaveLength(1);
  });

  it('treats a dismissed share sheet (AbortError) as cancelled, not an error', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('dismissed', 'AbortError');
    });
    await expect(shareImageFile(file(), nav({ share, canShare: () => true }))).resolves.toBe('cancelled');
  });

  it('reports any other failure as a ShareError with the cause attached', async () => {
    const cause = new DOMException('blocked', 'NotAllowedError');
    const share = vi.fn(async () => {
      throw cause;
    });
    const error = await shareImageFile(file(), nav({ share, canShare: () => true })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShareError);
    expect((error as ShareError).cause).toBe(cause);
  });

  it('refuses to share when unsupported, without calling share', async () => {
    const share = vi.fn(async () => undefined);
    await expect(shareImageFile(file(), nav({ share, canShare: () => false }))).rejects.toBeInstanceOf(ShareError);
    expect(share).not.toHaveBeenCalled();
  });
});
