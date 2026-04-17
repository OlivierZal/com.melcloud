import { vi } from 'vitest'

/*
 * Options for createMockDeviceClass.
 * - `overrides`: instance-level props assigned in the constructor (shallow merge).
 * - `superMocks`: prototype-level async methods that delegate to the provided vi.fn.
 *   Required when BaseMELCloudDevice calls super.X() (e.g. addCapability,
 *   removeCapability, setWarning) — instance vi.fn properties can't be invoked
 *   through super in a subclass.
 */
export interface MockDeviceClassOptions {
  readonly overrides?: Readonly<Record<string, unknown>>
  readonly superMocks?: Readonly<
    Record<string, (...args: readonly unknown[]) => unknown>
  >
}

export const createMockDeviceClass = (
  options: MockDeviceClassOptions = {},
): new () => Record<string, unknown> => {
  const { overrides, superMocks } = options

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
      if (superMocks) {
        // Delete shadowing instance props so prototype super-delegates win
        for (const methodName of Object.keys(superMocks)) {
          delete (this as Record<string, unknown>)[methodName]
        }
      }
    }
  }

  if (superMocks) {
    for (const [methodName, mockFn] of Object.entries(superMocks)) {
      Object.defineProperty(MockDevice.prototype, methodName, {
        configurable: true,
        value: async function superDelegate(
          ...args: readonly unknown[]
        ): Promise<void> {
          mockFn(...args)
          await Promise.resolve()
        },
        writable: true,
      })
    }
  }

  return MockDevice as unknown as new () => Record<string, unknown>
}
