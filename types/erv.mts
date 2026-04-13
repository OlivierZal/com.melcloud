import {
  type DeviceType,
  type FanSpeed,
  type GetDeviceData,
  type ListDeviceDataErv,
  type UpdateDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'

import type { ClassicMELCloudDeviceErv } from '../drivers/index.mts'
import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases.mts'

export const ventilationModeFromDevice = {
  [VentilationMode.auto]: 'auto',
  [VentilationMode.bypass]: 'bypass',
  [VentilationMode.recovery]: 'recovery',
} as const satisfies Record<VentilationMode, keyof typeof VentilationMode>

export const ThermostatModeErv = {
  auto: 'auto',
  bypass: 'bypass',
  off: 'off',
  recovery: 'recovery',
} as const

export type ClassicCapabilitiesErv = ClassicEnergyCapabilitiesErv &
  ClassicGetCapabilitiesErv &
  ClassicListCapabilitiesErv &
  ClassicSetCapabilitiesErv

export type ClassicEnergyCapabilitiesErv = Record<string, never>

export interface ClassicGetCapabilitiesErv extends BaseGetCapabilities {
  readonly measure_co2: number
  readonly measure_temperature: number
  readonly 'measure_temperature.outdoor': number
}

export interface ClassicListCapabilitiesErv extends BaseListCapabilities {
  readonly measure_pm25: number
}

export interface ClassicSetCapabilitiesErv extends BaseSetCapabilities {
  readonly fan_speed: FanSpeed
  readonly thermostat_mode: keyof typeof ThermostatModeErv
}

export type ThermostatModeErv =
  (typeof ThermostatModeErv)[keyof typeof ThermostatModeErv]

export const classicSetCapabilityTagMappingErv: Record<
  keyof ClassicSetCapabilitiesErv,
  keyof UpdateDeviceDataErv
> = {
  fan_speed: 'SetFanSpeed',
  onoff: 'Power',
  thermostat_mode: 'VentilationMode',
}

export const classicGetCapabilityTagMappingErv: Record<
  keyof ClassicGetCapabilitiesErv,
  keyof GetDeviceData<typeof DeviceType.Erv>
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
}

export const classicListCapabilityTagMappingErv: Record<
  keyof ClassicListCapabilitiesErv,
  keyof ListDeviceDataErv
> = {
  measure_pm25: 'PM25Level',
  measure_signal_strength: 'WifiSignalStrength',
}

export const classicEnergyCapabilityTagMappingErv: Record<string, never> = {}

export interface ClassicFlowArgsErv extends ClassicSetCapabilitiesErv {
  readonly device: ClassicMELCloudDeviceErv
}
