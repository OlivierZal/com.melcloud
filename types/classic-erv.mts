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

export const tagMappings: {
  readonly energy: Record<string, never>
  readonly get: Record<
    keyof GetCapabilities,
    keyof Classic.GetDeviceData<typeof Classic.DeviceType.Erv>
  >
  readonly list: Record<keyof ListCapabilities, keyof Classic.ListDeviceDataErv>
  readonly set: Record<keyof SetCapabilities, keyof Classic.UpdateDeviceDataErv>
} = {
  energy: {},
  get: {
    measure_co2: 'RoomCO2Level',
    measure_temperature: 'RoomTemperature',
    'measure_temperature.outdoor': 'OutdoorTemperature',
  },
  list: {
    measure_pm25: 'PM25Level',
    measure_signal_strength: 'WifiSignalStrength',
  },
  set: {
    fan_speed: 'SetFanSpeed',
    onoff: 'Power',
    thermostat_mode: 'VentilationMode',
  },
}
