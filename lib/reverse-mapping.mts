const KEY_INDEX = 0

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
