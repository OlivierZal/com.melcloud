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
  readonly AppVersion: '1.9.3.0'
  readonly Email: string
  readonly Password: string
  readonly Persist: true
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

export type DeviceInfo<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? DeviceInfoAtw
  : DeviceInfoAta

interface DeviceInfoAta {
  readonly name: string
  readonly data: {
    readonly id: number
    readonly buildingid: number
  }
}

interface DeviceInfoAtw {
  readonly name: string
  readonly data: {
    readonly id: number
    readonly buildingid: number
  }
  readonly store: {
    readonly canCool: boolean
    readonly hasZone2: boolean
  }
  readonly capabilities: Array<Capability<MELCloudDeviceAtw>>
}

export type GetData<T extends MELCloudDevice> = UpdateData<T> & GetDeviceData<T>

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

export type PostData<T extends MELCloudDevice> = UpdateData<T> & {
  readonly DeviceID: number
  readonly HasPendingCommand: true
}

export type UpdateData<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? SetDeviceDataAtw
  : SetDeviceDataAta

interface SetDeviceDataAta {
  readonly EffectiveFlags: number
  readonly OperationMode: number
  readonly Power: boolean
  readonly SetTemperature: number
  readonly SetFanSpeed: number
  readonly VaneVertical: number
  readonly VaneHorizontal: number
}

interface SetDeviceDataAtw {
  readonly EffectiveFlags: number
  readonly ForcedHotWaterMode: boolean
  readonly OperationModeZone1: number
  readonly OperationModeZone2: number
  readonly OutdoorTemperature: number
  readonly Power: boolean
  readonly SetCoolFlowTemperatureZone1: number
  readonly SetCoolFlowTemperatureZone2: number
  readonly SetHeatFlowTemperatureZone1: number
  readonly SetHeatFlowTemperatureZone2: number
  readonly SetTankWaterTemperature: number
  readonly SetTemperatureZone1: number
  readonly SetTemperatureZone2: number
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

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
  readonly UseCurrency: false
}

export type Capability<T extends MELCloudDevice> = SetCapability<T> | ReportCapability<T> | GetCapability<T>

export type SetCapability<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? keyof SetCapabilitiesAtw
  : keyof SetCapabilitiesAta

export type SetCapabilities<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? SetCapabilitiesAtw
  : SetCapabilitiesAta

interface SetCapabilitiesAta {
  onoff?: boolean
  operation_mode?: string
  target_temperature?: number
  fan_power?: number
  vertical?: string
  horizontal?: string
}

interface SetCapabilitiesAtw {
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

type GetCapability<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? keyof GetCapabilitiesAtw
  : keyof GetCapabilitiesAta

interface GetCapabilitiesAta {
  measure_temperature?: number
  'measure_power.wifi'?: number
}

interface GetCapabilitiesAtw {
  eco_hot_water?: boolean
  measure_temperature?: number
  'measure_temperature.zone2'?: number
  'measure_temperature.outdoor'?: number
  'measure_temperature.tank_water'?: number
  operation_mode_state?: string
  'alarm_generic.booster_heater1'?: boolean
  'alarm_generic.booster_heater2'?: boolean
  'alarm_generic.booster_heater2_plus'?: boolean
  'alarm_generic.defrost_mode'?: boolean
  'alarm_generic.immersion_heater'?: boolean
  'measure_power.heat_pump_frequency'?: number
  'measure_power.wifi'?: number
  'measure_temperature.flow'?: number
  'measure_temperature.return'?: number
}

export type ReportCapability<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? keyof ReportCapabilitiesAtw
  : keyof ReportCapabilitiesAta

export type ReportCapabilities<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? ReportCapabilitiesAtw
  : ReportCapabilitiesAta

interface ReportCapabilitiesAta {
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

interface ReportCapabilitiesAtw {
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

export interface Settings {
  readonly [setting: string]: any
}
