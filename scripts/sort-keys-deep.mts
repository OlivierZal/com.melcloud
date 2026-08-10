/**
 * Re-sorts every object key to the repo's `json/sort-keys` convention,
 * leaving values (and array order) exactly as they came — the vendored
 * capability definitions must stay homey-lib's own data, only laid out
 * the way the linter expects.
 * @param value - Any parsed JSON value.
 * @returns The same value with its object keys sorted, depth-first.
 */
export const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => sortKeysDeep(entry))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    )
  }
  return value
}
