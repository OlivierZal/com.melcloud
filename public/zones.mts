import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

// What the two dialects' picker routes serve: a Classic building, its
// subzones nested, or a Home building or device, flat — every Home entry
// naming its building.
export type PickerListZone =
  Classic.BuildingZone | HomeBuildingZone | HomeDeviceZone

// Everything the zone pickers can list: a Classic zone at any level, or
// a Home building and its devices.
export type PickerZone = Classic.Zone | HomeBuildingZone | HomeDeviceZone

const getBuildingName = (zone: PickerListZone): string =>
  zone.model === 'buildings' ? zone.name : zone.buildingName

// Both dialects' picker lists as one, sorted by building name. The sort is
// stable, so each Home building keeps its own devices right behind it, in
// the order the library lists them.
export const sortByBuilding = (
  zones: readonly PickerListZone[],
): PickerListZone[] =>
  zones.toSorted((zone, other) =>
    getBuildingName(zone).localeCompare(getBuildingName(other)),
  )

// Two buildings are the same house when their names match once trimmed
// and composed alike (NFC); letter case still tells them apart.
export const toBuildingKey = (name: string): string =>
  name.trim().normalize('NFC')

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
// tagged after `sortByBuilding`, which keys on the bare names.
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
