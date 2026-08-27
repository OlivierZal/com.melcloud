import type { HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

// One entry per MELCloud building (either dialect), for the extension
// app's per-building settings grouping.
export interface DeviceGroup {
  readonly deviceIds: readonly string[]
  readonly name: string
}

// Endpoints that can target a single device as well as a zone collection:
// frost protection, holiday mode (the settings page lists devices in its
// zone selector) and the ATA group state (the widget treats a device as a
// group of one).
export interface DeviceOrZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'devices' | 'floors'
}

// A chart-picker device leaf of either dialect: the `deviceType` tag
// and the `model` discriminant together let one flat list serve every
// per-chart line-up.
export type FlatDeviceZone = Classic.DeviceZone | HomeDeviceZone

export interface ZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'floors'
}
