import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import type { DeviceSettings, Settings } from './types/device-settings.mts'
import type { DriverSetting } from './types/driver-settings.mts'
import type {
  ClassicErrorLogQueryParams,
  FormattedErrorLog,
} from './types/error-log.mts'
import type { DeviceOrZoneData } from './types/zone.mts'
import { getClassicBuildings } from './lib/classic-facade-manager.mts'
import { toDeviceOrZoneData } from './lib/validation.mts'

const toNumber = (value: string | undefined): number | undefined => {
  if (value === undefined) {
    return undefined
  }
  const parsed = Number(value)
  if (value === '' || !Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric query param: ${JSON.stringify(value)}`)
  }
  return parsed
}

const api = {
  classicAuthenticate: async ({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<void> => app.classicApi.authenticate(body),
  getClassicBuildings: (): Classic.BuildingZone[] => getClassicBuildings(),
  getClassicErrorLog: async ({
    homey: { app },
    query: { from, offset, period, to },
  }: {
    homey: Homey
    query: Partial<ClassicErrorLogQueryParams>
  }): Promise<FormattedErrorLog> => {
    const parsedOffset = toNumber(offset)
    const parsedPeriod = toNumber(period)
    return app.getClassicErrorLog({
      from,
      offset: parsedOffset,
      period: parsedPeriod,
      to,
    })
  },
  getClassicFrostProtection: async ({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: DeviceOrZoneData
  }): Promise<Classic.FrostProtectionData> =>
    app.getClassicFrostProtection(toDeviceOrZoneData(params)),
  getClassicHolidayMode: async ({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: DeviceOrZoneData
  }): Promise<Classic.HolidayModeData> =>
    app.getClassicHolidayMode(toDeviceOrZoneData(params)),
  getDeviceSettings: ({ homey: { app } }: { homey: Homey }): DeviceSettings =>
    app.getDeviceSettings(),
  getDriverSettings: ({
    homey: { app },
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> => app.getDriverSettings(),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
  homeAuthenticate: async ({
    body,
    homey: { app },
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<void> => app.homeApi.authenticate(body),
  isClassicAuthenticated: ({ homey: { app } }: { homey: Homey }): boolean =>
    app.classicApi.isAuthenticated(),
  // Home authentication is only "restored" once a /context fetch has
  // succeeded. That boot-time fetch can fail transiently (e.g. the box
  // network is not ready right after an app restart) even though the
  // stored tokens are valid, which made the settings page show the Home
  // login form at open. Retry the context fetch lazily here so the check
  // self-heals; `list()` swallows its own failures.
  async isHomeAuthenticated({
    homey: { app },
  }: {
    homey: Homey
  }): Promise<boolean> {
    if (!app.homeApi.isAuthenticated()) {
      await app.homeApi.list()
    }
    return app.homeApi.isAuthenticated()
  },
  updateClassicFrostProtection: async ({
    body,
    homey: { app },
    params,
  }: {
    body: Classic.FrostProtectionQuery
    homey: Homey
    params: DeviceOrZoneData
  }): Promise<void> =>
    app.updateClassicFrostProtection({
      settings: body,
      ...toDeviceOrZoneData(params),
    }),
  updateClassicHolidayMode: async ({
    body,
    homey: { app },
    params,
  }: {
    body: Classic.HolidayModeQuery
    homey: Homey
    params: DeviceOrZoneData
  }): Promise<void> =>
    app.updateClassicHolidayMode({
      settings: body,
      ...toDeviceOrZoneData(params),
    }),
  updateDeviceSettings: async ({
    body,
    homey: { app },
    query: { driverId },
  }: {
    body: Settings
    homey: Homey
    query: { driverId?: string }
  }): Promise<void> => app.updateDeviceSettings({ driverId, settings: body }),
}

export default api
