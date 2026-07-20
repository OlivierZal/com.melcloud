import { expect, vi } from 'vitest'

// TS requires an explicit type annotation on the called identifier for
// asserts predicates; an annotated arrow satisfies that.
export const assertDefined: <T>(value: T | undefined) => asserts value is T = (
  value,
) => {
  expect(value).toBeDefined()
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is intentionally used only in the return type to enable callers to specify the expected mock argument type
export const getMockCallArg = <T>(
  mockFunction: { mock: { calls: unknown[][] } },
  callIndex: number,
  argIndex: number,
): T => {
  const arg = mockFunction.mock.calls.at(callIndex)?.at(argIndex)
  assertDefined(arg)
  return arg as T
}

export const mock = <T>(overrides: Partial<Record<keyof T, unknown>> = {}): T =>
  overrides as T

/**
 * Shape served by vitest when a CJS `export =` module (like `homey`) is
 * consumed through ESM default imports: the factory must expose the module
 * under a `default` key its declared type does not have.
 */
export type InteropModule<TModule> = TModule & { default: TModule }

export const createEnergyReportMock = (): {
  EnergyReport: ReturnType<typeof vi.fn>
} => ({
  EnergyReport: vi
    .fn<() => { start: () => Promise<void>; unschedule: () => void }>()
    .mockImplementation(() => ({
      start: vi.fn<() => Promise<void>>().mockResolvedValue(),
      unschedule: vi.fn<() => void>(),
    })),
})

// Drain the microtask chains a detached (fire-and-forget) device init
// leaves behind: one macrotask turn settles them all when the mocks
// resolve synchronously.
export const settleDetached = async (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })

export { createMockDeviceClass } from './mock-device-class.ts'
export { createMockDriverClass } from './mock-driver-class.ts'
