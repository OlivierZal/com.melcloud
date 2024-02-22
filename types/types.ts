import type { DateObjectUnits, DurationLike } from 'luxon'
import type {
  DeviceData,
  DeviceDataAta,
  DeviceDataAtw,
  DeviceDataErv,
  FrostProtectionPostData,
  HeatPumpType,
  Horizontal,
  ListDeviceAny,
  ListDeviceAta,
  ListDeviceAtw,
  ListDeviceErv,
  LoginCredentials,
  NonEffectiveFlagsKeyOf,
  OperationMode,
  OperationModeState,
  OperationModeZone,
  ReportDataAta,
  ReportDataAtw,
  SetDeviceDataAta,
  SetDeviceDataAtw,
  SetDeviceDataErv,
  Vertical,
} from './MELCloudAPITypes'
import type AtaDevice from '../drivers/melcloud/device'
import type AtaDriver from '../drivers/melcloud/driver'
import type AtwDevice from '../drivers/melcloud_atw/device'
import type AtwDriver from '../drivers/melcloud_atw/driver'
import type ErvDevice from '../drivers/melcloud_erv/device'
import type ErvDriver from '../drivers/melcloud_erv/driver'

export enum ThermostatMode {
  auto = 'auto',
  heat = 'heat',
  cool = 'cool',
  off = 'off',
}

export type MELCloudDriver = AtaDriver | AtwDriver | ErvDriver
export type MELCloudDevice = AtaDevice | AtwDevice | ErvDevice
type DeviceFromDriver<T extends MELCloudDriver> = T extends AtaDriver
  ? AtaDevice
  : T extends AtwDriver
    ? AtwDevice
    : ErvDevice

export type BooleanString = 'false' | 'true'

export type NonEffectiveFlagsValueOf<T> = T[NonEffectiveFlagsKeyOf<T>]

export type TypedString<T> = T & string
export type ValueOf<T> = T[keyof T]

export interface Settings
  extends Record<string, boolean | number | string | null | undefined> {
  readonly always_on?: boolean
}

export interface Store {
  readonly canCool: boolean
  readonly hasCO2Sensor: boolean
  readonly hasPM25Sensor: boolean
  readonly hasZone2: boolean
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
  readonly values?: readonly { readonly id: string; readonly label: string }[]
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

export type TargetTemperatureOptions = object & {
  readonly max: number
  readonly min: number
}

export type SetDeviceData<T extends MELCloudDriver> = MELCloudDriver &
  T extends AtaDriver
  ? SetDeviceDataAta
  : T extends AtwDriver
    ? SetDeviceDataAtw
    : SetDeviceDataErv
export type OpDeviceData<T extends MELCloudDriver> = NonEffectiveFlagsKeyOf<
  DeviceData<T['heatPumpType']> | ListDevice<T>['Device']
>

interface SetCapabilitiesCommon {
  onoff?: boolean
}
interface GetCapabilitiesCommon {
  readonly measure_temperature: number
}
interface ListCapabilitiesCommon {
  readonly 'measure_power.wifi': number
}

interface SetCapabilitiesAta extends SetCapabilitiesCommon {
  fan_power?: number
  horizontal?: keyof typeof Horizontal
  operation_mode?: keyof typeof OperationMode
  target_temperature?: number
  vertical?: keyof typeof Vertical
}
type GetCapabilitiesAta = GetCapabilitiesCommon
interface ListCapabilitiesAta extends ListCapabilitiesCommon {
  readonly fan_power: number
  readonly fan_power_state: number
  readonly horizontal: keyof typeof Horizontal
  readonly vertical: keyof typeof Vertical
}
interface ReportCapabilitiesAta {
  measure_power?: number
  'measure_power.auto'?: number
  'measure_power.cooling'?: number
  'measure_power.dry'?: number
  'measure_power.fan'?: number
  'measure_power.heating'?: number
  'measure_power.other'?: number
  meter_power?: number
  'meter_power.auto'?: number
  'meter_power.cooling'?: number
  'meter_power.daily'?: number
  'meter_power.daily_auto'?: number
  'meter_power.daily_cooling'?: number
  'meter_power.daily_dry'?: number
  'meter_power.daily_fan'?: number
  'meter_power.daily_heating'?: number
  'meter_power.daily_other'?: number
  'meter_power.dry'?: number
  'meter_power.fan'?: number
  'meter_power.heating'?: number
  'meter_power.other'?: number
}

export interface OperationModeZoneCapabilities {
  operation_mode_zone?: keyof typeof OperationModeZone
  'operation_mode_zone.zone2'?: keyof typeof OperationModeZone
  operation_mode_zone_with_cool?: keyof typeof OperationModeZone
  'operation_mode_zone_with_cool.zone2'?: keyof typeof OperationModeZone
}
interface SetCapabilitiesAtw
  extends SetCapabilitiesCommon,
    OperationModeZoneCapabilities {
  'onoff.forced_hot_water'?: boolean
  target_temperature?: number
  'target_temperature.flow_cool'?: number
  'target_temperature.flow_cool_zone2'?: number
  'target_temperature.flow_heat'?: number
  'target_temperature.flow_heat_zone2'?: number
  'target_temperature.tank_water'?: number
  'target_temperature.zone2'?: number
}
interface GetCapabilitiesAtw extends GetCapabilitiesCommon {
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operation_mode_state: keyof typeof OperationModeState
  readonly 'operation_mode_state.zone1': keyof typeof OperationModeState
  readonly 'operation_mode_state.zone2': keyof typeof OperationModeState
}
interface ListCapabilitiesAtw extends ListCapabilitiesCommon {
  readonly 'alarm_generic.booster_heater1': boolean
  readonly 'alarm_generic.booster_heater2': boolean
  readonly 'alarm_generic.booster_heater2_plus': boolean
  readonly 'alarm_generic.defrost_mode': boolean
  readonly 'alarm_generic.eco_hot_water': boolean
  readonly 'alarm_generic.immersion_heater': boolean
  readonly last_legionella: string
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
interface ReportCapabilitiesAtw {
  meter_power?: number
  'meter_power.cooling'?: number
  'meter_power.cop'?: number
  'meter_power.cop_cooling'?: number
  'meter_power.cop_daily'?: number
  'meter_power.cop_daily_cooling'?: number
  'meter_power.cop_daily_heating'?: number
  'meter_power.cop_daily_hotwater'?: number
  'meter_power.cop_heating'?: number
  'meter_power.cop_hotwater'?: number
  'meter_power.daily'?: number
  'meter_power.daily_cooling'?: number
  'meter_power.daily_heating'?: number
  'meter_power.daily_hotwater'?: number
  'meter_power.heating'?: number
  'meter_power.hotwater'?: number
  'meter_power.produced'?: number
  'meter_power.produced_cooling'?: number
  'meter_power.produced_daily'?: number
  'meter_power.produced_daily_cooling'?: number
  'meter_power.produced_daily_heating'?: number
  'meter_power.produced_daily_hotwater'?: number
  'meter_power.produced_heating'?: number
  'meter_power.produced_hotwater'?: number
}

export enum VentilationMode {
  recovery = 0,
  bypass = 1,
  auto = 2,
}
interface SetCapabilitiesErv extends SetCapabilitiesCommon {
  fan_power?: number
  ventilation_mode?: keyof typeof VentilationMode
}
interface GetCapabilitiesErv extends GetCapabilitiesCommon {
  readonly measure_co2: number
  readonly measure_temperature: number
  readonly 'measure_temperature.outdoor': number
}
interface ListCapabilitiesErv extends ListCapabilitiesCommon {
  readonly measure_pm25: number
}

export type SetCapabilities<T extends MELCloudDriver> = T extends AtaDriver
  ? SetCapabilitiesAta
  : T extends AtwDriver
    ? SetCapabilitiesAtw
    : SetCapabilitiesErv
export type SetCapabilitiesWithThermostatMode<T extends MELCloudDriver> =
  T extends AtaDriver
    ? SetCapabilitiesAta & { thermostat_mode?: ThermostatMode }
    : T extends AtwDriver
      ? SetCapabilitiesAtw & { thermostat_mode?: ThermostatMode }
      : SetCapabilitiesErv & { thermostat_mode?: ThermostatMode }
export type OpCapabilities<T extends MELCloudDriver> = T extends AtaDriver
  ? GetCapabilitiesAta & ListCapabilitiesAta & SetCapabilitiesAta
  : T extends AtwDriver
    ? GetCapabilitiesAtw & ListCapabilitiesAtw & SetCapabilitiesAtw
    : GetCapabilitiesErv & ListCapabilitiesErv & SetCapabilitiesErv
export type ReportCapabilities<T extends MELCloudDriver> = T extends AtaDriver
  ? ReportCapabilitiesAta
  : T extends AtwDriver
    ? ReportCapabilitiesAtw
    : never
export type Capabilities<T extends MELCloudDriver> = OpCapabilities<T> &
  ReportCapabilities<T> & { thermostat_mode: ThermostatMode }

export const setCapabilityTagMappingAta: Record<
  keyof SetCapabilitiesAta,
  NonEffectiveFlagsKeyOf<SetDeviceDataAta>
> = {
  fan_power: 'SetFanSpeed',
  horizontal: 'VaneHorizontal',
  onoff: 'Power',
  operation_mode: 'OperationMode',
  target_temperature: 'SetTemperature',
  vertical: 'VaneVertical',
} as const
export type SetCapabilityTagMappingAta = typeof setCapabilityTagMappingAta
export const getCapabilityTagMappingAta: Record<
  keyof GetCapabilitiesAta,
  NonEffectiveFlagsKeyOf<DeviceDataAta>
> = {
  measure_temperature: 'RoomTemperature',
} as const
export type GetCapabilityTagMappingAta = typeof getCapabilityTagMappingAta
export const listCapabilityTagMappingAta: Record<
  keyof ListCapabilitiesAta,
  NonEffectiveFlagsKeyOf<ListDeviceAta['Device']>
> = {
  fan_power: 'FanSpeed',
  fan_power_state: 'ActualFanSpeed',
  horizontal: 'VaneHorizontalDirection',
  'measure_power.wifi': 'WifiSignalStrength',
  vertical: 'VaneVerticalDirection',
} as const
export type ListCapabilityTagMappingAta = typeof listCapabilityTagMappingAta
export const reportCapabilityTagMappingAta: Record<
  keyof ReportCapabilitiesAta,
  readonly (keyof ReportDataAta)[]
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
} as const
export type ReportCapabilityTagMappingAta = typeof reportCapabilityTagMappingAta

export const setCapabilityTagMappingAtw: Record<
  keyof SetCapabilitiesAtw,
  NonEffectiveFlagsKeyOf<SetDeviceDataAtw>
> = {
  onoff: 'Power',
  'onoff.forced_hot_water': 'ForcedHotWaterMode',
  operation_mode_zone: 'OperationModeZone1',
  'operation_mode_zone.zone2': 'OperationModeZone2',
  operation_mode_zone_with_cool: 'OperationModeZone1',
  'operation_mode_zone_with_cool.zone2': 'OperationModeZone2',
  target_temperature: 'SetTemperatureZone1',
  'target_temperature.flow_cool': 'SetCoolFlowTemperatureZone1',
  'target_temperature.flow_cool_zone2': 'SetCoolFlowTemperatureZone2',
  'target_temperature.flow_heat': 'SetHeatFlowTemperatureZone1',
  'target_temperature.flow_heat_zone2': 'SetHeatFlowTemperatureZone2',
  'target_temperature.tank_water': 'SetTankWaterTemperature',
  'target_temperature.zone2': 'SetTemperatureZone2',
} as const
export type SetCapabilityTagMappingAtw = typeof setCapabilityTagMappingAtw
export const getCapabilityTagMappingAtw: Record<
  keyof GetCapabilitiesAtw,
  NonEffectiveFlagsKeyOf<DeviceDataAtw>
> = {
  measure_temperature: 'RoomTemperatureZone1',
  'measure_temperature.outdoor': 'OutdoorTemperature',
  'measure_temperature.tank_water': 'TankWaterTemperature',
  'measure_temperature.zone2': 'RoomTemperatureZone2',
  operation_mode_state: 'OperationMode',
  // Must follow `operation_mode_state`
  'operation_mode_state.zone1': 'IdleZone1',
  'operation_mode_state.zone2': 'IdleZone2',
} as const
export type GetCapabilityTagMappingAtw = typeof getCapabilityTagMappingAtw
export const listCapabilityTagMappingAtw: Record<
  keyof ListCapabilitiesAtw,
  NonEffectiveFlagsKeyOf<ListDeviceAtw['Device']>
> = {
  'alarm_generic.booster_heater1': 'BoosterHeater1Status',
  'alarm_generic.booster_heater2': 'BoosterHeater2Status',
  'alarm_generic.booster_heater2_plus': 'BoosterHeater2PlusStatus',
  'alarm_generic.defrost_mode': 'DefrostMode',
  'alarm_generic.eco_hot_water': 'EcoHotWater',
  'alarm_generic.immersion_heater': 'ImmersionHeaterStatus',
  last_legionella: 'LastLegionellaActivationTime',
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
} as const
export type ListCapabilityTagMappingAtw = typeof listCapabilityTagMappingAtw
export const reportCapabilityTagMappingAtw: Record<
  keyof ReportCapabilitiesAtw,
  readonly (keyof ReportDataAtw)[]
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
} as const
export type ReportCapabilityTagMappingAtw = typeof reportCapabilityTagMappingAtw

export const setCapabilityTagMappingErv: Record<
  keyof SetCapabilitiesErv,
  NonEffectiveFlagsKeyOf<SetDeviceDataErv>
> = {
  fan_power: 'SetFanSpeed',
  onoff: 'Power',
  ventilation_mode: 'VentilationMode',
} as const
export type SetCapabilityTagMappingErv = typeof setCapabilityTagMappingErv
export const getCapabilityTagMappingErv: Record<
  keyof GetCapabilitiesErv,
  NonEffectiveFlagsKeyOf<DeviceDataErv>
> = {
  measure_co2: 'RoomCO2Level',
  measure_temperature: 'RoomTemperature',
  'measure_temperature.outdoor': 'OutdoorTemperature',
} as const
export type GetCapabilityTagMappingErv = typeof getCapabilityTagMappingErv
export const listCapabilityTagMappingErv: Record<
  keyof ListCapabilitiesErv,
  NonEffectiveFlagsKeyOf<ListDeviceErv['Device']>
> = {
  measure_pm25: 'PM25Level',
  'measure_power.wifi': 'WifiSignalStrength',
} as const
export type ListCapabilityTagMappingErv = typeof listCapabilityTagMappingErv
export const reportCapabilityTagMappingErv: Record<string, never> = {} as const
export type ReportCapabilityTagMappingErv = typeof reportCapabilityTagMappingErv

export type SetCapabilityTagMappingAny =
  | SetCapabilityTagMappingAta
  | SetCapabilityTagMappingAtw
  | SetCapabilityTagMappingErv
export type SetCapabilityTagMapping<T extends MELCloudDriver> =
  T extends AtaDriver
    ? SetCapabilityTagMappingAta
    : T extends AtwDriver
      ? SetCapabilityTagMappingAtw
      : SetCapabilityTagMappingErv
export type GetCapabilityTagMappingAny =
  | GetCapabilityTagMappingAta
  | GetCapabilityTagMappingAtw
  | GetCapabilityTagMappingErv
export type GetCapabilityTagMapping<T extends MELCloudDriver> =
  T extends AtaDriver
    ? GetCapabilityTagMappingAta
    : T extends AtwDriver
      ? GetCapabilityTagMappingAtw
      : GetCapabilityTagMappingErv
export type ListCapabilityTagMappingAny =
  | ListCapabilityTagMappingAta
  | ListCapabilityTagMappingAtw
  | ListCapabilityTagMappingErv
export type ListCapabilityTagMapping<T extends MELCloudDriver> =
  T extends AtaDriver
    ? ListCapabilityTagMappingAta
    : T extends AtwDriver
      ? ListCapabilityTagMappingAtw
      : ListCapabilityTagMappingErv
export type ReportCapabilityTagMappingAny =
  | ReportCapabilityTagMappingAta
  | ReportCapabilityTagMappingAtw
  | ReportCapabilityTagMappingErv
export type ReportCapabilitTagyMapping<T extends MELCloudDriver> =
  T extends AtaDriver
    ? ReportCapabilityTagMappingAta
    : T extends AtwDriver
      ? ReportCapabilityTagMappingAtw
      : ReportCapabilityTagMappingErv

export type FlowArgs<T extends MELCloudDriver> = (T extends AtaDriver
  ? SetCapabilitiesAta
  : T extends AtwDriver
    ? {
        readonly onoff?: boolean
        readonly operation_mode_state?: keyof typeof OperationModeState
        readonly operation_mode_zone?: keyof typeof OperationModeZone
        readonly target_temperature?: number
      }
    : SetCapabilitiesErv) & { readonly device: DeviceFromDriver<T> }

export type ListDevice<T extends MELCloudDriver> = T extends AtaDriver
  ? ListDeviceAta
  : T extends AtwDriver
    ? ListDeviceAtw
    : ListDeviceErv

export interface DeviceLookup {
  devicesPerId: Record<number, ListDeviceAny>
  devicesPerType: Record<HeatPumpType, ListDeviceAny[]>
}

export interface DeviceDetails {
  readonly capabilities: readonly string[]
  readonly data: { readonly buildingid: number; readonly id: number }
  readonly name: string
  readonly store: Store
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
