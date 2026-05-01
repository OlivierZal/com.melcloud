import { err, ok } from '@olivierzal/melcloud-api'
import { describe, expect, it } from 'vitest'

import { unwrapResult } from '../../lib/unwrap-result.mts'

describe(unwrapResult, () => {
  it('should return the value when result is ok', () => {
    expect(unwrapResult(ok(42))).toBe(42)
  })

  it('should throw with kind in message and original error as cause when result is err', () => {
    const error = { kind: 'network' as const }

    expect(() => unwrapResult(err(error))).toThrow(
      expect.objectContaining({
        cause: error,
        message: 'MELCloud request failed: network',
      }),
    )
  })
})
