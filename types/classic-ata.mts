import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { ThermostatModeAta } from './ata.mts'
import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases.mts'

export interface Capabilities
  extends
    EnergyCapabilities,
    GetCapabilities,
    ListCapabilities,
    SetCapabilities {}

export interface EnergyCapabilities {
  readonly measure_power: number
  readonly 'measure_power.auto': number
  readonly 'measure_power.cooling': number
  readonly 'measure_power.dry': number
  readonly 'measure_power.fan': number
  readonly 'measure_power.heating': number
  readonly 'measure_power.other': number
  readonly meter_power: number
  readonly 'meter_power.auto': number
  readonly 'meter_power.cooling': number
  readonly 'meter_power.daily': number
  readonly 'meter_power.daily_auto': number
  readonly 'meter_power.daily_cooling': number
  readonly 'meter_power.daily_dry': number
  readonly 'meter_power.daily_fan': number
  readonly 'meter_power.daily_heating': number
  readonly 'meter_power.daily_other': number
  readonly 'meter_power.dry': number
  readonly 'meter_power.fan': number
  readonly 'meter_power.heating': number
  readonly 'meter_power.other': number
}

export interface GetCapabilities extends BaseGetCapabilities {
  readonly 'alarm_generic.silent': boolean
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

export interface ListCapabilities extends BaseListCapabilities {
  readonly 'alarm_generic.silent': boolean
  readonly 'fan_speed.state': number
  readonly 'measure_temperature.outdoor': number
}

export interface SetCapabilities extends BaseSetCapabilities {
  readonly fan_speed: Classic.FanSpeed
  readonly horizontal: keyof typeof Classic.Horizontal
  readonly target_temperature: number
  readonly thermostat_mode: keyof typeof ThermostatModeAta
  readonly vertical: keyof typeof Classic.Vertical
}

export const setCapabilityTagMapping: Record<
  keyof SetCapabilities,
  keyof Classic.UpdateDeviceDataAta
> = {
  fan_speed: 'SetFanSpeed',
  horizontal: 'VaneHorizontal',
  onoff: 'Power',
  target_temperature: 'SetTemperature',
  thermostat_mode: 'OperationMode',
  vertical: 'VaneVertical',
}

export const getCapabilityTagMapping: Record<
  keyof GetCapabilities,
  keyof Classic.GetDeviceData<typeof Classic.DeviceType.Ata>
> = {
  'alarm_generic.silent': 'SetFanSpeed',
  measure_temperature: 'RoomTemperature',
}

export const listCapabilityTagMapping: Record<
  'fan_speed' | 'horizontal' | 'vertical' | keyof ListCapabilities,
  keyof Classic.ListDeviceDataAta
> = {
  'alarm_generic.silent': 'FanSpeed',
  fan_speed: 'FanSpeed',
  'fan_speed.state': 'ActualFanSpeed',
  horizontal: 'VaneHorizontalDirection',
  measure_signal_strength: 'WifiSignalStrength',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  vertical: 'VaneVerticalDirection',
}

export const energyCapabilityTagMapping: Record<
  keyof EnergyCapabilities,
  readonly (keyof Classic.EnergyDataAta)[]
> = {
  measure_power: ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'],
  'measure_power.auto': ['Auto'],
  'measure_power.cooling': ['Cooling'],
  'measure_power.dry': ['Dry'],
  'measure_power.fan': ['Fan'],
  'measure_power.heating': ['Heating'],
  'measure_power.other': ['Other'],
  meter_power: [
    'TotalAutoConsumed',
    'TotalCoolingConsumed',
    'TotalDryConsumed',
    'TotalFanConsumed',
    'TotalHeatingConsumed',
    'TotalOtherConsumed',
  ],
  'meter_power.auto': ['TotalAutoConsumed'],
  'meter_power.cooling': ['TotalCoolingConsumed'],
  'meter_power.daily': [
    'TotalAutoConsumed',
    'TotalCoolingConsumed',
    'TotalDryConsumed',
    'TotalFanConsumed',
    'TotalHeatingConsumed',
    'TotalOtherConsumed',
  ],
  'meter_power.daily_auto': ['TotalAutoConsumed'],
  'meter_power.daily_cooling': ['TotalCoolingConsumed'],
  'meter_power.daily_dry': ['TotalDryConsumed'],
  'meter_power.daily_fan': ['TotalFanConsumed'],
  'meter_power.daily_heating': ['TotalHeatingConsumed'],
  'meter_power.daily_other': ['TotalOtherConsumed'],
  'meter_power.dry': ['TotalDryConsumed'],
  'meter_power.fan': ['TotalFanConsumed'],
  'meter_power.heating': ['TotalHeatingConsumed'],
  'meter_power.other': ['TotalOtherConsumed'],
}
