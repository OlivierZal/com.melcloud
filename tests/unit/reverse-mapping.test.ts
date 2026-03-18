import { describe, expect, it } from 'vitest'

import { keyOfValue } from '../../lib/reverse-mapping.mts'

const testEnum = {
  bar: 2,
  baz: 3,
  foo: 1,
} as const

describe(keyOfValue, () => {
  it('should return the key for a given value', () => {
    expect(keyOfValue(testEnum, testEnum.foo)).toBe('foo')
    expect(keyOfValue(testEnum, testEnum.bar)).toBe('bar')
    expect(keyOfValue(testEnum, testEnum.baz)).toBe('baz')
  })

  it('should throw for an unknown value', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    expect(() => keyOfValue(testEnum, -1 as never)).toThrow('Unknown value:')
  })
})
