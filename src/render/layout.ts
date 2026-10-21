/** Quiet zone, in modules, on every side (QR specification minimum). */
export const QUIET_ZONE = 4;

export interface QrLayout {
  /** Modules per side, excluding the quiet zone. */
  readonly modules: number;
  /** Modules per side including the quiet zone on both sides. */
  readonly total: number;
  /** Whole pixels per module (never fractional, so edges stay sharp). */
  readonly scale: number;
  /** Bitmap size in pixels (= scale * total). */
  readonly pixels: number;
}

/** Largest integer module scale that fits in `targetPx` (at least 1). */
export function computeLayout(modules: number, targetPx: number, quiet: number = QUIET_ZONE): QrLayout {
  const total = modules + 2 * quiet;
  const scale = Math.max(1, Math.floor(targetPx / total));
  return { modules, total, scale, pixels: scale * total };
}
