import type { DateObjectUnits, DurationLike } from 'luxon'
import type {
  DeviceData,
  DeviceType,
  FanSpeed,
  FrostProtectionPostData,
  Horizontal,
  ListDevice,
  LoginCredentials,
  NonEffectiveFlagsKeyOf,
  NonEffectiveFlagsValueOf,
  OperationMode,
  OperationModeState,
  OperationModeZone,
  ReportData,
  SetDeviceData,
  VentilationMode,
  Vertical,
} from './melcloud/types'
import type AtaDevice from './drivers/melcloud/device'
import type AtaDriver from './drivers/melcloud/driver'
import type AtwDevice from './drivers/melcloud_atw/device'
import type AtwDriver from './drivers/melcloud_atw/driver'
import type ErvDevice from './drivers/melcloud_erv/device'
import type ErvDriver from './drivers/melcloud_erv/driver'

export enum ThermostatMode {
  auto = 'auto',
  cool = 'cool',
  heat = 'heat',
  off = 'off',
}

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

export interface MELCloudDriver {
  readonly Ata: AtaDriver
  readonly Atw: AtwDriver
  readonly Erv: ErvDriver
}
export type MELCloudDevice = AtaDevice | AtwDevice | ErvDevice

export type ValueOf<T> = T[keyof T]

export interface Settings
  extends Record<string, boolean | number | string | null | undefined> {
  readonly always_on?: boolean
}

export interface Store {
  readonly Ata: {
    readonly maxTempAutomatic: number
    readonly maxTempCoolDry: number
    readonly maxTempHeat: number
    readonly minTempAutomatic: number
    readonly minTempCoolDry: number
    readonly minTempHeat: number
  }
  readonly Atw: {
    readonly canCool: boolean
    readonly hasZone2: boolean
    readonly maxTankTemperature: number
  }
  readonly Erv: {
    readonly hasCO2Sensor: boolean
    readonly hasPM25Sensor: boolean
  }
}
export const storeMappingAta: Record<
  keyof Store['Ata'],
  NonEffectiveFlagsKeyOf<ListDevice['Ata']['Device']>
> = {
  maxTempAutomatic: 'MaxTempAutomatic',
  maxTempCoolDry: 'MaxTempCoolDry',
  maxTempHeat: 'MaxTempHeat',
  minTempAutomatic: 'MinTempAutomatic',
  minTempCoolDry: 'MinTempCoolDry',
  minTempHeat: 'MinTempHeat',
} as const
export const storeMappingAtw: Record<
  keyof Store['Atw'],
  NonEffectiveFlagsKeyOf<ListDevice['Atw']['Device']>
> = {
  canCool: 'CanCool',
  hasZone2: 'HasZone2',
  maxTankTemperature: 'MaxTankTemperature',
} as const
export const storeMappingErv: Record<
  keyof Store['Erv'],
  NonEffectiveFlagsKeyOf<ListDevice['Erv']['Device']>
> = { hasCO2Sensor: 'HasCO2Sensor', hasPM25Sensor: 'HasPM25Sensor' } as const
export interface StoreMapping {
  readonly Ata: typeof storeMappingAta
  readonly Atw: typeof storeMappingAtw
  readonly Erv: typeof storeMappingErv
}

export interface HomeySettingsUI {
  readonly contextKey?: string
  readonly expiry?: string
  readonly password?: string
  readonly username?: string
}

export interface ReportPlanParameters {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly values: DateObjectUnits
}

export interface ManifestDriverSettingData {
  readonly max?: number
  readonly min?: number
  readonly units?: string
  readonly values?: readonly {
    readonly id: string
    readonly label: Record<string, string>
  }[]
  readonly id: string
  readonly label: Record<string, string>
  readonly type: string
}
export interface ManifestDriverSetting {
  readonly children?: readonly ManifestDriverSettingData[]
  readonly id?: string
  readonly label: Record<string, string>
}
export interface PairSetting {
  readonly id: string
}
export interface LoginSetting extends PairSetting {
  readonly id: 'login'
  readonly options: {
    readonly passwordLabel: Record<string, string>
    readonly passwordPlaceholder: Record<string, string>
    readonly usernameLabel: Record<string, string>
    readonly usernamePlaceholder: Record<string, string>
  }
}
export interface ManifestDriver {
  readonly capabilitiesOptions?: Record<
    string,
    { readonly title?: Record<string, string> }
  >
  readonly pair?: LoginSetting & readonly PairSetting[]
  readonly settings?: readonly ManifestDriverSetting[]
  readonly id: string
}

export interface DriverSetting {
  placeholder?: string
  readonly groupId?: string
  readonly groupLabel?: string
  readonly max?: number
  readonly min?: number
  readonly units?: string
  readonly values?: readonly { readonly id: string, readonly label: string }[]
  title: string
  readonly driverId: string
  readonly id: string
  readonly type: string
}
export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}

export type DeviceSetting = Record<string, ValueOf<Settings>[]>
export type DeviceSettings = Record<string, DeviceSetting>

export type OpDeviceData<T extends keyof typeof DeviceType> =
  | NonEffectiveFlagsKeyOf<DeviceData[T]>
  | NonEffectiveFlagsKeyOf<ListDevice[T]['Device']>

interface BaseSetCapabilities {
  readonly onoff: boolean
}
interface BaseGetCapabilities {
  readonly measure_temperature: number
}
interface BaseListCapabilities {
  readonly 'measure_power.wifi': number
}

interface SetCapabilitiesAta extends BaseSetCapabilities {
  readonly fan_power: FanSpeed
  readonly horizontal: keyof typeof Horizontal
  readonly operation_mode: keyof typeof OperationMode
  readonly target_temperature: number
  readonly vertical: keyof typeof Vertical
}
type GetCapabilitiesAta = BaseGetCapabilities & {
  readonly 'alarm_generic.silent': boolean
}
interface ListCapabilitiesAta extends BaseListCapabilities {
  readonly 'alarm_generic.silent': boolean
  readonly 'fan_power': FanSpeed
  readonly 'fan_power_state': number
  readonly 'horizontal': keyof typeof Horizontal
  readonly 'measure_temperature.outdoor': number

  readonly 'vertical': keyof typeof Vertical
}
type OpCapabilitiesAta = GetCapabilitiesAta &
  ListCapabilitiesAta &
  SetCapabilitiesAta
interface ReportCapabilitiesAta {
  readonly 'measure_power': number
  readonly 'measure_power.auto': number
  readonly 'measure_power.cooling': number
  readonly 'measure_power.dry': number
  readonly 'measure_power.fan': number
  readonly 'measure_power.heating': number
  readonly 'measure_power.other': number
  readonly 'meter_power': number
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

export interface OperationModeZoneCapabilities {
  readonly 'operation_mode_zone': keyof typeof OperationModeZone
  readonly 'operation_mode_zone.zone2': keyof typeof OperationModeZone
  readonly 'operation_mode_zone_with_cool': keyof typeof OperationModeZone
  readonly 'operation_mode_zone_with_cool.zone2': keyof typeof OperationModeZone
}
export interface TargetTemperatureFlowCapabilities {
  readonly 'target_temperature.flow_cool': number
  readonly 'target_temperature.flow_cool_zone2': number
  readonly 'target_temperature.flow_heat': number
  readonly 'target_temperature.flow_heat_zone2': number
}
interface SetCapabilitiesAtw
  extends BaseSetCapabilities,
  OperationModeZoneCapabilities,
  TargetTemperatureFlowCapabilities {
  readonly 'onoff.forced_hot_water': boolean
  readonly 'target_temperature': number
  readonly 'target_temperature.tank_water': number
  readonly 'target_temperature.zone2': number
}
interface GetCapabilitiesAtw extends BaseGetCapabilities {
  readonly 'boolean.idle_zone1': boolean
  readonly 'boolean.idle_zone2': boolean
  readonly 'boolean.prohibit_cooling_zone1': boolean
  readonly 'boolean.prohibit_cooling_zone2': boolean
  readonly 'boolean.prohibit_heating_zone1': boolean
  readonly 'boolean.prohibit_heating_zone2': boolean
  readonly 'boolean.prohibit_hot_water': boolean
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly 'operation_mode_state': keyof typeof OperationModeState
}
interface ListCapabilitiesAtw extends BaseListCapabilities {
  readonly 'alarm_generic.booster_heater1': boolean
  readonly 'alarm_generic.booster_heater2': boolean
  readonly 'alarm_generic.booster_heater2_plus': boolean
  readonly 'alarm_generic.defrost': boolean
  readonly 'alarm_generic.eco_hot_water': boolean
  readonly 'alarm_generic.immersion_heater': boolean
  readonly 'boolean.cooling_zone1': boolean
  readonly 'boolean.cooling_zone2': boolean
  readonly 'boolean.heating_zone1': boolean
  readonly 'boolean.heating_zone2': boolean
  readonly 'legionella': string
  readonly 'measure_power': number
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
type OpCapabilitiesAtw = GetCapabilitiesAtw &
  ListCapabilitiesAtw &
  SetCapabilitiesAtw
interface ReportCapabilitiesAtw {
  readonly 'meter_power': number
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

interface SetCapabilitiesErv extends BaseSetCapabilities {
  readonly fan_power: FanSpeed
  readonly ventilation_mode: keyof typeof VentilationMode
}
interface GetCapabilitiesErv extends BaseGetCapabilities {
  readonly 'measure_co2': number
  readonly 'measure_temperature': number
  readonly 'measure_temperature.outdoor': number
}
interface ListCapabilitiesErv extends BaseListCapabilities {
  readonly measure_pm25: number
}
type OpCapabilitiesErv = GetCapabilitiesErv &
  ListCapabilitiesErv &
  SetCapabilitiesErv

export interface SetCapabilities {
  readonly Ata: SetCapabilitiesAta
  readonly Atw: SetCapabilitiesAtw
  readonly Erv: SetCapabilitiesErv
}
export interface OpCapabilities {
  readonly Ata: OpCapabilitiesAta
  readonly Atw: OpCapabilitiesAtw
  readonly Erv: OpCapabilitiesErv
}
export interface ReportCapabilities {
  readonly Ata: ReportCapabilitiesAta
  readonly Atw: ReportCapabilitiesAtw
  readonly Erv: Record<string, never>
}
export interface Capabilities {
  Ata: OpCapabilities['Ata'] &
  ReportCapabilities['Ata'] & { readonly thermostat_mode: ThermostatMode }
  Atw: OpCapabilities['Atw'] &
  ReportCapabilities['Atw'] & {
    readonly 'operation_mode_state.hot_water':
    OperationModeStateHotWaterCapability
    readonly 'operation_mode_state.zone1': OperationModeStateZoneCapability
    readonly 'operation_mode_state.zone2': OperationModeStateZoneCapability
  }
  Erv: OpCapabilities['Erv'] & ReportCapabilities['Erv']
}

export const setCapabilityTagMappingAta: Record<
  keyof SetCapabilitiesAta,
  NonEffectiveFlagsKeyOf<SetDeviceData['Ata']>
> = {
  fan_power: 'SetFanSpeed',
  horizontal: 'VaneHorizontal',
  onoff: 'Power',
  operation_mode: 'OperationMode',
  target_temperature: 'SetTemperature',
  vertical: 'VaneVertical',
} as const
export const getCapabilityTagMappingAta: Record<
  keyof GetCapabilitiesAta,
  NonEffectiveFlagsKeyOf<DeviceData['Ata']>
> = {
  'alarm_generic.silent': 'SetFanSpeed',
  'measure_temperature': 'RoomTemperature',
} as const
export const listCapabilityTagMappingAta: Record<
  keyof ListCapabilitiesAta,
  NonEffectiveFlagsKeyOf<ListDevice['Ata']['Device']>
> = {
  'alarm_generic.silent': 'FanSpeed',
  'fan_power': 'FanSpeed',
  'fan_power_state': 'ActualFanSpeed',
  'horizontal': 'VaneHorizontalDirection',
  'measure_power.wifi': 'WifiSignalStrength',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  'vertical': 'VaneVerticalDirection',
} as const
export const reportCapabilityTagMappingAta: Record<
  keyof ReportCapabilitiesAta,
  readonly (keyof ReportData['Ata'])[]
> = {
  'measure_power': ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'],
  'measure_power.auto': ['Auto'],
  'measure_power.cooling': ['Cooling'],
  'measure_power.dry': ['Dry'],
  'measure_power.fan': ['Fan'],
  'measure_power.heating': ['Heating'],
  'measure_power.other': ['Other'],
  'meter_power': [
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
} as const

export const setCapabilityTagMappingAtw: Record<
  keyof SetCapabilitiesAtw,
  NonEffectiveFlagsKeyOf<SetDeviceData['Atw']>
> = {
  'onoff': 'Power',
  'onoff.forced_hot_water': 'ForcedHotWaterMode',
  'operation_mode_zone': 'OperationModeZone1',
  'operation_mode_zone.zone2': 'OperationModeZone2',
  'operation_mode_zone_with_cool': 'OperationModeZone1',
  'operation_mode_zone_with_cool.zone2': 'OperationModeZone2',
  'target_temperature': 'SetTemperatureZone1',
  'target_temperature.flow_cool': 'SetCoolFlowTemperatureZone1',
  'target_temperature.flow_cool_zone2': 'SetCoolFlowTemperatureZone2',
  'target_temperature.flow_heat': 'SetHeatFlowTemperatureZone1',
  'target_temperature.flow_heat_zone2': 'SetHeatFlowTemperatureZone2',
  'target_temperature.tank_water': 'SetTankWaterTemperature',
  'target_temperature.zone2': 'SetTemperatureZone2',
} as const
export const getCapabilityTagMappingAtw: Record<
  keyof GetCapabilitiesAtw,
  NonEffectiveFlagsKeyOf<DeviceData['Atw']>
> = {
  'boolean.idle_zone1': 'IdleZone1',
  'boolean.idle_zone2': 'IdleZone2',
  'boolean.prohibit_cooling_zone1': 'ProhibitCoolingZone1',
  'boolean.prohibit_cooling_zone2': 'ProhibitCoolingZone2',
  'boolean.prohibit_heating_zone1': 'ProhibitHeatingZone1',
  'boolean.prohibit_heating_zone2': 'ProhibitHeatingZone2',
  'boolean.prohibit_hot_water': 'ProhibitHotWater',
  'measure_temperature': 'RoomTemperatureZone1',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  'measure_temperature.tank_water': 'TankWaterTemperature',
  'measure_temperature.zone2': 'RoomTemperatureZone2',
  'operation_mode_state': 'OperationMode',
} as const
export const listCapabilityTagMappingAtw: Record<
  keyof ListCapabilitiesAtw,
  NonEffectiveFlagsKeyOf<ListDevice['Atw']['Device']>
> = {
  'alarm_generic.booster_heater1': 'BoosterHeater1Status',
  'alarm_generic.booster_heater2': 'BoosterHeater2Status',
  'alarm_generic.booster_heater2_plus': 'BoosterHeater2PlusStatus',
  'alarm_generic.defrost': 'DefrostMode',
  'alarm_generic.eco_hot_water': 'EcoHotWater',
  'alarm_generic.immersion_heater': 'ImmersionHeaterStatus',
  'boolean.cooling_zone1': 'Zone1InCoolMode',
  'boolean.cooling_zone2': 'Zone2InCoolMode',
  'boolean.heating_zone1': 'Zone1InHeatMode',
  'boolean.heating_zone2': 'Zone2InHeatMode',
  'legionella': 'LastLegionellaActivationTime',
  'measure_power': 'CurrentEnergyConsumed',
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
} as const
export const reportCapabilityTagMappingAtw: Record<
  keyof ReportCapabilitiesAtw,
  readonly (keyof ReportData['Atw'])[]
> = {
  'meter_power': [
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
} as const

export const setCapabilityTagMappingErv: Record<
  keyof SetCapabilitiesErv,
  NonEffectiveFlagsKeyOf<SetDeviceData['Erv']>
> = {
  fan_power: 'SetFanSpeed',
  onoff: 'Power',
  ventilation_mode: 'VentilationMode',
} as const
export const getCapabilityTagMappingErv: Record<
  keyof GetCapabilitiesErv,
  NonEffectiveFlagsKeyOf<DeviceData['Erv']>
> = {
  'measure_co2': 'RoomCO2Level',
  'measure_temperature': 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
} as const
export const listCapabilityTagMappingErv: Record<
  keyof ListCapabilitiesErv,
  NonEffectiveFlagsKeyOf<ListDevice['Erv']['Device']>
> = {
  'measure_pm25': 'PM25Level',
  'measure_power.wifi': 'WifiSignalStrength',
} as const
export const reportCapabilityTagMappingErv: Record<string, never> = {} as const

export interface SetCapabilityTagMapping {
  readonly Ata: typeof setCapabilityTagMappingAta
  readonly Atw: typeof setCapabilityTagMappingAtw
  readonly Erv: typeof setCapabilityTagMappingErv
}
export interface GetCapabilityTagMapping {
  readonly Ata: typeof getCapabilityTagMappingAta
  readonly Atw: typeof getCapabilityTagMappingAtw
  readonly Erv: typeof getCapabilityTagMappingErv
}
export interface ListCapabilityTagMapping {
  readonly Ata: typeof listCapabilityTagMappingAta
  readonly Atw: typeof listCapabilityTagMappingAtw
  readonly Erv: typeof listCapabilityTagMappingErv
}
export interface ReportCapabilityTagMapping {
  readonly Ata: typeof reportCapabilityTagMappingAta
  readonly Atw: typeof reportCapabilityTagMappingAtw
  readonly Erv: typeof reportCapabilityTagMappingErv
}
export type OpCapabilityTagEntries<T extends keyof typeof DeviceType> = [
  Extract<keyof OpCapabilities[T], string>,
  OpDeviceData<T>,
][]

export type ReportCapabilityTagEntries<T extends keyof typeof DeviceType> = [
  Extract<keyof ReportCapabilities[T], string>,
  (keyof ReportData[T])[],
][]

export type ConvertFromDevice<T extends keyof typeof DeviceType> = (
  value:
    | NonEffectiveFlagsValueOf<DeviceData[T]>
    | NonEffectiveFlagsValueOf<ListDevice[T]['Device']>,
) => OpCapabilities[T][keyof OpCapabilities[T]]
export type ConvertToDevice<T extends keyof typeof DeviceType> = (
  value: SetCapabilities[T][keyof SetCapabilities[T]],
) => NonEffectiveFlagsValueOf<SetDeviceData[T]>

export interface FlowArgs {
  readonly Ata: SetCapabilitiesAta & { readonly device: AtaDevice }
  readonly Atw: {
    readonly device: AtwDevice
    readonly onoff: boolean
    readonly operation_mode_state: keyof typeof OperationModeState
    readonly operation_mode_zone: keyof typeof OperationModeZone
    readonly target_temperature: number
  }
  readonly Erv: SetCapabilitiesErv & { readonly device: ErvDevice }
}

interface RangeOptions {
  readonly max: number
  readonly min: number
  readonly step: number
}
export interface CapabilitiesOptions {
  readonly Ata: { readonly fan_power: RangeOptions }
  readonly Atw: {
    readonly 'target_temperature.flow_cool': RangeOptions
    readonly 'target_temperature.flow_cool_zone2': RangeOptions
    readonly 'target_temperature.flow_heat': RangeOptions
    readonly 'target_temperature.flow_heat_zone2': RangeOptions
  }
  readonly Erv: { readonly fan_power: RangeOptions }
}
export interface DeviceDetails<T extends keyof typeof DeviceType> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: CapabilitiesOptions[T]
  readonly data: { readonly buildingid: number, readonly id: number }
  readonly name: string
  readonly store: Store[T]
}

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}
export interface ErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}
export interface ErrorLog {
  readonly errors: ErrorDetails[]
  readonly fromDateHuman: string
  readonly nextFromDate: string
  readonly nextToDate: string
}

export type FrostProtectionSettings = Omit<
  FrostProtectionPostData,
  'BuildingIds'
>

export interface HolidayModeSettings {
  readonly enabled: boolean
  readonly endDate: string
  readonly startDate: string
}
