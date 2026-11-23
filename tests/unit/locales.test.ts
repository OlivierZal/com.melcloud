import { findLocaleDrift } from '@olivierzal/homey-kit/testing'
import { describe, expect, it } from 'vitest'

// The Homey CLI generates `locales/<language>.json` by merging
// `.homeycompose/locales/<language>.json` into the file it finds, and
// never removes a text: one written in the generated file alone
// survives every build until that file is generated afresh, and one its
// source dropped keeps shipping. The comparison is the kit's.
describe('locales', () => {
  it('should generate exactly what their sources declare', async () => {
    await expect(findLocaleDrift('.')).resolves.toStrictEqual([])
  })
})
