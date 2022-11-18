import 'source-map-support/register'

export interface Area {
  Devices: ListDevice[]
}

export interface Building {
  Structure: {
    Devices: ListDevice[]
    Areas: Area[]
    Floors: Floor[]
  }
}

export interface Data {
  [tag: string]: Value
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

export interface Floor {
  Devices: ListDevice[]
  Areas: Area[]
}

export interface Headers {
  headers: {
    'X-MitsContextKey': string
  }
}

export interface ListDevice {
  BuildingID: number
  DeviceID: number
  DeviceName: string
  Device: {
    [tag: string]: Value
    CanCool: boolean
    DeviceType: number
    HasZone2: boolean
  }
}

export interface ListDevices {
  [key: string]: ListDevice
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginData {
  LoginData?: {
    ContextKey: string
  }
}

export interface ReportMapping {
  [tag: string]: number
}

export interface Settings {
  [setting: string]: any
}

export type Value = boolean | number | string
