import { describe, expect, it } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import {
  toClassicAtaGroupState,
  toHomeAtaValues,
  toNonSilentFanSpeed,
} from '../../lib/home-ata-group.mts'

describe('home ata group mapping', () => {
  describe(toNonSilentFanSpeed, () => {
    it('should degrade silent to auto', () => {
      expect(toNonSilentFanSpeed(Classic.FanSpeed.silent)).toBe(
        Classic.FanSpeed.auto,
      )
    })

    it('should pass any other speed through', () => {
      expect(toNonSilentFanSpeed(Classic.FanSpeed.very_fast)).toBe(
        Classic.FanSpeed.very_fast,
      )
    })
  })

  describe(toClassicAtaGroupState, () => {
    it('should project home facade values onto the classic dialect', () => {
      expect(
        toClassicAtaGroupState({
          operationMode: 'Heat',
          power: true,
          setFanSpeed: 'Four',
          setTemperature: 22,
          vaneHorizontalDirection: 'Swing',
          vaneVerticalDirection: 'Auto',
        }),
      ).toStrictEqual({
        FanSpeed: Classic.FanSpeed.fast,
        OperationMode: Classic.OperationMode.heat,
        Power: true,
        SetTemperature: 22,
        VaneHorizontalDirection: Classic.Horizontal.swing,
        VaneVerticalDirection: Classic.Vertical.auto,
      })
    })
  })

  describe(toHomeAtaValues, () => {
    it('should translate every defined key to the home payload', () => {
      expect(
        toHomeAtaValues({
          FanSpeed: Classic.FanSpeed.very_slow,
          OperationMode: Classic.OperationMode.cool,
          Power: false,
          SetTemperature: 19.5,
          VaneHorizontalDirection: Classic.Horizontal.center_left,
          VaneVerticalDirection: Classic.Vertical.downwards,
        }),
      ).toStrictEqual({
        operationMode: 'Cool',
        power: false,
        setFanSpeed: 'One',
        setTemperature: 19.5,
        vaneHorizontalDirection: 'LeftCentre',
        vaneVerticalDirection: 'Five',
      })
    })

    it('should drop absent keys from the delta', () => {
      expect(toHomeAtaValues({})).toStrictEqual({})
    })

    it('should drop null keys from the delta', () => {
      expect(
        toHomeAtaValues({
          FanSpeed: null,
          OperationMode: null,
          Power: true,
          SetTemperature: null,
          VaneHorizontalDirection: null,
          VaneVerticalDirection: null,
        }),
      ).toStrictEqual({ power: true })
    })
  })
})
