import 'source-map-support/register'

import MELCloudDeviceAta from './drivers/melcloud/device'
import MELCloudDeviceAtw from './drivers/melcloud_atw/device'
import MELCloudDriverAta from './drivers/melcloud/driver'
import MELCloudDriverAtw from './drivers/melcloud_atw/driver'

export type MELCloudDevice = MELCloudDeviceAta | MELCloudDeviceAtw
export type MELCloudDriver = MELCloudDriverAta | MELCloudDriverAtw

export interface LoginData {
  readonly LoginData?: {
    readonly ContextKey: string
  }
}

export interface LoginPostData {
  AppVersion: '1.9.3.0'
  Email: string
  Password: string
  Persist: true
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface ListDevices {
  [DeviceID: number]: ListDevice
}

export interface ListDevice {
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
  readonly Device: {
    readonly CanCool: boolean
    readonly DeviceType: number
    readonly HasZone2: boolean
    readonly [tag: string]: boolean | number
  }
}

export interface Building {
  readonly Structure: {
    readonly Devices: ListDevice[]
    readonly Areas: Array<{
      readonly Devices: ListDevice[]
    }>
    readonly Floors: Array<{
      readonly Devices: ListDevice[]
      readonly Areas: Array<{
        readonly Devices: ListDevice[]
      }>
    }>
  }
}

export interface DeviceInfo {
  name: string
  data: {
    id: number
    buildingid: number
  }
  store?: {
    canCool: boolean
    hasZone2: boolean
  }
  capabilities?: string[]
}

export type ReportMapping<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? ReportMappingAtw
  : ReportMappingAta

interface ReportMappingAta {
  'meter_power.daily_consumed': number
  'meter_power.daily_consumed_auto': number
  'meter_power.daily_consumed_cooling': number
  'meter_power.daily_consumed_dry': number
  'meter_power.daily_consumed_fan': number
  'meter_power.daily_consumed_heating': number
  'meter_power.daily_consumed_other': number
  'meter_power.total_consumed': number
  'meter_power.total_consumed_auto': number
  'meter_power.total_consumed_cooling': number
  'meter_power.total_consumed_dry': number
  'meter_power.total_consumed_fan': number
  'meter_power.total_consumed_heating': number
  'meter_power.total_consumed_other': number
}

interface ReportMappingAtw {
  'meter_power.daily_cop': number
  'meter_power.daily_cop_cooling': number
  'meter_power.daily_cop_heating': number
  'meter_power.daily_cop_hotwater': number
  'meter_power.daily_consumed': number
  'meter_power.daily_consumed_cooling': number
  'meter_power.daily_consumed_heating': number
  'meter_power.daily_consumed_hotwater': number
  'meter_power.daily_produced': number
  'meter_power.daily_produced_cooling': number
  'meter_power.daily_produced_heating': number
  'meter_power.daily_produced_hotwater': number
  'meter_power.total_cop': number
  'meter_power.total_cop_cooling': number
  'meter_power.total_cop_heating': number
  'meter_power.total_cop_hotwater': number
  'meter_power.total_consumed': number
  'meter_power.total_consumed_cooling': number
  'meter_power.total_consumed_heating': number
  'meter_power.total_consumed_hotwater': number
  'meter_power.total_produced': number
  'meter_power.total_produced_cooling': number
  'meter_power.total_produced_heating': number
  'meter_power.total_produced_hotwater': number
}

export type ReportData<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? ReportDataAtw
  : ReportDataAta

interface ReportDataAta {
  readonly TotalHeatingConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalAutoConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}

interface ReportDataAtw {
  readonly TotalHeatingConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalCoolingProduced: number
  readonly TotalHotWaterProduced: number
}

export interface ReportPostData extends DeviceData {
  FromDate: string
  ToDate: string
  UseCurrency: false
}

export type GetData<T extends MELCloudDevice> = { +readonly [tag in keyof UpdateData<T>]: UpdateData<T>[tag] } & GetDeviceData<T>

type GetDeviceData<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? GetDeviceDataAtw
  : GetDeviceDataAta

interface GetDeviceDataAta {
  readonly RoomTemperature: number
}

interface GetDeviceDataAtw {
  readonly EcoHotWater: boolean
  readonly OperationMode: number
  readonly OutdoorTemperature: number
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}

export type PostData<T extends MELCloudDevice> = UpdateData<T> & DeviceData & { HasPendingCommand: true }

interface DeviceData {
  DeviceID: number
}

export type UpdateData<T extends MELCloudDevice> = SetDeviceData<T> & { EffectiveFlags: number }

type SetDeviceData<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? SetDeviceDataAtw
  : SetDeviceDataAta

interface SetDeviceDataAta {
  OperationMode: number
  Power: boolean
  SetTemperature: number
  SetFanSpeed: number
  VaneVertical: number
  VaneHorizontal: number
}

interface SetDeviceDataAtw {
  ForcedHotWaterMode: boolean
  OperationModeZone1: number
  OperationModeZone2: number
  OutdoorTemperature: number
  Power: boolean
  SetCoolFlowTemperatureZone1: number
  SetCoolFlowTemperatureZone2: number
  SetHeatFlowTemperatureZone1: number
  SetHeatFlowTemperatureZone2: number
  SetTankWaterTemperature: number
  SetTemperatureZone1: number
  SetTemperatureZone2: number
}

export type Diff<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? DiffAtw
  : DiffAta

interface DiffAta {
  onoff?: boolean
  operation_mode?: string
  target_temperature?: number
  fan_power?: number
  vertical?: string
  horizontal?: string
}

interface DiffAtw {
  onoff?: boolean
  'operation_mode_zone.zone1'?: string
  'operation_mode_zone_with_cool.zone1'?: string
  'operation_mode_zone.zone2'?: string
  'operation_mode_zone_with_cool.zone2'?: string
  'onoff.forced_hot_water'?: boolean
  target_temperature?: number
  'target_temperature.zone2'?: number
  'target_temperature.zone1_flow_cool'?: number
  'target_temperature.zone1_flow_heat'?: number
  'target_temperature.zone2_flow_cool'?: number
  'target_temperature.zone2_flow_heat'?: number
  'target_temperature.tank_water'?: number
}

export interface Settings {
  [setting: string]: any
}
