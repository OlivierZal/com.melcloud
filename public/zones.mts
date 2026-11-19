import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

// A house both accounts list under one name, read and written as one
// group (`toMergedBuilding`). It nests its Classic building's subzones,
// so a picker walks them under it as under the building.
export interface MergedBuildingZone extends Pick<
  Classic.BuildingZone,
  'areas' | 'devices' | 'floors'
> {
  readonly buildingName: string
  readonly id: string
  readonly level: 0
  readonly model: 'mergedBuildings'
  readonly name: string
}

// What the zone pickers list at the top level: a Classic building, its
// subzones nested, or a Home building or device, flat — every Home entry
// naming its building —, and in the ATA group widget the merged house
// standing in for a pair's two buildings.
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
  ['mergedBuildings', '[Classic + Home]'],
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
// the two stop reading alike, and a merged house always takes both, the
// list holding it in place of its two buildings. Option values, nested
// subzones and devices stay as they are, and so does the input. A list
// sorted by building is tagged after `sortByBuilding`, which keys on the
// bare names.
export const tagSameNameBuildings = <T extends NamedZone>(
  zones: readonly T[],
): T[] => {
  const classicKeys = getBuildingKeys(zones, 'buildings')
  const homeKeys = getBuildingKeys(zones, 'homeBuildings')
  const isSharedName = (name: string): boolean => {
    const key = toBuildingKey(name)
    return classicKeys.has(key) && homeKeys.has(key)
  }
  return zones.map((zone) => {
    const tag = DIALECT_TAGS.get(zone.model)
    return tag !== undefined &&
      (zone.model === 'mergedBuildings' || isSharedName(zone.name))
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

// The merged house of a pair: its value joins the two buildings' ids, it
// sorts and reads under the Classic building's name, and it nests that
// building's subzones.
export const toMergedBuilding = ({
  classic,
  home,
}: SameNamePair): MergedBuildingZone => ({
  areas: classic.areas,
  buildingName: classic.name,
  devices: classic.devices,
  floors: classic.floors,
  id: `${String(classic.id)}_${home.id}`,
  level: 0,
  model: 'mergedBuildings',
  name: classic.name,
})

interface ValuedZone {
  readonly id: number | string
  readonly model: string
}

// The list without the two buildings of each pair, which the pair's
// merged house stands in for. Matched by option value, so pairs drawn
// from another list of the same accounts apply too.
export const withoutPairedBuildings = <T extends ValuedZone>(
  zones: readonly T[],
  pairs: readonly SameNamePair[],
): T[] => {
  const pairedValues = new Set(
    pairs.flatMap(({ classic, home }) => [
      getZoneId(classic.id, classic.model),
      getZoneId(home.id, home.model),
    ]),
  )
  return zones.filter(
    ({ id, model }) => !pairedValues.has(getZoneId(id, model)),
  )
}

// The list with each house both accounts list under one name as ONE
// entry: its merged house stands in for its two buildings, and the Home
// building's devices stay. The houses come first, so the stable
// `sortByBuilding` puts each one ahead of those devices.
export const withMergedBuildings = (
  zones: readonly PickerListZone[],
): PickerListZone[] => {
  const pairs = pairSameNameBuildings(zones)
  return [
    ...pairs.map((pair) => toMergedBuilding(pair)),
    ...withoutPairedBuildings(zones, pairs),
  ]
}

// Only Classic zones nest — the Home entries carry none of the subzone
// keys, so the walk bottoms out on them.
export const getSubzones = (zone: PickerZone): Classic.Zone[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

export const getZoneId = (id: number | string, model: string): string =>
  `${model}_${String(id)}`

export const getZoneName = (name: string, level: number): string =>
  `${'···'.repeat(level)} ${name}`

// Every option value a picker list renders, its subzones' included.
const getZoneValues = (zones: readonly PickerZone[]): string[] =>
  zones.flatMap((zone) => [
    getZoneId(zone.id, zone.model),
    ...getZoneValues(getSubzones(zone)),
  ])

// The building a stored zone was stamped with: every Home entry and
// merged house carries one, a Classic zone only when the autocomplete
// that stored it did.
const getStoredBuildingName = (zone: PickerZone): string | undefined =>
  'buildingName' in zone ? zone.buildingName : undefined

// The option a stored default zone opens on: its own while the list
// offers it, else the house-level entry listed under its building name —
// a building whose house reads as one entry opens on that house, a house
// whose pair broke (an account signed out, a building renamed) on the
// building left under its name. Failing both, its own value, which
// selects nothing: the picker stays on its first entry.
export const toDefaultZoneValue = (
  zone: PickerZone,
  zones: readonly PickerListZone[],
): string => {
  const value = getZoneId(zone.id, zone.model)
  const buildingName = getStoredBuildingName(zone)
  if (buildingName === undefined || getZoneValues(zones).includes(value)) {
    return value
  }
  const key = toBuildingKey(buildingName)
  const house = zones.find(
    (candidate) => candidate.level === 0 && getBuildingKey(candidate) === key,
  )
  return house === undefined ? value : getZoneId(house.id, house.model)
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
