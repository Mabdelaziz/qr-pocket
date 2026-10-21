import type { Ecc } from '../qr/encode';

/** 'scanned' is reserved for the V1.1 camera scanner; Version 1.0 only ever writes 'typed'. */
export type SavedSource = 'typed' | 'scanned';

export interface SavedCode {
  readonly id: string;
  readonly title: string;
  /** The exact text that is encoded. Never trimmed or normalised. */
  readonly payload: string;
  /** The error-correction level actually used. */
  readonly ecc: Ecc;
  readonly source: SavedSource;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Record schema version. */
  readonly v: 1;
}

export interface NewCode {
  readonly payload: string;
  readonly ecc: Ecc;
  readonly title?: string;
  readonly source?: SavedSource;
}

export type StoreErrorKind = 'unavailable' | 'quota' | 'not-found' | 'invalid' | 'unknown';

export class StoreError extends Error {
  readonly kind: StoreErrorKind;

  constructor(kind: StoreErrorKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'StoreError';
    this.kind = kind;
  }
}

export interface CodeStore {
  add(input: NewCode): Promise<SavedCode>;
  /** Newest first (createdAt descending); renames do not reorder. */
  list(): Promise<SavedCode[]>;
  get(id: string): Promise<SavedCode | undefined>;
  rename(id: string, title: string): Promise<SavedCode>;
  /** Idempotent: removing a record that no longer exists succeeds. */
  remove(id: string): Promise<void>;
}

export function isSavedCode(value: unknown): value is SavedCode {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['title'] === 'string' &&
    typeof r['payload'] === 'string' &&
    (r['ecc'] === 'L' || r['ecc'] === 'M') &&
    (r['source'] === 'typed' || r['source'] === 'scanned') &&
    typeof r['createdAt'] === 'number' &&
    typeof r['updatedAt'] === 'number' &&
    r['v'] === 1
  );
}
