import type {
  BuildingZone,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionQuery,
  HolidayModeData,
  HolidayModeQuery,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type {
  DeviceSettings,
  DriverSetting,
  FormattedErrorLog,
  Settings,
} from './types/settings.mts'
import type { ZoneData } from './types/widgets.mts'
import { getClassicBuildings } from './lib/classic-facade-manager.mts'

const api = {
  async authenticateClassic({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return app.authenticateClassic(body)
  },
  async authenticateHome({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return app.authenticateHome(body)
  },
  getClassicBuildings(): BuildingZone[] {
    return getClassicBuildings()
  },
  async getClassicErrorLog({
    homey: { app },
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<FormattedErrorLog> {
    return app.getClassicErrorLog(query)
  },
  async getClassicFrostProtection({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<FrostProtectionData> {
    return app.getClassicFrostProtection(params)
  },
  async getClassicHolidayMode({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<HolidayModeData> {
    return app.getClassicHolidayMode(params)
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
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
  isClassicAuthenticated({ homey: { app } }: { homey: Homey }): boolean {
    return app.classicApi.isAuthenticated()
  },
  async updateClassicFrostProtection({
    body,
    homey: { app },
    params,
  }: {
    body: FrostProtectionQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.updateClassicFrostProtection({ settings: body, ...params })
  },
  async updateClassicHolidayMode({
    body,
    homey: { app },
    params,
  }: {
    body: HolidayModeQuery
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.updateClassicHolidayMode({ settings: body, ...params })
  },
  async updateDeviceSettings({
    body,
    homey: { app },
    query: { driverId },
  }: {
    body: Settings
    homey: Homey
    query: { driverId?: string }
  }): Promise<void> {
    return app.updateDeviceSettings({ driverId, settings: body })
  },
}

export default api
