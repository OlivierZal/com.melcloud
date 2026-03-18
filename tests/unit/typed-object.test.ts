import { describe, expect, it } from 'vitest'

import {
  typedEntries,
  typedFromEntries,
  typedKeys,
} from '../../lib/typed-object.mts'

describe('typed-object', () => {
  const testObject = { bar: 2, foo: 1 }

  describe(typedEntries, () => {
    it('should return typed entries', () => {
      const entries = typedEntries(testObject)

      expect(entries).toStrictEqual([
        ['bar', 2],
        ['foo', 1],
      ])
    })
  })

  describe(typedFromEntries, () => {
    it('should return a typed record from entries', () => {
      const result = typedFromEntries([
        ['bar', 2],
        ['foo', 1],
      ])

      expect(result).toStrictEqual(testObject)
    })
  })

  describe(typedKeys, () => {
    it('should return typed keys', () => {
      const keys = typedKeys(testObject)

      expect(keys).toStrictEqual(['bar', 'foo'])
    })
  })
})
