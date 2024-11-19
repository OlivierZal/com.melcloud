import { getBuildings } from './lib/getBuildings.mts'

import type {
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionQuery,
  GroupAtaState,
  HolidayModeData,
  HolidayModeQuery,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey'

import type MELCloudApp from './app.mts'
import type {
  BuildingZone,
  DeviceSettings,
  DriverSetting,
  Settings,
  ZoneData,
} from './types/index.mts'

const getApp = (homey: Homey): MELCloudApp => homey.app as MELCloudApp

const api = {
  getBuildings(): BuildingZone[] {
    return getBuildings()
  },
  getDeviceSettings({ homey }: { homey: Homey }): DeviceSettings {
    return getApp(homey).getDeviceSettings()
  },
  getDriverSettings({
    homey,
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> {
    return getApp(homey).getDriverSettings()
  },
  async getErrors({
    homey,
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    return getApp(homey).getErrors(query)
  },
  async getFrostProtectionSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<FrostProtectionData> {
    return getApp(homey).getFrostProtectionSettings(params)
  },
  async getHolidayModeSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<HolidayModeData> {
    return getApp(homey).getHolidayModeSettings(params)
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
  },
  async login({
    body,
    homey,
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return getApp(homey).login(body)
  },
  async setAtaValues({
    body,
    homey,
    params,
  }: {
    body: GroupAtaState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return getApp(homey).setAtaValues(body, params)
  },
  async setDeviceSettings({
    body,
    homey,
    query,
  }: {
    body: Settings
    homey: Homey
    query?: { driverId: string }
  }): Promise<void> {
    return getApp(homey).setDeviceSettings(body, query?.driverId)
  },
  async setFrostProtectionSettings({
    body,
    homey,
    params,
  }: {
    body: FrostProtectionQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return getApp(homey).setFrostProtectionSettings(body, params)
  },
  async setHolidayModeSettings({
    body,
    homey,
    params,
  }: {
    body: HolidayModeQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return getApp(homey).setHolidayModeSettings(body, params)
  },
}

export default api
