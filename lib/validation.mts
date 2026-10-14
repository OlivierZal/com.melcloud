import type { DeviceOrZoneData } from '../types/zone.mts'

const zoneTypes = new Set<string>(['areas', 'buildings', 'floors'])

const deviceOrZoneTypes = new Set<string>([...zoneTypes, 'devices'])

const isDeviceOrZoneType = (
  zoneType: string,
): zoneType is DeviceOrZoneData['zoneType'] => deviceOrZoneTypes.has(zoneType)

interface NonNegativeIntOptions {
  readonly field?: string | undefined
  readonly max?: number
}

const fieldPrefix = (field?: string): string =>
  field === undefined || field === '' ? '' : `${field}: `

/**
 * Parses `value` as a non-negative finite integer (0 included).
 * @param value - The candidate to coerce, accepted as a number or numeric string.
 * @param root0 - Parsing constraints.
 * @param root0.field - Field name prepended to error messages so callers can locate the invalid input.
 * @param root0.max - Inclusive upper bound above which the parsed value is rejected.
 * @returns The parsed integer, guaranteed non-negative and within `max`.
 * @throws {@link TypeError} when `value` is neither a number nor a string.
 * @throws {@link RangeError} when the parsed number is negative, unsafe, fractional, or exceeds `max`.
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
  // `Number('')` (and whitespace) is 0 — a JS coercion wart, not an
  // integer representation; reject it before the numeric checks.
  const parsed =
    typeof value === 'string' && value.trim() === ''
      ? Number.NaN
      : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
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
 * Splits a `${model}_${id}` zone option value — as carried by every flat
 * picker item — into validated coordinates. The model is a single word and
 * the id numeric, so the first underscore separates them; the type is then
 * guarded exactly like a request path param.
 * @param value - The `${model}_${id}` option value emitted by a flat picker item.
 * @returns The decoded coordinates narrowed to `DeviceOrZoneData`.
 * @throws {@link RangeError} when the type is neither a known zone collection nor `devices`.
 */
export const toZoneValueData = (value: string): DeviceOrZoneData => {
  const separator = value.indexOf('_')
  const zoneType = value.slice(0, separator)
  if (!isDeviceOrZoneType(zoneType)) {
    throw new RangeError(`Invalid zone type: ${zoneType}`)
  }
  return { zoneId: value.slice(separator + 1), zoneType }
}
