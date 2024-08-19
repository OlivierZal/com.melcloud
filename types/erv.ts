import type {
  FanSpeed,
  GetDeviceDataErv,
  ListDeviceDataErv,
  ListDeviceErv,
  UpdateDeviceDataErv,
} from '@olivierzal/melcloud-api'

import type ErvDevice from '../drivers/melcloud/device'

import {
  type BaseGetCapabilities,
  type BaseListCapabilities,
  type BaseSetCapabilities,
  type RangeOptions,
  AUTO,
  OFF,
} from './bases'

export enum ThermostatModeErv {
  auto = 'auto',
  bypass = 'bypass',
  off = 'off',
  recovery = 'recovery',
}

const THERMOSTAT_MODE_VALUES_ERV = [
  AUTO,
  {
    id: 'bypass',
    title: {
      da: 'Bypass',
      en: 'Bypass',
      es: 'Bypass',
      fr: 'Bypass',
      nl: 'Bypass',
      no: 'Bypass',
      sv: 'Bypass',
    },
  },
  {
    id: 'recovery',
    title: {
      da: 'Varmegenvinding',
      en: 'Energy Recovery',
      es: 'Recuperación de energía',
      fr: "Récupération d'énergie",
      nl: 'Warmteterugwinning',
      no: 'Varmegjenvinning',
      sv: 'Värmeåtervinning',
    },
  },
  OFF,
] as const

export interface SetCapabilitiesErv extends BaseSetCapabilities {
  readonly fan_power: FanSpeed
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

export const SET_CAPABILITY_TAGS_MAPPING_ERV: Record<
  keyof SetCapabilitiesErv,
  keyof UpdateDeviceDataErv
> = {
  fan_power: 'SetFanSpeed',
  onoff: 'Power',
  thermostat_mode: 'VentilationMode',
}

export const GET_CAPABILITY_TAGS_MAPPING_ERV: Record<
  keyof GetCapabilitiesErv,
  keyof GetDeviceDataErv
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
}

export const LIST_CAPABILITY_TAGS_MAPPING_ERV: Record<
  keyof ListCapabilitiesErv,
  keyof ListDeviceErv['Device']
> = {
  measure_pm25: 'PM25Level',
  'measure_power.wifi': 'WifiSignalStrength',
}

export const ENERGY_CAPABILITY_TAG_MAPPING_ERV: Record<string, never> = {}

export interface FlowArgsErv extends SetCapabilitiesErv {
  readonly device: ErvDevice
}

export interface CapabilitiesOptionsErv {
  readonly fan_power: RangeOptions
  readonly thermostat_mode: {
    readonly values: readonly {
      readonly id: keyof typeof ThermostatModeErv
      readonly title: Record<string, string>
    }[]
  }
}

export const getCapabilitiesOptionsErv = ({
  HasAutomaticFanSpeed: hasAutomaticFanSpeed,
  NumberOfFanSpeeds: numberOfFanSpeeds,
}: ListDeviceDataErv): Partial<CapabilitiesOptionsErv> => ({
  fan_power: {
    max: numberOfFanSpeeds,
    min: Number(!hasAutomaticFanSpeed),
    step: 1,
  },
  thermostat_mode: { values: THERMOSTAT_MODE_VALUES_ERV },
})
