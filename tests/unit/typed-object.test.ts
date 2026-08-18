import { describe, expect, it } from 'vitest'

import {
  invertEnum,
  typedEntries,
  typedFromEntries,
} from '../../lib/typed-object.mts'

describe('typed-object', () => {
  const testObject = { bar: 2, foo: 1 }

  describe(invertEnum, () => {
    it('should map each enum value back to its key', () => {
      expect(invertEnum({ auto: 0, heat: 1 })).toStrictEqual({
        0: 'auto',
        1: 'heat',
      })
    })

    it('should invert string-valued enums too', () => {
      expect(invertEnum({ cool: 'Cool', dry: 'Dry' })).toStrictEqual({
        Cool: 'cool',
        Dry: 'dry',
      })
    })
  })

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
})
