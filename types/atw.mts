import {
  type DeviceType,
  type EnergyDataAtw,
  type GetDeviceData,
  type ListDeviceDataAtw,
  type OperationModeStateHotWater,
  type OperationModeStateZone,
  type UpdateDeviceDataAtw,
  OperationModeState,
  OperationModeZone,
} from '@olivierzal/melcloud-api'

import type { ClassicMELCloudDeviceAtw } from '../drivers/index.mts'
import { thermostatMode } from '../files.mts'
import {
  type BaseGetCapabilities,
  type BaseListCapabilities,
  type BaseSetCapabilities,
  type CapabilitiesOptionsValues,
  type LocalizedStrings,
  type RangeOptions,
  localizeWithAffix,
} from './bases.mts'

export const operationModeStateFromDevice = {
  [OperationModeState.cooling]: 'cooling',
  [OperationModeState.defrost]: 'defrost',
  [OperationModeState.dhw]: 'dhw',
  [OperationModeState.heating]: 'heating',
  [OperationModeState.idle]: 'idle',
  [OperationModeState.legionella]: 'legionella',
} as const satisfies Record<OperationModeState, keyof typeof OperationModeState>

export const operationModeZoneFromDevice = {
  [OperationModeZone.curve]: 'curve',
  [OperationModeZone.flow]: 'flow',
  [OperationModeZone.flow_cool]: 'flow_cool',
  [OperationModeZone.room]: 'room',
  [OperationModeZone.room_cool]: 'room_cool',
} as const satisfies Record<OperationModeZone, keyof typeof OperationModeZone>

const addSuffixToTitle = (
  title: LocalizedStrings,
  suffix: LocalizedStrings,
): LocalizedStrings => localizeWithAffix(title, suffix, 'suffix')

const curve: CapabilitiesOptionsValues<'curve'> = {
  id: 'curve',
  title: {
    ar: 'منحنى التعويض المناخي',
    da: 'Varmekurve',
    de: 'Heizkurve',
    en: 'Weather compensation curve',
    es: 'Curva de calefacción',
    fr: 'Courbe de chauffe',
    it: 'Curva di compensazione climatica',
    ko: '기상 보상 곡선',
    nl: 'Weerscompensatiecurve',
    no: 'Varmekurve',
    pl: 'Krzywa kompensacji pogodowej',
    ru: 'Кривая погодозависимого регулирования',
    sv: 'Värmekurva',
  },
}

const flow: CapabilitiesOptionsValues<'flow'> = {
  id: 'flow',
  title: {
    ar: 'درجة حرارة تدفق ثابتة',
    da: 'Fast fremledningstemperatur',
    de: 'Feste Vorlauftemperatur',
    en: 'Fixed flow temperature',
    es: 'Temperatura de partida fija',
    fr: 'Température de départ fixe',
    it: 'Temperatura di mandata fissa',
    ko: '고정 유량 온도',
    nl: 'Vaste aanvoertemperatuur',
    no: 'Fast fremløpstemperatur',
    pl: 'Stała temperatura zasilania',
    ru: 'Фиксированная температура подачи',
    sv: 'Fast framledningstemperatur',
  },
}

const room: CapabilitiesOptionsValues<'room'> = {
  id: 'room',
  title: {
    ar: 'درجة الحرارة الداخلية',
    da: 'Indendørs føler',
    de: 'Innentemperatur',
    en: 'Indoor temperature',
    es: 'Temperatura interior',
    fr: 'Température intérieure',
    it: 'Temperatura interna',
    ko: '실내 온도',
    nl: 'Binnentemperatuur',
    no: 'Innendørs føler',
    pl: 'Temperatura wewnętrzna',
    ru: 'Температура в помещении',
    sv: 'Inomhusgivare',
  },
}

const COOL_SUFFIX = 'cool'

const createCoolObject = ({
  id,
  title,
}: {
  id: 'flow' | 'room'
  title: LocalizedStrings
}): CapabilitiesOptionsValues<keyof typeof OperationModeZone> => ({
  id: `${id}_${COOL_SUFFIX}`,
  title: addSuffixToTitle(title, {
    ar: '- تبريد',
    da: '- køling',
    de: '- Kühlung',
    en: '- cooling',
    es: '- enfriamiento',
    fr: '- refroidissement',
    it: '- raffrescamento',
    ko: '- 냉방',
    nl: '- koeling',
    no: '- kjøling',
    pl: '- chłodzenie',
    ru: '- охлаждение',
    sv: '- kylning',
  }),
})

const thermostatModeTitleAtw = addSuffixToTitle(thermostatMode.title, {
  ar: '- المنطقة 2',
  da: '- zone 2',
  de: '- Zone 2',
  en: '- zone 2',
  es: '- zona 2',
  fr: '- zone 2',
  it: '- zona 2',
  ko: '- 구역 2',
  nl: '- zone 2',
  no: '- sone 2',
  pl: '- strefa 2',
  ru: '- зона 2',
  sv: '- zon 2',
})

const thermostatModeValuesAtw = [
  room,
  flow,
  curve,
  createCoolObject(room),
  createCoolObject(flow),
]

export const classicGetCapabilitiesOptionsAtw = ({
  CanCool: canCool,
  HasZone2: hasZone2,
}: ListDeviceDataAtw): Partial<ClassicCapabilitiesOptionsAtw> => {
  const values =
    canCool ?
      thermostatModeValuesAtw
    : thermostatModeValuesAtw.filter(({ id }) => !id.endsWith(COOL_SUFFIX))
  return {
    thermostat_mode: { values },
    ...(hasZone2 && {
      'thermostat_mode.zone2': { title: thermostatModeTitleAtw, values },
    }),
  }
}

export const ClassicHotWaterMode = {
  auto: 'auto',
  forced: 'forced',
} as const

export interface ClassicCapabilitiesAtw
  extends
    ClassicEnergyCapabilitiesAtw,
    ClassicGetCapabilitiesAtw,
    ClassicListCapabilitiesAtw,
    ClassicSetCapabilitiesAtw {
  readonly 'operational_state.hot_water': OperationModeStateHotWater
  readonly 'operational_state.zone1': OperationModeStateZone
  readonly 'operational_state.zone2': OperationModeStateZone
}

export interface ClassicEnergyCapabilitiesAtw {
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

export interface ClassicGetCapabilitiesAtw extends BaseGetCapabilities {
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operational_state: keyof typeof OperationModeState
}

export type ClassicHotWaterMode =
  (typeof ClassicHotWaterMode)[keyof typeof ClassicHotWaterMode]

export interface ClassicListCapabilitiesAtw extends BaseListCapabilities {
  readonly 'alarm_generic.booster_heater1': boolean
  readonly 'alarm_generic.booster_heater2': boolean
  readonly 'alarm_generic.booster_heater2_plus': boolean
  readonly 'alarm_generic.defrost': boolean
  readonly 'alarm_generic.eco_hot_water': boolean
  readonly 'alarm_generic.immersion_heater': boolean
  readonly legionella: string
  readonly measure_frequency: number
  readonly measure_power: number
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

export interface ClassicSetCapabilitiesAtw
  extends BaseSetCapabilities, ClassicTargetTemperatureFlowCapabilities {
  readonly hot_water_mode: keyof typeof ClassicHotWaterMode
  readonly target_temperature: number
  readonly 'target_temperature.tank_water': number
  readonly 'target_temperature.zone2': number
  readonly thermostat_mode: keyof typeof OperationModeZone
  readonly 'thermostat_mode.zone2': keyof typeof OperationModeZone
}

export interface ClassicTargetTemperatureFlowCapabilities {
  readonly 'target_temperature.flow_cool': number
  readonly 'target_temperature.flow_cool_zone2': number
  readonly 'target_temperature.flow_heat': number
  readonly 'target_temperature.flow_heat_zone2': number
}

export const classicSetCapabilityTagMappingAtw: Record<
  keyof ClassicSetCapabilitiesAtw,
  keyof UpdateDeviceDataAtw
> = {
  hot_water_mode: 'ForcedHotWaterMode',
  onoff: 'Power',
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

export const classicGetCapabilityTagMappingAtw: Record<
  keyof ClassicGetCapabilitiesAtw,
  keyof GetDeviceData<typeof DeviceType.Atw>
> = {
  measure_temperature: 'RoomTemperatureZone1',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  'measure_temperature.tank_water': 'TankWaterTemperature',
  'measure_temperature.zone2': 'RoomTemperatureZone2',
  operational_state: 'OperationMode',
}

export const classicListCapabilityTagMappingAtw: Record<
  keyof ClassicListCapabilitiesAtw,
  keyof ListDeviceDataAtw
> = {
  'alarm_generic.booster_heater1': 'BoosterHeater1Status',
  'alarm_generic.booster_heater2': 'BoosterHeater2Status',
  'alarm_generic.booster_heater2_plus': 'BoosterHeater2PlusStatus',
  'alarm_generic.defrost': 'DefrostMode',
  'alarm_generic.eco_hot_water': 'EcoHotWater',
  'alarm_generic.immersion_heater': 'ImmersionHeaterStatus',
  legionella: 'LastLegionellaActivationTime',
  measure_frequency: 'HeatPumpFrequency',
  measure_power: 'CurrentEnergyConsumed',
  'measure_power.produced': 'CurrentEnergyProduced',
  measure_signal_strength: 'WifiSignalStrength',
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

export const classicEnergyCapabilityTagMappingAtw: Record<
  keyof ClassicEnergyCapabilitiesAtw,
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

export interface ClassicCapabilitiesOptionsAtw {
  readonly 'target_temperature.flow_cool': RangeOptions
  readonly 'target_temperature.flow_cool_zone2': RangeOptions
  readonly 'target_temperature.flow_heat': RangeOptions
  readonly 'target_temperature.flow_heat_zone2': RangeOptions
  readonly thermostat_mode: {
    readonly values: readonly CapabilitiesOptionsValues<
      keyof typeof OperationModeZone
    >[]
  }
  readonly 'thermostat_mode.zone2': {
    readonly title: LocalizedStrings
    readonly values: readonly {
      readonly id: keyof typeof OperationModeZone
      readonly title: LocalizedStrings
    }[]
  }
}

export interface ClassicFlowArgsAtw {
  readonly device: ClassicMELCloudDeviceAtw
  readonly onoff: boolean
  readonly operation_mode_zone: keyof typeof OperationModeZone
  readonly operational_state: keyof typeof OperationModeState
  readonly target_temperature: number
}
