import type { Hour } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { BaseSettings } from './bases.mts'

export interface AtaGroupSettingWidgetSettings extends BaseSettings {
  readonly animations: boolean
  readonly default_zone: Classic.DeviceZone | null
}

export interface ChartsWidgetSettings extends BaseSettings {
  readonly chart:
    | 'hourly_temperatures'
    | 'operation_modes'
    | 'signal'
    | 'temperatures'
  readonly days: number
  readonly default_zone: Classic.DeviceZone | null
  readonly height: `${number}`
}

export interface DaysQuery {
  readonly days?: string
}

export interface GetAtaOptions {
  readonly mode?: 'detailed'
  readonly status?: 'on'
}

export interface HourQuery {
  readonly hour?: `${Hour}`
}
