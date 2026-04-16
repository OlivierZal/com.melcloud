import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { HourNumbers } from 'luxon'

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

export interface GroupAtaStates {
  readonly FanSpeed: Exclude<Classic.FanSpeed, typeof Classic.FanSpeed.silent>[]
  readonly OperationMode: Classic.OperationMode[]
  readonly Power: boolean[]
  readonly SetTemperature: number[]
  readonly VaneHorizontalDirection: Classic.Horizontal[]
  readonly VaneHorizontalSwing: boolean[]
  readonly VaneVerticalDirection: Classic.Vertical[]
  readonly VaneVerticalSwing: boolean[]
}

export interface HourQuery {
  readonly hour?: `${HourNumbers}`
}

export interface ZoneData {
  readonly zoneId: string
  readonly zoneType: 'areas' | 'buildings' | 'floors'
}
