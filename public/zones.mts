import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

// A house both accounts list under one name, read and written as one
// group, as a flat list or a stored default zone carries it
// (`toMergedItem`).
export interface MergedBuildingItem {
  readonly buildingName: string
  readonly id: string
  readonly level: 0
  readonly model: 'mergedBuildings'
  readonly name: string
}

// The same house as the ATA widget's picker lists it: ONE entry over
// every unit and zone of its two buildings (`toMergedBuilding`).
export interface MergedBuildingZone extends MergedBuildingItem {
  readonly areas: readonly Classic.AreaZone[]
  readonly devices: readonly (Classic.DeviceZone | HomeDeviceZone)[]
  readonly floors: readonly Classic.FloorZone[]
}

// What the zone pickers list at the top level: a Classic building, its
// subzones nested, or a Home building or device, flat — every Home entry
// naming its building —, and in the ATA group widget the merged houses,
// their units and zones nested.
export type PickerListZone =
  Classic.BuildingZone | HomeBuildingZone | HomeDeviceZone | MergedBuildingZone

// Everything the zone pickers can list: a Classic zone at any level, a
// Home building and its devices, or a merged house.
export type PickerZone =
  Classic.Zone | HomeBuildingZone | HomeDeviceZone | MergedBuildingZone

// Two buildings are the same house when their names match once trimmed
// and composed alike (NFC); letter case still tells them apart.
export const toBuildingKey = (name: string): string =>
  name.trim().normalize('NFC')

const getBuildingKey = (zone: PickerListZone): string =>
  toBuildingKey(zone.model === 'buildings' ? zone.name : zone.buildingName)

// Both dialects' picker lists as one, sorted by building name, the same
// house's buildings comparing equal. The sort is stable, so each Home
// building keeps its own devices right behind it, in the order the
// library lists them, and a house's buildings keep the order they came
// in.
export const sortByBuilding = (
  zones: readonly PickerListZone[],
): PickerListZone[] =>
  zones.toSorted((zone, other) =>
    getBuildingKey(zone).localeCompare(getBuildingKey(other)),
  )

// The driver-prefix tokens, spelled the same in every locale.
const DIALECT_TAGS: ReadonlyMap<string, string> = new Map([
  ['buildings', '[Classic]'],
  ['homeBuildings', '[Home]'],
])

interface NamedZone {
  readonly model: string
  readonly name: string
}

const getBuildingKeys = (
  zones: readonly NamedZone[],
  model: string,
): Set<string> =>
  new Set(
    zones
      .filter((zone) => zone.model === model)
      .map(({ name }) => toBuildingKey(name)),
  )

// Display copies of a list spanning both accounts: a building whose name
// the other account's buildings hold too takes its own account's tag, so
// the two stop reading alike. Option values, nested subzones and devices
// stay as they are, and so does the input. A list sorted by building is
// tagged after `sortByBuilding`, which keys on the untagged names.
export const tagSameNameBuildings = <T extends NamedZone>(
  zones: readonly T[],
): T[] => {
  const classicKeys = getBuildingKeys(zones, 'buildings')
  const homeKeys = getBuildingKeys(zones, 'homeBuildings')
  return zones.map((zone) => {
    const tag = DIALECT_TAGS.get(zone.model)
    const key = toBuildingKey(zone.name)
    return tag !== undefined && classicKeys.has(key) && homeKeys.has(key)
      ? { ...zone, name: `${zone.name.trim()} ${tag}` }
      : zone
  })
}

// The two buildings of a house both accounts list under one name.
export interface SameNamePair {
  readonly classic: Classic.BuildingZone
  readonly home: HomeBuildingZone
}

// Each name's one building on a side, `null` for a name that side holds
// twice or more.
const toUniqueByKey = <T extends NamedZone>(
  zones: readonly T[],
): Map<string, T | null> => {
  const unique = new Map<string, T | null>()
  for (const zone of zones) {
    const key = toBuildingKey(zone.name)
    unique.set(key, unique.has(key) ? null : zone)
  }
  return unique
}

// The houses both accounts list under one name: a name held by exactly
// one building on each side. A name either account holds twice pairs
// nothing, since a merged house joins one building per account.
export const pairSameNameBuildings = (
  zones: readonly PickerListZone[],
): SameNamePair[] => {
  const classics = toUniqueByKey(
    zones.filter((zone) => zone.model === 'buildings'),
  )
  const homes = toUniqueByKey(
    zones.filter((zone) => zone.model === 'homeBuildings'),
  )
  const pairs: SameNamePair[] = []
  for (const [key, classic] of classics) {
    const home = homes.get(key) ?? null
    if (classic !== null && home !== null) {
      pairs.push({ classic, home })
    }
  }
  return pairs
}

// The merged house of a pair: its value joins the two buildings' ids,
// and it sorts and reads under the Classic building's name, trimmed like
// every name a flat list shows.
export const toMergedItem = ({
  classic,
  home,
}: SameNamePair): MergedBuildingItem => ({
  buildingName: classic.name.trim(),
  id: `${String(classic.id)}_${home.id}`,
  level: 0,
  model: 'mergedBuildings',
  name: classic.name.trim(),
})

const byName = (zone: NamedZone, other: NamedZone): number =>
  zone.name.localeCompare(other.name)

// The house over everything its two buildings hold: the units of both
// accounts in one list, in name order, then the Classic areas and floors.
const toMergedBuilding = (
  pair: SameNamePair,
  homeDevices: readonly HomeDeviceZone[],
): MergedBuildingZone => ({
  ...toMergedItem(pair),
  areas: pair.classic.areas,
  devices: [...pair.classic.devices, ...homeDevices].toSorted(byName),
  floors: pair.classic.floors,
})

const isHomeDevice = (zone: PickerListZone): zone is HomeDeviceZone =>
  zone.model === 'homeDevices'

// The list with each house both accounts list under one name as ONE
// entry: its two buildings, and the Home one's devices, give way to the
// merged house, which holds them all; `sortByBuilding` places it among
// the other buildings by name. Every unit and zone stays selectable on
// its own.
export const mergeSameNameBuildings = (
  zones: readonly PickerListZone[],
): PickerListZone[] => {
  const houses = new Map(
    pairSameNameBuildings(zones).map((pair) => [
      toBuildingKey(pair.classic.name),
      pair,
    ]),
  )
  const homeDevices = zones.filter((zone) => isHomeDevice(zone))
  return [
    ...zones.filter((zone) => !houses.has(getBuildingKey(zone))),
    ...[...houses].map(([key, pair]) =>
      toMergedBuilding(
        pair,
        homeDevices.filter((device) => getBuildingKey(device) === key),
      ),
    ),
  ]
}

// Only Classic zones and merged houses nest — the Home entries carry
// none of the subzone keys, so the walk bottoms out on them.
export const getSubzones = (
  zone: PickerZone,
): (Classic.Zone | HomeDeviceZone)[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

export const getZoneId = (id: number | string, model: string): string =>
  `${model}_${String(id)}`

export const getZoneName = (name: string, level: number): string =>
  `${'···'.repeat(level)} ${name}`

// A default zone stored on one of a merged house's buildings stands for
// the house, which the picker lists in their place.
export const toHouseDefault = <
  T extends { readonly id: number | string; readonly model: string },
>(
  zone: T | null,
  pairs: readonly SameNamePair[],
): MergedBuildingItem | T | null => {
  if (zone === null) {
    return null
  }
  const value = getZoneId(zone.id, zone.model)
  const pair = pairs.find(
    ({ classic, home }) =>
      value === getZoneId(classic.id, 'buildings') ||
      value === getZoneId(home.id, 'homeBuildings'),
  )
  return pair === undefined ? zone : toMergedItem(pair)
}

// A selected option value is `${model}_${id}`. A Home device carries model
// `homeDevices` and a string id that may itself contain underscores, so
// detect it by prefix and strip that fixed-length prefix — never by
// splitting on `_`, which would truncate such an id.
const HOME_DEVICE_VALUE_PREFIX = 'homeDevices_'

export const isHomeDeviceValue = (value: string): boolean =>
  value.startsWith(HOME_DEVICE_VALUE_PREFIX)

export const getHomeDeviceId = (value: string): string =>
  value.slice(HOME_DEVICE_VALUE_PREFIX.length)

// A Home building groups its devices for a single batched frost/holiday
// write; same prefix-detection contract as the device values above.
const HOME_BUILDING_VALUE_PREFIX = 'homeBuildings_'

export const isHomeBuildingValue = (value: string): boolean =>
  value.startsWith(HOME_BUILDING_VALUE_PREFIX)

export const getHomeBuildingId = (value: string): string =>
  value.slice(HOME_BUILDING_VALUE_PREFIX.length)

// A merged house is recognized by its prefix and resolved by looking its
// whole value up among the pairs the registries hold now — never split:
// both halves are ids, and a Home id may hold underscores.
export const isMergedBuildingValue = (value: string): boolean =>
  value.startsWith('mergedBuildings_')
