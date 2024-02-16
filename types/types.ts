import type { DateObjectUnits, DurationLike } from 'luxon'
import type {
  DeviceDataAta,
  DeviceDataAtw,
  DeviceDataErv,
  DeviceDataFromGetAta,
  DeviceDataFromGetAtw,
  DeviceDataFromGetErv,
  DeviceDataFromListAta,
  DeviceDataFromListAtw,
  DeviceDataFromListErv,
  HeatPumpType,
  Horizontal,
  ListDeviceAny,
  ListDeviceAta,
  ListDeviceAtw,
  ListDeviceErv,
  OperationMode,
  OperationModeState,
  OperationModeZone,
  PostDataAta,
  PostDataAtw,
  PostDataErv,
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
import type Homey from 'homey/lib/Homey'
import type { SimpleClass } from 'homey'

export enum ThermostatMode {
  auto = 'auto',
  heat = 'heat',
  cool = 'cool',
  off = 'off',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HomeyClass = new (...args: any[]) => SimpleClass & {
  readonly homey: Homey
  readonly setWarning?: (warning: string | null) => Promise<void>
}

export type MELCloudDriver = AtaDriver | AtwDriver | ErvDriver
export type MELCloudDevice = AtaDevice | AtwDevice | ErvDevice
type DeviceFromDriver<T> = MELCloudDriver & T extends AtaDriver
  ? AtaDevice
  : MELCloudDriver & T extends AtwDriver
    ? AtwDevice
    : ErvDevice

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

export interface HomeySettingsUI {
  readonly username: string | undefined
  readonly password: string | undefined
  readonly contextKey: string | undefined
  readonly expiry: string | undefined
}

export interface ReportPlanParameters {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly values: DateObjectUnits
}

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
  placeholder?: string
  title: string
  readonly driverId: string
  readonly groupId?: string
  readonly groupLabel?: string
  readonly id: string
  readonly max?: number
  readonly min?: number
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

export type SetDeviceData<T> = MELCloudDriver & T extends AtaDriver
  ? SetDeviceDataAta
  : MELCloudDriver & T extends AtwDriver
    ? SetDeviceDataAtw
    : SetDeviceDataErv
export type PostData<T> = MELCloudDriver & T extends AtaDriver
  ? PostDataAta
  : MELCloudDriver & T extends AtwDriver
    ? PostDataAtw
    : PostDataErv
export type DeviceData<T> = MELCloudDriver & T extends AtaDriver
  ? DeviceDataAta
  : MELCloudDriver & T extends AtwDriver
    ? DeviceDataAtw
    : DeviceDataErv
export type DeviceDataFromGet<T> = MELCloudDriver & T extends AtaDriver
  ? DeviceDataFromGetAta
  : MELCloudDriver & T extends AtwDriver
    ? DeviceDataFromGetAtw
    : DeviceDataFromGetErv
export type DeviceDataFromList<T> = MELCloudDriver & T extends AtaDriver
  ? DeviceDataFromListAta
  : MELCloudDriver & T extends AtwDriver
    ? DeviceDataFromListAtw
    : DeviceDataFromListErv

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
  readonly fan_power_state: number
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
    : SetCapabilitiesErv) & {
  thermostat_mode?: ThermostatMode
}
export type OpCapabilities<T> = MELCloudDriver & T extends AtaDriver
  ? GetCapabilitiesAta & ListCapabilitiesAta & SetCapabilitiesAta
  : MELCloudDriver & T extends AtwDriver
    ? GetCapabilitiesAtw & ListCapabilitiesAtw & SetCapabilitiesAtw
    : GetCapabilitiesErv & ListCapabilitiesErv & SetCapabilitiesErv
export type ReportData<T> = MELCloudDriver & T extends AtaDriver
  ? ReportDataAta
  : MELCloudDriver & T extends AtwDriver
    ? ReportDataAtw
    : never
export type ReportCapabilities<T> = MELCloudDriver & T extends AtaDriver
  ? ReportCapabilitiesAta
  : MELCloudDriver & T extends AtwDriver
    ? ReportCapabilitiesAtw
    : never
export type Capabilities<T> = OpCapabilities<T> &
  ReportCapabilities<T> & { thermostat_mode: ThermostatMode }

type SetCapabilityMappingAtaType = Record<
  keyof SetCapabilitiesAta,
  {
    readonly effectiveFlag: bigint
    readonly tag: Exclude<keyof SetDeviceDataAta, 'EffectiveFlags'>
  }
>
export const setCapabilityMappingAta: SetCapabilityMappingAtaType = {
  fan_power: { effectiveFlag: 0x8n, tag: 'SetFanSpeed' },
  horizontal: { effectiveFlag: 0x100n, tag: 'VaneHorizontal' },
  onoff: { effectiveFlag: 0x1n, tag: 'Power' },
  operation_mode: { effectiveFlag: 0x2n, tag: 'OperationMode' },
  target_temperature: { effectiveFlag: 0x4n, tag: 'SetTemperature' },
  vertical: { effectiveFlag: 0x10n, tag: 'VaneVertical' },
} as const
export type SetCapabilityMappingAta = typeof setCapabilityMappingAta
type GetCapabilityMappingAtaType = Record<
  keyof GetCapabilitiesAta,
  { readonly tag: Exclude<keyof DeviceDataAta, 'EffectiveFlags'> }
>
export const getCapabilityMappingAta: GetCapabilityMappingAtaType = {
  measure_temperature: { tag: 'RoomTemperature' },
} as const
export type GetCapabilityMappingAta = typeof getCapabilityMappingAta
type ListCapabilityMappingAtaType = Record<
  keyof ListCapabilitiesAta,
  { readonly tag: Exclude<keyof DeviceDataFromListAta, 'EffectiveFlags'> }
>
export const listCapabilityMappingAta: ListCapabilityMappingAtaType = {
  fan_power_state: { tag: 'ActualFanSpeed' },
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
} as const
export type ListCapabilityMappingAta = typeof listCapabilityMappingAta
type ReportCapabilityMappingAtaType = Record<
  keyof ReportCapabilitiesAta,
  readonly (keyof ReportDataAta)[]
>
export const reportCapabilityMappingAta: ReportCapabilityMappingAtaType = {
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
export type ReportCapabilityMappingAta = typeof reportCapabilityMappingAta

type SetCapabilityMappingAtwType = Record<
  keyof SetCapabilitiesAtw,
  {
    readonly effectiveFlag: bigint
    readonly tag: Exclude<keyof SetDeviceDataAtw, 'EffectiveFlags'>
  }
>
export const setCapabilityMappingAtw: SetCapabilityMappingAtwType = {
  onoff: { effectiveFlag: 0x1n, tag: 'Power' },
  'onoff.forced_hot_water': {
    effectiveFlag: 0x10000n,
    tag: 'ForcedHotWaterMode',
  },
  operation_mode_zone: { effectiveFlag: 0x8n, tag: 'OperationModeZone1' },
  'operation_mode_zone.zone2': {
    effectiveFlag: 0x10n,
    tag: 'OperationModeZone2',
  },
  operation_mode_zone_with_cool: {
    effectiveFlag: 0x8n,
    tag: 'OperationModeZone1',
  },
  'operation_mode_zone_with_cool.zone2': {
    effectiveFlag: 0x10n,
    tag: 'OperationModeZone2',
  },
  target_temperature: {
    effectiveFlag: 0x200000080n,
    tag: 'SetTemperatureZone1',
  },
  'target_temperature.flow_cool': {
    effectiveFlag: 0x1000000000000n,
    tag: 'SetCoolFlowTemperatureZone1',
  },
  'target_temperature.flow_cool_zone2': {
    effectiveFlag: 0x1000000000000n,
    tag: 'SetCoolFlowTemperatureZone2',
  },
  'target_temperature.flow_heat': {
    effectiveFlag: 0x1000000000000n,
    tag: 'SetHeatFlowTemperatureZone1',
  },
  'target_temperature.flow_heat_zone2': {
    effectiveFlag: 0x1000000000000n,
    tag: 'SetHeatFlowTemperatureZone2',
  },
  'target_temperature.tank_water': {
    effectiveFlag: 0x1000000000020n,
    tag: 'SetTankWaterTemperature',
  },
  'target_temperature.zone2': {
    effectiveFlag: 0x800000200n,
    tag: 'SetTemperatureZone2',
  },
} as const
export type SetCapabilityMappingAtw = typeof setCapabilityMappingAtw
type GetCapabilityMappingAtwType = Record<
  keyof GetCapabilitiesAtw,
  { readonly tag: Exclude<keyof DeviceDataAtw, 'EffectiveFlags'> }
>
export const getCapabilityMappingAtw: GetCapabilityMappingAtwType = {
  measure_temperature: { tag: 'RoomTemperatureZone1' },
  'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
  'measure_temperature.tank_water': { tag: 'TankWaterTemperature' },
  'measure_temperature.zone2': { tag: 'RoomTemperatureZone2' },
  operation_mode_state: { tag: 'OperationMode' },
  // Must follow `operation_mode_state`
  'operation_mode_state.zone1': { tag: 'IdleZone1' },
  'operation_mode_state.zone2': { tag: 'IdleZone2' },
} as const
export type GetCapabilityMappingAtw = typeof getCapabilityMappingAtw
type ListCapabilityMappingAtwType = Record<
  keyof ListCapabilitiesAtw,
  { readonly tag: Exclude<keyof DeviceDataFromListAtw, 'EffectiveFlags'> }
>
export const listCapabilityMappingAtw: ListCapabilityMappingAtwType = {
  'alarm_generic.booster_heater1': { tag: 'BoosterHeater1Status' },
  'alarm_generic.booster_heater2': { tag: 'BoosterHeater2Status' },
  'alarm_generic.booster_heater2_plus': { tag: 'BoosterHeater2PlusStatus' },
  'alarm_generic.defrost_mode': { tag: 'DefrostMode' },
  'alarm_generic.eco_hot_water': { tag: 'EcoHotWater' },
  'alarm_generic.immersion_heater': { tag: 'ImmersionHeaterStatus' },
  last_legionella: { tag: 'LastLegionellaActivationTime' },
  measure_power: { tag: 'CurrentEnergyConsumed' },
  'measure_power.heat_pump_frequency': { tag: 'HeatPumpFrequency' },
  'measure_power.produced': { tag: 'CurrentEnergyProduced' },
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
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
export type ListCapabilityMappingAtw = typeof listCapabilityMappingAtw
type ReportCapabilityMappingAtwType = Record<
  keyof ReportCapabilitiesAtw,
  readonly (keyof ReportDataAtw)[]
>
export const reportCapabilityMappingAtw: ReportCapabilityMappingAtwType = {
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
export type ReportCapabilityMappingAtw = typeof reportCapabilityMappingAtw

type SetCapabilityMappingErvType = Record<
  keyof SetCapabilitiesErv,
  {
    readonly effectiveFlag: bigint
    readonly tag: Exclude<keyof SetDeviceDataErv, 'EffectiveFlags'>
  }
>
export const setCapabilityMappingErv: SetCapabilityMappingErvType = {
  fan_power: { effectiveFlag: 0x8n, tag: 'SetFanSpeed' },
  onoff: { effectiveFlag: 0x1n, tag: 'Power' },
  ventilation_mode: { effectiveFlag: 0x4n, tag: 'VentilationMode' },
} as const
export type SetCapabilityMappingErv = typeof setCapabilityMappingErv
type GetCapabilityMappingErvType = Record<
  keyof GetCapabilitiesErv,
  { readonly tag: Exclude<keyof DeviceDataErv, 'EffectiveFlags'> }
>
export const getCapabilityMappingErv: GetCapabilityMappingErvType = {
  measure_co2: { tag: 'RoomCO2Level' },
  measure_temperature: { tag: 'RoomTemperature' },
  'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
} as const
export type GetCapabilityMappingErv = typeof getCapabilityMappingErv
type ListCapabilityMappingErvType = Record<
  keyof ListCapabilitiesErv,
  { readonly tag: Exclude<keyof DeviceDataFromListErv, 'EffectiveFlags'> }
>
export const listCapabilityMappingErv: ListCapabilityMappingErvType = {
  measure_pm25: { tag: 'PM25Level' },
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
} as const
export type ListCapabilityMappingErv = typeof listCapabilityMappingErv
type ReportCapabilityMappingErvType = Record<string, never>
export const reportCapabilityMappingErv: ReportCapabilityMappingErvType =
  {} as const
export type ReportCapabilityMappingErv = typeof reportCapabilityMappingErv

export interface SetCapabilityData<T> {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>
}
export type SetCapabilityMappingAny =
  | SetCapabilityMappingAta
  | SetCapabilityMappingAtw
  | SetCapabilityMappingErv
export type SetCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? SetCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? SetCapabilityMappingAtw
    : SetCapabilityMappingErv
export interface GetCapabilityData<T> {
  readonly tag: Exclude<keyof DeviceData<T>, 'EffectiveFlags'>
}
export type GetCapabilityMappingAny =
  | GetCapabilityMappingAta
  | GetCapabilityMappingAtw
  | GetCapabilityMappingErv
export type GetCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? GetCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? GetCapabilityMappingAtw
    : GetCapabilityMappingErv
interface ListCapabilityData<T> {
  readonly tag: Exclude<keyof DeviceDataFromList<T>, 'EffectiveFlags'>
}
export type ListCapabilityMappingAny =
  | ListCapabilityMappingAta
  | ListCapabilityMappingAtw
  | ListCapabilityMappingErv
export type ListCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? ListCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? ListCapabilityMappingAtw
    : ListCapabilityMappingErv
export type OpCapabilityData<T> =
  | GetCapabilityData<T>
  | ListCapabilityData<T>
  | SetCapabilityData<T>
export type ReportCapabilityMappingAny =
  | ReportCapabilityMappingAta
  | ReportCapabilityMappingAtw
  | ReportCapabilityMappingErv
export type ReportCapabilityMapping<T> = MELCloudDriver & T extends AtaDriver
  ? ReportCapabilityMappingAta
  : MELCloudDriver & T extends AtwDriver
    ? ReportCapabilityMappingAtw
    : ReportCapabilityMappingErv

export type FlowArgs<T> = (MELCloudDriver & T extends AtaDriver
  ? SetCapabilities<AtaDriver>
  : MELCloudDriver & T extends AtwDriver
    ? {
        readonly onoff: boolean
        readonly operation_mode_state: keyof typeof OperationModeState
        readonly operation_mode_zone: keyof typeof OperationModeZone
        readonly target_temperature: number
      }
    : SetCapabilities<ErvDriver>) & { readonly device: DeviceFromDriver<T> }

export type ListDevice<T> = MELCloudDriver & T extends AtaDriver
  ? ListDeviceAta
  : MELCloudDriver & T extends AtwDriver
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

export interface FrostProtectionSettings {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}

export interface HolidayModeSettings {
  readonly enabled: boolean
  readonly endDate: string
  readonly startDate: string
}
