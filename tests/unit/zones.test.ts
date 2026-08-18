import type { HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import { describe, expect, it } from 'vitest'

import {
  getHomeBuildingId,
  getHomeDeviceId,
  getSubzones,
  getZoneId,
  getZoneName,
  getZonePath,
  isHomeBuildingValue,
  isHomeDeviceValue,
} from '../../public/zones.mts'
import { mock } from '../helpers.ts'

describe('zones', () => {
  it('should flatten every classic subzone collection in order', () => {
    const devices = [{ id: 1 }]
    const areas = [{ id: 2 }]
    const floors = [{ id: 3 }]

    expect(
      getSubzones(mock<Classic.BuildingZone>({ areas, devices, floors })),
    ).toStrictEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('should bottom out on a home zone carrying no subzone key', () => {
    expect(getSubzones(mock<HomeDeviceZone>({ id: 'x' }))).toStrictEqual([])
  })

  it('should build a zone value from model and id', () => {
    expect(getZoneId(11, 'devices')).toBe('devices_11')
    expect(getZoneId('building_1', 'homeBuildings')).toBe(
      'homeBuildings_building_1',
    )
  })

  it('should replace only the first underscore in a zone path', () => {
    expect(getZonePath('devices_11')).toBe('devices/11')
    expect(getZonePath('floors_2_1')).toBe('floors/2_1')
  })

  it('should indent a zone name by its level', () => {
    expect(getZoneName('Home', 0)).toBe(' Home')
    expect(getZoneName('Corner', 2)).toBe('······ Corner')
  })

  it('should detect home values by fixed-length prefix only', () => {
    expect(isHomeDeviceValue('homeDevices_abc_def')).toBe(true)
    expect(isHomeDeviceValue('devices_11')).toBe(false)
    expect(isHomeBuildingValue('homeBuildings_b_1')).toBe(true)
    expect(isHomeBuildingValue('homeDevices_abc')).toBe(false)
  })

  it('should keep underscores inside a stripped home id', () => {
    expect(getHomeDeviceId('homeDevices_abc_def')).toBe('abc_def')
    expect(getHomeBuildingId('homeBuildings_b_1')).toBe('b_1')
  })
})
