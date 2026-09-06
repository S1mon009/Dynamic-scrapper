/** Recursive partial representation used for configuration overrides. */
export type DeepPartial<T> = T extends (infer U)[]
  ? U[] | undefined
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

/** Merges nested plain objects while replacing arrays and scalar values. */
export function deepMerge<T extends Record<string, unknown>>(base: T, override: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = (override as Record<string, unknown>)[key];
    if (overrideValue === undefined) continue;
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }
  return result as T;
}

/** Applies several configuration overrides from left to right. */
export function deepMergeAll<T extends Record<string, unknown>>(
  base: T,
  ...overrides: Array<DeepPartial<T>>
): T {
  return overrides.reduce<T>((acc, next) => deepMerge(acc, next), base);
}
