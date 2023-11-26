import type Homey from 'homey/lib/Homey'
import type MELCloudDeviceAta from './drivers/melcloud/device'
import type MELCloudDriverAta from './drivers/melcloud/driver'
import type MELCloudDeviceAtw from './drivers/melcloud_atw/device'
import type MELCloudDriverAtw from './drivers/melcloud_atw/driver'
import type MELCloudDeviceErv from './drivers/melcloud_erv/device'
import type MELCloudDriverErv from './drivers/melcloud_erv/driver'

export const loginURL = '/Login/ClientLogin'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Loggable {
  /* eslint-disable @typescript-eslint/method-signature-style */
  error(...errorArgs: any[]): void
  log(...logArgs: any[]): void
  /* eslint-enable @typescript-eslint/method-signature-style */
}

export type LogClass = abstract new (...args: any[]) => Loggable

export type HomeyClass = new (...args: any[]) => Loggable & {
  readonly homey: Homey

  readonly setWarning?: (warning: string | null) => Promise<void>
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type MELCloudDevice =
  | MELCloudDeviceAta
  | MELCloudDeviceAtw
  | MELCloudDeviceErv
export type MELCloudDriver =
  | MELCloudDriverAta
  | MELCloudDriverAtw
  | MELCloudDriverErv

export type SyncFromMode = 'syncFrom'
export type SyncMode = SyncFromMode | 'syncTo'

export type CapabilityValue = boolean | number | string

export type SetDeviceValue = boolean | number
export type DeviceValue = boolean | number | string

type ValueOf<T> = T[keyof T]

export interface Settings
  extends Record<string, boolean | number | string | null | undefined> {
  readonly always_on?: boolean
}

export type SettingValue = ValueOf<Settings>

interface BaseHomeySettingValue<T> {
  readonly username: T
  readonly password: T
  readonly ContextKey: T
  readonly Expiry: T
}

export type HomeySettings = BaseHomeySettingValue<string | null>

export type HomeySettingsUI = BaseHomeySettingValue<string | undefined>

export type HomeySettingValue = ValueOf<HomeySettings>

export interface Store {
  readonly CanCool: boolean
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly HasZone2: boolean
}

export interface ManifestDriverSettingData {
  readonly id: string
  readonly label: Record<string, string>
  readonly max?: number
  readonly min?: number
  readonly type: string
  readonly units?: string
  readonly values?: {
    readonly id: string
    readonly label: Record<string, string>
  }[]
}

export interface ManifestDriverSetting {
  readonly children?: ManifestDriverSettingData[]
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
  readonly id: string
  readonly pair?: LoginSetting & PairSetting[]
  readonly settings?: ManifestDriverSetting[]
}

export interface DriverSetting {
  readonly driverId: string
  readonly groupId?: string
  readonly groupLabel?: string
  readonly id: string
  readonly max?: number
  readonly min?: number
  placeholder?: string
  title: string
  readonly type: string
  readonly units?: string
  readonly values?: { readonly id: string; readonly label: string }[]
}

export interface LoginCredentials {
  password: string
  username: string
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}

export type DeviceSetting = Record<string, SettingValue[]>
export type DeviceSettings = Record<string, DeviceSetting>

export interface SuccessData {
  readonly AttributeErrors: null
}

export interface FailureData {
  readonly AttributeErrors: Record<string, string[]>
}

interface SetCapabilitiesCommon {
  onoff?: boolean
}

interface SetCapabilitiesAta extends SetCapabilitiesCommon {
  fan_power?: number
  horizontal?: string
  operation_mode?: string
  target_temperature?: number
  vertical?: string
}

interface SetCapabilitiesErv extends SetCapabilitiesCommon {
  fan_power?: number
  ventilation_mode?: number
}

interface SetCapabilitiesAtw extends SetCapabilitiesCommon {
  'onoff.forced_hot_water'?: boolean
  'operation_mode_zone.zone1'?: string
  'operation_mode_zone.zone2'?: string
  'operation_mode_zone_with_cool.zone1'?: string
  'operation_mode_zone_with_cool.zone2'?: string
  target_temperature?: number
  'target_temperature.tank_water'?: number
  'target_temperature.flow_cool'?: number
  'target_temperature.flow_heat'?: number
  'target_temperature.zone2'?: number
  'target_temperature.flow_cool_zone2'?: number
  'target_temperature.flow_heat_zone2'?: number
}

interface GetCapabilitiesCommon {
  readonly measure_temperature: number
}

type GetCapabilitiesAta = GetCapabilitiesCommon

interface GetCapabilitiesErv extends GetCapabilitiesCommon {
  readonly measure_co2: number
  readonly measure_temperature: number
  readonly 'measure_temperature.outdoor': number
}

interface GetCapabilitiesAtw extends GetCapabilitiesCommon {
  readonly 'alarm_generic.eco_hot_water': boolean
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operation_mode_state: number
  readonly 'operation_mode_state.zone1': number
  readonly 'operation_mode_state.zone2': number
}

interface ListCapabilitiesCommon {
  readonly 'measure_power.wifi': number
}

interface ListCapabilitiesAta extends ListCapabilitiesCommon {
  readonly fan_power: number
  readonly fan_power_state: number
  readonly horizontal: number
  readonly vertical: number
}

interface ListCapabilitiesErv extends ListCapabilitiesCommon {
  readonly measure_pm25: number
}

interface ListCapabilitiesAtw extends ListCapabilitiesCommon {
  readonly 'alarm_generic.booster_heater1': boolean
  readonly 'alarm_generic.booster_heater2': boolean
  readonly 'alarm_generic.booster_heater2_plus': boolean
  readonly 'alarm_generic.defrost_mode': boolean
  readonly 'alarm_generic.immersion_heater': boolean
  readonly last_legionella: string
  readonly measure_power: number
  readonly 'measure_power.heat_pump_frequency': number
  readonly 'measure_power.produced': number
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
  'meter_power.dry'?: number
  'meter_power.fan'?: number
  'meter_power.heating'?: number
  'meter_power.other'?: number
  'meter_power.daily'?: number
  'meter_power.daily_auto'?: number
  'meter_power.daily_cooling'?: number
  'meter_power.daily_dry'?: number
  'meter_power.daily_fan'?: number
  'meter_power.daily_heating'?: number
  'meter_power.daily_other'?: number
}

interface ReportCapabilitiesAtw {
  meter_power?: number
  'meter_power.cooling'?: number
  'meter_power.heating'?: number
  'meter_power.hotwater'?: number
  'meter_power.produced'?: number
  'meter_power.produced_cooling'?: number
  'meter_power.produced_heating'?: number
  'meter_power.produced_hotwater'?: number
  'meter_power.cop'?: number
  'meter_power.cop_cooling'?: number
  'meter_power.cop_heating'?: number
  'meter_power.cop_hotwater'?: number
  'meter_power.daily'?: number
  'meter_power.daily_cooling'?: number
  'meter_power.daily_heating'?: number
  'meter_power.daily_hotwater'?: number
  'meter_power.produced_daily'?: number
  'meter_power.produced_daily_cooling'?: number
  'meter_power.produced_daily_heating'?: number
  'meter_power.produced_daily_hotwater'?: number
  'meter_power.cop_daily'?: number
  'meter_power.cop_daily_cooling'?: number
  'meter_power.cop_daily_heating'?: number
  'meter_power.cop_daily_hotwater'?: number
}

export type SetCapabilityAta = keyof SetCapabilitiesAta

export type SetCapabilityErv = keyof SetCapabilitiesErv

export type SetCapabilityAtw = keyof SetCapabilitiesAtw

export type SetCapability<T extends MELCloudDriver> =
  T extends MELCloudDriverAtw
    ? SetCapabilityAtw
    : T extends MELCloudDriverAta
      ? SetCapabilityAta
      : SetCapabilityErv

type GetCapabilityAta = keyof GetCapabilitiesAta

type GetCapabilityErv = keyof GetCapabilitiesErv

export type GetCapabilityAtw = keyof GetCapabilitiesAtw

type GetCapability<T extends MELCloudDriver> = T extends MELCloudDriverAtw
  ? GetCapabilityAtw
  : T extends MELCloudDriverAta
    ? GetCapabilityAta
    : GetCapabilityErv

type ListCapabilityAta = keyof ListCapabilitiesAta

type ListCapabilityErv = keyof ListCapabilitiesErv

export type ListCapabilityAtw = keyof ListCapabilitiesAtw

type ListCapability<T extends MELCloudDriver> = T extends MELCloudDriverAtw
  ? ListCapabilityAtw
  : T extends MELCloudDriverAta
    ? ListCapabilityAta
    : ListCapabilityErv

type ReportCapabilityAta = keyof ReportCapabilitiesAta

type ReportCapabilityAtw = keyof ReportCapabilitiesAtw

export type ReportCapability<T extends MELCloudDriver> =
  T extends MELCloudDriverAtw
    ? ReportCapabilityAtw
    : T extends MELCloudDriverAta
      ? ReportCapabilityAta
      : never

export type NonReportCapability<T extends MELCloudDriver> =
  | GetCapability<T>
  | ListCapability<T>
  | SetCapability<T>

export type Capability<T extends MELCloudDriver> =
  | NonReportCapability<T>
  | ReportCapability<T>

interface BaseDeviceData {
  EffectiveFlags: number
  readonly Power?: boolean
}

interface UpdateDeviceDataAta extends BaseDeviceData {
  readonly OperationMode?: number
  readonly SetFanSpeed?: number
  readonly SetTemperature?: number
  readonly VaneHorizontal?: number
  readonly VaneVertical?: number
}

interface UpdateDeviceDataErv extends BaseDeviceData {
  readonly SetFanSpeed?: number
  readonly VentilationMode?: number
}

interface UpdateDeviceDataAtw extends BaseDeviceData {
  readonly ForcedHotWaterMode?: boolean
  readonly OperationModeZone1?: number
  readonly OperationModeZone2?: number
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}

export type UpdateDeviceData<T extends MELCloudDriver> = T & {
  EffectiveFlags: number
} extends MELCloudDriverAtw
  ? UpdateDeviceDataAtw
  : T extends MELCloudDriverAta
    ? UpdateDeviceDataAta
    : UpdateDeviceDataErv

type SetDeviceDataAta = Readonly<Required<UpdateDeviceDataAta>>

type SetDeviceDataErv = Readonly<Required<UpdateDeviceDataErv>>

type SetDeviceDataAtw = Readonly<Required<UpdateDeviceDataAtw>>

export type SetDeviceData<T extends MELCloudDriver> = Readonly<
  Required<UpdateDeviceData<T>>
>

interface GetDeviceDataAta extends SetDeviceDataAta {
  readonly RoomTemperature: number
}

interface GetDeviceDataErv extends SetDeviceDataErv {
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
  readonly OutdoorTemperature: number
}

interface GetDeviceDataAtw extends SetDeviceDataAtw {
  readonly EcoHotWater: boolean
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: number
  readonly OutdoorTemperature: number
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}

export type GetDeviceData<T extends MELCloudDriver> =
  T extends MELCloudDriverAtw
    ? GetDeviceDataAtw
    : T extends MELCloudDriverAta
      ? GetDeviceDataAta
      : GetDeviceDataErv

export type PostData<T extends MELCloudDriver> = SetDeviceData<T> & {
  readonly DeviceID: number
  readonly HasPendingCommand: true
}

interface ListDeviceDataCommon {
  readonly DeviceType: number
  readonly WifiSignalStrength: number
}

interface ListDeviceDataAta
  extends Exclude<
      GetDeviceDataAta,
      'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
    >,
    ListDeviceDataCommon {
  readonly ActualFanSpeed: number
  readonly FanSpeed: number
  readonly VaneHorizontalDirection: number
  readonly VaneVerticalDirection: number
}

interface ListDeviceDataErv extends GetDeviceDataErv, ListDeviceDataCommon {
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

interface ListDeviceDataAtw extends GetDeviceDataAtw, ListDeviceDataCommon {
  readonly BoosterHeater1Status: boolean
  readonly BoosterHeater2PlusStatus: boolean
  readonly BoosterHeater2Status: boolean
  readonly CanCool: boolean
  readonly CurrentEnergyConsumed: number
  readonly CurrentEnergyProduced: number
  readonly DefrostMode: number
  readonly FlowTemperature: number
  readonly FlowTemperatureZone1: number
  readonly FlowTemperatureZone2: number
  readonly HasZone2: boolean
  readonly HeatPumpFrequency: number
  readonly ImmersionHeaterStatus: boolean
  readonly LastLegionellaActivationTime: string
  readonly MixingTankWaterTemperature: number
  readonly ReturnTemperature: number
  readonly ReturnTemperatureZone1: number
  readonly ReturnTemperatureZone2: number
  readonly TargetHCTemperatureZone1: number
  readonly TargetHCTemperatureZone2: number
}

export type ListDeviceData<T extends MELCloudDriver> =
  T extends MELCloudDriverAtw
    ? ListDeviceDataAtw
    : T extends MELCloudDriverErv
      ? ListDeviceDataErv
      : ListDeviceDataAta

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
  readonly UseCurrency: false
}

interface ReportDataAta {
  readonly Auto: number[]
  readonly Cooling: number[]
  readonly Dry: number[]
  readonly Fan: number[]
  readonly Heating: number[]
  readonly Other: number[]
  readonly TotalAutoConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalHeatingConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}

interface ReportDataAtw {
  readonly CoP: number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}

export type ReportData<T extends MELCloudDriver> = T extends MELCloudDriverAtw
  ? ReportDataAtw
  : ReportDataAta

export interface SetCapabilityKeys<T extends MELCloudDriver> {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>
}

interface SetCapabilityKeysAta {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceDataAta, 'EffectiveFlags'>
}

interface SetCapabilityKeysErv {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceDataErv, 'EffectiveFlags'>
}

interface SetCapabilityKeysAtw {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceDataAtw, 'EffectiveFlags'>
}

export type SetCapabilityMappingAta = Record<
  SetCapabilityAta,
  SetCapabilityKeysAta
>

export type SetCapabilityMappingErv = Record<
  SetCapabilityErv,
  SetCapabilityKeysErv
>

export type SetCapabilityMappingAtw = Record<
  SetCapabilityAtw,
  SetCapabilityKeysAtw
>

export type SetCapabilityMappingAny =
  | SetCapabilityMappingAta
  | SetCapabilityMappingAtw
  | SetCapabilityMappingErv

export interface GetCapabilityKeys<T extends MELCloudDriver> {
  readonly tag: Exclude<keyof GetDeviceData<T>, 'EffectiveFlags'>
}

interface GetCapabilityKeysAta {
  readonly tag: Exclude<keyof GetDeviceDataAta, 'EffectiveFlags'>
}

interface GetCapabilityKeysErv {
  readonly tag: Exclude<keyof GetDeviceDataErv, 'EffectiveFlags'>
}

interface GetCapabilityKeysAtw {
  readonly tag: Exclude<keyof GetDeviceDataAtw, 'EffectiveFlags'>
}

export type GetCapabilityMappingAta = Record<
  GetCapabilityAta,
  GetCapabilityKeysAta
>

export type GetCapabilityMappingErv = Record<
  GetCapabilityErv,
  GetCapabilityKeysErv
>

export type GetCapabilityMappingAtw = Record<
  GetCapabilityAtw,
  GetCapabilityKeysAtw
>

export type GetCapabilityMappingAny =
  | GetCapabilityMappingAta
  | GetCapabilityMappingAtw
  | GetCapabilityMappingErv

export interface ListCapabilityKeys<T extends MELCloudDriver> {
  readonly effectiveFlag?: bigint
  readonly tag: Exclude<keyof ListDeviceData<T>, 'EffectiveFlags'>
}

interface ListCapabilityKeysAta {
  readonly effectiveFlag?: bigint
  readonly tag: Exclude<keyof ListDeviceDataAta, 'EffectiveFlags'>
}

interface ListCapabilityKeysErv {
  readonly effectiveFlag?: bigint
  readonly tag: Exclude<keyof ListDeviceDataErv, 'EffectiveFlags'>
}

interface ListCapabilityKeysAtw {
  readonly effectiveFlag?: bigint
  readonly tag: Exclude<keyof ListDeviceDataAtw, 'EffectiveFlags'>
}

export type ListCapabilityMappingAta = Record<
  ListCapabilityAta,
  ListCapabilityKeysAta
>

export type ListCapabilityMappingErv = Record<
  ListCapabilityErv,
  ListCapabilityKeysErv
>

export type ListCapabilityMappingAtw = Record<
  ListCapabilityAtw,
  ListCapabilityKeysAtw
>

export type ListCapabilityMappingAny =
  | ListCapabilityMappingAta
  | ListCapabilityMappingAtw
  | ListCapabilityMappingErv

export type ReportCapabilityKeys<T extends MELCloudDriver> =
  (keyof ReportData<T>)[]

type ReportCapabilityKeysAta = readonly (keyof ReportDataAta)[]

type ReportCapabilityKeysAtw = readonly (keyof ReportDataAtw)[]

export type ReportCapabilityMappingAta = Record<
  ReportCapabilityAta,
  ReportCapabilityKeysAta
>

export type ReportCapabilityMappingAtw = Record<
  ReportCapabilityAtw,
  ReportCapabilityKeysAtw
>

export type ReportCapabilityMappingAny =
  | ReportCapabilityMappingAta
  | ReportCapabilityMappingAtw
  | null

export const setCapabilityMappingAta: Record<
  SetCapabilityAta,
  SetCapabilityKeysAta
> = {
  onoff: {
    tag: 'Power',
    effectiveFlag: 0x1n,
  },
  operation_mode: {
    tag: 'OperationMode',
    effectiveFlag: 0x2n,
  },
  target_temperature: {
    tag: 'SetTemperature',
    effectiveFlag: 0x4n,
  },
  fan_power: {
    tag: 'SetFanSpeed',
    effectiveFlag: 0x8n,
  },
  vertical: {
    tag: 'VaneVertical',
    effectiveFlag: 0x10n,
  },
  horizontal: {
    tag: 'VaneHorizontal',
    effectiveFlag: 0x100n,
  },
} as const

export const setCapabilityMappingErv: Record<
  SetCapabilityErv,
  SetCapabilityKeysErv
> = {
  onoff: {
    tag: 'Power',
    effectiveFlag: 0x1n,
  },
  ventilation_mode: {
    tag: 'VentilationMode',
    effectiveFlag: 0x4n,
  },
  fan_power: {
    tag: 'SetFanSpeed',
    effectiveFlag: 0x8n,
  },
} as const

export const setCapabilityMappingAtw: Record<
  SetCapabilityAtw,
  SetCapabilityKeysAtw
> = {
  onoff: {
    tag: 'Power',
    effectiveFlag: 0x1n,
  },
  'operation_mode_zone.zone1': {
    tag: 'OperationModeZone1',
    effectiveFlag: 0x8n,
  },
  'operation_mode_zone_with_cool.zone1': {
    tag: 'OperationModeZone1',
    effectiveFlag: 0x8n,
  },
  'operation_mode_zone.zone2': {
    tag: 'OperationModeZone2',
    effectiveFlag: 0x10n,
  },
  'operation_mode_zone_with_cool.zone2': {
    tag: 'OperationModeZone2',
    effectiveFlag: 0x10n,
  },
  'onoff.forced_hot_water': {
    tag: 'ForcedHotWaterMode',
    effectiveFlag: 0x10000n,
  },
  target_temperature: {
    tag: 'SetTemperatureZone1',
    effectiveFlag: 0x200000080n,
  },
  'target_temperature.zone2': {
    tag: 'SetTemperatureZone2',
    effectiveFlag: 0x800000200n,
  },
  'target_temperature.flow_cool': {
    tag: 'SetCoolFlowTemperatureZone1',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.flow_heat': {
    tag: 'SetHeatFlowTemperatureZone1',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.flow_cool_zone2': {
    tag: 'SetCoolFlowTemperatureZone2',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.flow_heat_zone2': {
    tag: 'SetHeatFlowTemperatureZone2',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.tank_water': {
    tag: 'SetTankWaterTemperature',
    effectiveFlag: 0x1000000000020n,
  },
} as const

export const getCapabilityMappingAta: Record<
  GetCapabilityAta,
  GetCapabilityKeysAta
> = {
  measure_temperature: {
    tag: 'RoomTemperature',
  },
} as const

export const getCapabilityMappingErv: Record<
  GetCapabilityErv,
  GetCapabilityKeysErv
> = {
  measure_co2: {
    tag: 'RoomCO2Level',
  },
  measure_temperature: {
    tag: 'RoomTemperature',
  },
  'measure_temperature.outdoor': {
    tag: 'OutdoorTemperature',
  },
} as const

export const getCapabilityMappingAtw: Record<
  GetCapabilityAtw,
  GetCapabilityKeysAtw
> = {
  'alarm_generic.eco_hot_water': {
    tag: 'EcoHotWater',
  },
  measure_temperature: {
    tag: 'RoomTemperatureZone1',
  },
  'measure_temperature.zone2': {
    tag: 'RoomTemperatureZone2',
  },
  'measure_temperature.outdoor': {
    tag: 'OutdoorTemperature',
  },
  'measure_temperature.tank_water': {
    tag: 'TankWaterTemperature',
  },
  operation_mode_state: {
    tag: 'OperationMode',
  },
  // Must follow `operation_mode_state`
  'operation_mode_state.zone1': {
    tag: 'IdleZone1',
  },
  'operation_mode_state.zone2': {
    tag: 'IdleZone2',
  },
} as const

export const listCapabilityMappingAta: Record<
  ListCapabilityAta,
  ListCapabilityKeysAta
> = {
  'measure_power.wifi': {
    tag: 'WifiSignalStrength',
  },
  fan_power: {
    tag: 'FanSpeed',
  },
  fan_power_state: {
    tag: 'ActualFanSpeed',
  },
  vertical: {
    tag: 'VaneVerticalDirection',
  },
  horizontal: {
    tag: 'VaneHorizontalDirection',
  },
} as const

export const listCapabilityMappingErv: Record<
  ListCapabilityErv,
  ListCapabilityKeysErv
> = {
  'measure_power.wifi': {
    tag: 'WifiSignalStrength',
  },
  measure_pm25: {
    tag: 'PM25Level',
  },
} as const

export const listCapabilityMappingAtw: Record<
  ListCapabilityAtw,
  ListCapabilityKeysAtw
> = {
  'measure_power.wifi': {
    tag: 'WifiSignalStrength',
  },
  'alarm_generic.booster_heater1': {
    tag: 'BoosterHeater1Status',
  },
  'alarm_generic.booster_heater2': {
    tag: 'BoosterHeater2Status',
  },
  'alarm_generic.booster_heater2_plus': {
    tag: 'BoosterHeater2PlusStatus',
  },
  'alarm_generic.defrost_mode': {
    tag: 'DefrostMode',
  },
  'alarm_generic.immersion_heater': {
    tag: 'ImmersionHeaterStatus',
  },
  last_legionella: {
    tag: 'LastLegionellaActivationTime',
  },
  measure_power: {
    tag: 'CurrentEnergyConsumed',
  },
  'measure_power.produced': {
    tag: 'CurrentEnergyProduced',
  },
  'measure_power.heat_pump_frequency': {
    tag: 'HeatPumpFrequency',
  },
  'measure_temperature.flow': {
    tag: 'FlowTemperature',
  },
  'measure_temperature.flow_zone1': {
    tag: 'FlowTemperatureZone1',
  },
  'measure_temperature.flow_zone2': {
    tag: 'FlowTemperatureZone2',
  },
  'measure_temperature.return': {
    tag: 'ReturnTemperature',
  },
  'measure_temperature.return_zone1': {
    tag: 'ReturnTemperatureZone1',
  },
  'measure_temperature.return_zone2': {
    tag: 'ReturnTemperatureZone2',
  },
  'measure_temperature.tank_water_mixing': {
    tag: 'MixingTankWaterTemperature',
  },
  'measure_temperature.target_curve': {
    tag: 'TargetHCTemperatureZone1',
  },
  'measure_temperature.target_curve_zone2': {
    tag: 'TargetHCTemperatureZone2',
  },
} as const

export const reportCapabilityMappingAta: Record<
  ReportCapabilityAta,
  ReportCapabilityKeysAta
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
  'meter_power.dry': ['TotalDryConsumed'],
  'meter_power.fan': ['TotalFanConsumed'],
  'meter_power.heating': ['TotalHeatingConsumed'],
  'meter_power.other': ['TotalOtherConsumed'],
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
} as const

export const reportCapabilityMappingAtw: Record<
  ReportCapabilityAtw,
  ReportCapabilityKeysAtw
> = {
  meter_power: [
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.cooling': ['TotalCoolingConsumed'],
  'meter_power.heating': ['TotalHeatingConsumed'],
  'meter_power.hotwater': ['TotalHotWaterConsumed'],
  'meter_power.produced': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
  ],
  'meter_power.produced_cooling': ['TotalCoolingProduced'],
  'meter_power.produced_heating': ['TotalHeatingProduced'],
  'meter_power.produced_hotwater': ['TotalHotWaterProduced'],
  'meter_power.cop': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.cop_cooling': ['TotalCoolingProduced', 'TotalCoolingConsumed'],
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
  'meter_power.produced_daily': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
  ],
  'meter_power.produced_daily_cooling': ['TotalCoolingProduced'],
  'meter_power.produced_daily_heating': ['TotalHeatingProduced'],
  'meter_power.produced_daily_hotwater': ['TotalHotWaterProduced'],
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
} as const

export interface DeviceDetails {
  readonly capabilities: string[]
  readonly data: {
    readonly buildingid: number
    readonly id: number
  }
  readonly name: string
  readonly store: Store
}

export type FlowArgs<T extends MELCloudDriver> = Record<
  SetCapability<T>,
  string
> & {
  readonly device: T extends MELCloudDriverAtw
    ? MELCloudDeviceAtw
    : T extends MELCloudDriverAta
      ? MELCloudDeviceAta
      : MELCloudDeviceErv
}

export interface LoginPostData {
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
  readonly Persist: true
}

export interface LoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

export interface FrostProtectionSettings {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}

export interface FrostProtectionPostData extends FrostProtectionSettings {
  readonly BuildingIds: [number]
}

export interface FrostProtectionData {
  FPEnabled: boolean
  FPMaxTemperature: number
  FPMinTemperature: number
}

export interface HolidayModeSettings {
  readonly Enabled: boolean
  readonly EndDate: string
  readonly StartDate: string
}

export interface HolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
  readonly HMTimeZones: [
    {
      readonly Buildings: [number]
    },
  ]
  readonly StartDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
}

export interface HolidayModeData {
  HMEnabled: boolean
  HMEndDate: string | null
  HMStartDate: string | null
}

interface BaseListDevice {
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
}

export interface ListDevice<T extends MELCloudDriver> extends BaseListDevice {
  readonly Device: ListDeviceData<T>
}

export type ListDeviceAny =
  | ListDevice<MELCloudDriverAta>
  | ListDevice<MELCloudDriverAtw>
  | ListDevice<MELCloudDriverErv>

export interface BuildingData extends FrostProtectionData, HolidayModeData {}

export interface Building extends Readonly<BuildingData> {
  readonly ID: number
  readonly Name: string
  readonly Structure: {
    readonly Areas: {
      readonly Devices: ListDeviceAny[]
    }[]
    readonly Devices: ListDeviceAny[]
    readonly Floors: {
      readonly Areas: {
        readonly Devices: ListDeviceAny[]
      }[]
      readonly Devices: ListDeviceAny[]
    }[]
  }
}

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}

export interface ErrorLogPostData {
  readonly DeviceIDs: string[]
  readonly FromDate: string
  readonly ToDate: string
}

export interface ErrorLogData {
  readonly DeviceId: number
  readonly Duration: number
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}

export interface ErrorDetails {
  readonly Date: string
  readonly Device: string
  readonly Error: string
}

export interface ErrorLog {
  readonly Errors: ErrorDetails[]
  readonly FromDateHuman: string
  readonly NextFromDate: string
  readonly NextToDate: string
}
