import type { Hour } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { BaseSettings } from './bases.mts'
import type { HomeBuildingZone, HomeDeviceZone } from './zone.mts'

// Report-history cap shared by the charts widget API validation, the
// widget day picker and the settings manifest bound: a full year.
export const DAYS_MAX = 365

export interface AtaGroupSettingWidgetSettings extends BaseSettings {
  // Explicit false is the only opt-out: instances placed before this setting
  // existed report null and must keep animating.
  readonly animations: boolean | null
  // Classic zone collections and devices, plus the Home buildings
  // (account-level groups) and their devices.
  readonly default_zone: Classic.Zone | HomeBuildingZone | HomeDeviceZone | null
}

export interface ChartsWidgetSettings extends BaseSettings {
  readonly chart:
    | 'hourly_temperatures'
    | 'operation_modes'
    | 'report'
    | 'signal'
    | 'temperatures'
  readonly days: number
  // Classic devices and Home devices alike — no zone collections.
  readonly default_zone: Classic.DeviceZone | HomeDeviceZone | null
  readonly height: `${number}`
}

export interface DaysQuery {
  readonly days?: string
}

export interface GetAtaOptions {
  readonly status?: 'on' | undefined
}

export interface HourQuery {
  readonly hour?: `${Hour}`
}
