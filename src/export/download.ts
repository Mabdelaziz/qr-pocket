/** How long the temporary object URL stays valid after the click (long enough for the browser to start the download). */
export const REVOKE_DELAY_MS = 2000;

/** Saves a Blob through the browser's download mechanism and revokes the temporary object URL afterwards. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
