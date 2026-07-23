// One entry per MELCloud building (either dialect), for the extension
// app's per-building settings grouping.
export interface DeviceGroup {
  readonly deviceIds: readonly string[]
  readonly name: string
}

// Endpoints that can target a single device as well as a zone collection:
// frost protection, holiday mode (the settings page lists devices in its
// zone selector) and the ATA group state (the widget treats a device as a
// group of one). The detailed ATA states endpoint stays zone-only — a
// single device never reports a mixed operation mode, so the widget never
// queries details for device targets.
export interface DeviceOrZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'devices' | 'floors'
}

// MELCloud-Home targets: each `/context` building (the account-level
// group) is a selectable root entry, its devices one level below. The
// models are camelCase because option values split `${model}_${id}` at
// the FIRST underscore — a Home id may itself contain underscores.
// `buildingName` mirrors `Classic.FlatZone`: it names the owning building
// (a building carries its own) so a flat picker can suffix leaves and keep
// same-named devices on different buildings apart.
export interface HomeBuildingZone {
  readonly buildingName: string
  readonly id: string
  readonly level: 0
  readonly model: 'homeBuildings'
  readonly name: string
}

export interface HomeDeviceZone {
  readonly buildingName: string
  readonly id: string
  readonly level: 1
  readonly model: 'homeDevices'
  readonly name: string
}

export interface ZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'floors'
}
