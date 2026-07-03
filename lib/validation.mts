import type { Hour } from '@olivierzal/melcloud-api'

import type { DeviceOrZoneData, ZoneData } from '../types/zone.mts'

const HOUR_MIN = 0
const HOUR_MAX = 23

const zoneTypes = new Set<ZoneData['zoneType']>([
  'areas',
  'buildings',
  'floors',
])

const deviceOrZoneTypes = new Set<DeviceOrZoneData['zoneType']>([
  ...zoneTypes,
  'devices',
])

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
 * Parses `value` as an `Hour` (0-23). Throws on out-of-range or non-integer
 * input.
 */
export const toHour = (value: unknown, field?: string): Hour => {
  const parsed = toNonNegativeInt(value, { field, max: HOUR_MAX })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing a [0..23] integer to the Hour union
  return parsed as Hour
}

/**
 * Validates URL path params as `ZoneData`. `zoneType` comes straight from the
 * request path and is later used to index the zone registry, so reject
 * anything outside the known zone collections.
 */
export const toZoneData = ({ zoneId, zoneType }: ZoneData): ZoneData => {
  if (!zoneTypes.has(zoneType)) {
    throw new RangeError(`Invalid zone type: ${zoneType}`)
  }
  return { zoneId, zoneType }
}

/**
 * Same guard for endpoints that also accept a single device (frost
 * protection and holiday mode — the settings page lists devices in its
 * zone selector).
 */
export const toDeviceOrZoneData = ({
  zoneId,
  zoneType,
}: DeviceOrZoneData): DeviceOrZoneData => {
  if (!deviceOrZoneTypes.has(zoneType)) {
    throw new RangeError(`Invalid zone type: ${zoneType}`)
  }
  return { zoneId, zoneType }
}

export { HOUR_MAX, HOUR_MIN }
