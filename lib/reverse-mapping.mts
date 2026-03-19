const KEY_INDEX = 0

/*
 * Reverse enum lookup: finds the key for a given value.
 * Object.entries returns [key, value] tuples, so entry[0] is the key
 */
export const keyOfValue = <T extends Record<string, number | string>>(
  object: T,
  value: unknown,
): string & keyof T => {
  const entry = Object.entries(object).find(
    ([, entryValue]) => entryValue === value,
  )
  if (!entry) {
    throw new Error(`Unknown value: ${String(value)}`)
  }
  return entry[KEY_INDEX] as string & keyof T
}
