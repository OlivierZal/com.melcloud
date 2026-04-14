import type {
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
  FormattedErrorLog,
  Settings,
  ZoneData,
} from './types/index.mts'
import { getBuildings } from './lib/index.mts'

const api = {
  async createHomeSession({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return app.createHomeSession(body)
  },
  async createSession({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return app.createSession(body)
  },
  getBuildings(): BuildingZone[] {
    return getBuildings()
  },
  getClassicSession({ homey: { app } }: { homey: Homey }): boolean {
    return app.api.isAuthenticated()
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
  }): Promise<FormattedErrorLog> {
    return app.getErrors(query)
  },
  async getFrostProtection({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<FrostProtectionData> {
    return app.getFrostProtection(params)
  },
  async getHolidayMode({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<HolidayModeData> {
    return app.getHolidayMode(params)
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
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
    return app.setDeviceSettings({ driverId, settings: body })
  },
  async setFrostProtection({
    body,
    homey: { app },
    params,
  }: {
    body: FrostProtectionQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.setFrostProtection({ settings: body, ...params })
  },
  async setHolidayMode({
    body,
    homey: { app },
    params,
  }: {
    body: HolidayModeQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.setHolidayMode({ settings: body, ...params })
  },
}

export default api
