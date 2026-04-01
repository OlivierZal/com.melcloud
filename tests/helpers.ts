import { describe, expect, it, vi } from 'vitest'

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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime guard: arg is unknown (not T | undefined) so TypeScript sees assertDefined as unnecessary, but the runtime check is needed
  assertDefined(arg)
  return arg as T
}

export const mock = <T>(overrides: Partial<Record<keyof T, unknown>> = {}): T =>
  overrides as T

export const createEnergyReportMock = (): {
  EnergyReport: ReturnType<typeof vi.fn>
} => ({
  EnergyReport: vi.fn().mockImplementation(() => ({
    // eslint-disable-next-line unicorn/no-useless-undefined
    handle: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn(),
  })),
})

export { createMockDeviceClass } from './mock-device-class.ts'
export { createMockDriverClass } from './mock-driver-class.ts'

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
  getDriver: () => object,
  mappings: Record<string, unknown>,
): void => {
  describe('tag mappings', () => {
    it.each(Object.entries(mappings))(
      'should use the correct %s',
      (name, expected) => {
        expect((getDriver() as Record<string, unknown>)[name]).toBe(expected)
      },
    )
  })
}

export const testEnergyReportConfig = (
  getDevice: () => object,
  property: string,
  expected: object | null,
): void => {
  describe(property, () => {
    it('should match expected config', () => {
      expect((getDevice() as Record<string, unknown>)[property]).toStrictEqual(
        expected,
      )
    })
  })
}
