export type ShareResult = 'shared' | 'cancelled';

export class ShareError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ShareError';
  }
}

/** A 1-byte PNG-typed file, used only to ask the browser whether it can share image files at all. */
function probeFile(): File {
  return new File([new Uint8Array(1)], 'qr.png', { type: 'image/png' });
}

/** True when the Web Share API can share image files (feature detection, no side effects). */
export function canShareImageFiles(nav: Navigator = navigator): boolean {
  try {
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
    return nav.canShare({ files: [probeFile()] });
  } catch {
    return false;
  }
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name: unknown }).name === 'AbortError';
}

/**
 * Shares only the PNG file (no title, text or URL, so the payload is never sent as text).
 * A dismissed share sheet resolves to 'cancelled'; any other failure throws ShareError.
 */
export async function shareImageFile(file: File, nav: Navigator = navigator): Promise<ShareResult> {
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || !nav.canShare({ files: [file] })) {
    throw new ShareError('File sharing is not supported');
  }
  try {
    await nav.share({ files: [file] });
    return 'shared';
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    throw new ShareError('The share sheet could not be opened', error);
  }
}
