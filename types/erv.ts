import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases'
import type {
  FanSpeed,
  GetDeviceDataErv,
  ListDeviceErv,
  UpdateDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'
import type ErvDevice from '../drivers/melcloud/device'

export interface StoreErv {
  readonly hasCO2Sensor: boolean
  readonly hasPM25Sensor: boolean
}

export const STORE_MAPPING_ERV: Record<
  keyof StoreErv,
  keyof ListDeviceErv['Device']
> = { hasCO2Sensor: 'HasCO2Sensor', hasPM25Sensor: 'HasPM25Sensor' } as const

export interface SetCapabilitiesErv extends BaseSetCapabilities {
  readonly fan_power: FanSpeed
  readonly ventilation_mode: keyof typeof VentilationMode
}

export interface GetCapabilitiesErv extends BaseGetCapabilities {
  readonly measure_co2: number
  readonly measure_temperature: number
  readonly 'measure_temperature.outdoor': number
}

export interface ListCapabilitiesErv extends BaseListCapabilities {
  readonly measure_pm25: number
}

export type OpCapabilitiesErv = GetCapabilitiesErv &
  ListCapabilitiesErv &
  SetCapabilitiesErv

export type EnergyCapabilitiesErv = Record<string, never>

export type CapabilitiesErv = EnergyCapabilitiesErv & OpCapabilitiesErv

export const SET_CAPABILITY_TAGS_MAPPING_ERV: Record<
  keyof SetCapabilitiesErv,
  keyof UpdateDeviceDataErv
> = {
  fan_power: 'SetFanSpeed',
  onoff: 'Power',
  ventilation_mode: 'VentilationMode',
} as const

export const GET_CAPABILITY_TAGS_MAPPING_ERV: Record<
  keyof GetCapabilitiesErv,
  keyof GetDeviceDataErv
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
} as const

export const LIST_CAPABILITY_TAGS_MAPPING_ERV: Record<
  keyof ListCapabilitiesErv,
  keyof ListDeviceErv['Device']
> = {
  measure_pm25: 'PM25Level',
  'measure_power.wifi': 'WifiSignalStrength',
} as const

export const ENERGY_CAPABILITY_TAG_MAPPING_ERV: Record<string, never> =
  {} as const

export interface FlowArgsErv extends SetCapabilitiesErv {
  readonly device: ErvDevice
}
