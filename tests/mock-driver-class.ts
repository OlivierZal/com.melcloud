import { vi } from 'vitest'

const applyOverrides = (
  target: object,
  overrides?: Record<string, unknown>,
): void => {
  if (overrides) {
    Object.assign(target, overrides)
  }
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
