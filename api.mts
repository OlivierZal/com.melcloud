import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import {
  type LoginCredentials,
  AuthenticationError,
} from '@olivierzal/melcloud-api'
import * as Home from '@olivierzal/melcloud-api/home'

import type { DeviceSettings, Settings } from './types/device-settings.mts'
import type { DriverSetting } from './types/driver-settings.mts'
import type {
  ErrorLogQueryParams,
  FormattedErrorLog,
} from './types/error-log.mts'
import type { DeviceGroup, DeviceOrZoneData } from './types/zone.mts'
import { getClassicBuildings } from './lib/classic-facade-manager.mts'
import { getErrorMessage } from './lib/get-error-message.mts'
import { toDeviceOrZoneData } from './lib/validation.mts'

// The webview only receives an error MESSAGE across the app bridge, so
// login failures are classified here, where `instanceof` still works:
// a rejection reads differently from MELCloud's login throttle (where
// retrying keeps the lockout alive) and from a transport failure. The
// throttled subclass is not re-exported by the package root; its
// stable `name` is the discriminant.
const toLoginFailure = (homey: Homey, error: unknown): Error =>
  new Error(
    error instanceof AuthenticationError ?
      homey.__(
        error.name === 'AuthenticationThrottledError' ?
          'settings.authenticate.throttled'
        : 'settings.authenticate.rejected',
      )
    : getErrorMessage(error),
  )

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

// Home buildings can own units of both types; the per-type registry views
// are merged by building id so a mixed building yields a single group.
const collectHomeGroups = (registry: Home.Registry): DeviceGroup[] => {
  const groups = new Map<string, DeviceGroup>()
  for (const type of Object.values(Home.DeviceType)) {
    for (const { devices, id, name } of registry.getBuildingsByType(type)) {
      groups.set(id, {
        deviceIds: [
          ...(groups.get(id)?.deviceIds ?? []),
          ...devices.map((device) => device.id),
        ],
        name,
      })
    }
  }
  return groups.values().toArray()
}

// Diagnostics breadcrumb: the settings webview is otherwise invisible in
// diagnostic reports (its routes never touch MELCloud), which made
// "settings fail to load" reports undecidable — no line = the page's JS
// never ran; lines without a completed sequence = where it stopped.
const logSettingsRoute = (app: Homey['app'], route: string): void => {
  app.log({ dataType: 'Settings page', route })
}

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
    homey,
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<void> => {
    try {
      await homey.app.classicApi.authenticate(body)
    } catch (error) {
      throw toLoginFailure(homey, error)
    }
  },
  classicLogOut: ({ homey: { app } }: { homey: Homey }): void => {
    logSettingsRoute(app, '/classic/sessions')
    app.classicApi.logOut()
  },
  getClassicBuildings: (): Classic.BuildingZone[] => getClassicBuildings(),
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
   * Both dialects are served from the in-memory registries — no wire
   * call, no sync-cycle interference; entries (owned and guest alike)
   * reflect the latest sync.
   * @param options - Homey API context.
   * @param options.homey - Homey instance carrying the app.
   * @returns One entry per non-empty building, sorted by name.
   */
  getDeviceGroups: ({ homey: { app } }: { homey: Homey }): DeviceGroup[] => {
    const classicGroups = getClassicBuildings().map((building) => ({
      deviceIds: collectClassicDeviceIds(building),
      name: building.name,
    }))
    return [...classicGroups, ...collectHomeGroups(app.homeApi.registry)]
      .filter(({ deviceIds }) => deviceIds.length > 0)
      .toSorted((group1, group2) => group1.name.localeCompare(group2.name))
  },
  getDeviceSettings: ({ homey: { app } }: { homey: Homey }): DeviceSettings => {
    logSettingsRoute(app, '/settings/devices')
    return app.getDeviceSettings()
  },
  getDriverSettings: ({
    homey: { app },
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> => {
    logSettingsRoute(app, '/settings/drivers')
    return app.getDriverSettings()
  },
  getErrorLog: async ({
    homey: { app },
    query: { from, offset, period, to },
  }: {
    homey: Homey
    query: Partial<ErrorLogQueryParams>
  }): Promise<FormattedErrorLog> => {
    const parsedOffset = toNumber(offset)
    const parsedPeriod = toNumber(period)
    return app.getErrorLog({
      from,
      offset: parsedOffset,
      period: parsedPeriod,
      to,
    })
  },
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
  homeAuthenticate: async ({
    body,
    homey,
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<void> => {
    try {
      await homey.app.homeApi.authenticate(body)
    } catch (error) {
      throw toLoginFailure(homey, error)
    }
  },
  homeLogOut: ({ homey: { app } }: { homey: Homey }): void => {
    logSettingsRoute(app, '/home/sessions')
    app.homeApi.logOut()
  },
  isClassicAuthenticated: ({ homey: { app } }: { homey: Homey }): boolean => {
    logSettingsRoute(app, '/classic/sessions')
    return app.classicApi.isAuthenticated()
  },
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
    logSettingsRoute(app, '/home/sessions')
    if (!app.homeApi.isAuthenticated()) {
      await app.homeApi.list()
    }
    return app.homeApi.isAuthenticated()
  },
  logWebviewBoot: ({
    body,
    homey: { app },
  }: {
    body: unknown
    homey: Homey
  }): void => {
    app.error('Settings webview boot failed:', JSON.stringify(body))
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
