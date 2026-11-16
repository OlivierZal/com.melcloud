import { afterEach, describe, expect, it, vi } from 'vitest'

import { randomFraction } from '../../public/random.mts'
import { stubRandomUint32, UINT32_RANGE } from '../random.ts'

describe(randomFraction, () => {
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
})
