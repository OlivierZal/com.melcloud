import type { Hour } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { BaseSettings } from './bases.mts'

// Report-history cap shared by the charts widget API validation, the
// widget day picker and the settings manifest bound: a full year.
export const DAYS_MAX = 365

export interface AtaGroupSettingWidgetSettings extends BaseSettings {
  // The widget's autocomplete serves zone collections only, never devices.
  readonly default_zone: Exclude<Classic.Zone, Classic.DeviceZone> | null
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
