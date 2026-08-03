import { describe, expect, it, vi } from 'vitest'

import { fireAndForget } from '../../lib/fire-and-forget.mts'
import { settleDetached } from '../helpers.ts'

describe(fireAndForget, () => {
  it('should keep a resolved promise silent', async () => {
    const logError = vi.fn<(...args: unknown[]) => void>()
    fireAndForget(Promise.resolve('done'), logError, 'Detached work failed:')
    await settleDetached()

    expect(logError).not.toHaveBeenCalled()
  })

  it('should log a rejection with the given message', async () => {
    const failure = new Error('boom')
    const logError = vi.fn<(...args: unknown[]) => void>()
    fireAndForget(Promise.reject(failure), logError, 'Detached work failed:')
    await settleDetached()

    expect(logError).toHaveBeenCalledWith('Detached work failed:', failure)
  })
})
