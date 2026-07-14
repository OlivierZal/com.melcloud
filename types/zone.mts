// One entry per MELCloud building (either dialect), for the extension
// app's per-building settings grouping.
export interface DeviceGroup {
  readonly deviceIds: readonly string[]
  readonly name: string
}

// Frost protection and holiday mode can also target a single device (the
// settings page lists devices in its zone selector), unlike the ATA group
// endpoints which only operate on zone collections.
export interface DeviceOrZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'devices' | 'floors'
}

export interface ZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'floors'
}
