export const getZoneId = (id: number | string, model: string): string =>
  `${model}_${String(id)}`

export const getZonePath = (value: string): string => value.replace('_', '/')

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
