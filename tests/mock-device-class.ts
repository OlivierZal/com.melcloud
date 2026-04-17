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
    public addCapability = vi.fn<(capability: string) => Promise<void>>()

    public driver = {}

    public error = vi.fn<(...args: readonly unknown[]) => void>()

    public getCapabilities = vi
      .fn<() => readonly string[]>()
      .mockReturnValue([])

    public getCapabilityOptions =
      vi.fn<(capability: string) => Record<string, unknown>>()

    public getCapabilityValue = vi.fn<(capability: string) => unknown>()

    public getData = vi
      .fn<() => { id: number | string }>()
      .mockReturnValue({ id: 1 })

    public getSetting = vi.fn<(key: string) => unknown>()

    public getSettings = vi
      .fn<() => Record<string, unknown>>()
      .mockReturnValue({})

    public hasCapability = vi
      .fn<(capability: string) => boolean>()
      .mockReturnValue(true)

    public homey = {
      __: vi.fn<(key: string) => string>(),
      api: { realtime: vi.fn<(event: string, data: unknown) => void>() },
      app: { getClassicFacade: vi.fn<(kind: string, id: number) => unknown>() },
      clearInterval: vi.fn<(timer: NodeJS.Timeout | undefined) => void>(),
      clearTimeout: vi.fn<(timer: NodeJS.Timeout | null) => void>(),
      setInterval:
        vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
      setTimeout: vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
    }

    public log = vi.fn<(...args: readonly unknown[]) => void>()

    public registerMultipleCapabilityListener =
      vi.fn<
        (
          capabilities: readonly string[],
          listener: (values: Record<string, unknown>) => Promise<void>,
          delay?: number,
        ) => void
      >()

    public removeCapability = vi.fn<(capability: string) => Promise<void>>()

    public setCapabilityOptions =
      vi.fn<
        (capability: string, options: Record<string, unknown>) => Promise<void>
      >()

    public setCapabilityValue =
      vi.fn<(capability: string, value: unknown) => Promise<void>>()

    public setSettings =
      vi.fn<(settings: Record<string, unknown>) => Promise<void>>()

    public setWarning = vi.fn<(message: unknown) => Promise<void>>()

    public triggerCapabilityListener =
      vi.fn<(capability: string, value: unknown) => Promise<void>>()

    public constructor() {
      if (overrides) {
        Object.assign(this, overrides)
      }
      if (superMocks) {
        // Strip shadowing instance props so the prototype super-delegates win
        const instance = this as Record<string, unknown>
        for (const methodName of Object.keys(superMocks)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- methodName is a known key from superMocks; dynamic delete required to shadow instance vi.fn() props with prototype super-delegates
          delete instance[methodName]
        }
      }
    }
  }

  if (superMocks) {
    for (const [methodName, mockFunction] of Object.entries(superMocks)) {
      Object.defineProperty(MockDevice.prototype, methodName, {
        configurable: true,
        writable: true,
        async value(...args: readonly unknown[]): Promise<void> {
          mockFunction(...args)
          await Promise.resolve()
        },
      })
    }
  }

  return MockDevice as unknown as new () => Record<string, unknown>
}
