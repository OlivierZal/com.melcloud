import type { SimpleClass } from 'homey'
import type Homey from 'homey/lib/Homey'
import type AtaDevice from './drivers/melcloud/device'
import type AtaDriver from './drivers/melcloud/driver'
import type AtwDevice from './drivers/melcloud_atw/device'
import type AtwDriver from './drivers/melcloud_atw/driver'
import type ErvDevice from './drivers/melcloud_erv/device'
import type ErvDriver from './drivers/melcloud_erv/driver'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HomeyClass = new (...args: any[]) => SimpleClass & {
  readonly homey: Homey
  readonly setWarning?: (warning: string | null) => Promise<void>
}

export enum HeatPumpType {
  Ata = 0,
  Atw = 1,
  Erv = 3,
}

export type MELCloudDriver = AtaDriver | AtwDriver | ErvDriver
export type MELCloudDevice = AtaDevice | AtwDevice | ErvDevice
type DeviceFromDriver<T> = MELCloudDriver & T extends AtaDriver
  ? AtaDevice
  : MELCloudDriver & T extends AtwDriver
    ? AtwDevice
    : T extends ErvDriver
      ? ErvDevice
      : MELCloudDevice

export type BooleanString = 'false' | 'true'

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

interface BaseHomeySettings<T> {
  readonly username: T
  readonly password: T
  readonly contextKey: T
  readonly expiry: T
}
export type HomeySettings = BaseHomeySettings<string | null>
export type HomeySettingsUI = BaseHomeySettings<string | undefined>

export interface ReportPlanParameters {
  readonly duration: object
  readonly interval: object
  readonly minus: object
  readonly values: object
}

export type SyncFromMode = 'syncFrom'
export type SyncMode = SyncFromMode | 'syncTo'

export interface ManifestDriverSettingData {
  readonly id: string
  readonly label: Record<string, string>
  readonly max?: number
  readonly min?: number
  readonly type: string
  readonly units?: string
  readonly values?: readonly {
    readonly id: string
    readonly label: Record<string, string>
  }[]
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
  readonly id: string
  readonly pair?: LoginSetting & readonly PairSetting[]
  readonly settings?: readonly ManifestDriverSetting[]
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
  readonly values?: readonly { readonly id: string; readonly label: string }[]
}
export interface LoginCredentials {
  readonly password: string
  readonly username: string
}
export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}

export type DeviceSetting = Record<string, ValueOf<Settings>[]>
export type DeviceSettings = Record<string, DeviceSetting>

interface SetCapabilitiesCommon {
  onoff?: boolean
}
interface GetCapabilitiesCommon {
  readonly measure_temperature: number
}
interface ListCapabilitiesCommon {
  readonly 'measure_power.wifi': number
}

export enum ThermostatMode {
  auto = 'auto',
  heat = 'heat',
  cool = 'cool',
  off = 'off',
}
export enum OperationMode {
  heat = 1,
  dry = 2,
  cool = 3,
  fan = 7,
  auto = 8,
}
export enum Vertical {
  auto = 0,
  upwards = 1,
  mid_high = 2,
  middle = 3,
  mid_low = 4,
  downwards = 5,
  swing = 7,
}
export enum Horizontal {
  auto = 0,
  leftwards = 1,
  center_left = 2,
  center = 3,
  center_right = 4,
  rightwards = 5,
  swing = 12,
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

export enum OperationModeState {
  idle = 0,
  dhw = 1,
  heating = 2,
  cooling = 3,
  standby = 5,
  legionella = 6,
}
export enum OperationModeZone {
  room = 0,
  flow = 1,
  curve = 2,
  room_cool = 3,
  flow_cool = 4,
}
export interface OperationModeZoneCapabilities {
  operation_mode_zone?: keyof typeof OperationModeZone
  operation_mode_zone_with_cool?: keyof typeof OperationModeZone
  'operation_mode_zone.zone2'?: keyof typeof OperationModeZone
  'operation_mode_zone_with_cool.zone2'?: keyof typeof OperationModeZone
}
interface SetCapabilitiesAtw
  extends SetCapabilitiesCommon,
    OperationModeZoneCapabilities {
  'onoff.forced_hot_water'?: boolean
  target_temperature?: number
  'target_temperature.tank_water'?: number
  'target_temperature.flow_cool'?: number
  'target_temperature.flow_heat'?: number
  'target_temperature.zone2'?: number
  'target_temperature.flow_cool_zone2'?: number
  'target_temperature.flow_heat_zone2'?: number
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

export type SetCapabilities<T> = (MELCloudDriver & T extends AtaDriver
  ? SetCapabilitiesAta
  : MELCloudDriver & T extends AtwDriver
    ? SetCapabilitiesAtw
    : T extends ErvDriver
      ? SetCapabilitiesErv
      : SetCapabilitiesAta | SetCapabilitiesAtw | SetCapabilitiesErv) & {
  thermostat_mode?: ThermostatMode
}
export type OpCapabilities<T> = MELCloudDriver & T extends AtaDriver
  ? GetCapabilitiesAta & ListCapabilitiesAta & SetCapabilitiesAta
  : MELCloudDriver & T extends AtwDriver
    ? GetCapabilitiesAtw & ListCapabilitiesAtw & SetCapabilitiesAtw
    : T extends ErvDriver
      ? GetCapabilitiesErv & ListCapabilitiesErv & SetCapabilitiesErv
      :
          | (GetCapabilitiesAta & ListCapabilitiesAta & SetCapabilitiesAta)
          | (GetCapabilitiesAtw & ListCapabilitiesAtw & SetCapabilitiesAtw)
          | (GetCapabilitiesErv & ListCapabilitiesErv & SetCapabilitiesErv)
export type ReportCapabilities<T> = MELCloudDriver & T extends AtaDriver
  ? ReportCapabilitiesAta
  : MELCloudDriver & T extends AtwDriver
    ? ReportCapabilitiesAtw
    : T extends ErvDriver
      ? never
      : ReportCapabilitiesAta | ReportCapabilitiesAtw
export type Capabilities<T> = OpCapabilities<T> &
  ReportCapabilities<T> & { thermostat_mode: ThermostatMode }

interface BaseDeviceData {
  EffectiveFlags: number
  readonly Power?: boolean
}
interface ListDeviceDataCommon {
  readonly WifiSignalStrength: number
}

interface UpdateDeviceDataAta extends BaseDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: number
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}
type SetDeviceDataAta = Readonly<Required<UpdateDeviceDataAta>>
interface GetDeviceDataAta extends SetDeviceDataAta {
  readonly RoomTemperature: number
}
interface ListDeviceDataAta
  extends Exclude<
      GetDeviceDataAta,
      'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
    >,
    ListDeviceDataCommon {
  readonly DeviceType: HeatPumpType.Ata
  readonly ActualFanSpeed: number
  readonly FanSpeed: number
  readonly VaneHorizontalDirection: Horizontal
  readonly VaneVerticalDirection: Vertical
}

interface UpdateDeviceDataAtw extends BaseDeviceData {
  readonly ForcedHotWaterMode?: boolean
  readonly OperationModeZone1?: OperationModeZone
  readonly OperationModeZone2?: OperationModeZone
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}
type SetDeviceDataAtw = Readonly<Required<UpdateDeviceDataAtw>>
interface GetDeviceDataAtw extends SetDeviceDataAtw {
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: OperationModeState
  readonly OutdoorTemperature: number
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}
interface ListDeviceDataAtw extends GetDeviceDataAtw, ListDeviceDataCommon {
  readonly DeviceType: HeatPumpType.Atw
  readonly BoosterHeater1Status: boolean
  readonly BoosterHeater2PlusStatus: boolean
  readonly BoosterHeater2Status: boolean
  readonly CanCool: boolean
  readonly CondensingTemperature: number
  readonly CurrentEnergyConsumed: number
  readonly CurrentEnergyProduced: number
  readonly DefrostMode: number
  readonly EcoHotWater: boolean
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

interface UpdateDeviceDataErv extends BaseDeviceData {
  readonly SetFanSpeed?: number
  readonly VentilationMode?: VentilationMode
}
type SetDeviceDataErv = Readonly<Required<UpdateDeviceDataErv>>
interface GetDeviceDataErv extends SetDeviceDataErv {
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
  readonly OutdoorTemperature: number
}
interface ListDeviceDataErv extends GetDeviceDataErv, ListDeviceDataCommon {
  readonly DeviceType: HeatPumpType.Erv
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

export type UpdateDeviceData<T> = MELCloudDriver & T extends AtaDriver
  ? UpdateDeviceDataAta
  : MELCloudDriver & T extends AtwDriver
    ? UpdateDeviceDataAtw
    : T extends ErvDriver
      ? UpdateDeviceDataErv
      : UpdateDeviceDataAta | UpdateDeviceDataAtw | UpdateDeviceDataErv
export type SetDeviceData<T> = Readonly<Required<UpdateDeviceData<T>>>
export type PostData<T> = SetDeviceData<T> & {
  readonly DeviceID: number
  readonly HasPendingCommand: true
}

export type GetDeviceData<T> = MELCloudDriver & T extends AtaDriver
  ? GetDeviceDataAta
  : MELCloudDriver & T extends AtwDriver
    ? GetDeviceDataAtw
    : T extends ErvDriver
      ? GetDeviceDataErv
      : GetDeviceDataAta | GetDeviceDataAtw | GetDeviceDataErv
export type ListDeviceData<T> = MELCloudDriver & T extends AtaDriver
  ? ListDeviceDataAta
  : MELCloudDriver & T extends AtwDriver
    ? ListDeviceDataAtw
    : T extends ErvDriver
      ? ListDeviceDataErv
      : ListDeviceDataAta | ListDeviceDataAtw | ListDeviceDataErv

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
  readonly UseCurrency: false
}

interface ReportDataAta {
  readonly Auto: readonly number[]
  readonly Cooling: readonly number[]
  readonly Dry: readonly number[]
  readonly Fan: readonly number[]
  readonly Heating: readonly number[]
  readonly Other: readonly number[]
  readonly TotalAutoConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalHeatingConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}
interface ReportDataAtw {
  readonly CoP: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}
export type ReportData<T> = MELCloudDriver & T extends AtaDriver
  ? ReportDataAta
  : MELCloudDriver & T extends AtwDriver
    ? ReportDataAtw
    : T extends ErvDriver
      ? never
      : ReportDataAta | ReportDataAtw

export type SetCapabilityMappingAta = Record<
  keyof SetCapabilitiesAta,
  {
    readonly effectiveFlag: bigint
    readonly tag: Exclude<keyof SetDeviceDataAta, 'EffectiveFlags'>
  }
>
export const setCapabilityMappingAta: SetCapabilityMappingAta = {
  onoff: { tag: 'Power', effectiveFlag: 0x1n },
  operation_mode: { tag: 'OperationMode', effectiveFlag: 0x2n },
  target_temperature: { tag: 'SetTemperature', effectiveFlag: 0x4n },
  fan_power: { tag: 'SetFanSpeed', effectiveFlag: 0x8n },
  vertical: { tag: 'VaneVertical', effectiveFlag: 0x10n },
  horizontal: { tag: 'VaneHorizontal', effectiveFlag: 0x100n },
} as const
export type GetCapabilityMappingAta = Record<
  keyof GetCapabilitiesAta,
  { readonly tag: Exclude<keyof GetDeviceDataAta, 'EffectiveFlags'> }
>
export const getCapabilityMappingAta: GetCapabilityMappingAta = {
  measure_temperature: { tag: 'RoomTemperature' },
} as const
export type ListCapabilityMappingAta = Record<
  keyof ListCapabilitiesAta,
  { readonly tag: Exclude<keyof ListDeviceDataAta, 'EffectiveFlags'> }
>
export const listCapabilityMappingAta: ListCapabilityMappingAta = {
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
  fan_power: { tag: 'FanSpeed' },
  fan_power_state: { tag: 'ActualFanSpeed' },
  vertical: { tag: 'VaneVerticalDirection' },
  horizontal: { tag: 'VaneHorizontalDirection' },
} as const
export type ReportCapabilityMappingAta = Record<
  keyof ReportCapabilitiesAta,
  readonly (keyof ReportDataAta)[]
>
export const reportCapabilityMappingAta: ReportCapabilityMappingAta = {
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

export type SetCapabilityMappingAtw = Record<
  keyof SetCapabilitiesAtw,
  {
    readonly effectiveFlag: bigint
    readonly tag: Exclude<keyof SetDeviceDataAtw, 'EffectiveFlags'>
  }
>
export const setCapabilityMappingAtw: SetCapabilityMappingAtw = {
  onoff: { tag: 'Power', effectiveFlag: 0x1n },
  operation_mode_zone: { tag: 'OperationModeZone1', effectiveFlag: 0x8n },
  operation_mode_zone_with_cool: {
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
export type GetCapabilityMappingAtw = Record<
  keyof GetCapabilitiesAtw,
  { readonly tag: Exclude<keyof GetDeviceDataAtw, 'EffectiveFlags'> }
>
export const getCapabilityMappingAtw: GetCapabilityMappingAtw = {
  measure_temperature: { tag: 'RoomTemperatureZone1' },
  'measure_temperature.zone2': { tag: 'RoomTemperatureZone2' },
  'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
  'measure_temperature.tank_water': { tag: 'TankWaterTemperature' },
  operation_mode_state: { tag: 'OperationMode' },
  // Must follow `operation_mode_state`
  'operation_mode_state.zone1': { tag: 'IdleZone1' },
  'operation_mode_state.zone2': { tag: 'IdleZone2' },
} as const
export type ListCapabilityMappingAtw = Record<
  keyof ListCapabilitiesAtw,
  { readonly tag: Exclude<keyof ListDeviceDataAtw, 'EffectiveFlags'> }
>
export const listCapabilityMappingAtw: ListCapabilityMappingAtw = {
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
  'alarm_generic.booster_heater1': { tag: 'BoosterHeater1Status' },
  'alarm_generic.booster_heater2': { tag: 'BoosterHeater2Status' },
  'alarm_generic.booster_heater2_plus': { tag: 'BoosterHeater2PlusStatus' },
  'alarm_generic.defrost_mode': { tag: 'DefrostMode' },
  'alarm_generic.eco_hot_water': { tag: 'EcoHotWater' },
  'alarm_generic.immersion_heater': { tag: 'ImmersionHeaterStatus' },
  last_legionella: { tag: 'LastLegionellaActivationTime' },
  measure_power: { tag: 'CurrentEnergyConsumed' },
  'measure_power.produced': { tag: 'CurrentEnergyProduced' },
  'measure_power.heat_pump_frequency': { tag: 'HeatPumpFrequency' },
  'measure_temperature.condensing': { tag: 'CondensingTemperature' },
  'measure_temperature.flow': { tag: 'FlowTemperature' },
  'measure_temperature.flow_zone1': { tag: 'FlowTemperatureZone1' },
  'measure_temperature.flow_zone2': { tag: 'FlowTemperatureZone2' },
  'measure_temperature.return': { tag: 'ReturnTemperature' },
  'measure_temperature.return_zone1': { tag: 'ReturnTemperatureZone1' },
  'measure_temperature.return_zone2': { tag: 'ReturnTemperatureZone2' },
  'measure_temperature.tank_water_mixing': {
    tag: 'MixingTankWaterTemperature',
  },
  'measure_temperature.target_curve': { tag: 'TargetHCTemperatureZone1' },
  'measure_temperature.target_curve_zone2': { tag: 'TargetHCTemperatureZone2' },
} as const
export type ReportCapabilityMappingAtw = Record<
  keyof ReportCapabilitiesAtw,
  readonly (keyof ReportDataAtw)[]
>
export const reportCapabilityMappingAtw: ReportCapabilityMappingAtw = {
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

export type SetCapabilityMappingErv = Record<
  keyof SetCapabilitiesErv,
  {
    readonly effectiveFlag: bigint
    readonly tag: Exclude<keyof SetDeviceDataErv, 'EffectiveFlags'>
  }
>
export const setCapabilityMappingErv: SetCapabilityMappingErv = {
  onoff: { tag: 'Power', effectiveFlag: 0x1n },
  ventilation_mode: { tag: 'VentilationMode', effectiveFlag: 0x4n },
  fan_power: { tag: 'SetFanSpeed', effectiveFlag: 0x8n },
} as const
export type GetCapabilityMappingErv = Record<
  keyof GetCapabilitiesErv,
  { readonly tag: Exclude<keyof GetDeviceDataErv, 'EffectiveFlags'> }
>
export const getCapabilityMappingErv: GetCapabilityMappingErv = {
  measure_co2: { tag: 'RoomCO2Level' },
  measure_temperature: { tag: 'RoomTemperature' },
  'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
} as const
export type ListCapabilityMappingErv = Record<
  keyof ListCapabilitiesErv,
  { readonly tag: Exclude<keyof ListDeviceDataErv, 'EffectiveFlags'> }
>
export const listCapabilityMappingErv: ListCapabilityMappingErv = {
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
  measure_pm25: { tag: 'PM25Level' },
} as const

export interface SetCapabilityData<T> {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>
}
export type SetCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? SetCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? SetCapabilityMappingAtw
    : T extends ErvDriver
      ? SetCapabilityMappingErv
      :
          | SetCapabilityMappingAta
          | SetCapabilityMappingAtw
          | SetCapabilityMappingErv
export interface GetCapabilityData<T> {
  readonly tag: Exclude<keyof GetDeviceData<T>, 'EffectiveFlags'>
}
export type GetCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? GetCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? GetCapabilityMappingAtw
    : T extends ErvDriver
      ? GetCapabilityMappingErv
      :
          | GetCapabilityMappingAta
          | GetCapabilityMappingAtw
          | GetCapabilityMappingErv
export interface ListCapabilityData<T> {
  readonly tag: Exclude<keyof ListDeviceData<T>, 'EffectiveFlags'>
}
export type ListCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? ListCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? ListCapabilityMappingAtw
    : T extends ErvDriver
      ? ListCapabilityMappingErv
      :
          | ListCapabilityMappingAta
          | ListCapabilityMappingAtw
          | ListCapabilityMappingErv
export type OpCapabilityData<T> =
  | GetCapabilityData<T>
  | ListCapabilityData<T>
  | SetCapabilityData<T>
export type ReportCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? ReportCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? ReportCapabilityMappingAtw
    : T extends ErvDriver
      ? null
      : ReportCapabilityMappingAta | ReportCapabilityMappingAtw | null

export type FlowArgs<T> = (MELCloudDriver & T extends AtaDriver
  ? SetCapabilities<AtaDriver>
  : MELCloudDriver & T extends AtwDriver
    ? {
        readonly onoff: boolean
        readonly operation_mode_state: keyof typeof OperationModeState
        readonly operation_mode_zone: keyof typeof OperationModeZone
        readonly target_temperature: number
      }
    : T extends ErvDriver
      ? SetCapabilities<ErvDriver>
      : never) & { readonly device: DeviceFromDriver<T> }

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
  readonly HMTimeZones: [{ readonly Buildings: [number] }]
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

export interface SuccessData {
  readonly AttributeErrors: null
}
export interface FailureData {
  readonly AttributeErrors: Record<string, readonly string[]>
}

interface BaseListDevice {
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
}
interface ListDeviceAta extends BaseListDevice {
  readonly Device: ListDeviceDataAta
}
interface ListDeviceAtw extends BaseListDevice {
  readonly Device: ListDeviceDataAtw
}
interface ListDeviceErv extends BaseListDevice {
  readonly Device: ListDeviceDataErv
}
export type ListDevice<T> = MELCloudDriver & T extends AtaDriver
  ? ListDeviceAta
  : MELCloudDriver & T extends AtwDriver
    ? ListDeviceAtw
    : T extends ErvDriver
      ? ListDeviceErv
      : ListDeviceAta | ListDeviceAtw | ListDeviceErv

export interface BuildingData extends FrostProtectionData, HolidayModeData {}
export interface Building extends Readonly<BuildingData> {
  readonly ID: number
  readonly Name: string
  readonly Structure: {
    readonly Areas: readonly {
      readonly Devices: readonly ListDevice<MELCloudDriver>[]
    }[]
    readonly Devices: readonly ListDevice<MELCloudDriver>[]
    readonly Floors: readonly {
      readonly Areas: readonly {
        readonly Devices: readonly ListDevice<MELCloudDriver>[]
      }[]
      readonly Devices: readonly ListDevice<MELCloudDriver>[]
    }[]
  }
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
export interface ErrorLogPostData {
  readonly DeviceIDs: readonly string[]
  readonly FromDate: string
  readonly ToDate: string
}
export interface ErrorLogData {
  readonly DeviceId: number
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
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
