/* eslint-disable
    vitest/no-conditional-tests,
    vitest/prefer-each,
*/
import { describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line func-style -- TS requires function declaration for asserts predicates
export function assertDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined()
}

export const mock = <T>(overrides: Partial<Record<keyof T, unknown>> = {}): T =>
  overrides as T

export const createEnergyReportMock = (): {
  EnergyReport: ReturnType<typeof vi.fn>
} => ({
  EnergyReport: vi.fn().mockImplementation(() => ({
    handle: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn(),
  })),
})

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

    public async removeCapability(): Promise<void> {
      await Promise.resolve()
    }

    public async setWarning(): Promise<void> {
      await Promise.resolve()
    }
  }
  return MockDevice
}

export const createMockDriverClass = (
  overrides?: Record<string, unknown>,
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
  getDriver: () => any,
  mappings: Record<string, unknown>,
): void => {
  describe('tag mappings', () => {
    for (const [name, expected] of Object.entries(mappings)) {
      it(`should use the correct ${name}`, () => {
        expect(getDriver()[name]).toBe(expected)
      })
    }
  })
}

export const testEnergyReportConfig = (
  getDevice: () => any,
  property: string,
  expected: object | null,
): void => {
  describe(property, () => {
    if (expected === null) {
      it('should be null', () => {
        expect(getDevice()[property]).toBeNull()
      })
    } else {
      it('should have correct config', () => {
        expect(getDevice()[property]).toStrictEqual(expected)
      })
    }
  })
}
