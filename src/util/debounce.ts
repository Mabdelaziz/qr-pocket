export interface Debounced {
  (): void;
  cancel(): void;
}

/** Trailing-edge debounce: the last call wins (SPEC-001 "rapid typing"). */
export function debounce(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn();
    }, ms);
  }) as Debounced;
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
