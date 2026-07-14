import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import type { DeviceSettings, Settings } from './types/device-settings.mts'
import type { DriverSetting } from './types/driver-settings.mts'
import type {
  ClassicErrorLogQueryParams,
  FormattedErrorLog,
} from './types/error-log.mts'
import type { DeviceGroup, DeviceOrZoneData } from './types/zone.mts'
import { getClassicBuildings } from './lib/classic-facade-manager.mts'
import { toDeviceOrZoneData } from './lib/validation.mts'

// The registry zone tree nests devices under the building itself, its
// areas, and its floors (which nest areas of their own)
const collectClassicDeviceIds = (
  building: Classic.BuildingZone,
): readonly string[] =>
  [
    ...building.devices,
    ...building.areas.flatMap(({ devices }) => devices),
    ...building.floors.flatMap((floor) => [
      ...floor.devices,
      ...floor.areas.flatMap(({ devices }) => devices),
    ]),
  ].map(({ id }) => String(id))

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
  /**
   * Lists the MELCloud buildings of both dialects with the device ids
   * they own, for the extension app's per-building settings grouping.
   * Home buildings come from the live context (owned and guest); a
   * failed Home fetch simply yields no Home entries.
   * @param options - Homey API context.
   * @param options.homey - Homey instance carrying the app.
   * @returns One entry per non-empty building, sorted by name.
   */
  getDeviceGroups: async ({
    homey: { app },
  }: {
    homey: Homey
  }): Promise<DeviceGroup[]> => {
    const classicGroups = getClassicBuildings().map((building) => ({
      deviceIds: collectClassicDeviceIds(building),
      name: building.name,
    }))
    const homeBuildings = await app.homeApi.list()
    const homeGroups = homeBuildings.map(
      ({ airToAirUnits, airToWaterUnits, name }) => ({
        deviceIds: [...airToAirUnits, ...airToWaterUnits].map(({ id }) => id),
        name,
      }),
    )
    return [...classicGroups, ...homeGroups]
      .filter(({ deviceIds }) => deviceIds.length > 0)
      .toSorted((group1, group2) => group1.name.localeCompare(group2.name))
  },
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
