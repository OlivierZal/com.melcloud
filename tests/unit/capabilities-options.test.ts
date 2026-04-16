import type * as Home from '@olivierzal/melcloud-api/home'
import { describe, expect, it } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import {
  fanSpeedValues,
  getCapabilitiesOptionsAtaErv,
  homeGetCapabilitiesOptions,
} from '../../types/ata-erv.mts'
import {
  getCapabilitiesOptions as getCapabilitiesOptionsAtw,
  HotWaterMode,
} from '../../types/classic-atw.mts'
import { mock } from '../helpers.ts'

describe(getCapabilitiesOptionsAtaErv, () => {
  it('should return fan_speed with min 0 when HasAutomaticFanSpeed is true', () => {
    const data = mock<Classic.ListDeviceDataAta>({
      HasAutomaticFanSpeed: true,
      NumberOfFanSpeeds: 5,
    })
    const result = getCapabilitiesOptionsAtaErv(data)

    expect(result).toStrictEqual({
      fan_speed: { max: 5, min: 0, step: 1, units: '' },
    })
  })

  it('should return fan_speed with min 1 when HasAutomaticFanSpeed is false', () => {
    const data = mock<Classic.ListDeviceDataAta>({
      HasAutomaticFanSpeed: false,
      NumberOfFanSpeeds: 3,
    })
    const result = getCapabilitiesOptionsAtaErv(data)

    expect(result).toStrictEqual({
      fan_speed: { max: 3, min: 1, step: 1, units: '' },
    })
  })

  it('should work with ERV device data', () => {
    const data = mock<Classic.ListDeviceDataErv>({
      HasAutomaticFanSpeed: true,
      NumberOfFanSpeeds: 4,
    })
    const result = getCapabilitiesOptionsAtaErv(data)

    expect(result).toStrictEqual({
      fan_speed: { max: 4, min: 0, step: 1, units: '' },
    })
  })
})

describe(homeGetCapabilitiesOptions, () => {
  it('should return fan_speed options from Home device capabilities', () => {
    const capabilities = mock<Home.DeviceCapabilities>({
      hasAutomaticFanSpeed: true,
      numberOfFanSpeeds: 4,
    })
    const result = homeGetCapabilitiesOptions(capabilities)

    expect(result).toStrictEqual({
      fan_speed: { max: 4, min: 0, step: 1, units: '' },
    })
  })

  it('should return min 1 when hasAutomaticFanSpeed is false', () => {
    const capabilities = mock<Home.DeviceCapabilities>({
      hasAutomaticFanSpeed: false,
      numberOfFanSpeeds: 5,
    })
    const result = homeGetCapabilitiesOptions(capabilities)

    expect(result).toStrictEqual({
      fan_speed: { max: 5, min: 1, step: 1, units: '' },
    })
  })
})

describe('fan speed values', () => {
  it('should contain 6 entries', () => {
    expect(fanSpeedValues).toHaveLength(6)
  })

  it('should have the correct ids in order', () => {
    const ids = fanSpeedValues.map(({ id }) => id)

    expect(ids).toStrictEqual([
      'auto',
      'very_fast',
      'fast',
      'moderate',
      'slow',
      'very_slow',
    ])
  })

  it('should have addPrefixToTitle applied to very_fast', () => {
    const veryFast = fanSpeedValues.find(({ id }) => id === 'very_fast')

    expect(veryFast?.title.en).toBe('Very fast')
    expect(veryFast?.title['fr']).toBe('Très rapide')
  })

  it('should have addPrefixToTitle applied to very_slow', () => {
    const verySlow = fanSpeedValues.find(({ id }) => id === 'very_slow')

    expect(verySlow?.title.en).toBe('Very slow')
    expect(verySlow?.title['fr']).toBe('Très lent')
  })
})

describe(getCapabilitiesOptionsAtw, () => {
  it('should include only non-cool values when CanCool is false', () => {
    const data = mock<Classic.ListDeviceDataAtw>({
      CanCool: false,
      HasZone2: false,
    })
    const result = getCapabilitiesOptionsAtw(data)
    const ids = result.thermostat_mode?.values.map(({ id }) => id)

    expect(ids).toStrictEqual(['room', 'flow', 'curve'])
    expect(result).not.toHaveProperty('thermostat_mode.zone2')
  })

  it('should include cool values when CanCool is true', () => {
    const data = mock<Classic.ListDeviceDataAtw>({
      CanCool: true,
      HasZone2: false,
    })
    const result = getCapabilitiesOptionsAtw(data)
    const ids = result.thermostat_mode?.values.map(({ id }) => id)

    expect(ids).toStrictEqual([
      'room',
      'flow',
      'curve',
      'room_cool',
      'flow_cool',
    ])
    expect(result).not.toHaveProperty('thermostat_mode.zone2')
  })

  it('should include zone2 when HasZone2 is true', () => {
    const data = mock<Classic.ListDeviceDataAtw>({
      CanCool: false,
      HasZone2: true,
    })
    const result = getCapabilitiesOptionsAtw(data)

    expect(result['thermostat_mode.zone2']).toBeDefined()
    expect(result['thermostat_mode.zone2']?.title.en).toContain('zone 2')
  })

  it('should include zone2 with cool values when both CanCool and HasZone2 are true', () => {
    const data = mock<Classic.ListDeviceDataAtw>({
      CanCool: true,
      HasZone2: true,
    })
    const result = getCapabilitiesOptionsAtw(data)
    const zone2Ids = result['thermostat_mode.zone2']?.values.map(({ id }) => id)

    expect(zone2Ids).toStrictEqual([
      'room',
      'flow',
      'curve',
      'room_cool',
      'flow_cool',
    ])
  })

  it('should apply addSuffixToTitle to cool mode titles', () => {
    const data = mock<Classic.ListDeviceDataAtw>({
      CanCool: true,
      HasZone2: false,
    })
    const result = getCapabilitiesOptionsAtw(data)
    const roomCool = result.thermostat_mode?.values.find(
      ({ id }) => id === 'room_cool',
    )

    expect(roomCool?.title.en).toBe('Indoor temperature - cooling')
    expect(roomCool?.title['fr']).toBe(
      'Température intérieure - refroidissement',
    )
  })
})

describe('hot water mode options', () => {
  it('should have the correct values', () => {
    expect(HotWaterMode).toStrictEqual({
      auto: 'auto',
      forced: 'forced',
    })
  })
})

describe('hot water operation state options', () => {
  it('should have the correct values', () => {
    expect(Classic.OperationModeStateHotWater).toStrictEqual({
      dhw: 'dhw',
      idle: 'idle',
      legionella: 'legionella',
      prohibited: 'prohibited',
    })
  })
})

describe('zone operation state options', () => {
  it('should have the correct values', () => {
    expect(Classic.OperationModeStateZone).toStrictEqual({
      cooling: 'cooling',
      defrost: 'defrost',
      heating: 'heating',
      idle: 'idle',
      prohibited: 'prohibited',
    })
  })
})
