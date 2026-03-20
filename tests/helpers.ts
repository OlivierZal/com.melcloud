/* eslint-disable
    max-classes-per-file,
    vitest/no-conditional-tests,
    vitest/prefer-each,
*/
import { describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
export const mock = <T>(overrides: Partial<T> = {}): T => overrides as T

const applyOverrides = (
  target: object,
  overrides?: Record<string, unknown>,
): void => {
  if (overrides) {
    Object.assign(target, overrides)
  }
}

export const createMockDeviceClass = (
  overrides?: Record<string, unknown>,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): new () => any => {
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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      __: vi.fn(),
      api: { realtime: vi.fn() },
      app: { getFacade: vi.fn() },
      clearInterval: vi.fn(),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(),
      setTimeout: vi.fn(),
    }

    public log = vi.fn()

    public registerMultipleCapabilityListener = vi.fn()

    public setCapabilityOptions = vi.fn()

    public setCapabilityValue = vi.fn()

    public setSettings = vi.fn()

    public triggerCapabilityListener = vi.fn()

    public constructor() {
      applyOverrides(this, overrides)
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public async removeCapability(): Promise<void> {
      await Promise.resolve()
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public async setWarning(): Promise<void> {
      await Promise.resolve()
    }
  }
  return MockDevice
}

export const createMockDriverClass = (
  overrides?: Record<string, unknown>,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): new () => any => {
  class MockDriver {
    public getDevices = vi.fn().mockReturnValue([])

    public homey = {
      app: {
        api: {
          authenticate: vi.fn(),
          registry: { getDevicesByType: vi.fn().mockReturnValue([]) },
        },
      },
      flow: {
        getActionCard: vi.fn().mockReturnValue({
          registerRunListener: vi.fn(),
        }),
        getConditionCard: vi.fn().mockReturnValue({
          registerRunListener: vi.fn(),
        }),
      },
    }

    public log = vi.fn()

    public manifest = { capabilities: [] }

    public constructor() {
      applyOverrides(this, overrides)
    }
  }
  return MockDriver
}

export const testDriverType = (
  getDriver: () => { type: unknown },
  expectedType: unknown,
): void => {
  describe('type', () => {
    it(`should be ${String(expectedType)}`, () => {
      expect(getDriver().type).toBe(expectedType)
    })
  })
}

export const testTagMappings = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDriver: () => any,
  mappings: Record<string, unknown>,
): void => {
  describe('tag mappings', () => {
    for (const [name, expected] of Object.entries(mappings)) {
      it(`should use the correct ${name}`, () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(getDriver()[name]).toBe(expected)
      })
    }
  })
}

export const testEnergyReportConfig = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDevice: () => any,
  property: string,
  expected: object | null,
): void => {
  describe(property, () => {
    if (expected === null) {
      it('should be null', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(getDevice()[property]).toBeNull()
      })
    } else {
      it('should have correct config', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(getDevice()[property]).toStrictEqual(expected)
      })
    }
  })
}
