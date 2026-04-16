import type * as Classic from '@olivierzal/melcloud-api/classic'

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
  readonly fan_speed: Classic.FanSpeed
  readonly thermostat_mode: keyof typeof ThermostatModeErv
}

export const setCapabilityTagMapping: Record<
  keyof SetCapabilities,
  keyof Classic.UpdateDeviceDataErv
> = {
  fan_speed: 'SetFanSpeed',
  onoff: 'Power',
  thermostat_mode: 'ClassicVentilationMode',
}

export const getCapabilityTagMapping: Record<
  keyof GetCapabilities,
  keyof Classic.GetDeviceData<typeof Classic.DeviceType.Erv>
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
}

export const listCapabilityTagMapping: Record<
  keyof ListCapabilities,
  keyof Classic.ListDeviceDataErv
> = {
  measure_pm25: 'PM25Level',
  measure_signal_strength: 'WifiSignalStrength',
}

export const energyCapabilityTagMapping: Record<string, never> = {}
