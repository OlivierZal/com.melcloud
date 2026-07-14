import type { Hour } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { BaseSettings } from './bases.mts'
import type { HomeBuildingZone, HomeDeviceZone } from './zone.mts'

// Report-history cap shared by the charts widget API validation, the
// widget day picker and the settings manifest bound: a full year.
export const DAYS_MAX = 365

export interface AtaGroupSettingWidgetSettings extends BaseSettings {
  // Classic zone collections and devices, plus the Home buildings
  // (account-level groups) and their devices.
  readonly default_zone: Classic.Zone | HomeBuildingZone | HomeDeviceZone | null
}

export interface ChartsWidgetSettings extends BaseSettings {
  readonly chart:
    'hourly_temperatures' | 'operation_modes' | 'signal' | 'temperatures'
  readonly days: number
  readonly default_zone: Classic.DeviceZone | null
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
