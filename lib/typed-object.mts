export const typedEntries = <K extends string, V>(
  object: Partial<Record<K, V>>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): [K, V][] => Object.entries(object) as [K, V][]

export const typedFromEntries = <K extends string, V>(
  entries: Iterable<readonly [K, V]>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): Record<K, V> => Object.fromEntries(entries) as Record<K, V>

export const typedKeys = <K extends string>(
  object: Partial<Record<K, unknown>>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
): K[] => Object.keys(object) as K[]
