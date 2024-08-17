import type {
  EnergyDataAta,
  FanSpeed,
  GetDeviceDataAta,
  Horizontal,
  ListDeviceAta,
  ListDeviceDataAta,
  UpdateDeviceDataAta,
  Vertical,
} from '@olivierzal/melcloud-api'

import type AtaDevice from '../drivers/melcloud/device'

import {
  type BaseGetCapabilities,
  type BaseListCapabilities,
  type BaseSetCapabilities,
  type RangeOptions,
  AUTO,
  OFF,
} from './bases'

export enum ThermostatModeAta {
  auto = 'auto',
  cool = 'cool',
  dry = 'dry',
  fan = 'fan',
  heat = 'heat',
  off = 'off',
}

const THERMOSTAT_MODE_VALUES_ATA = [
  AUTO,
  {
    id: 'cool',
    title: {
      da: 'Køl ned',
      en: 'Cool',
      es: 'Enfriar',
      fr: 'Refroidir',
      nl: 'Koelen',
      no: 'Avkjøle',
      sv: 'Kyla',
    },
  },
  {
    id: 'dry',
    title: {
      da: 'Affugte',
      en: 'Dry',
      es: 'Deshumidificar',
      fr: 'Déshumidifier',
      nl: 'Ontvochtigen',
      no: 'Avfukte',
      sv: 'Avfukta',
    },
  },
  {
    id: 'fan',
    title: {
      da: 'Blæse',
      en: 'Fan',
      es: 'Ventilar',
      fr: 'Ventiler',
      nl: 'Ventileren',
      no: 'Vifte',
      sv: 'Fläkta',
    },
  },
  {
    id: 'heat',
    title: {
      da: 'Opvarm',
      en: 'Heat',
      es: 'Calentar',
      fr: 'Chauffer',
      nl: 'Verhitten',
      no: 'Varme',
      sv: 'Värme',
    },
  },
  OFF,
] as const

export interface SetCapabilitiesAta extends BaseSetCapabilities {
  readonly fan_power: FanSpeed
  readonly horizontal: keyof typeof Horizontal
  readonly target_temperature: number
  readonly thermostat_mode: keyof typeof ThermostatModeAta
  readonly vertical: keyof typeof Vertical
}

export interface GetCapabilitiesAta extends BaseGetCapabilities {
  readonly 'alarm_generic.silent': boolean
}

export interface ListCapabilitiesAta extends BaseListCapabilities {
  readonly 'alarm_generic.silent': boolean
  readonly fan_power: FanSpeed
  readonly fan_power_state: number
  readonly horizontal: keyof typeof Horizontal
  readonly 'measure_temperature.outdoor': number

  readonly vertical: keyof typeof Vertical
}

export interface OpCapabilitiesAta
  extends SetCapabilitiesAta,
    GetCapabilitiesAta,
    ListCapabilitiesAta {}

export interface EnergyCapabilitiesAta {
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

export interface CapabilitiesAta
  extends OpCapabilitiesAta,
    EnergyCapabilitiesAta {}

export const SET_CAPABILITY_TAGS_MAPPING_ATA: Record<
  keyof SetCapabilitiesAta,
  keyof UpdateDeviceDataAta
> = {
  fan_power: 'SetFanSpeed',
  horizontal: 'VaneHorizontal',
  onoff: 'Power',
  target_temperature: 'SetTemperature',
  thermostat_mode: 'OperationMode',
  vertical: 'VaneVertical',
}

export const GET_CAPABILITY_TAGS_MAPPING_ATA: Record<
  keyof GetCapabilitiesAta,
  keyof GetDeviceDataAta
> = {
  'alarm_generic.silent': 'SetFanSpeed',
  measure_temperature: 'RoomTemperature',
}

export const LIST_CAPABILITY_TAGS_MAPPING_ATA: Record<
  keyof ListCapabilitiesAta,
  keyof ListDeviceAta['Device']
> = {
  'alarm_generic.silent': 'FanSpeed',
  fan_power: 'FanSpeed',
  fan_power_state: 'ActualFanSpeed',
  horizontal: 'VaneHorizontalDirection',
  'measure_power.wifi': 'WifiSignalStrength',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  vertical: 'VaneVerticalDirection',
}

export const ENERGY_CAPABILITY_TAG_MAPPING_ATA: Record<
  keyof EnergyCapabilitiesAta,
  readonly (keyof EnergyDataAta)[]
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

export interface FlowArgsAta extends SetCapabilitiesAta {
  readonly device: AtaDevice
}

export interface CapabilitiesOptionsAta {
  readonly fan_power: RangeOptions
  readonly thermostat_mode: {
    readonly values: readonly {
      readonly id: keyof typeof ThermostatModeAta
      readonly title: Record<string, string>
    }[]
  }
}

export const getCapabilitiesOptionsAta = ({
  HasAutomaticFanSpeed: hasAutomaticFanSpeed,
  NumberOfFanSpeeds: numberOfFanSpeeds,
}: ListDeviceDataAta): Partial<CapabilitiesOptionsAta> => ({
  fan_power: {
    max: numberOfFanSpeeds,
    min: Number(!hasAutomaticFanSpeed),
    step: 1,
  },
  thermostat_mode: { values: THERMOSTAT_MODE_VALUES_ATA },
})
