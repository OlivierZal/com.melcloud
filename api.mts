import type {
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionQuery,
  HolidayModeData,
  HolidayModeQuery,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type {
  BuildingZone,
  DeviceSettings,
  DriverSetting,
  Settings,
  ZoneData,
} from './types/index.mts'

import { getBuildings } from './lib/index.mts'

const api = {
  getBuildings(): BuildingZone[] {
    return getBuildings()
  },
  getDeviceSettings({ homey }: { homey: Homey }): DeviceSettings {
    return homey.app.getDeviceSettings()
  },
  getDriverSettings({
    homey,
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> {
    return homey.app.getDriverSettings()
  },
  async getErrors({
    homey,
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    return homey.app.getErrors(query)
  },
  async getFrostProtectionSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<FrostProtectionData> {
    return homey.app.getFrostProtectionSettings(params)
  },
  async getHolidayModeSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<HolidayModeData> {
    return homey.app.getHolidayModeSettings(params)
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
    return homey.app.login(body)
  },
  async setDeviceSettings({
    body,
    homey,
    query,
  }: {
    body: Settings
    homey: Homey
    query: { driverId?: string }
  }): Promise<void> {
    return homey.app.setDeviceSettings(body, { driverId: query.driverId })
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
    return homey.app.setFrostProtectionSettings(body, params)
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
    return homey.app.setHolidayModeSettings(body, params)
  },
}

export default api
