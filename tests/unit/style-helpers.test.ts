import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  generateStyleNumber,
  generateStyleString,
  randomFraction,
} from '../../widgets/ata-group-setting/public/style-helpers.mts'

const UINT32_RANGE = 4_294_967_296

// Pins the CSPRNG output so every derived style value is exact.
const stubRandomUint32 = (value: number): void => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    if (array instanceof Uint32Array) {
      array.fill(value)
    }
    return array
  })
}

describe('style helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should scale the full uint32 range onto [0, 1)', () => {
    stubRandomUint32(0)

    expect(randomFraction()).toBe(0)

    stubRandomUint32(UINT32_RANGE - 1)

    expect(randomFraction()).toBeCloseTo(1, 9)
    expect(randomFraction()).toBeLessThan(1)
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
