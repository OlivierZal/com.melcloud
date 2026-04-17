import { describe, expect, it } from 'vitest'

import { toHourNumbers, toPositiveInt } from '../../lib/validation.mts'

describe(toPositiveInt, () => {
  it.each([
    [0, 0],
    [23, 23],
    ['7', 7],
    ['0', 0],
  ])('accepts %s and returns %d', (input, expected) => {
    expect(toPositiveInt(input)).toBe(expected)
  })

  it('enforces the optional max', () => {
    expect(toPositiveInt(10, { max: 10 })).toBe(10)
    expect(() => toPositiveInt(11, { field: 'days', max: 10 })).toThrow(
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
    expect(() => toPositiveInt(input)).toThrow(pattern)
  })

  it('rejects non-numeric types', () => {
    expect(() => toPositiveInt(null)).toThrow(
      /expected number or numeric string/u,
    )
    expect(() => toPositiveInt({ field: 'x' })).toThrow(
      /expected number or numeric string/u,
    )
  })

  it('includes the field name in error messages when provided', () => {
    expect(() => toPositiveInt('bad', { field: 'days' })).toThrow(/^days: /u)
  })
})

describe(toHourNumbers, () => {
  it.each([0, 12, 23])('accepts %d', (input) => {
    expect(toHourNumbers(input)).toBe(input)
  })

  it('accepts numeric strings', () => {
    expect(toHourNumbers('5')).toBe(5)
  })

  it.each([24, -1, 1.5, 'abc'])('rejects %p', (input) => {
    expect(() => toHourNumbers(input, 'hour')).toThrow(/^hour: /u)
  })
})
