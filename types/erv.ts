import type {
  FanSpeed,
  GetDeviceDataErv,
  ListDeviceErv,
  UpdateDeviceDataErv,
} from '@olivierzal/melcloud-api'

import type ErvDevice from '../drivers/melcloud/device'

import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases'

export enum ThermostatModeErv {
  auto = 'auto',
  bypass = 'bypass',
  off = 'off',
  recovery = 'recovery',
}

export interface SetCapabilitiesErv extends BaseSetCapabilities {
  readonly fan_speed: FanSpeed
  readonly thermostat_mode: keyof typeof ThermostatModeErv
}

export interface GetCapabilitiesErv extends BaseGetCapabilities {
  readonly measure_co2: number
  readonly measure_temperature: number
  readonly 'measure_temperature.outdoor': number
}

export interface ListCapabilitiesErv extends BaseListCapabilities {
  readonly measure_pm25: number
}

export interface OpCapabilitiesErv
  extends SetCapabilitiesErv,
    GetCapabilitiesErv,
    ListCapabilitiesErv {}

export type EnergyCapabilitiesErv = Record<string, never>

export type CapabilitiesErv = EnergyCapabilitiesErv & OpCapabilitiesErv

export const setCapabilityTagMappingErv: Record<
  keyof SetCapabilitiesErv,
  keyof UpdateDeviceDataErv
> = {
  fan_speed: 'SetFanSpeed',
  onoff: 'Power',
  thermostat_mode: 'VentilationMode',
} as const

export const getCapabilityTagMappingErv: Record<
  keyof GetCapabilitiesErv,
  keyof GetDeviceDataErv
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
} as const

export const listCapabilityTagMappingErv: Record<
  keyof ListCapabilitiesErv,
  keyof ListDeviceErv['Device']
> = {
  measure_pm25: 'PM25Level',
  measure_signal_strength: 'WifiSignalStrength',
} as const

export const energyCapabilityTagMappingErv: Record<string, never> = {} as const

export interface FlowArgsErv extends SetCapabilitiesErv {
  readonly device: ErvDevice
}
