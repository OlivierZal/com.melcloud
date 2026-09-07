import { describe, expect, it, vi } from 'vitest'

import { settleAll } from '../../lib/settle-all.mts'

describe(settleAll, () => {
  it('should settle every branch and report each rejection on its own', async () => {
    const logger = { error: vi.fn<(...args: unknown[]) => void>() }
    const first = new Error('first down')
    const second = new Error('second down')
    const survivor = vi.fn<() => Promise<void>>().mockResolvedValue()

    await settleAll(
      [Promise.reject(first), survivor(), Promise.reject(second)],
      logger,
      'Work failed:',
    )

    expect(survivor).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenNthCalledWith(1, 'Work failed:', first)
    expect(logger.error).toHaveBeenNthCalledWith(2, 'Work failed:', second)
  })

  it('should stay silent when every branch settles', async () => {
    const logger = { error: vi.fn<(...args: unknown[]) => void>() }

    await settleAll([Promise.resolve(1), Promise.resolve(2)], logger, 'never')

    expect(logger.error).not.toHaveBeenCalled()
  })
})
