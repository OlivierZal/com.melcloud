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
    public getDevices = vi.fn<() => readonly unknown[]>().mockReturnValue([])

    public homey = {
      app: {
        api: { authenticate: vi.fn<(data: unknown) => Promise<boolean>>() },
        getDevicesByType: vi
          .fn<(type: number) => readonly unknown[]>()
          .mockReturnValue([]),
      },
      flow: {
        getActionCard: vi
          .fn<
            (id: string) => {
              registerRunListener: (
                listener: (args: Record<string, unknown>) => unknown,
              ) => void
            }
          >()
          .mockReturnValue({
            registerRunListener:
              vi.fn<
                (listener: (args: Record<string, unknown>) => unknown) => void
              >(),
          }),
        getConditionCard: vi
          .fn<
            (id: string) => {
              registerRunListener: (
                listener: (args: Record<string, unknown>) => unknown,
              ) => void
            }
          >()
          .mockReturnValue({
            registerRunListener:
              vi.fn<
                (listener: (args: Record<string, unknown>) => unknown) => void
              >(),
          }),
      },
    }

    public log = vi.fn<(...args: readonly unknown[]) => void>()

    public manifest = { capabilities: [] }

    public constructor() {
      applyOverrides(this, overrides)
    }
  }
  return MockDriver
}
