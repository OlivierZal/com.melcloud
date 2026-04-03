import { vi } from 'vitest'

const applyOverrides = (
  target: object,
  overrides?: Record<string, unknown>,
): void => {
  if (overrides) {
    Object.assign(target, overrides)
  }
}

interface MockDriverInstance {
  getDevices: ReturnType<typeof vi.fn>
  homey: Record<string, unknown>
  log: ReturnType<typeof vi.fn>
  manifest: Record<string, unknown>
}

export const createMockDriverClass = (
  overrides?: Record<string, unknown>,
): new () => MockDriverInstance => {
  class MockDriver implements MockDriverInstance {
    public getDevices = vi.fn().mockReturnValue([])

    public homey = {
      app: {
        api: { authenticate: vi.fn() },
        getDevicesByType: vi.fn().mockReturnValue([]),
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
