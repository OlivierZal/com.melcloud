import { describe, expect, it, vi } from 'vitest'

import { fireAndForget } from '../../lib/fire-and-forget.mts'
import { settleDetached } from '../helpers.ts'

const createLogger = (): {
  error: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>
  log: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>
} => ({
  error: vi.fn<(...args: unknown[]) => void>(),
  log: vi.fn<(...args: unknown[]) => void>(),
})

describe(fireAndForget, () => {
  it('should keep a resolved promise silent', async () => {
    const logger = createLogger()
    fireAndForget(Promise.resolve('done'), logger, 'Detached work failed:')
    await settleDetached()

    expect(logger.error).not.toHaveBeenCalled()
  })

  it('should log a rejection with the given message', async () => {
    const failure = new Error('boom')
    const logger = createLogger()
    fireAndForget(Promise.reject(failure), logger, 'Detached work failed:')
    await settleDetached()

    expect(logger.error).toHaveBeenCalledWith('Detached work failed:', failure)
  })
})
