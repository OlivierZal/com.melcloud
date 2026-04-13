import type {
  DeviceType,
  FanSpeed,
  GetDeviceData,
  ListDeviceDataErv,
  UpdateDeviceDataErv,
} from '@olivierzal/melcloud-api'

import type { ClassicMELCloudDeviceErv } from '../drivers/index.mts'
import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases.mts'
import type { ThermostatModeErv } from './erv.mts'

export type Capabilities = EnergyCapabilities &
  GetCapabilities &
  ListCapabilities &
  SetCapabilities

export type EnergyCapabilities = Record<string, never>

export interface GetCapabilities extends BaseGetCapabilities {
  readonly measure_co2: number
  readonly measure_temperature: number
  readonly 'measure_temperature.outdoor': number
}

export interface ListCapabilities extends BaseListCapabilities {
  readonly measure_pm25: number
}

export interface SetCapabilities extends BaseSetCapabilities {
  readonly fan_speed: FanSpeed
  readonly thermostat_mode: keyof typeof ThermostatModeErv
}

export const setCapabilityTagMapping: Record<
  keyof SetCapabilities,
  keyof UpdateDeviceDataErv
> = {
  fan_speed: 'SetFanSpeed',
  onoff: 'Power',
  thermostat_mode: 'VentilationMode',
}

export const getCapabilityTagMapping: Record<
  keyof GetCapabilities,
  keyof GetDeviceData<typeof DeviceType.Erv>
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
}

export const listCapabilityTagMapping: Record<
  keyof ListCapabilities,
  keyof ListDeviceDataErv
> = {
  measure_pm25: 'PM25Level',
  measure_signal_strength: 'WifiSignalStrength',
}

export const energyCapabilityTagMapping: Record<string, never> = {}

export interface FlowArgs extends SetCapabilities {
  readonly device: ClassicMELCloudDeviceErv
}
