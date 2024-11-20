import type {
  DeviceType,
  FanSpeed,
  GetDeviceData,
  ListDeviceDataErv,
  UpdateDeviceDataErv,
} from '@olivierzal/melcloud-api'

import type MELCloudDeviceErv from '../drivers/melcloud_erv/device.mts'

import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases.mts'

export enum ThermostatModeErv {
  auto = 'auto',
  bypass = 'bypass',
  off = 'off',
  recovery = 'recovery',
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
  extends GetCapabilitiesErv,
    ListCapabilitiesErv,
    SetCapabilitiesErv {}

export interface SetCapabilitiesErv extends BaseSetCapabilities {
  readonly fan_speed: FanSpeed
  readonly thermostat_mode: keyof typeof ThermostatModeErv
}

export type CapabilitiesErv = EnergyCapabilitiesErv & OpCapabilitiesErv

export type EnergyCapabilitiesErv = Record<string, never>

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
  keyof GetDeviceData<DeviceType.Erv>
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
} as const

export const listCapabilityTagMappingErv: Record<
  keyof ListCapabilitiesErv,
  keyof ListDeviceDataErv
> = {
  measure_pm25: 'PM25Level',
  measure_signal_strength: 'WifiSignalStrength',
} as const

export const energyCapabilityTagMappingErv: Record<string, never> = {} as const

export interface FlowArgsErv extends SetCapabilitiesErv {
  readonly device: MELCloudDeviceErv
}
