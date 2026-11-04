import { describe, expect, it } from 'vitest'

import { toCapabilitiesOptionsNarrowing } from '../../types/manifest.mts'

const values = [
  { id: 'heat', title: { en: 'Heat', fr: 'Chauffer' } },
  { id: 'cool', title: { en: 'Cool' } },
]

describe(toCapabilitiesOptionsNarrowing, () => {
  it('should read the bounds and the values a driver manifest declares', () => {
    expect(
      toCapabilitiesOptionsNarrowing({ max: 31, min: 10, values }),
    ).toStrictEqual({ max: 31, min: 10, values })
  })

  it('should read a partial entry as the fields it declares', () => {
    expect(toCapabilitiesOptionsNarrowing({ max: 31, min: 10 })).toStrictEqual({
      max: 31,
      min: 10,
    })
    expect(toCapabilitiesOptionsNarrowing({ values })).toStrictEqual({ values })
  })

  it.each([undefined, null, 'heat', 31])(
    'should narrow nothing from %s, which is not an entry',
    (entry) => {
      expect(toCapabilitiesOptionsNarrowing(entry)).toStrictEqual({})
    },
  )

  it('should leave a field the schema does not state that way to the definition', () => {
    expect(
      toCapabilitiesOptionsNarrowing({ max: '31', min: null, values: 'heat' }),
    ).toStrictEqual({})
  })

  it.each([
    ['a value that is not an object', [null]],
    ['a value without an id', [{ title: { en: 'Heat' } }]],
    ['a value whose id is not a string', [{ id: 1, title: { en: 'Heat' } }]],
    ['a value without a title', [{ id: 'heat' }]],
    ['a title that is a plain string', [{ id: 'heat', title: 'Heat' }]],
    [
      'a title without an English string',
      [{ id: 'heat', title: { fr: 'Chauffer' } }],
    ],
    [
      'a title holding a non-string',
      [{ id: 'heat', title: { en: 'Heat', fr: 1 } }],
    ],
  ])(
    'should take the values whole or not at all: %s drops the list',
    (_name, list) => {
      expect(
        toCapabilitiesOptionsNarrowing({ values: [...values, ...list] }),
      ).toStrictEqual({})
    },
  )
})
