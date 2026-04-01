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
    for (const [name, expected] of Object.entries(mappings)) {
      it(`should use the correct ${name}`, () => {
        expect((getDriver() as Record<string, unknown>)[name]).toBe(expected)
      })
    }
  })
}

export const testEnergyReportConfig = (
  getDevice: () => object,
  property: string,
  expected: object | null,
): void => {
  describe(property, () => {
    if (expected === null) {
      it('should be null', () => {
        expect((getDevice() as Record<string, unknown>)[property]).toBeNull()
      })
    } else {
      it('should have correct config', () => {
        expect(
          (getDevice() as Record<string, unknown>)[property],
        ).toStrictEqual(expected)
      })
    }
  })
}
