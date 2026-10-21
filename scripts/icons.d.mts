export type IconKind = 'any' | 'maskable';
export interface IconImage {
  width: number;
  height: number;
  data: Uint8Array;
}
export const BLUE: readonly [number, number, number];
export const WHITE: readonly [number, number, number];
export const VIEWBOX: number;
export const CORNER_RADIUS: number;
export const WHITE_RECTS: ReadonlyArray<readonly [number, number, number, number]>;
export const BLUE_RECTS: ReadonlyArray<readonly [number, number, number, number]>;
export const ARTWORK_EXTENT: number;
export const MASKABLE_ARTWORK_FRACTION: number;
export const SAFE_ZONE_RADIUS_FRACTION: number;
export function renderIcon(kind: IconKind, size: number): IconImage;
export function encodePng(image: IconImage): Buffer;
export function iconSvg(kind: IconKind): string;
export function writeIcons(dir: string): string[];
