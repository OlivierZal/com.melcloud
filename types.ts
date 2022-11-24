import 'source-map-support/register'

import MELCloudDeviceAta from './drivers/melcloud/device'
import MELCloudDeviceAtw from './drivers/melcloud_atw/device'

interface DeviceData {
  DeviceID: number
}

export interface LoginData {
  LoginData?: {
    ContextKey: string
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
  BuildingID: number
  DeviceID: number
  DeviceName: string
  Device: {
    [tag: string]: boolean | number
    CanCool: boolean
    DeviceType: number
    HasZone2: boolean
  }
}

export interface Building {
  Structure: {
    Devices: ListDevice[]
    Areas: Array<{
      Devices: ListDevice[]
    }>
    Floors: Array<{
      Devices: ListDevice[]
      Areas: Array<{
        Devices: ListDevice[]
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

export interface ReportData {
  [tag: string]: number | string
}

export interface ReportPostData extends DeviceData {
  FromDate: string
  ToDate: string
  UseCurrency: false
}

export interface ReportMapping {
  [tag: string]: number
}

export type GetData<T extends MELCloudDeviceAta | MELCloudDeviceAtw> = UpdateData<T> & DeviceData & GetDeviceData<T>

export type PostData<T extends MELCloudDeviceAta | MELCloudDeviceAtw> = UpdateData<T> & DeviceData & { HasPendingCommand: true }

export type UpdateData<T extends MELCloudDeviceAta | MELCloudDeviceAtw> = SetDeviceData<T> & { EffectiveFlags: number }

type GetDeviceData<T extends MELCloudDeviceAta | MELCloudDeviceAtw> = T extends MELCloudDeviceAtw
  ? GetDeviceDataAtw
  : GetDeviceDataAta

interface GetDeviceDataAta {
  RoomTemperature: number
}

interface GetDeviceDataAtw {
  EcoHotWater: boolean
  OperationMode: number
  OutdoorTemperature: number
  RoomTemperatureZone1: number
  RoomTemperatureZone2: number
  TankWaterTemperature: number
}

type SetDeviceData<T extends MELCloudDeviceAta | MELCloudDeviceAtw> = T extends MELCloudDeviceAtw
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

export type Diff<T extends MELCloudDeviceAta | MELCloudDeviceAtw> = T extends MELCloudDeviceAtw
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
