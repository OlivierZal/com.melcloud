/* eslint-disable
    @typescript-eslint/no-explicit-any,
    @typescript-eslint/no-unsafe-member-access,
    vitest/no-conditional-tests,
    vitest/prefer-each,
*/
import { describe, expect, it } from 'vitest'

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
export const mock = <T>(overrides: Partial<T> = {}): T => overrides as T

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
