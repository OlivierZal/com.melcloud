import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import { assertDefined, mock } from '@olivierzal/homey-kit/testing'
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
  mergeSameNameBuildings,
  pairSameNameBuildings,
  sortByBuilding,
  tagSameNameBuildings,
  toBuildingKey,
  toFollowedValues,
  toHouseDefault,
  toMergedItem,
  toMergedValue,
} from '../../public/zones.mts'

const classicBuilding = (name: string): Classic.BuildingZone =>
  mock<Classic.BuildingZone>({
    areas: [],
    devices: [],
    floors: [],
    model: 'buildings',
    name,
  })

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
      toMergedItem({
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

  // ONE entry for the house, no account named: the units of both
  // accounts in name order, then the Classic areas and floors, each
  // still selectable on its own.
  it('should list a house both accounts share as one entry over all it holds', () => {
    const area = { devices: [], id: 31, level: 1, model: 'areas', name: 'Aile' }
    const floor = {
      areas: [],
      devices: [],
      id: 21,
      level: 1,
      model: 'floors',
      name: 'Étage',
    }
    const salon = { id: 11, level: 1, model: 'devices', name: 'Salon' }
    const domicile = mock<Classic.BuildingZone>({
      areas: [area],
      devices: [salon],
      floors: [floor],
      id: 1,
      model: 'buildings',
      name: 'Domicile',
    })
    const bureau = homeDevice('Domicile', 'Bureau')
    const villa = homeBuilding('Villa')
    const terrasse = homeDevice('Villa', 'Terrasse')
    const [house, ...rest] = sortByBuilding(
      mergeSameNameBuildings([
        domicile,
        homeBuilding('Domicile'),
        bureau,
        villa,
        terrasse,
      ]),
    )

    assertDefined(house)

    expect(house).toMatchObject({
      buildingName: 'Domicile',
      model: 'mergedBuildings',
      name: 'Domicile',
    })
    expect(getSubzones(house)).toStrictEqual([bureau, salon, area, floor])
    expect(rest).toStrictEqual([villa, terrasse])
    expect(tagSameNameBuildings([house]).map(({ name }) => name)).toStrictEqual(
      ['Domicile'],
    )
  })

  // The pairing rule decides what merges: names differing in spacing make
  // one house, read under the trimmed name, and each house keeps its own
  // Home units.
  it('should merge each house under the pairing rule, with its own Home units', () => {
    const bureau = homeDevice('Domicile', 'Bureau')
    const terrasse = homeDevice('Villa', 'Terrasse')
    const houses = mergeSameNameBuildings([
      classicBuilding('Domicile '),
      homeBuilding('Domicile'),
      bureau,
      classicBuilding('Villa'),
      homeBuilding('Villa'),
      terrasse,
    ])

    expect(
      houses.map((house) => [house.model, house.name, getSubzones(house)]),
    ).toStrictEqual([
      ['mergedBuildings', 'Domicile', [bureau]],
      ['mergedBuildings', 'Villa', [terrasse]],
    ])
  })

  // A name either account holds twice is no single house: its buildings
  // stay, each tagged with its account.
  it('should leave a name held twice by one account as tagged buildings', () => {
    const zones = [
      classicBuilding('Maison'),
      classicBuilding('Maison'),
      homeBuilding('Maison'),
    ]

    expect(mergeSameNameBuildings(zones)).toStrictEqual(zones)
    expect(tagSameNameBuildings(zones).map(({ name }) => name)).toStrictEqual([
      'Maison [Classic]',
      'Maison [Classic]',
      'Maison [Home]',
    ])
  })

  // The sort keys on the same rule as the pairing, so names differing in
  // spacing alone sort as one.
  it('should sort names differing in spacing alone as one', () => {
    const domicile = classicBuilding(' Domicile')
    const bureau = homeBuilding('Bureau')
    const homeDomicile = homeBuilding('Domicile ')

    expect(sortByBuilding([domicile, bureau, homeDomicile])).toStrictEqual([
      bureau,
      domicile,
      homeDomicile,
    ])
  })

  // A widget whose default zone is one of the house's buildings opens on
  // the house, which the picker lists in their place.
  it('should read a default stored on either building as the house', () => {
    const pair = {
      classic: mock<Classic.BuildingZone>({ id: 1, name: 'Domicile' }),
      home: mock<HomeBuildingZone>({ id: 'b_2', name: 'Domicile' }),
    }
    const house = toMergedItem(pair)
    const office = { id: 2, model: 'buildings' }

    expect(toHouseDefault({ id: 1, model: 'buildings' }, [pair])).toStrictEqual(
      house,
    )
    expect(
      toHouseDefault({ id: 'b_2', model: 'homeBuildings' }, [pair]),
    ).toStrictEqual(house)
    expect(toHouseDefault(office, [pair])).toBe(office)
    expect(toHouseDefault(null, [pair])).toBeNull()
  })

  // Both ways: a selection on one of the house's buildings follows it
  // to the house once the other account's list lands, and a house that
  // came apart, one account gone, goes to whichever of its two buildings
  // is still listed, the caller trying each value in turn. Any other
  // selection stays where it is, a unit of the house included.
  it('should say where a selection goes once the lists have moved', () => {
    const pair = {
      classic: mock<Classic.BuildingZone>({ id: 1, name: 'Domicile' }),
      home: mock<HomeBuildingZone>({ id: 'b_2', name: 'Domicile' }),
    }
    const house = 'mergedBuildings_1_b_2'
    const apart = [house, 'buildings_1', 'homeBuildings_b_2']

    expect(toMergedValue(pair)).toBe(house)
    expect(toFollowedValues('buildings_1', [], [pair])).toStrictEqual([house])
    expect(toFollowedValues('homeBuildings_b_2', [], [pair])).toStrictEqual([
      house,
    ])
    expect(toFollowedValues(house, [pair], [pair])).toStrictEqual(apart)
    expect(toFollowedValues(house, [pair], [])).toStrictEqual(apart)
    // A whole value is matched, never a prefix of one.
    expect(
      ['buildings_2', 'buildings_12', 'devices_1', ''].flatMap((value) =>
        toFollowedValues(value, [pair], [pair]),
      ),
    ).toStrictEqual(['buildings_2', 'buildings_12', 'devices_1', ''])
  })

  it('should detect a merged value by its prefix', () => {
    expect(isMergedBuildingValue('mergedBuildings_1_b_2')).toBe(true)
    expect(isMergedBuildingValue('buildings_1')).toBe(false)
    expect(isMergedBuildingValue('homeBuildings_mergedBuildings_1')).toBe(false)
  })
})
