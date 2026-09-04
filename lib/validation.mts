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
 * Validates a raw `zoneType`/`zoneId` pair (from a request path or a parsed
 * option value), also accepting a single device (frost protection and
 * holiday mode — the settings page lists devices in its zone selector).
 * `zoneType` is later used to index the zone registry, so reject anything
 * outside the known collections.
 * @param root0 - The raw coordinates to validate.
 * @param root0.zoneId - Identifier of the target device or zone.
 * @param root0.zoneType - Collection name, also accepting `devices`, rejected when unknown.
 * @returns The validated pair narrowed to `DeviceOrZoneData`.
 * @throws {@link RangeError} when zoneType is neither a known zone collection nor `devices`.
 */
export const toDeviceOrZoneData = ({
  zoneId,
  zoneType,
}: {
  readonly zoneId: string
  readonly zoneType: string
}): DeviceOrZoneData => {
  if (!isDeviceOrZoneType(zoneType)) {
    throw new RangeError(`Invalid zone type: ${zoneType}`)
  }
  return { zoneId, zoneType }
}

/**
 * Splits a `${model}_${id}` zone option value — as carried by every flat
 * picker item — into validated coordinates. The model is a single word and
 * the id numeric, so the first underscore separates them; the type is then
 * guarded exactly like a request path param.
 * @param value - The `${model}_${id}` option value emitted by a flat picker item.
 * @returns The decoded coordinates narrowed to `DeviceOrZoneData`.
 */
export const toZoneValueData = (value: string): DeviceOrZoneData => {
  const separator = value.indexOf('_')
  return toDeviceOrZoneData({
    zoneId: value.slice(separator + 1),
    zoneType: value.slice(0, separator),
  })
}
