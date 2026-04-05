import { describe, expect, expectTypeOf, it } from 'vitest'

import appConfig from '../../.homeycompose/app.json' with { type: 'json' }
import api from '../../api.mts'
import ataGroupSettingApi from '../../widgets/ata-group-setting/api.mts'
import ataGroupSettingConfig from '../../widgets/ata-group-setting/widget.compose.json' with { type: 'json' }
import chartsApi from '../../widgets/charts/api.mts'
import chartsConfig from '../../widgets/charts/widget.compose.json' with { type: 'json' }

const sortedKeys = (object: object): string[] =>
  Object.keys(object).toSorted((left, right) => left.localeCompare(right))

describe('api contract', () => {
  describe('app API', () => {
    it.each(Object.keys(appConfig.api))(
      '%s handler exists in api.mts',
      (name) => {
        expect(api).toHaveProperty(name)

        expectTypeOf(api[name as keyof typeof api]).toBeFunction()
      },
    )

    it('should not have handlers missing from app.json', () => {
      expect(sortedKeys(api)).toStrictEqual(sortedKeys(appConfig.api))
    })
  })

  describe('ata-group-setting widget API', () => {
    it.each(Object.keys(ataGroupSettingConfig.api))(
      '%s handler exists in api.mts',
      (name) => {
        expect(ataGroupSettingApi).toHaveProperty(name)

        expectTypeOf(
          ataGroupSettingApi[name as keyof typeof ataGroupSettingApi],
        ).toBeFunction()
      },
    )

    it('should not have handlers missing from widget.compose.json', () => {
      expect(sortedKeys(ataGroupSettingApi)).toStrictEqual(
        sortedKeys(ataGroupSettingConfig.api),
      )
    })
  })

  describe('charts widget API', () => {
    it.each(Object.keys(chartsConfig.api))(
      '%s handler exists in api.mts',
      (name) => {
        expect(chartsApi).toHaveProperty(name)

        expectTypeOf(chartsApi[name as keyof typeof chartsApi]).toBeFunction()
      },
    )

    it('should not have handlers missing from widget.compose.json', () => {
      expect(sortedKeys(chartsApi)).toStrictEqual(sortedKeys(chartsConfig.api))
    })
  })
})
