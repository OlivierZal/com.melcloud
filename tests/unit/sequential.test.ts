import { describe, expect, it, vi } from 'vitest'

import { sequential } from '../../lib/sequential.mts'

describe(sequential, () => {
  it('should run the items strictly one at a time in order', async () => {
    const events: string[] = []
    await sequential(['first', 'second'], async (item) => {
      events.push(`start ${item}`)
      await Promise.resolve()
      events.push(`end ${item}`)
    })

    expect(events).toStrictEqual([
      'start first',
      'end first',
      'start second',
      'end second',
    ])
  })

  it('should resolve without running anything for no items', async () => {
    const run = vi.fn<() => Promise<void>>().mockResolvedValue()
    await sequential([], run)

    expect(run).not.toHaveBeenCalled()
  })
})
