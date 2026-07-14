import 'source-map-support/register.js'

import {
  type DeviceType,
  type Hour,
  type Logger,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type SettingManager,
  type SyncCallback,
  isClassicAtaFacade,
  NoChangesError,
  operationModeToClassic,
} from '@olivierzal/melcloud-api'
import { Intl, Temporal } from 'temporal-polyfill'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type { Api } from './types/api.mts'
import type { GroupAtaStates } from './types/classic-ata.mts'
import type {
  DeviceSetting,
  DeviceSettings,
  Settings,
} from './types/device-settings.mts'
import type {
  DriverCapabilitiesOptions,
  DriverSetting,
} from './types/driver-settings.mts'
import type { FormattedErrorLog } from './types/error-log.mts'
import type { HomeDeviceFacade } from './types/home.mts'
import type {
  LoginSetting,
  ManifestDriver,
  ManifestDriverCapabilitiesOptions,
} from './types/manifest.mts'
import type { MELCloudDevice, MELCloudDriver } from './types/melcloud.mts'
import type { GetAtaOptions } from './types/widgets.mts'
import type {
  DeviceOrZoneData,
  HomeBuildingZone,
  HomeDeviceZone,
  ZoneData,
} from './types/zone.mts'
import {
  changelog,
  fanSpeed,
  horizontal,
  power,
  targetTemperature,
  thermostatMode,
  vertical,
} from './files.mts'
import { setClassicFacadeManager } from './lib/classic-facade-manager.mts'
import { NotFoundError } from './lib/errors.mts'
import { type Homey, App } from './lib/homey.mts'
import { getTimeZone } from './lib/temporal.mts'
import { typedFromEntries } from './lib/typed-object.mts'
import { unwrapResult } from './lib/unwrap-result.mts'
import { fanSpeedValues } from './types/ata-erv.mts'

const HOLIDAY_MODE_MAX_DURATION_DAYS = 365
const HOLIDAY_MODE_OFF_DURATION = 0

const NOTIFICATION_DELAY_MS = 10_000

const DRIVER_IDS_BY_TYPE: Partial<Record<DeviceType, string>> = {
  [Classic.DeviceType.Ata]: 'melcloud',
  [Classic.DeviceType.Atw]: 'melcloud_atw',
  [Classic.DeviceType.Erv]: 'melcloud_erv',
  [Home.DeviceType.Ata]: 'home-melcloud',
  [Home.DeviceType.Atw]: 'home-melcloud_atw',
}

// The report `to` bound defaults to now in the API timezone lib-side.
const daysAgo = (days: number, timezone: string): string =>
  Temporal.Now.plainDateTimeISO(timezone).subtract({ days }).toString()

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const throwOnErrors = (
  errors: Record<string, readonly string[]> | null,
): void => {
  if (errors !== null) {
    throw new Error(formatErrors(errors))
  }
}

// Aggregates one device's settings into the per-driver map; a conflicting
// value across devices marks the setting as indeterminate (`null`) and stops
// processing the remaining settings of that device.
const mergeDeviceSettings = (
  driverSettings: DeviceSetting,
  settings: Record<string, unknown>,
): void => {
  for (const [settingId, value] of Object.entries(settings)) {
    if (!Object.hasOwn(driverSettings, settingId)) {
      driverSettings[settingId] = value
    } else if (driverSettings[settingId] !== value) {
      driverSettings[settingId] = null
      return
    }
  }
}

const getDriverSettings = (
  { id: driverId, settings }: ManifestDriver,
  language: string,
): DriverSetting[] =>
  (settings ?? []).flatMap(({ children, id: groupId, label: groupLabel }) =>
    (children ?? []).map(({ id, label, max, min, type, units, values }) => ({
      driverId,
      groupId,
      groupLabel: groupLabel[language] ?? groupLabel.en,
      id,
      max,
      min,
      title: label[language] ?? label.en,
      type,
      units,
      values: values?.map(({ id: valueId, label: valueLabel }) => ({
        id: valueId,
        label: valueLabel[language] ?? valueLabel.en,
      })),
    })),
  )

const getDriverLoginSetting = (
  { id: driverId, pair }: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const driverLoginSetting: Record<string, DriverSetting> = {}
  const loginOptions =
    pair?.find(
      (pairSetting): pairSetting is LoginSetting => pairSetting.id === 'login',
    )?.options ?? []
  for (const [option, label] of Object.entries(loginOptions)) {
    const isPassword = option.startsWith('password')
    const key = isPassword ? 'password' : 'username'
    driverLoginSetting[key] ??= {
      driverId,
      groupId: 'login',
      id: key,
      title: '',
      type: isPassword ? 'password' : 'text',
    }
    driverLoginSetting[key] = {
      ...driverLoginSetting[key],
      [option.endsWith('Placeholder') ? 'placeholder' : 'title']:
        label[language] ?? label.en,
    }
  }
  return Object.values(driverLoginSetting)
}

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?: Record<string, number | string>,
): DriverCapabilitiesOptions => ({
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    id:
      enumType !== undefined && Object.hasOwn(enumType, id) ?
        String(enumType[id])
      : id,
    label: title[language] ?? title.en,
  })),
})

// The ATA group surface shared by the zone facades and — per the
// melcloud-api contract this feature tracks — the ATA device facade, which
// emulates it as a group of one.
type ClassicAtaGroupFacade = Pick<
  Classic.ZoneFacade,
  'getGroup' | 'updateGroupState'
>

// `devices` = individual units only; omitting the kind serves the zone
// collections (areas, buildings, floors) and the devices alike.
type ZoneKind = 'devices'

const filterZonesByName = <T extends { readonly name: string }>(
  zones: readonly T[],
  query: string,
): T[] => {
  const lowerCaseQuery = query.toLowerCase()
  return zones.filter(({ name }) => name.toLowerCase().includes(lowerCaseQuery))
}

const matchesZoneKind = (
  model: Classic.Zone['model'],
  kind?: ZoneKind,
): boolean => kind === undefined || model === 'devices'

// Flow autocomplete items over the given zones (including single devices,
// which the holiday mode endpoints also accept). The zone target is
// carried on the selected item so run listeners need no id parsing.
const toZoneAutocompleteItems = (
  zones: readonly Classic.Zone[],
): (DeviceOrZoneData & { id: string; name: string })[] =>
  zones.map(({ id, model, name }) => ({
    id: `${model}_${String(id)}`,
    name,
    zoneId: String(id),
    zoneType: model,
  }))

// MELCloud reports error timestamps either as UTC instants (Z or offset
// suffix) or as wall-clock times in the building's timezone.
const parseErrorDate = (date: string, timeZone: string): Temporal.Instant => {
  try {
    return Temporal.Instant.from(date)
  } catch {
    return Temporal.PlainDateTime.from(date)
      .toZonedDateTime(timeZone)
      .toInstant()
  }
}

export default class MELCloudApp extends App {
  declare public readonly homey: Homey.Homey

  public get classicApi(): Classic.API {
    return this.#classicApi
  }

  public get homeApi(): Home.API {
    return this.#homeApi
  }

  #classicApi!: Classic.API

  #facadeManager!: Classic.FacadeManager

  #homeApi!: Home.API

  #homeFacadeManager!: Home.FacadeManager

  get #classicRegistry(): Classic.Registry {
    return this.#classicApi.registry
  }

  get #homeRegistry(): Home.Registry {
    return this.#homeApi.registry
  }

  public override async onInit(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    await this.#initClassicApi({
      language,
      locale: language,
      timezone: getTimeZone(this.homey),
    })
    await this.#initHomeApi()
    this.#createNotification(language)
    this.#registerWidgetListeners()
    this.#registerFlowListeners()
  }

  public override async onUninit(): Promise<void> {
    this.#classicApi.clearSync()
    this.#homeApi.clearSync()
    await Promise.resolve()
  }

  public getClassicAtaCapabilities(): [
    keyof Classic.GroupState & keyof Classic.ListDeviceDataAta,
    DriverCapabilitiesOptions,
  ][] {
    return this.#getAtaCapabilityConfigs().map(
      ({
        enumType,
        key,
        options,
      }): [
        keyof Classic.GroupState & keyof Classic.ListDeviceDataAta,
        DriverCapabilitiesOptions,
      ] => [
        key,
        getLocalizedCapabilitiesOptions(
          options,
          this.homey.i18n.getLanguage(),
          enumType,
        ),
      ],
    )
  }

  public getClassicAtaDetailedStates({
    status,
    zoneId,
    zoneType,
  }: GetAtaOptions & ZoneData): GroupAtaStates {
    // Annotated to collapse the BuildingFacade | ZoneFacade `devices` union
    // into one array type, so the `.filter` type guard below can narrow.
    const { devices }: { devices: readonly Classic.DeviceAny[] } =
      this.getClassicFacade(zoneType, zoneId)
    if (devices.length === 0) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic Classic.GroupState to typed GroupAtaStates
    return typedFromEntries(
      this.getClassicAtaCapabilities().map(([key]) => [
        key,
        devices
          .filter((device) =>
            Classic.isDeviceOfType(device, Classic.DeviceType.Ata),
          )
          .map(({ data }) => data)
          .filter((data) => status !== 'on' || data.Power)
          .map((data) => data[key]),
      ]),
    ) as GroupAtaStates
  }

  public async getClassicAtaState({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): Promise<Classic.GroupState> {
    return unwrapResult(
      await this.#getClassicAtaGroupFacade({ zoneId, zoneType }).getGroup(),
    )
  }

  public async getClassicErrorLog(
    query: Classic.ErrorLogQuery,
  ): Promise<FormattedErrorLog> {
    const { errors, fromDate, ...rest } = unwrapResult(
      await this.#classicApi.getErrorLog(query),
    )
    const locale = this.homey.i18n.getLanguage()
    const timeZone = getTimeZone(this.homey)
    // Reused across all entries instead of rebuilding a DateTime + formatter per call.
    const dateTimeMedFormat = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      month: 'short',
      timeZone,
      year: 'numeric',
    })
    return {
      ...rest,
      errors: errors.map(({ date, deviceId, ...errorRest }) => ({
        ...errorRest,
        date: dateTimeMedFormat.format(parseErrorDate(date, timeZone)),
        device: this.#classicRegistry.devices.getById(deviceId)?.name ?? '',
      })),
      fromDateHuman: Temporal.PlainDate.from(fromDate).toLocaleString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }
  }

  public getClassicFacade<T extends Classic.DeviceType>(
    zoneType: 'devices',
    id: number | string,
  ): Classic.DeviceFacade<T>
  public getClassicFacade(
    zoneType: ZoneData['zoneType'],
    id: number | string,
  ): Classic.BuildingFacade | Classic.ZoneFacade
  public getClassicFacade(
    zoneType: DeviceOrZoneData['zoneType'],
    id: number | string,
  ): Classic.Facade
  public getClassicFacade(
    zoneType: DeviceOrZoneData['zoneType'],
    id: number | string,
  ): Classic.Facade {
    const instance = this.#classicRegistry[zoneType].getById(Number(id))
    if (instance === undefined) {
      throw new NotFoundError(
        this.homey.__(
          `errors.${zoneType === 'devices' ? 'device' : 'zone'}NotFound`,
        ),
      )
    }
    return this.#facadeManager.get(instance)
  }

  public async getClassicFrostProtection({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): Promise<Classic.FrostProtectionData> {
    return unwrapResult(
      await this.getClassicFacade(zoneType, zoneId).getFrostProtection(),
    )
  }

  public async getClassicHolidayMode({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): Promise<Classic.HolidayModeData> {
    return unwrapResult(
      await this.getClassicFacade(zoneType, zoneId).getHolidayMode(),
    )
  }

  public async getClassicHourlyTemperatures({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getHourlyTemperatures(
        hour,
      ),
    )
  }

  public async getClassicOperationModes({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartPieOptions> {
    const from = daysAgo(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getOperationModes({
        from,
      }),
    )
  }

  public async getClassicSignal({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getSignalStrength(hour),
    )
  }

  public async getClassicTemperatures({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartLineOptions> {
    const from = daysAgo(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getTemperatures({
        from,
      }),
    )
  }

  public getDeviceSettings(): DeviceSettings {
    const deviceSettings: DeviceSettings = {}
    for (const device of this.#getDevices()) {
      const {
        driver: { id: driverId },
      } = device
      deviceSettings[driverId] ??= {}
      mergeDeviceSettings(deviceSettings[driverId], device.getSettings())
    }
    return deviceSettings
  }

  public getDevicesByType<T extends Classic.DeviceType>(
    type: T,
  ): Classic.Device<T>[] {
    return this.#classicRegistry.getDevicesByType(type)
  }

  public getDriverSettings(): Partial<Record<string, DriverSetting[]>> {
    const language = this.homey.i18n.getLanguage()
    return Object.groupBy(
      this.homey.manifest.drivers.flatMap((driver) => [
        ...getDriverSettings(driver, language),
        ...getDriverLoginSetting(driver, language),
      ]),
      ({ driverId, groupId }) => groupId ?? driverId,
    )
  }

  public async getHomeAtaState(deviceId: string): Promise<Classic.GroupState> {
    return unwrapResult(
      await this.getHomeFacade(deviceId, Home.DeviceType.Ata).getGroup(),
    )
  }

  // Every ATA target the group widget can address on the Home side: one
  // root entry per `/context` building (the account-level group), its
  // devices one level below, both alphabetical.
  public getHomeAtaTargets(): (HomeBuildingZone | HomeDeviceZone)[] {
    return this.#homeRegistry
      .getBuildingsByType(Home.DeviceType.Ata)
      .toSorted((building, other) => building.name.localeCompare(other.name))
      .flatMap(({ devices, id, name }) => [
        {
          id,
          level: 0,
          model: 'homeBuildings',
          name,
        } satisfies HomeBuildingZone,
        ...devices
          .map((device): HomeDeviceZone => ({
            id: device.id,
            level: 1,
            model: 'homeDevices',
            name: device.name,
          }))
          .toSorted((zone, other) => zone.name.localeCompare(other.name)),
      ])
  }

  // Member operation modes in the Classic vocabulary — what the widget's
  // mixed-mode scene resolver consumes.
  public getHomeBuildingAtaModes(buildingId: string): number[] {
    return this.#getHomeBuildingFacade(buildingId).devices.map(
      (device) =>
        operationModeToClassic[
          this.#homeFacadeManager.get(device).operationMode
        ],
    )
  }

  public async getHomeBuildingAtaState(
    buildingId: string,
  ): Promise<Classic.GroupState> {
    return unwrapResult(
      await this.#getHomeBuildingFacade(buildingId).getGroup(),
    )
  }

  public getHomeDevicesByType(type: Home.DeviceType): Home.Device[] {
    return this.#homeRegistry.getByType(type)
  }

  public getHomeFacade<T extends Home.DeviceType>(
    deviceId: string,
    type: T,
  ): HomeDeviceFacade<T>
  public getHomeFacade(
    deviceId: string,
    type: Home.DeviceType,
  ): Home.DeviceAtaFacade | Home.DeviceAtwFacade {
    const model = this.#homeRegistry.getById(deviceId)
    if (model?.type === type) {
      if (model.isAta()) {
        return this.#homeFacadeManager.get(model)
      }
      if (model.isAtw()) {
        return this.#homeFacadeManager.get(model)
      }
    }
    throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
  }

  public async updateClassicAtaState({
    state,
    zoneId,
    zoneType,
  }: DeviceOrZoneData & { state: Classic.GroupState }): Promise<void> {
    const { AttributeErrors } = await this.#getClassicAtaGroupFacade({
      zoneId,
      zoneType,
    }).updateGroupState(state)
    throwOnErrors(AttributeErrors)
  }

  public async updateClassicFrostProtection({
    settings,
    zoneId,
    zoneType,
  }: DeviceOrZoneData & {
    settings: Classic.FrostProtectionQuery
  }): Promise<void> {
    const { AttributeErrors } = await this.getClassicFacade(
      zoneType,
      zoneId,
    ).updateFrostProtection(settings)
    throwOnErrors(AttributeErrors)
  }

  public async updateClassicHolidayMode({
    settings,
    zoneId,
    zoneType,
  }: DeviceOrZoneData & {
    settings: Classic.HolidayModeQuery
  }): Promise<void> {
    const { AttributeErrors } = await this.getClassicFacade(
      zoneType,
      zoneId,
    ).updateHolidayMode(settings)
    throwOnErrors(AttributeErrors)
  }

  public async updateDeviceSettings({
    driverId,
    settings,
  }: {
    settings: Settings
    driverId?: string | undefined
  }): Promise<void> {
    await Promise.all(
      this.#getDevices({ driverId }).map(async (device) => {
        const changedKeys = Object.keys(settings).filter(
          (changedKey) =>
            settings[changedKey] !== device.getSetting(changedKey),
        )
        if (changedKeys.length === 0) {
          return
        }
        await device.setSettings(
          Object.fromEntries(changedKeys.map((key) => [key, settings[key]])),
        )
        await device.onSettings({
          changedKeys,
          newSettings: device.getSettings(),
        })
      }),
    )
  }

  public async updateHomeAtaState({
    deviceId,
    state,
  }: {
    deviceId: string
    state: Classic.GroupState
  }): Promise<void> {
    try {
      await this.getHomeFacade(deviceId, Home.DeviceType.Ata).updateGroupState(
        state,
      )
    } catch (error) {
      // A delta the device already matches is fine by definition.
      if (!(error instanceof NoChangesError)) {
        throw error
      }
    }
  }

  public async updateHomeBuildingAtaState({
    buildingId,
    state,
  }: {
    buildingId: string
    state: Classic.GroupState
  }): Promise<void> {
    await this.#getHomeBuildingFacade(buildingId).updateGroupState(state)
  }

  readonly #onSync: SyncCallback = async ({ ids, type } = {}) => {
    await this.#classicSyncDevices({
      driverId: type === undefined ? undefined : DRIVER_IDS_BY_TYPE[type],
      ids,
    })
  }

  // Sync matching classic devices by pulling their latest state from MELCloud.
  // Per-device sync failures are logged without aborting the full sync run.
  async #classicSyncDevices(
    filter: {
      driverId?: string | undefined
      ids?: (number | string)[] | undefined
    } = {},
  ): Promise<void> {
    const results = await Promise.allSettled(
      this.#getDevices(filter).map(async (device) => device.syncFromDevice()),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        this.error('Device sync failed:', result.reason)
      }
    }
  }

  #createLogger(): Logger {
    return {
      error: (...args: unknown[]): void => {
        this.error(...args)
      },
      log: (...args: unknown[]): void => {
        this.log(...args)
      },
    }
  }

  #createNotification(language: string): void {
    const { homey } = this
    const {
      manifest: { version },
      notifications,
      settings,
    } = homey
    if (settings.get('notifiedVersion') === version) {
      return
    }
    const changelogByVersion = changelog as Record<
      string,
      Record<string, string>
    >
    const versionChangelog = changelogByVersion[version] ?? {}
    const excerpt = versionChangelog[language]
    if (excerpt === undefined) {
      return
    }
    homey.setTimeout(async () => {
      try {
        await notifications.createNotification({ excerpt })
        settings.set('notifiedVersion', version)
      } catch {
        // Non-critical: notification display is best-effort
      }
    }, NOTIFICATION_DELAY_MS)
  }

  #createSettingManager(api: Api = 'classic'): SettingManager {
    // Classic owns the unprefixed keys (legacy); Home is namespaced to
    // avoid collisions (e.g. `username` → `homeUsername`).
    const prefixKey = (key: string): string =>
      api === 'classic' ? key : (
        `${api}${key.charAt(0).toUpperCase()}${key.slice(1)}`
      )
    return {
      get: (key: string): string | null | undefined => {
        const value: unknown = this.homey.settings.get(prefixKey(key))
        return typeof value === 'string' || value === null ? value : undefined
      },
      set: (key: string, value: string): void => {
        this.homey.settings.set(prefixKey(key), value)
      },
    }
  }

  #getAtaCapabilityConfigs(): {
    key: keyof Classic.GroupState & keyof Classic.ListDeviceDataAta
    options: ManifestDriverCapabilitiesOptions
    enumType?: Record<string, number | string>
  }[] {
    return [
      { key: 'Power', options: power },
      { key: 'SetTemperature', options: targetTemperature },
      {
        enumType: Classic.FanSpeed,
        key: 'FanSpeed',
        options: { ...fanSpeed, type: 'enum', values: fanSpeedValues },
      },
      {
        enumType: Classic.Vertical,
        key: 'VaneVerticalDirection',
        options: vertical,
      },
      {
        enumType: Classic.Horizontal,
        key: 'VaneHorizontalDirection',
        options: horizontal,
      },
      {
        enumType: Classic.OperationMode,
        key: 'OperationMode',
        options: {
          ...thermostatMode,
          values: this.homey.manifest.drivers
            .find(({ id }) => id === 'melcloud')
            ?.capabilitiesOptions?.thermostat_mode?.values?.filter(
              ({ id }) => id !== 'off',
            ),
        },
      },
    ]
  }

  #getClassicAtaGroupFacade({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): ClassicAtaGroupFacade {
    if (zoneType !== 'devices') {
      return this.getClassicFacade(zoneType, zoneId)
    }
    const facade = this.getClassicFacade('devices', zoneId)
    if (!isClassicAtaFacade(facade)) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    return facade
  }

  #getDevices({
    driverId,
    ids,
  }: {
    driverId?: string | undefined
    ids?: (number | string)[] | undefined
  } = {}): MELCloudDevice[] {
    const drivers = this.#getDrivers(driverId)
    const stringIds = ids?.map(String)
    return drivers.flatMap((driver) => {
      const devices = driver.getDevices()
      return stringIds === undefined ? devices : (
          devices.filter(({ id }) => stringIds.includes(String(id)))
        )
    })
  }

  // SDK v3 runs `App#onInit` before any `Driver#onInit`, so `onSync`
  // callbacks fired by the MELCloud API clients during `#initClassicApi`
  // / `#initHomeApi` find no ready drivers. Awaiting driver readiness
  // would deadlock: drivers can't init until `App#onInit` returns, which
  // awaits these API-client constructors. `getDrivers()` only exposes
  // drivers whose `onInit` has completed, so unready drivers are filtered
  // out naturally — an initial sync silently becomes a no-op. Each device
  // runs its own initial sync via `ensureDevice()` in `Device#onInit`,
  // and post-init `onSync` calls find every driver ready.
  #getDrivers(driverId?: string): MELCloudDriver[] {
    const drivers = Object.values(this.homey.drivers.getDrivers())
    return driverId === undefined ? drivers : (
        drivers.filter((driver) => driver.id === driverId)
      )
  }

  #getHomeBuildingFacade(buildingId: string): Home.BuildingAtaFacade {
    const facade = this.#homeFacadeManager.getBuilding(buildingId)
    if (facade === null) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    return facade
  }

  async #initClassicApi(config: {
    language: string
    locale: string
    timezone: string
  }): Promise<void> {
    this.#classicApi = await Classic.API.create({
      ...config,
      events: { onSyncComplete: this.#onSync },
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager(),
    })
    this.#facadeManager = new Classic.FacadeManager(
      this.#classicApi,
      this.#classicRegistry,
    )
    setClassicFacadeManager(this.#facadeManager)
  }

  async #initHomeApi(): Promise<void> {
    this.#homeApi = await Home.API.create({
      events: { onSyncComplete: this.#onSync },
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager('home'),
    })
    this.#homeFacadeManager = new Home.FacadeManager(this.#homeApi)
    await this.#homeApi.list()
  }

  #registerFlowListeners(): void {
    this.#registerHolidayModeAction()
    this.#registerHolidayModeCondition()
  }

  #registerHolidayModeAction(): void {
    const card = this.homey.flow.getActionCard('holiday_mode_action')
    card.registerArgumentAutocompleteListener('zone', (query) =>
      toZoneAutocompleteItems(this.#searchZones(query)),
    )
    card.registerRunListener(
      async ({
        duration,
        zone: { zoneId, zoneType },
      }: {
        duration: unknown
        zone: DeviceOrZoneData
      }) => {
        // The manifest min/max/step only constrain manual input: a token
        // dropped into the field can carry anything at runtime. Only
        // numbers and numeric strings are accepted — coercing other types
        // (false, null, '') would silently read as 0 and turn holiday
        // mode off.
        const days =
          typeof duration === 'number' ? duration
          : typeof duration === 'string' && duration.trim() !== '' ?
            Number(duration)
          : NaN
        if (
          !Number.isSafeInteger(days) ||
          days < HOLIDAY_MODE_OFF_DURATION ||
          days > HOLIDAY_MODE_MAX_DURATION_DAYS
        ) {
          throw new RangeError(this.homey.__('errors.invalidDuration'))
        }
        // `from` is omitted: the library defaults it to now in the API's
        // timezone, which onInit seeds from Homey's clock.
        await this.updateClassicHolidayMode({
          settings:
            days > HOLIDAY_MODE_OFF_DURATION ?
              {
                to: Temporal.Now.plainDateTimeISO(getTimeZone(this.homey))
                  .add({ days })
                  .toString(),
              }
            : {},
          zoneId,
          zoneType,
        })
      },
    )
  }

  #registerHolidayModeCondition(): void {
    const card = this.homey.flow.getConditionCard('holiday_mode_condition')
    card.registerArgumentAutocompleteListener('zone', (query) =>
      toZoneAutocompleteItems(this.#searchZones(query)),
    )
    card.registerRunListener(
      async ({ zone: { zoneId, zoneType } }: { zone: DeviceOrZoneData }) => {
        const { HMEnabled: isEnabled } = await this.getClassicHolidayMode({
          zoneId,
          zoneType,
        })
        return isEnabled
      },
    )
  }

  #registerWidgetListeners(): void {
    this.homey.dashboards
      .getWidget('ata-group-setting')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        this.#searchAtaTargets(query),
      )
    this.homey.dashboards
      .getWidget('charts')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        this.#searchZones(query, { kind: 'devices' }),
      )
  }

  // Everything the ATA group widget can target: the Classic zones and
  // devices, then the Home buildings with their devices (alpha-sorted).
  #searchAtaTargets(
    query: string,
  ): (Classic.Zone | HomeBuildingZone | HomeDeviceZone)[] {
    return [
      ...this.#searchZones(query, { type: Classic.DeviceType.Ata }),
      ...filterZonesByName(this.getHomeAtaTargets(), query),
    ]
  }

  // One zone-search pipeline for every autocomplete surface: registry
  // fetch (instance state), kind/type narrowing, then query filtering.
  #searchZones(
    query: string,
    { kind, type }: { kind?: ZoneKind; type?: Classic.DeviceType } = {},
  ): Classic.Zone[] {
    const zones = this.#facadeManager
      .getZones(type === undefined ? {} : { type })
      .filter(({ model }) => matchesZoneKind(model, kind))
    return filterZonesByName(zones, query)
  }
}
