import { describe, expect, it } from 'vitest'

import { createDirtyGate } from '../../public/dirty-gate.mts'
import { mock } from '../helpers.ts'

// The gate is headless: buttons only need a `disabled` slot, fieldsets a
// `disabled` slot plus an attribute sink, and wired targets only need to
// dispatch events, so plain doubles are enough.
const setup = (): {
  applyElement: HTMLButtonElement
  attributes: Map<string, string>
  fieldsetElement: HTMLFieldSetElement
  form: { value: string }
  gate: ReturnType<typeof createDirtyGate>
  refreshElement: HTMLButtonElement
} => {
  const applyElement = mock<HTMLButtonElement>({ disabled: false })
  const refreshElement = mock<HTMLButtonElement>({ disabled: false })
  const attributes = new Map<string, string>()
  const fieldsetElement = mock<HTMLFieldSetElement>({
    disabled: false,
    setAttribute: (name: string, value: string): void => {
      attributes.set(name, value)
    },
  })
  const form = { value: 'pristine' }
  const gate = createDirtyGate({
    applyElement,
    fieldsetElements: [fieldsetElement],
    refreshElements: [refreshElement],
    serialize: () => form.value,
  })
  return {
    applyElement,
    attributes,
    fieldsetElement,
    form,
    gate,
    refreshElement,
  }
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

  it('should freeze the fieldsets while busy and thaw them after', () => {
    const { attributes, fieldsetElement, gate } = setup()

    gate.setBusy(true)

    expect(fieldsetElement.disabled).toBe(true)
    expect(attributes.get('aria-busy')).toBe('true')

    gate.setBusy(false)

    expect(fieldsetElement.disabled).toBe(false)
    expect(attributes.get('aria-busy')).toBe('false')
  })

  it('should release the buttons and fieldsets when the action rejects and keep the edit dirty', async () => {
    const { applyElement, fieldsetElement, form, gate, refreshElement } =
      setup()

    form.value = 'edited'

    await expect(
      gate.runBusy(async () => {
        await Promise.reject(new Error('boom'))
      }),
    ).rejects.toThrow('boom')

    expect(applyElement.disabled).toBe(false)
    expect(fieldsetElement.disabled).toBe(false)
    expect(refreshElement.disabled).toBe(false)
  })

  it('should let only the latest claim release the busy state', async () => {
    const { fieldsetElement, gate, refreshElement } = setup()
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

    expect(fieldsetElement.disabled).toBe(true)
    expect(refreshElement.disabled).toBe(true)

    secondClaim.resolve(null)
    await second

    expect(fieldsetElement.disabled).toBe(false)
    expect(refreshElement.disabled).toBe(false)
  })
})
