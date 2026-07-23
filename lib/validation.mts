import type { Hour } from '@olivierzal/melcloud-api'

import type { DeviceOrZoneData, ZoneData } from '../types/zone.mts'

const HOUR_MAX = 23

const zoneTypes = new Set<string>(['areas', 'buildings', 'floors'])

const deviceOrZoneTypes = new Set<string>([...zoneTypes, 'devices'])

const isZoneType = (zoneType: string): zoneType is ZoneData['zoneType'] =>
  zoneTypes.has(zoneType)

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
  const parsed = Number(value)
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
 * Parses `value` as an `Hour` (0-23). Throws on out-of-range or non-integer
 * input.
 * @param value - The candidate to parse as an hour of the day.
 * @param field - Field name prepended to error messages so callers can locate the invalid input.
 * @returns The parsed hour narrowed to the `Hour` union (0-23).
 */
export const toHour = (value: unknown, field?: string): Hour => {
  const parsed = toNonNegativeInt(value, { field, max: HOUR_MAX })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing a [0..23] integer to the Hour union
  return parsed as Hour
}

/**
 * Validates a raw `zoneType`/`zoneId` pair (from a request path or a parsed
 * option value) as `ZoneData`. `zoneType` is later used to index the zone
 * registry, so reject anything outside the known zone collections.
 * @param root0 - The raw zone coordinates to validate.
 * @param root0.zoneId - Identifier of the target zone within its collection.
 * @param root0.zoneType - Zone collection name, rejected unless it names a known collection.
 * @returns The validated pair narrowed to `ZoneData`.
 * @throws {@link RangeError} when zoneType is not a known zone collection.
 */
export const toZoneData = ({
  zoneId,
  zoneType,
}: {
  readonly zoneId: string
  readonly zoneType: string
}): ZoneData => {
  if (!isZoneType(zoneType)) {
    throw new RangeError(`Invalid zone type: ${zoneType}`)
  }
  return { zoneId, zoneType }
}

/**
 * Same guard for endpoints that also accept a single device (frost
 * protection and holiday mode — the settings page lists devices in its
 * zone selector).
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
