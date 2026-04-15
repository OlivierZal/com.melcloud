import { vi } from 'vitest'

export const createMockDeviceClass = (
  overrides?: Record<string, unknown>,
): new () => Record<string, unknown> => {
  class MockDevice {
    public addCapability = vi.fn()

    public driver = {}

    public error = vi.fn()

    public getCapabilities = vi.fn().mockReturnValue([])

    public getCapabilityOptions = vi.fn()

    public getCapabilityValue = vi.fn()

    public getData = vi.fn().mockReturnValue({ id: 1 })

    public getSetting = vi.fn()

    public getSettings = vi.fn().mockReturnValue({})

    public hasCapability = vi.fn().mockReturnValue(true)

    public homey = {
      __: vi.fn(),
      api: { realtime: vi.fn() },
      app: { getClassicFacade: vi.fn() },
      clearInterval: vi.fn(),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(),
      setTimeout: vi.fn(),
    }

    public log = vi.fn()

    public registerMultipleCapabilityListener = vi.fn()

    public removeCapability = vi.fn()

    public setCapabilityOptions = vi.fn()

    public setCapabilityValue = vi.fn()

    public setSettings = vi.fn()

    public setWarning = vi.fn()

    public triggerCapabilityListener = vi.fn()

    public constructor() {
      if (overrides) {
        Object.assign(this, overrides)
      }
    }
  }
  return MockDevice as unknown as new () => Record<string, unknown>
}
