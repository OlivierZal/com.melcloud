import { describe, expect, it } from 'vitest'

import { toHour, toNonNegativeInt } from '../../lib/validation.mts'

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
      /days: expected value ≤ 10/u,
    )
  })

  it.each([
    ['abc', /non-negative integer/u],
    [-1, /non-negative integer/u],
    [1.5, /non-negative integer/u],
    [Number.NaN, /non-negative integer/u],
    [Number.POSITIVE_INFINITY, /non-negative integer/u],
  ])('rejects %p', (input, pattern) => {
    expect(() => toNonNegativeInt(input)).toThrow(pattern)
  })

  it('rejects non-numeric types', () => {
    expect(() => toNonNegativeInt(null)).toThrow(
      /expected number or numeric string/u,
    )
    expect(() => toNonNegativeInt({ field: 'x' })).toThrow(
      /expected number or numeric string/u,
    )
  })

  it('includes the field name in error messages when provided', () => {
    expect(() => toNonNegativeInt('bad', { field: 'days' })).toThrow(/^days: /u)
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
    expect(() => toHour(input, 'hour')).toThrow(/^hour: /u)
  })
})
