import { err, ok } from '@olivierzal/melcloud-api'
import { describe, expect, it } from 'vitest'

import { failureCause, unwrapResult } from '../../lib/unwrap-result.mts'
import { createTransportFailure } from '../transport-failure.ts'

// The SDK's descriptor is a plain object a cause chain would spell as
// "a thrown object": a failure line names the error it classified
// instead, and the descriptor itself only when the SDK classified none.
describe(failureCause, () => {
  it('should answer the error the SDK classified when the descriptor carries one', () => {
    const cause = createTransportFailure()

    expect(failureCause({ cause, kind: 'network' })).toBe(cause)
  })

  it('should answer the descriptor when the SDK classified no error', () => {
    const error = { kind: 'rate-limited' as const, retryAfterMs: null }

    expect(failureCause(error)).toBe(error)
  })

  it('should answer the descriptor when the classified error is undefined', () => {
    const error = { cause: undefined, kind: 'network' as const }

    expect(failureCause(error)).toBe(error)
  })
})

describe(unwrapResult, () => {
  it('should return the value when result is ok', () => {
    expect(unwrapResult(ok(42))).toBe(42)
  })

  it('should throw with the kind in the message and the classified error as cause', () => {
    const cause = createTransportFailure()

    expect(() => unwrapResult(err({ cause, kind: 'network' }))).toThrow(
      expect.objectContaining({
        cause,
        message: 'MELCloud request failed: network',
      }),
    )
  })
})
