import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from '.'
import type {
  FanSpeed,
  GetDeviceDataErv,
  ListDeviceErv,
  NonEffectiveFlagsKeyOf,
  UpdateDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'
import type ErvDevice from '../drivers/melcloud/device'

export interface StoreErv {
  readonly hasCO2Sensor: boolean
  readonly hasPM25Sensor: boolean
}

export const storeMappingErv: Record<
  keyof StoreErv,
  NonEffectiveFlagsKeyOf<ListDeviceErv['Device']>
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

export const setCapabilityTagMappingErv: Record<
  keyof SetCapabilitiesErv,
  NonEffectiveFlagsKeyOf<UpdateDeviceDataErv>
> = {
  fan_power: 'SetFanSpeed',
  onoff: 'Power',
  ventilation_mode: 'VentilationMode',
} as const

export const getCapabilityTagMappingErv: Record<
  keyof GetCapabilitiesErv,
  NonEffectiveFlagsKeyOf<GetDeviceDataErv>
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
} as const

export const listCapabilityTagMappingErv: Record<
  keyof ListCapabilitiesErv,
  NonEffectiveFlagsKeyOf<ListDeviceErv['Device']>
> = {
  measure_pm25: 'PM25Level',
  'measure_power.wifi': 'WifiSignalStrength',
} as const

export const energyCapabilityTagMappingErv: Record<string, never> = {} as const

export interface FlowArgsErv extends SetCapabilitiesErv {
  readonly device: ErvDevice
}
