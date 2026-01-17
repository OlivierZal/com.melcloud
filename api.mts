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
  TemperatureSensorInfo,
  ZoneData,
} from './types/index.mts'

import { getBuildings } from './lib/index.mts'

const api = {
  getBuildings(): BuildingZone[] {
    return getBuildings()
  },
  getDeviceSettings({ homey: { app } }: { homey: Homey }): DeviceSettings {
    return app.getDeviceSettings()
  },
  getDriverSettings({
    homey: { app },
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> {
    return app.getDriverSettings()
  },
  async getErrors({
    homey: { app },
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    return app.getErrors(query)
  },
  async getFrostProtectionSettings({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<FrostProtectionData> {
    return app.getFrostProtectionSettings(params)
  },
  async getHolidayModeSettings({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<HolidayModeData> {
    return app.getHolidayModeSettings(params)
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
  async getTemperatureSensors({
    homey: { app },
  }: {
    homey: Homey
  }): Promise<TemperatureSensorInfo[]> {
    return app.getTemperatureSensors()
  },
  async login({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return app.login(body)
  },
  async setDeviceSettings({
    body,
    homey: { app },
    query: { driverId },
  }: {
    body: Settings
    homey: Homey
    query: { driverId?: string }
  }): Promise<void> {
    return app.setDeviceSettings(body, { driverId })
  },
  async setFrostProtectionSettings({
    body,
    homey: { app },
    params,
  }: {
    body: FrostProtectionQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.setFrostProtectionSettings(body, params)
  },
  async setHolidayModeSettings({
    body,
    homey: { app },
    params,
  }: {
    body: HolidayModeQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.setHolidayModeSettings(body, params)
  },
}

export default api
