import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  generateStyleNumber,
  generateStyleString,
} from '../../widgets/ata-group-setting/public/style-helpers.mts'
import { stubRandomUint32, UINT32_RANGE } from '../random.ts'

describe('style helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should span min to min plus gap with the default factors', () => {
    stubRandomUint32(0)

    expect(generateStyleNumber({ gap: 4, min: 3 })).toBe(3)

    stubRandomUint32(UINT32_RANGE / 2)

    expect(generateStyleNumber({ gap: 4, min: 3 })).toBe(5)
  })

  it('should apply multiplier and divisor', () => {
    stubRandomUint32(0)

    expect(
      generateStyleNumber({ divisor: 2, gap: 1, min: 3, multiplier: 1000 }),
    ).toBe(1500)
  })

  it('should treat a zero divisor as one', () => {
    stubRandomUint32(0)

    expect(generateStyleNumber({ divisor: 0, gap: 1, min: 3 })).toBe(3)
  })

  it('should append the unit to the stringified value', () => {
    stubRandomUint32(0)

    expect(generateStyleString({ gap: 1, min: 2 }, 'rem')).toBe('2rem')
    expect(generateStyleString({ gap: 1, min: 2 })).toBe('2')
  })
})
