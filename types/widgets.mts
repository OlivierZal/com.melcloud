import type { Hour } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { BaseSettings } from './bases.mts'
import type { HomeDeviceZone } from './zone.mts'

export interface AtaGroupSettingWidgetSettings extends BaseSettings {
  // Classic zone collections and devices, plus Home devices at root level.
  readonly default_zone: Classic.Zone | HomeDeviceZone | null
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
