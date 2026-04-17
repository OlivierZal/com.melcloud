import type { HourNumbers } from 'luxon'

const HOUR_MIN = 0
const HOUR_MAX = 23

interface NonNegativeIntOptions {
  readonly field?: string
  readonly max?: number
}

const fieldPrefix = (field?: string): string =>
  field === undefined || field === '' ? '' : `${field}: `

/**
 * Parses `value` as a non-negative finite integer (0 included). Throws if the
 * input cannot be coerced cleanly (non-numeric string, NaN, non-finite,
 * negative, fractional, or above the optional `max` bound).
 */
export const toNonNegativeInt = (
  value: unknown,
  { field, max }: NonNegativeIntOptions = {},
): number => {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new TypeError(
      `${fieldPrefix(field)}expected number or numeric string`,
    )
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new RangeError(
      `${fieldPrefix(field)}expected non-negative integer, got ${String(value)}`,
    )
  }
  if (max !== undefined && parsed > max) {
    throw new RangeError(
      `${fieldPrefix(field)}expected value ≤ ${String(max)}, got ${String(parsed)}`,
    )
  }
  return parsed
}

/**
 * Parses `value` as a Luxon `HourNumbers` (0-23). Throws on out-of-range or
 * non-integer input.
 */
export const toHourNumbers = (value: unknown, field?: string): HourNumbers => {
  const parsed = toNonNegativeInt(value, { field, max: HOUR_MAX })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing a [0..23] integer to HourNumbers (Luxon's 0-23 union)
  return parsed as HourNumbers
}

export { HOUR_MAX, HOUR_MIN }
