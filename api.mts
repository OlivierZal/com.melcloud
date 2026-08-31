import type { DriverSetting } from '@olivierzal/homey-kit/manifest'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'
import type { Homey } from 'homey/lib/Homey'
import { getErrorMessage } from '@olivierzal/homey-kit'
import {
  type BaseAPIAdapter,
  type HomeBuildingZone,
  type HomeDeviceZone,
  type LoginCredentials,
  type ProtectionUpdate,
  AuthenticationError,
  AuthenticationThrottledError,
  RegistrySyncError,
} from '@olivierzal/melcloud-api'

import type {
  Api,
  AuthenticationResult,
  HolidayModeSettings,
  TargetHolidayModeState,
  TargetProtectionState,
} from './types/api.mts'
import type { DeviceSettings, Settings } from './types/device-settings.mts'
import type {
  ErrorLogQueryParams,
  FormattedErrorLog,
} from './types/error-log.mts'
import type { DeviceGroup } from './types/zone.mts'
import { getClassicBuildings } from './lib/classic-facade-manager.mts'
import { toNonNegativeInt } from './lib/validation.mts'
import { getWebviewHashes } from './lib/webview-hashes.mts'

// The user-facing service names, interpolated into the failure
// messages so the alert says WHICH account failed.
const API_DISPLAY_NAMES = {
  classic: 'MELCloud Classic',
  home: 'MELCloud Home',
} as const

// The client behind each API id — the addressing map of the one
// `/sessions/:api` resource, where the family is the only visible step.
const API_CLIENTS: Record<Api, (app: Homey['app']) => BaseAPIAdapter> = {
  classic: (app) => app.classicApi,
  home: (app) => app.homeApi,
}

const isApi = (value: string): value is Api => Object.hasOwn(API_CLIENTS, value)

// A session path names one of the two APIs; anything else is a stale
// or hand-built address.
const toApi = (value: string): Api => {
  if (!isApi(value)) {
    throw new RangeError(`Invalid API: ${value}`)
  }
  return value
}

const getApiClient = ({ app }: Homey, service: Api): BaseAPIAdapter =>
  API_CLIENTS[service](app)

// The webview only receives an error MESSAGE across the app bridge, so
// login failures are classified here, where `instanceof` still works:
// a rejection reads differently from MELCloud's login throttle (where
// retrying keeps the lockout alive) and from a transport failure.
const toLoginFailure = (
  homey: Homey,
  service: keyof typeof API_DISPLAY_NAMES,
  error: unknown,
): Error => {
  if (!(error instanceof AuthenticationError)) {
    return new Error(getErrorMessage(error))
  }
  const reason =
    error instanceof AuthenticationThrottledError
      ? 'settings.authenticate.throttled'
      : 'settings.authenticate.rejected'
  return new Error(homey.__(reason, { name: API_DISPLAY_NAMES[service] }))
}

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

// A Home building can own units of both connection types; the registry
// merges them per building, so one pass covers a mixed building.
const collectHomeGroups = (registry: Home.Registry): DeviceGroup[] =>
  registry
    .getBuildings()
    .map(({ devices, name }) => ({
      deviceIds: devices.map((device) => device.id),
      name,
    }))

// Diagnostics breadcrumb: the settings webview is otherwise invisible in
// diagnostic reports (its routes never touch MELCloud), which made
// "settings fail to load" reports undecidable — no line = the page's JS
// never ran; lines without a completed sequence = where it stopped.
const logSettingsRoute = (app: Homey['app'], route: string): void => {
  app.log({ dataType: 'Settings page', route })
}

// Optional query params: absent stays absent, present must satisfy the
// error-log paging contract — a non-negative integer.
const toOptionalNonNegativeInt = (
  value: string | undefined,
  field: string,
): number | undefined =>
  value === undefined ? undefined : toNonNegativeInt(value, { field })

const api = {
  authenticate: async ({
    body,
    homey,
    params,
  }: {
    body: LoginCredentials
    homey: Homey
    params: { api: string }
  }): Promise<AuthenticationResult> => {
    const service = toApi(params.api)
    const client = getApiClient(homey, service)
    try {
      await client.authenticate(body)
    } catch (error) {
      // A rejection is not proof the credentials were refused: the
      // library enforces a registry sync AFTER the server accepted the
      // sign-in, and that failure arrives wrapped as its own TYPE —
      // `RegistrySyncError` means the account is in and only the device
      // list is stale. The type is the arbiter; re-deriving the verdict
      // from the session read "signed in" on a transport failure over a
      // PRE-EXISTING live session while the new credentials were never
      // accepted.
      if (error instanceof RegistrySyncError) {
        return { isDeviceListStale: true }
      }
      throw toLoginFailure(homey, service, error)
    }
    return { isDeviceListStale: false }
  },
  getClassicBuildings: (): Classic.BuildingZone[] => getClassicBuildings(),
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
    logSettingsRoute(app, 'GET /settings/devices')
    return app.getDeviceSettings()
  },
  getDriverSettings: ({
    homey: { app },
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> => {
    logSettingsRoute(app, 'GET /settings/drivers')
    return app.getDriverSettings()
  },
  getErrorLog: async ({
    homey: { app },
    query: { from, offset, period, to },
  }: {
    homey: Homey
    query: Partial<ErrorLogQueryParams>
  }): Promise<FormattedErrorLog> => {
    const parsedOffset = toOptionalNonNegativeInt(offset, 'offset')
    const parsedPeriod = toOptionalNonNegativeInt(period, 'period')
    return app.getErrorLog({
      ...(from !== undefined && { from }),
      ...(parsedOffset !== undefined && { offset: parsedOffset }),
      ...(parsedPeriod !== undefined && { period: parsedPeriod }),
      ...(to !== undefined && { to }),
    })
  },
  getHomeTargets: ({
    homey: { app },
  }: {
    homey: Homey
  }): (HomeBuildingZone | HomeDeviceZone)[] => app.getHomeTargets(),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
  getTargetFrostProtection: async ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Promise<TargetProtectionState> => app.getTargetFrostProtection(targetId),
  getTargetHolidayMode: async ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Promise<TargetHolidayModeState> => app.getTargetHolidayMode(targetId),
  getTargetOverheatProtection: async ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Promise<TargetProtectionState> =>
    app.getTargetOverheatProtection(targetId),
  getWebviewHashes: async ({
    homey: { app },
  }: {
    homey: Homey
  }): Promise<Partial<Record<string, string>>> => {
    logSettingsRoute(app, 'GET /webview-hashes')
    return getWebviewHashes()
  },
  isAuthenticated: async ({
    homey,
    params,
  }: {
    homey: Homey
    params: { api: string }
  }): Promise<boolean> => {
    const service = toApi(params.api)
    logSettingsRoute(homey.app, `GET /sessions/${service}`)
    return getApiClient(homey, service).ensureAuthenticated()
  },
  logOut: ({
    homey,
    params,
  }: {
    homey: Homey
    params: { api: string }
  }): void => {
    const service = toApi(params.api)
    logSettingsRoute(homey.app, `DELETE /sessions/${service}`)
    getApiClient(homey, service).logOut()
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
  updateDeviceSettings: async ({
    body,
    homey: { app },
    query: { driverId },
  }: {
    body: Settings
    homey: Homey
    query: { driverId?: string }
  }): Promise<void> => app.updateDeviceSettings({ driverId, settings: body }),
  updateTargetFrostProtection: async ({
    body,
    homey: { app },
    params: { targetId },
  }: {
    body: ProtectionUpdate
    homey: Homey
    params: { targetId: string }
  }): Promise<void> => app.updateTargetFrostProtection(targetId, body),
  updateTargetHolidayMode: async ({
    body,
    homey: { app },
    params: { targetId },
  }: {
    body: HolidayModeSettings
    homey: Homey
    params: { targetId: string }
  }): Promise<void> => app.updateTargetHolidayMode(targetId, body),
  updateTargetOverheatProtection: async ({
    body,
    homey: { app },
    params: { targetId },
  }: {
    body: ProtectionUpdate
    homey: Homey
    params: { targetId: string }
  }): Promise<void> => app.updateTargetOverheatProtection(targetId, body),
}

export default api
