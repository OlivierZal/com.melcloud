import { describe, expect, it } from 'vitest'

import { createDirtyGate } from '../../public/dirty-gate.mts'

// The gate is headless: buttons only need a `disabled` slot, and wired
// targets only need to dispatch events, so plain doubles are enough.
const setup = (): {
  applyElement: HTMLButtonElement
  form: { value: string }
  gate: ReturnType<typeof createDirtyGate>
  refreshElement: HTMLButtonElement
} => {
  const applyElement = { disabled: false } as unknown as HTMLButtonElement
  const refreshElement = { disabled: false } as unknown as HTMLButtonElement
  const form = { value: 'pristine' }
  const gate = createDirtyGate({
    applyElement,
    refreshElements: [refreshElement],
    serialize: () => form.value,
  })
  return { applyElement, form, gate, refreshElement }
}

describe('dirty gate', () => {
  it('should start pristine with Apply greyed and Refresh live', () => {
    const { applyElement, refreshElement } = setup()

    expect(applyElement.disabled).toBe(true)
    expect(refreshElement.disabled).toBe(false)
  })

  it('should enable Apply when the form diverges and grey it once saved', () => {
    const { applyElement, form, gate } = setup()

    form.value = 'edited'
    gate.recompute()

    expect(applyElement.disabled).toBe(false)

    gate.markSaved()

    expect(applyElement.disabled).toBe(true)
  })

  it('should recompute on change and input events from wired targets', () => {
    const { applyElement, form, gate } = setup()
    const target = new EventTarget()
    gate.wire([target])

    form.value = 'edited'
    target.dispatchEvent(new Event('change'))

    expect(applyElement.disabled).toBe(false)

    form.value = 'pristine'
    target.dispatchEvent(new Event('input'))

    expect(applyElement.disabled).toBe(true)
  })

  it('should grey both buttons while busy and restore them after', () => {
    const { applyElement, form, gate, refreshElement } = setup()

    form.value = 'edited'
    gate.setBusy(true)

    expect(applyElement.disabled).toBe(true)
    expect(refreshElement.disabled).toBe(true)

    gate.setBusy(false)

    expect(applyElement.disabled).toBe(false)
    expect(refreshElement.disabled).toBe(false)
  })

  it('should release the buttons when the action rejects and keep the edit dirty', async () => {
    const { applyElement, form, gate, refreshElement } = setup()

    form.value = 'edited'

    await expect(
      gate.runBusy(async () => {
        await Promise.reject(new Error('boom'))
      }),
    ).rejects.toThrow('boom')

    expect(applyElement.disabled).toBe(false)
    expect(refreshElement.disabled).toBe(false)
  })

  it('should let only the latest claim release the busy state', async () => {
    const { gate, refreshElement } = setup()
    const firstClaim = Promise.withResolvers<null>()
    const secondClaim = Promise.withResolvers<null>()
    const first = gate.runBusy(async () => {
      await firstClaim.promise
    })
    const second = gate.runBusy(async () => {
      await secondClaim.promise
    })

    firstClaim.resolve(null)
    await first

    expect(refreshElement.disabled).toBe(true)

    secondClaim.resolve(null)
    await second

    expect(refreshElement.disabled).toBe(false)
  })
})
