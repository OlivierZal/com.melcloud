import { describe, expect, it } from 'vitest'

import { sortKeysDeep } from '../../scripts/sort-keys-deep.mts'

describe(sortKeysDeep, () => {
  it('should sort object keys depth-first', () => {
    const sorted = sortKeysDeep({ area: 3, zone: { getable: 2, max: 1 } })

    expect(sorted).toStrictEqual({ area: 3, zone: { getable: 2, max: 1 } })
    expect(Object.keys(sorted as object)).toStrictEqual(['area', 'zone'])
  })

  it('should keep array order and sort the entries inside', () => {
    expect(sortKeysDeep([{ area: 2, zone: 1 }, 'zulu', 'alpha'])).toStrictEqual(
      [{ area: 2, zone: 1 }, 'zulu', 'alpha'],
    )
  })

  it('should pass primitives and null through untouched', () => {
    expect([
      sortKeysDeep('text'),
      sortKeysDeep(7),
      sortKeysDeep(true),
      sortKeysDeep(null),
    ]).toStrictEqual(['text', 7, true, null])
  })
})
