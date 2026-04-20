import { expect, vi } from 'vitest'

// eslint-disable-next-line func-style -- TS requires function declaration for asserts predicates
export function assertDefined<T>(value: T | undefined): asserts value is T {
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

export { createMockDeviceClass } from './mock-device-class.ts'
export { createMockDriverClass } from './mock-driver-class.ts'
