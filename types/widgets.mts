import type {
  DeviceZone,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import type { HourNumbers } from 'luxon'

import type { BaseSettings } from './bases.mts'

export interface DaysQuery {
  readonly days?: string
}

export interface GetAtaOptions {
  readonly mode?: 'detailed'
  readonly status?: 'on'
}

export interface GroupAtaStates {
  readonly FanSpeed: Exclude<FanSpeed, typeof FanSpeed.silent>[]
  readonly OperationMode: OperationMode[]
  readonly Power: boolean[]
  readonly SetTemperature: number[]
  readonly VaneHorizontalDirection: Horizontal[]
  readonly VaneHorizontalSwing: boolean[]
  readonly VaneVerticalDirection: Vertical[]
  readonly VaneVerticalSwing: boolean[]
}

export interface HomeyWidgetSettingsAtaGroupSetting extends BaseSettings {
  readonly animations: boolean
  readonly default_zone: DeviceZone | null
}

export interface HomeyWidgetSettingsCharts extends BaseSettings {
  readonly chart:
    | 'hourly_temperatures'
    | 'operation_modes'
    | 'signal'
    | 'temperatures'
  readonly days: number
  readonly default_zone: DeviceZone | null
  readonly height: `${number}`
}

export interface HourQuery {
  readonly hour?: `${HourNumbers}`
}

export interface ZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'floors'
}
