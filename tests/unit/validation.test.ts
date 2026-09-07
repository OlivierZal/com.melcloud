import { describe, expect, it } from 'vitest'

import { toNonNegativeInt, toZoneValueData } from '../../lib/validation.mts'

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
    [Infinity, /non-negative integer/v],
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

describe(toZoneValueData, () => {
  // Every zone collection plus `devices`: frost protection and holiday
  // mode also target a single device.
  it.each([
    ['areas_100', { zoneId: '100', zoneType: 'areas' }],
    ['buildings_1', { zoneId: '1', zoneType: 'buildings' }],
    ['devices_2001', { zoneId: '2001', zoneType: 'devices' }],
    ['floors_10', { zoneId: '10', zoneType: 'floors' }],
  ] as const)('splits %p into coordinates', (value, expected) => {
    expect(toZoneValueData(value)).toStrictEqual(expected)
  })

  // The model indexes the zone registry later, so anything outside the
  // known collections — a prototype key, an empty model, another
  // dialect's model — is refused here.
  it.each(['constructor_1', '_1', 'homeDevices_abc'])(
    'rejects %p, whose model is not a zone collection',
    (value) => {
      expect(() => toZoneValueData(value)).toThrow(/Invalid zone type/v)
    },
  )
})
