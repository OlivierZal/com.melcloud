import { describe, expect, it } from 'vitest'

import type { DeviceOrZoneData, ZoneData } from '../../types/zone.mts'
import {
  toDeviceOrZoneData,
  toHour,
  toNonNegativeInt,
  toZoneData,
} from '../../lib/validation.mts'

describe(toNonNegativeInt, () => {
  it.each([
    [0, 0],
    [23, 23],
    ['7', 7],
    ['0', 0],
  ])('accepts %s and returns %d', (input, expected) => {
    expect(toNonNegativeInt(input)).toBe(expected)
  })

  it('enforces the optional max', () => {
    expect(toNonNegativeInt(10, { max: 10 })).toBe(10)
    expect(() => toNonNegativeInt(11, { field: 'days', max: 10 })).toThrow(
      /days: expected value ≤ 10/v,
    )
  })

  it.each([
    ['abc', /non-negative integer/v],
    [-1, /non-negative integer/v],
    [1.5, /non-negative integer/v],
    [Number.NaN, /non-negative integer/v],
    [Number.POSITIVE_INFINITY, /non-negative integer/v],
  ])('rejects %p', (input, pattern) => {
    expect(() => toNonNegativeInt(input)).toThrow(pattern)
  })

  it('rejects non-numeric types', () => {
    expect(() => toNonNegativeInt(null)).toThrow(
      /expected number or numeric string/v,
    )
    expect(() => toNonNegativeInt({ field: 'x' })).toThrow(
      /expected number or numeric string/v,
    )
  })

  it('includes the field name in error messages when provided', () => {
    expect(() => toNonNegativeInt('bad', { field: 'days' })).toThrow(/^days: /v)
  })
})

describe(toHour, () => {
  it.each([0, 12, 23])('accepts %d', (input) => {
    expect(toHour(input)).toBe(input)
  })

  it('accepts numeric strings', () => {
    expect(toHour('5')).toBe(5)
  })

  it.each([24, -1, 1.5, 'abc'])('rejects %p', (input) => {
    expect(() => toHour(input, 'hour')).toThrow(/^hour: /v)
  })
})

describe(toZoneData, () => {
  it.each(['areas', 'buildings', 'floors'] as const)(
    'accepts %s',
    (zoneType) => {
      expect(toZoneData({ zoneId: '1', zoneType })).toStrictEqual({
        zoneId: '1',
        zoneType,
      })
    },
  )

  it.each(['devices', 'constructor', ''])(
    'rejects %p coming from the URL',
    (zoneType) => {
      expect(() =>
        toZoneData({
          zoneId: '1',
          zoneType: zoneType as ZoneData['zoneType'],
        }),
      ).toThrow(/Invalid zone type/v)
    },
  )
})

describe(toDeviceOrZoneData, () => {
  it.each(['areas', 'buildings', 'devices', 'floors'] as const)(
    'accepts %s (frost protection and holiday mode also target devices)',
    (zoneType) => {
      expect(toDeviceOrZoneData({ zoneId: '1', zoneType })).toStrictEqual({
        zoneId: '1',
        zoneType,
      })
    },
  )

  it.each(['constructor', ''])('rejects %p coming from the URL', (zoneType) => {
    expect(() =>
      toDeviceOrZoneData({
        zoneId: '1',
        zoneType: zoneType as DeviceOrZoneData['zoneType'],
      }),
    ).toThrow(/Invalid zone type/v)
  })
})
