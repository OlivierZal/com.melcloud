export const typedEntries = <TKey extends string, TValue>(
  object: Partial<Record<TKey, TValue>>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.entries/fromEntries/keys lose key types; cast restores them
): [TKey, TValue][] => Object.entries(object) as [TKey, TValue][]

export const typedFromEntries = <TKey extends string, TValue>(
  entries: Iterable<readonly [TKey, TValue]>,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.entries/fromEntries/keys lose key types; cast restores them
): Record<TKey, TValue> => Object.fromEntries(entries) as Record<TKey, TValue>

export const invertEnum = <TEnum extends Record<string, PropertyKey>>(
  enumObject: TEnum,
): Record<TEnum[keyof TEnum], keyof TEnum> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Object.entries/fromEntries/keys lose key types; cast restores them
  Object.fromEntries(
    Object.entries(enumObject).map(([key, value]) => [value, key]),
  ) as Record<TEnum[keyof TEnum], keyof TEnum>
