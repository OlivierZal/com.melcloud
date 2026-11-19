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
  toDefaultZoneValue,
  toMergedBuilding,
  withMergedBuildings,
  withoutPairedBuildings,
} from '../../public/zones.mts'

const classicBuilding = (name: string, id?: number): Classic.BuildingZone =>
  mock<Classic.BuildingZone>({ id, model: 'buildings', name })

const homeBuilding = (name: string, id?: string): HomeBuildingZone =>
  mock<HomeBuildingZone>({
    buildingName: name,
    id,
    model: 'homeBuildings',
    name,
  })

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

  // The value joins both ids whole, a Home id's underscores included, and
  // the house reads and sorts under the Classic building's name, nesting
  // what that building holds.
  it('should build a merged house from its pair', () => {
    const living = { id: 11, level: 1, model: 'devices', name: 'Living' }

    expect(
      toMergedBuilding({
        classic: mock<Classic.BuildingZone>({
          areas: [],
          devices: [living],
          floors: [],
          id: 1,
          name: 'Domicile',
        }),
        home: mock<HomeBuildingZone>({ id: 'b_2', name: 'Domicile ' }),
      }),
    ).toStrictEqual({
      areas: [],
      buildingName: 'Domicile',
      devices: [living],
      floors: [],
      id: '1_b_2',
      level: 0,
      model: 'mergedBuildings',
      name: 'Domicile',
    })
    expect(getZoneId('1_b_2', 'mergedBuildings')).toBe('mergedBuildings_1_b_2')
  })

  // The house stands in for its two buildings and leads the Home
  // building's devices, tagged though no building is left to tell it
  // from.
  it('should list a house both accounts share as one entry', () => {
    const zones = [
      classicBuilding('Domicile', 1),
      homeBuilding('Villa', 'b_1'),
      homeBuilding('Domicile', 'b_2'),
      homeDevice('Domicile', 'Bureau'),
    ]

    expect(
      tagSameNameBuildings(sortByBuilding(withMergedBuildings(zones))).map(
        ({ model, name }) => `${model}: ${name}`,
      ),
    ).toStrictEqual([
      'mergedBuildings: Domicile [Classic + Home]',
      'homeDevices: Bureau',
      'homeBuildings: Villa',
    ])
  })

  // The sort keys on the same rule as the pairing, so names differing in
  // spacing alone keep the house ahead of its Home devices.
  it('should keep a house together when its names differ in spacing alone', () => {
    const zones = [
      classicBuilding(' Domicile', 1),
      homeBuilding('Bureau', 'b_1'),
      homeBuilding('Domicile ', 'b_2'),
      homeDevice('Domicile ', 'Salon'),
    ]

    expect(
      tagSameNameBuildings(sortByBuilding(withMergedBuildings(zones))).map(
        ({ model, name }) => `${model}: ${name}`,
      ),
    ).toStrictEqual([
      'homeBuildings: Bureau',
      'mergedBuildings: Domicile [Classic + Home]',
      'homeDevices: Salon',
    ])
  })

  // Pairs drawn from the building tree filter a flat list by option
  // value: the two buildings leave, everything else stays — a zone of
  // another model under the same id included.
  it('should drop the two buildings of each pair from another list', () => {
    const pair = {
      classic: classicBuilding('Domicile', 1),
      home: homeBuilding('Domicile', 'b_2'),
    }

    expect(
      withoutPairedBuildings(
        [
          { id: 1, model: 'buildings' },
          { id: 1, model: 'devices' },
          { id: 'b_2', model: 'homeBuildings' },
          { id: 'ata_2', model: 'homeDevices' },
          { id: 2, model: 'buildings' },
        ],
        [pair],
      ),
    ).toStrictEqual([
      { id: 1, model: 'devices' },
      { id: 'ata_2', model: 'homeDevices' },
      { id: 2, model: 'buildings' },
    ])
  })

  describe('default zone', () => {
    const living = { id: 11, level: 1, model: 'devices', name: 'Living' }
    const domicile = mock<Classic.BuildingZone>({
      areas: [],
      devices: [living],
      floors: [],
      id: 1,
      level: 0,
      model: 'buildings',
      name: 'Domicile',
    })
    const homeDomicile = mock<HomeBuildingZone>({
      buildingName: 'Domicile',
      id: 'b_2',
      level: 0,
      model: 'homeBuildings',
      name: 'Domicile',
    })
    const bureau = mock<HomeDeviceZone>({
      buildingName: 'Domicile',
      id: 'ata_2',
      level: 1,
      model: 'homeDevices',
      name: 'Bureau',
    })
    const villa = mock<HomeBuildingZone>({
      buildingName: 'Villa',
      id: 'b_1',
      level: 0,
      model: 'homeBuildings',
      name: 'Villa',
    })
    const listed = sortByBuilding(
      withMergedBuildings([domicile, homeDomicile, bureau, villa]),
    )

    it('should keep a zone the list still offers, subzones included', () => {
      expect(
        toDefaultZoneValue(
          mock<Classic.FlatZone>({
            buildingName: 'Domicile',
            id: 11,
            model: 'devices',
          }),
          listed,
        ),
      ).toBe('devices_11')
      expect(toDefaultZoneValue(villa, listed)).toBe('homeBuildings_b_1')
    })

    // Stored as either building, before its house read as one entry.
    it('should open a building of a merged house on the house', () => {
      expect(
        toDefaultZoneValue(
          mock<Classic.FlatZone>({
            buildingName: 'Domicile',
            id: 1,
            model: 'buildings',
            name: 'Domicile [Classic]',
          }),
          listed,
        ),
      ).toBe('mergedBuildings_1_b_2')
      expect(toDefaultZoneValue(homeDomicile, listed)).toBe(
        'mergedBuildings_1_b_2',
      )
    })

    // The Home account signed out: the Classic building is left.
    it('should open a house whose pair broke on the building left under its name', () => {
      expect(
        toDefaultZoneValue(
          toMergedBuilding({ classic: domicile, home: homeDomicile }),
          sortByBuilding(withMergedBuildings([domicile, villa])),
        ),
      ).toBe('buildings_1')
    })

    // A unit gone from its house opens on the house; a name the list no
    // longer offers, or a Classic zone stored with no building name,
    // keeps its own value, which selects nothing.
    it('should fall back on the house of a zone gone from the list, if any', () => {
      expect(
        toDefaultZoneValue(
          mock<HomeDeviceZone>({
            buildingName: 'Villa',
            id: 'ata_9',
            model: 'homeDevices',
          }),
          listed,
        ),
      ).toBe('homeBuildings_b_1')
      expect(
        toDefaultZoneValue(
          mock<HomeBuildingZone>({
            buildingName: 'Chalet',
            id: 'b_9',
            model: 'homeBuildings',
          }),
          listed,
        ),
      ).toBe('homeBuildings_b_9')
      expect(
        toDefaultZoneValue(
          mock<Classic.BuildingZone>({ id: 1, model: 'buildings' }),
          listed,
        ),
      ).toBe('buildings_1')
    })
  })

  it('should detect a merged value by its prefix', () => {
    expect(isMergedBuildingValue('mergedBuildings_1_b_2')).toBe(true)
    expect(isMergedBuildingValue('buildings_1')).toBe(false)
    expect(isMergedBuildingValue('homeBuildings_mergedBuildings_1')).toBe(false)
  })
})
