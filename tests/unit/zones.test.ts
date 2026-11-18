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
  isMergedBuildingValue,
  pairSameNameBuildings,
  sortByBuilding,
  tagSameNameBuildings,
  toBuildingKey,
  toMergedBuilding,
  withMergedBuildings,
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

  it('should key a building name trimmed and composed, case kept', () => {
    expect(toBuildingKey('  Domicile\t')).toBe('Domicile')
    // An accent typed as a combining mark keys like its precomposed form.
    expect(toBuildingKey('Re\u{301}sidence')).toBe('R\u{E9}sidence')
    expect(toBuildingKey('domicile')).not.toBe(toBuildingKey('Domicile'))
  })

  // Only the display name moves: the id and model the option value is
  // built from, the nested subzones and the Home devices stay as given.
  it('should tag the buildings both accounts list under one name, nothing else', () => {
    const living = { id: 11, level: 1, model: 'devices', name: 'Living' }
    const classicDomicile = mock<Classic.BuildingZone>({
      devices: [living],
      id: 1,
      model: 'buildings',
      name: 'Domicile',
    })
    const homeDomicile = mock<HomeBuildingZone>({
      buildingName: 'Domicile',
      id: 'b_1',
      model: 'homeBuildings',
      name: 'Domicile',
    })
    const salon = homeDevice('Domicile', 'Salon')
    const bureau = classicBuilding('Bureau')

    expect(
      tagSameNameBuildings([bureau, classicDomicile, homeDomicile, salon]),
    ).toStrictEqual([
      bureau,
      {
        devices: [living],
        id: 1,
        model: 'buildings',
        name: 'Domicile [Classic]',
      },
      {
        buildingName: 'Domicile',
        id: 'b_1',
        model: 'homeBuildings',
        name: 'Domicile [Home]',
      },
      salon,
    ])
    expect(classicDomicile.name).toBe('Domicile')
    expect(homeDomicile.name).toBe('Domicile')
  })

  it('should pair building names under the same-house rule', () => {
    const zones = [
      classicBuilding('Atelier '),
      homeBuilding('Atelier'),
      classicBuilding('Re\u{301}sidence'),
      homeBuilding('R\u{E9}sidence'),
      classicBuilding('domicile'),
      homeBuilding('Domicile'),
    ]

    expect(tagSameNameBuildings(zones).map(({ name }) => name)).toStrictEqual([
      'Atelier [Classic]',
      'Atelier [Home]',
      'Re\u{301}sidence [Classic]',
      'R\u{E9}sidence [Home]',
      'domicile',
      'Domicile',
    ])
  })

  // A name repeated within one account is no cross-account collision,
  // while one both accounts hold tags every building that holds it; a
  // device named after a building keeps its name.
  it('should tag a shared name on every building that holds it', () => {
    const zones = [
      classicBuilding('Maison'),
      classicBuilding('Maison'),
      homeBuilding('Maison'),
      classicBuilding('Chalet'),
      classicBuilding('Chalet'),
      homeBuilding('Villa'),
      homeBuilding('Villa'),
      homeDevice('Villa', 'Maison'),
    ]

    expect(tagSameNameBuildings(zones).map(({ name }) => name)).toStrictEqual([
      'Maison [Classic]',
      'Maison [Classic]',
      'Maison [Home]',
      'Chalet',
      'Chalet',
      'Villa',
      'Villa',
      'Maison',
    ])
  })

  // One building per account and name, under the same-house rule: a
  // name either account holds twice, or only one account holds, pairs
  // nothing.
  it('should pair a name held by exactly one building per account', () => {
    const atelier = classicBuilding('Atelier ')
    const homeAtelier = homeBuilding('Atelier')
    const residence = classicBuilding('Re\u{301}sidence')
    const homeResidence = homeBuilding('R\u{E9}sidence')

    expect(
      pairSameNameBuildings([
        atelier,
        homeAtelier,
        residence,
        homeResidence,
        classicBuilding('domicile'),
        homeBuilding('Domicile'),
        classicBuilding('Maison'),
        classicBuilding('Maison'),
        homeBuilding('Maison'),
        classicBuilding('Chalet'),
        homeBuilding('Villa'),
        homeBuilding('Villa'),
        classicBuilding('Villa'),
        homeDevice('Atelier', 'Atelier'),
      ]),
    ).toStrictEqual([
      { classic: atelier, home: homeAtelier },
      { classic: residence, home: homeResidence },
    ])
  })

  // The value joins both ids whole, a Home id's underscores included,
  // and the house reads and sorts under the Classic building's name.
  it('should build a merged house from its pair', () => {
    expect(
      toMergedBuilding({
        classic: mock<Classic.BuildingZone>({ id: 1, name: 'Domicile' }),
        home: mock<HomeBuildingZone>({ id: 'b_2', name: 'Domicile ' }),
      }),
    ).toStrictEqual({
      buildingName: 'Domicile',
      id: '1_b_2',
      level: 0,
      model: 'mergedBuildings',
      name: 'Domicile',
    })
    expect(getZoneId('1_b_2', 'mergedBuildings')).toBe('mergedBuildings_1_b_2')
  })

  // Each building stays selectable, and the house both make lands right
  // after the second one's devices: a list never starts on it, so a
  // widget with no default zone opens where it did before.
  it('should list a merged house right after its two buildings', () => {
    const zones = [
      classicBuilding('Domicile'),
      homeBuilding('Villa'),
      homeBuilding('Domicile'),
      homeDevice('Domicile', 'Bureau'),
    ]

    expect(
      tagSameNameBuildings(sortByBuilding(withMergedBuildings(zones))).map(
        ({ model, name }) => `${model}: ${name}`,
      ),
    ).toStrictEqual([
      'buildings: Domicile [Classic]',
      'homeBuildings: Domicile [Home]',
      'homeDevices: Bureau',
      'mergedBuildings: Domicile [Classic + Home]',
      'homeBuildings: Villa',
    ])
  })

  // The sort keys on the same rule as the pairing, so names differing in
  // spacing alone keep the house together and its merged entry after it.
  it('should keep a house together when its names differ in spacing alone', () => {
    const zones = [
      classicBuilding(' Domicile'),
      homeBuilding('Bureau'),
      homeBuilding('Domicile '),
      homeDevice('Domicile ', 'Salon'),
    ]

    expect(
      tagSameNameBuildings(sortByBuilding(withMergedBuildings(zones))).map(
        ({ model, name }) => `${model}: ${name}`,
      ),
    ).toStrictEqual([
      'homeBuildings: Bureau',
      'buildings: Domicile [Classic]',
      'homeBuildings: Domicile [Home]',
      'homeDevices: Salon',
      'mergedBuildings: Domicile [Classic + Home]',
    ])
  })

  it('should detect a merged value by its prefix', () => {
    expect(isMergedBuildingValue('mergedBuildings_1_b_2')).toBe(true)
    expect(isMergedBuildingValue('buildings_1')).toBe(false)
    expect(isMergedBuildingValue('homeBuildings_mergedBuildings_1')).toBe(false)
  })
})
