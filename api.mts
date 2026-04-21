import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import type { DeviceSettings, Settings } from './types/app-settings.mts'
import type { DriverSetting } from './types/driver-settings.mts'
import type { FormattedErrorLog } from './types/error-log.mts'
import type { ZoneData } from './types/zone.mts'
import { getClassicBuildings } from './lib/classic-facade-manager.mts'

const api = {
  async classicAuthenticate({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<void> {
    return app.classicApi.authenticate(body)
  },
  getClassicBuildings(): Classic.BuildingZone[] {
    return getClassicBuildings()
  },
  async getClassicErrorLog({
    homey: { app },
    query,
  }: {
    homey: Homey
    query: Classic.ErrorLogQuery
  }): Promise<FormattedErrorLog> {
    return app.getClassicErrorLog(query)
  },
  async getClassicFrostProtection({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<Classic.FrostProtectionData> {
    return app.getClassicFrostProtection(params)
  },
  async getClassicHolidayMode({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<Classic.HolidayModeData> {
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
  async homeAuthenticate({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<void> {
    return app.homeApi.authenticate(body)
  },
  isClassicAuthenticated({ homey: { app } }: { homey: Homey }): boolean {
    return app.classicApi.isAuthenticated()
  },
  isHomeAuthenticated({ homey: { app } }: { homey: Homey }): boolean {
    return app.homeApi.isAuthenticated()
  },
  async updateClassicFrostProtection({
    body,
    homey: { app },
    params,
  }: {
    body: Classic.FrostProtectionQuery
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
    body: Classic.HolidayModeQuery
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
