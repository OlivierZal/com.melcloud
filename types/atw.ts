import type {
  EnergyDataAtw,
  GetDeviceDataAtw,
  ListDeviceAtw,
  ListDeviceDataAtw,
  OperationModeState,
  OperationModeZone,
  UpdateDeviceDataAtw,
} from '@olivierzal/melcloud-api'

import type AtwDevice from '../drivers/melcloud/device'

import {
  type BaseGetCapabilities,
  type BaseListCapabilities,
  type BaseSetCapabilities,
  type RangeOptions,
  THERMOSTAT_MODE_TITLE,
} from './bases'

export enum OperationModeStateHotWaterCapability {
  dhw = 'dhw',
  idle = 'idle',
  legionella = 'legionella',
  prohibited = 'prohibited',
}

export enum OperationModeStateZoneCapability {
  cooling = 'cooling',
  defrost = 'defrost',
  heating = 'heating',
  idle = 'idle',
  prohibited = 'prohibited',
}

export type Zone = 'zone1' | 'zone2'

export interface TargetTemperatureFlowCapabilities {
  readonly 'target_temperature.flow_cool': number
  readonly 'target_temperature.flow_cool_zone2': number
  readonly 'target_temperature.flow_heat': number
  readonly 'target_temperature.flow_heat_zone2': number
}

export interface SetCapabilitiesAtw
  extends BaseSetCapabilities,
    TargetTemperatureFlowCapabilities {
  readonly 'onoff.forced_hot_water': boolean
  readonly target_temperature: number
  readonly 'target_temperature.tank_water': number
  readonly 'target_temperature.zone2': number
  readonly thermostat_mode: keyof typeof OperationModeZone
  readonly 'thermostat_mode.zone2': keyof typeof OperationModeZone
}

export interface GetCapabilitiesAtw extends BaseGetCapabilities {
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operation_mode_state: keyof typeof OperationModeState
}

export interface ListCapabilitiesAtw extends BaseListCapabilities {
  readonly 'alarm_generic.booster_heater1': boolean
  readonly 'alarm_generic.booster_heater2': boolean
  readonly 'alarm_generic.booster_heater2_plus': boolean
  readonly 'alarm_generic.defrost': boolean
  readonly 'alarm_generic.eco_hot_water': boolean
  readonly 'alarm_generic.immersion_heater': boolean
  readonly legionella: string
  readonly measure_power: number
  readonly 'measure_power.heat_pump_frequency': number
  readonly 'measure_power.produced': number
  readonly 'measure_temperature.condensing': number
  readonly 'measure_temperature.flow': number
  readonly 'measure_temperature.flow_zone1': number
  readonly 'measure_temperature.flow_zone2': number
  readonly 'measure_temperature.return': number
  readonly 'measure_temperature.return_zone1': number
  readonly 'measure_temperature.return_zone2': number
  readonly 'measure_temperature.tank_water_mixing': number
  readonly 'measure_temperature.target_curve': number
  readonly 'measure_temperature.target_curve_zone2': number
}

export interface OpCapabilitiesAtw
  extends SetCapabilitiesAtw,
    GetCapabilitiesAtw,
    ListCapabilitiesAtw {}

export interface EnergyCapabilitiesAtw {
  readonly meter_power: number
  readonly 'meter_power.cooling': number
  readonly 'meter_power.cop': number
  readonly 'meter_power.cop_cooling': number
  readonly 'meter_power.cop_daily': number
  readonly 'meter_power.cop_daily_cooling': number
  readonly 'meter_power.cop_daily_heating': number
  readonly 'meter_power.cop_daily_hotwater': number
  readonly 'meter_power.cop_heating': number
  readonly 'meter_power.cop_hotwater': number
  readonly 'meter_power.daily': number
  readonly 'meter_power.daily_cooling': number
  readonly 'meter_power.daily_heating': number
  readonly 'meter_power.daily_hotwater': number
  readonly 'meter_power.heating': number
  readonly 'meter_power.hotwater': number
  readonly 'meter_power.produced': number
  readonly 'meter_power.produced_cooling': number
  readonly 'meter_power.produced_daily': number
  readonly 'meter_power.produced_daily_cooling': number
  readonly 'meter_power.produced_daily_heating': number
  readonly 'meter_power.produced_daily_hotwater': number
  readonly 'meter_power.produced_heating': number
  readonly 'meter_power.produced_hotwater': number
}

export interface CapabilitiesAtw
  extends OpCapabilitiesAtw,
    EnergyCapabilitiesAtw {
  readonly 'operation_mode_state.hot_water': OperationModeStateHotWaterCapability
  readonly 'operation_mode_state.zone1': OperationModeStateZoneCapability
  readonly 'operation_mode_state.zone2': OperationModeStateZoneCapability
}

export const SET_CAPABILITY_TAGS_MAPPING_ATW: Record<
  keyof SetCapabilitiesAtw,
  keyof UpdateDeviceDataAtw
> = {
  onoff: 'Power',
  'onoff.forced_hot_water': 'ForcedHotWaterMode',
  target_temperature: 'SetTemperatureZone1',
  'target_temperature.flow_cool': 'SetCoolFlowTemperatureZone1',
  'target_temperature.flow_cool_zone2': 'SetCoolFlowTemperatureZone2',
  'target_temperature.flow_heat': 'SetHeatFlowTemperatureZone1',
  'target_temperature.flow_heat_zone2': 'SetHeatFlowTemperatureZone2',
  'target_temperature.tank_water': 'SetTankWaterTemperature',
  'target_temperature.zone2': 'SetTemperatureZone2',
  thermostat_mode: 'OperationModeZone1',
  'thermostat_mode.zone2': 'OperationModeZone2',
}

export const GET_CAPABILITY_TAGS_MAPPING_ATW: Record<
  keyof GetCapabilitiesAtw,
  keyof GetDeviceDataAtw
> = {
  measure_temperature: 'RoomTemperatureZone1',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  'measure_temperature.tank_water': 'TankWaterTemperature',
  'measure_temperature.zone2': 'RoomTemperatureZone2',
  operation_mode_state: 'OperationMode',
}

export const LIST_CAPABILITY_TAGS_MAPPING_ATW: Record<
  keyof ListCapabilitiesAtw,
  keyof ListDeviceAtw['Device']
> = {
  'alarm_generic.booster_heater1': 'BoosterHeater1Status',
  'alarm_generic.booster_heater2': 'BoosterHeater2Status',
  'alarm_generic.booster_heater2_plus': 'BoosterHeater2PlusStatus',
  'alarm_generic.defrost': 'DefrostMode',
  'alarm_generic.eco_hot_water': 'EcoHotWater',
  'alarm_generic.immersion_heater': 'ImmersionHeaterStatus',
  legionella: 'LastLegionellaActivationTime',
  measure_power: 'CurrentEnergyConsumed',
  'measure_power.heat_pump_frequency': 'HeatPumpFrequency',
  'measure_power.produced': 'CurrentEnergyProduced',
  'measure_power.wifi': 'WifiSignalStrength',
  'measure_temperature.condensing': 'CondensingTemperature',
  'measure_temperature.flow': 'FlowTemperature',
  'measure_temperature.flow_zone1': 'FlowTemperatureZone1',
  'measure_temperature.flow_zone2': 'FlowTemperatureZone2',
  'measure_temperature.return': 'ReturnTemperature',
  'measure_temperature.return_zone1': 'ReturnTemperatureZone1',
  'measure_temperature.return_zone2': 'ReturnTemperatureZone2',
  'measure_temperature.tank_water_mixing': 'MixingTankWaterTemperature',
  'measure_temperature.target_curve': 'TargetHCTemperatureZone1',
  'measure_temperature.target_curve_zone2': 'TargetHCTemperatureZone2',
}

export const ENERGY_CAPABILITY_TAG_MAPPING_ATW: Record<
  keyof EnergyCapabilitiesAtw,
  readonly (keyof EnergyDataAtw)[]
> = {
  meter_power: [
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.cooling': ['TotalCoolingConsumed'],
  'meter_power.cop': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.cop_cooling': ['TotalCoolingProduced', 'TotalCoolingConsumed'],
  'meter_power.cop_daily': ['CoP'],
  'meter_power.cop_daily_cooling': [
    'TotalCoolingProduced',
    'TotalCoolingConsumed',
  ],
  'meter_power.cop_daily_heating': [
    'TotalHeatingProduced',
    'TotalHeatingConsumed',
  ],
  'meter_power.cop_daily_hotwater': [
    'TotalHotWaterProduced',
    'TotalHotWaterConsumed',
  ],
  'meter_power.cop_heating': ['TotalHeatingProduced', 'TotalHeatingConsumed'],
  'meter_power.cop_hotwater': [
    'TotalHotWaterProduced',
    'TotalHotWaterConsumed',
  ],
  'meter_power.daily': [
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.daily_cooling': ['TotalCoolingConsumed'],
  'meter_power.daily_heating': ['TotalHeatingConsumed'],
  'meter_power.daily_hotwater': ['TotalHotWaterConsumed'],
  'meter_power.heating': ['TotalHeatingConsumed'],
  'meter_power.hotwater': ['TotalHotWaterConsumed'],
  'meter_power.produced': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
  ],
  'meter_power.produced_cooling': ['TotalCoolingProduced'],
  'meter_power.produced_daily': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
  ],
  'meter_power.produced_daily_cooling': ['TotalCoolingProduced'],
  'meter_power.produced_daily_heating': ['TotalHeatingProduced'],
  'meter_power.produced_daily_hotwater': ['TotalHotWaterProduced'],
  'meter_power.produced_heating': ['TotalHeatingProduced'],
  'meter_power.produced_hotwater': ['TotalHotWaterProduced'],
}

export interface FlowArgsAtw {
  readonly device: AtwDevice
  readonly onoff: boolean
  readonly operation_mode_state: keyof typeof OperationModeState
  readonly operation_mode_zone: keyof typeof OperationModeZone
  readonly target_temperature: number
}

export interface CapabilitiesOptionsAtw {
  readonly 'target_temperature.flow_cool': RangeOptions
  readonly 'target_temperature.flow_cool_zone2': RangeOptions
  readonly 'target_temperature.flow_heat': RangeOptions
  readonly 'target_temperature.flow_heat_zone2': RangeOptions
  readonly thermostat_mode: {
    readonly values: readonly {
      readonly id: keyof typeof OperationModeZone
      readonly title: Record<string, string>
    }[]
  }
  readonly 'thermostat_mode.zone2': {
    readonly title: Record<string, string>
    readonly values: readonly {
      readonly id: keyof typeof OperationModeZone
      readonly title: Record<string, string>
    }[]
  }
}

const ZONE2_SUFFIX = {
  da: 'zone 2',
  en: 'zone 2',
  es: 'zona 2',
  fr: 'zone 2',
  nl: 'zone 2',
  no: 'sone 2',
  sv: 'zon 2',
}
const createZone2Title = (
  title: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ZONE2_SUFFIX).map(([language, suffix]) => [
      language,
      `${title[language]} - ${suffix}`,
    ]),
  )
const THERMOSTAT_MODE_TITLE_ATW = createZone2Title(THERMOSTAT_MODE_TITLE)

const CURVE = {
  id: 'curve',
  title: {
    da: 'Varmekurve',
    en: 'Weather compensation curve',
    es: 'Curva de compensación climática',
    fr: 'Courbe de compensation météo',
    nl: 'Weerscompensatiecurve',
    no: 'Varmekurve',
    sv: 'Värmekurva',
  },
} as const
const FLOW = {
  id: 'flow',
  title: {
    da: 'Fast fremledningstemperatur',
    en: 'Fixed flow temperature',
    es: 'Temperatura de flujo fija',
    fr: 'Température de flux fixe',
    nl: 'Vaste aanvoertemperatuur',
    no: 'Fast fremløpstemperatur',
    sv: 'Fast framledningstemperatur',
  },
} as const
const ROOM = {
  id: 'room',
  title: {
    da: 'Indendørs føler',
    en: 'Indoor temperature',
    es: 'Temperatura interior',
    fr: 'Température intérieure',
    nl: 'Binnentemperatuur',
    no: 'Innendørs føler',
    sv: 'Inomhusgivare',
  },
} as const

const COOL_SUFFIX = {
  id: 'cool',
  title: {
    da: 'køling',
    en: 'cooling',
    es: 'enfriamiento',
    fr: 'refroidissement',
    nl: 'koeling',
    no: 'kjøling',
    sv: 'kylning',
  },
} as const
const createCoolObject = ({
  id,
  title,
}: {
  id: 'flow' | 'room'
  title: Record<string, string>
}) =>
  ({
    id: `${id}_${COOL_SUFFIX.id}`,
    title: Object.fromEntries(
      Object.entries(COOL_SUFFIX.title).map(([language, suffix]) => [
        language,
        `${title[language]} - ${suffix}`,
      ]),
    ),
  }) as const
const FLOW_COOL = createCoolObject(FLOW)
const ROOM_COOL = createCoolObject(ROOM)

const THERMOSTAT_MODE_VALUES_ATW = [ROOM, FLOW, CURVE, ROOM_COOL, FLOW_COOL]

export const getCapabilitiesOptionsAtw = ({
  CanCool: canCool,
  HasZone2: hasZone2,
}: ListDeviceDataAtw): Partial<CapabilitiesOptionsAtw> => {
  const thermostatModeValues =
    canCool ?
      THERMOSTAT_MODE_VALUES_ATW
    : THERMOSTAT_MODE_VALUES_ATW.filter(
        ({ id }) => !id.endsWith(COOL_SUFFIX.id),
      )
  return {
    thermostat_mode: { values: thermostatModeValues },
    ...(hasZone2 ?
      {
        'thermostat_mode.zone2': {
          title: THERMOSTAT_MODE_TITLE_ATW,
          values: thermostatModeValues,
        },
      }
    : {}),
  }
}
