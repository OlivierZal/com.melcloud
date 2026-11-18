import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import { mock } from '@olivierzal/homey-kit/testing'
import { describe, expect, it } from 'vitest'

import {
  getHomeBuildingId,
  getHomeDeviceId,
  getSubzones,
  getZoneId,
  getZoneName,
  isHomeBuildingValue,
  isHomeDeviceValue,
  sortByBuilding,
} from '../../public/zones.mts'

const classicBuilding = (name: string): Classic.BuildingZone =>
  mock<Classic.BuildingZone>({ model: 'buildings', name })

const homeBuilding = (name: string): HomeBuildingZone =>
  mock<HomeBuildingZone>({ buildingName: name, model: 'homeBuildings', name })

const homeDevice = (buildingName: string, name: string): HomeDeviceZone =>
  mock<HomeDeviceZone>({ buildingName, model: 'homeDevices', name })

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

  // The devices keep the library's order, not their own names': the key
  // is the building, so `Salon` stays ahead of `Atelier`.
  it('should sort both dialects by building, a home building leading its devices', () => {
    const maison = classicBuilding('Maison')
    const bureau = classicBuilding('Bureau')
    const chalet = homeBuilding('Chalet')
    const salon = homeDevice('Chalet', 'Salon')
    const atelier = homeDevice('Chalet', 'Atelier')

    expect(
      sortByBuilding([maison, bureau, chalet, salon, atelier]),
    ).toStrictEqual([bureau, chalet, salon, atelier, maison])
  })

  it('should keep the given order between entries of one building name', () => {
    const classicMaison = classicBuilding('Maison')
    const homeMaison = homeBuilding('Maison')
    const salon = homeDevice('Maison', 'Salon')

    expect(sortByBuilding([classicMaison, homeMaison, salon])).toStrictEqual([
      classicMaison,
      homeMaison,
      salon,
    ])
  })
})
