import { describe, expect, expectTypeOf, it } from 'vitest'

import appConfig from '../../.homeycompose/app.json' with { type: 'json' }
import api from '../../api.mts'
import ataGroupSettingApi from '../../widgets/ata-group-setting/api.mts'
import ataGroupSettingConfig from '../../widgets/ata-group-setting/widget.compose.json' with { type: 'json' }
import chartsApi from '../../widgets/charts/api.mts'
import chartsConfig from '../../widgets/charts/widget.compose.json' with { type: 'json' }

const sortedKeys = (object: object): string[] =>
  Object.keys(object).toSorted((left, right) => left.localeCompare(right))

// One equality per surface pins the ids ↔ handlers mapping in both
// directions at once: a handler with no declaration and a declaration
// with no handler both break it, and the diff names the offender. A
// per-id existence sweep alongside it could only ever fail together
// with the equality, so it is not kept.
describe('api contract', () => {
  describe('app API', () => {
    // The compile-time half of the contract, asserted on the whole
    // union at once: no per-name method reference ever leaves its
    // object (unbound-method).
    it('should expose only function handlers', () => {
      expectTypeOf<(typeof api)[keyof typeof api]>().toBeFunction()
    })

    it('should declare exactly the handlers app.json names', () => {
      expect(sortedKeys(api)).toStrictEqual(sortedKeys(appConfig.api))
    })
  })

  describe('ata-group-setting widget API', () => {
    it('should expose only function handlers', () => {
      expectTypeOf<
        (typeof ataGroupSettingApi)[keyof typeof ataGroupSettingApi]
      >().toBeFunction()
    })

    it('should declare exactly the handlers widget.compose.json names', () => {
      expect(sortedKeys(ataGroupSettingApi)).toStrictEqual(
        sortedKeys(ataGroupSettingConfig.api),
      )
    })
  })

  describe('charts widget API', () => {
    it('should expose only function handlers', () => {
      expectTypeOf<(typeof chartsApi)[keyof typeof chartsApi]>().toBeFunction()
    })

    it('should declare exactly the handlers widget.compose.json names', () => {
      expect(sortedKeys(chartsApi)).toStrictEqual(sortedKeys(chartsConfig.api))
    })
  })
})
