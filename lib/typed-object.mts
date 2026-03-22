export const typedEntries = <TKey extends string, TValue>(
  object: Partial<Record<TKey, TValue>>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): [TKey, TValue][] => Object.entries(object) as [TKey, TValue][]

export const typedFromEntries = <TKey extends string, TValue>(
  entries: Iterable<readonly [TKey, TValue]>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): Record<TKey, TValue> => Object.fromEntries(entries) as Record<TKey, TValue>

export const typedKeys = <TKey extends string>(
  object: Partial<Record<TKey, unknown>>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): TKey[] => Object.keys(object) as TKey[]
