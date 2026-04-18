import type {
  DeviceType,
  Logger,
  ReportChartLineOptions,
  ReportChartPieOptions,
  SettingManager,
  SyncCallback,
} from '@olivierzal/melcloud-api'
import { type HourNumbers, DateTime, Settings as LuxonSettings } from 'luxon'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type {
  LoginSetting,
  ManifestDriver,
  ManifestDriverCapabilitiesOptions,
} from './types/manifest.mts'
import type { MELCloudDevice, MELCloudDriver } from './types/melcloud.mts'
import type {
  DeviceSettings,
  DriverCapabilitiesOptions,
  DriverSetting,
  FormattedErrorLog,
  Settings,
} from './types/settings.mts'
import type {
  GetAtaOptions,
  GroupAtaStates,
  ZoneData,
} from './types/widgets.mts'
import {
  changelog,
  fanSpeed,
  horizontal,
  power,
  setTemperature,
  thermostatMode,
  vertical,
} from './files.mts'
import { setClassicFacadeManager } from './lib/classic-facade-manager.mts'
import { type Homey, App } from './lib/homey.mts'
import { typedFromEntries } from './lib/typed-object.mts'
import { fanSpeedValues } from './types/ata-erv.mts'

const NOTIFICATION_DELAY_MS = 10_000

const DRIVER_IDS_BY_TYPE: Partial<Record<DeviceType, string>> = {
  [Classic.DeviceType.Ata]: 'melcloud',
  [Classic.DeviceType.Atw]: 'melcloud_atw',
  [Classic.DeviceType.Erv]: 'melcloud_erv',
  [Home.DeviceType.Ata]: 'home-melcloud',
}

const createDateRange = (days: number): { from: string; to: string } => {
  const now = DateTime.now()
  return {
    from: now.minus({ days }).toISO({ includeOffset: false }),
    to: now.toISO({ includeOffset: false }),
  }
}

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const throwOnErrors = (
  errors: Record<string, readonly string[]> | null,
): void => {
  if (errors) {
    throw new Error(formatErrors(errors))
  }
}

const getDriverSettings = (
  { id: driverId, settings }: ManifestDriver,
  language: string,
): DriverSetting[] =>
  (settings ?? []).flatMap(({ children, id: groupId, label: groupLabel }) =>
    /* v8 ignore next -- @preserve, manifest children is optional in SDK type */
    (children ?? []).map(({ id, label, max, min, type, units, values }) => ({
      driverId,
      groupId,
      /* v8 ignore next -- @preserve, language fallback to English */
      groupLabel: groupLabel[language] ?? groupLabel.en,
      id,
      max,
      min,
      /* v8 ignore next -- @preserve, language fallback to English */
      title: label[language] ?? label.en,
      type,
      units,
      values: values?.map(({ id: valueId, label: valueLabel }) => ({
        id: valueId,
        /* v8 ignore next -- @preserve, language fallback to English */
        label: valueLabel[language] ?? valueLabel.en,
      })),
    })),
  )

const getDriverLoginSetting = (
  { id: driverId, pair }: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const driverLoginSetting: Record<string, DriverSetting> = {}
  for (const [option, label] of Object.entries(
    pair?.find(
      (pairSetting): pairSetting is LoginSetting => pairSetting.id === 'login',
    )?.options ?? [],
  )) {
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
        /* v8 ignore next -- @preserve, language fallback to English */
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
  /* v8 ignore next -- @preserve, language fallback to English */
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    /* v8 ignore next -- @preserve, enumType mapping: resolves string enum to numeric value */
    id: enumType && id in enumType ? String(enumType[id]) : id,
    /* v8 ignore next -- @preserve, language fallback to English */
    label: title[language] ?? title.en,
  })),
})

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
    const timezone = this.homey.clock.getTimezone()
    LuxonSettings.defaultLocale = language
    LuxonSettings.defaultZone = timezone
    await this.#initClassicApi({ language, timezone })
    await this.#initHomeApi()
    this.#createNotification(language)
    this.#registerWidgetListeners()
  }

  public override async onUninit(): Promise<void> {
    this.#classicApi.clearSync()
    this.#homeApi.clearSync()
    await Promise.resolve()
  }

  public async authenticateClassic(
    data: Classic.LoginCredentials,
  ): Promise<boolean> {
    return this.#classicApi.authenticate(data)
  }

  public async authenticateHome(
    data: Classic.LoginCredentials,
  ): Promise<boolean> {
    return this.#homeApi.authenticate(data)
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
  }: ZoneData & { status?: GetAtaOptions['status'] }): GroupAtaStates {
    const { devices } = this.getClassicFacade(zoneType, zoneId)
    if (devices.length === 0) {
      throw new Error(this.homey.__('errors.deviceNotFound'))
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic Classic.GroupState to typed GroupAtaStates
    return typedFromEntries(
      this.getClassicAtaCapabilities().map(([key]) => [
        key,
        devices
          .filter((device) => device.type === Classic.DeviceType.Ata)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic DeviceModel data to ATA-specific type
          .map(({ data }) => data as Classic.ListDeviceDataAta)
          .filter((data) => status !== 'on' || data.Power)
          .map((data) => data[key]),
      ]),
    ) as GroupAtaStates
  }

  public async getClassicAtaState({
    zoneId,
    zoneType,
  }: ZoneData): Promise<Classic.GroupState> {
    return this.getClassicFacade(zoneType, zoneId).getGroup()
  }

  public async getClassicErrorLog(
    query: Classic.ErrorLogQuery,
  ): Promise<FormattedErrorLog> {
    const { errors, fromDate, ...rest } =
      await this.#classicApi.getErrorLog(query)
    return {
      ...rest,
      errors: errors.map(({ date, deviceId, ...errorRest }) => ({
        ...errorRest,
        date: DateTime.fromISO(date).toLocaleString(DateTime.DATETIME_MED),
        device: this.#classicRegistry.devices.getById(deviceId)?.name ?? '',
      })),
      fromDateHuman: DateTime.fromISO(fromDate).toLocaleString(
        DateTime.DATE_FULL,
      ),
    }
  }

  public getClassicFacade<T extends Classic.DeviceType>(
    zoneType: 'devices',
    id: number | string,
  ): Classic.DeviceFacade<T>
  public getClassicFacade(
    zoneType: 'areas' | 'buildings' | 'floors',
    id: number | string,
  ): Classic.BuildingFacade | Classic.ZoneFacade
  public getClassicFacade(
    zoneType: 'areas' | 'buildings' | 'devices' | 'floors',
    id: number | string,
  ): Classic.Facade {
    const instance = this.#classicRegistry[zoneType].getById(Number(id))
    if (!instance) {
      throw new Error(
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
  }: ZoneData): Promise<Classic.FrostProtectionData> {
    return this.getClassicFacade(zoneType, zoneId).getFrostProtection()
  }

  public async getClassicHolidayMode({
    zoneId,
    zoneType,
  }: ZoneData): Promise<Classic.HolidayModeData> {
    return this.getClassicFacade(zoneType, zoneId).getHolidayMode()
  }

  public async getClassicHourlyTemperatures({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: HourNumbers
  }): Promise<ReportChartLineOptions> {
    return this.getClassicFacade('devices', deviceId).getHourlyTemperatures(
      hour,
    )
  }

  public async getClassicOperationModes({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartPieOptions> {
    return this.getClassicFacade('devices', deviceId).getOperationModes(
      createDateRange(days),
    )
  }

  public async getClassicSignal({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: HourNumbers
  }): Promise<ReportChartLineOptions> {
    return this.getClassicFacade('devices', deviceId).getSignalStrength(hour)
  }

  public async getClassicTemperatures({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartLineOptions> {
    return this.getClassicFacade('devices', deviceId).getTemperatures(
      createDateRange(days),
    )
  }

  public getDeviceSettings(): DeviceSettings {
    const deviceSettings: DeviceSettings = {}
    for (const device of this.#getDevices()) {
      const {
        driver: { id: driverId },
      } = device
      deviceSettings[driverId] ??= {}
      for (const [settingId, value] of Object.entries(device.getSettings())) {
        if (!(settingId in deviceSettings[driverId])) {
          deviceSettings[driverId][settingId] = value
        } else if (deviceSettings[driverId][settingId] !== value) {
          deviceSettings[driverId][settingId] = null
          break
        }
      }
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
      /* v8 ignore next -- @preserve, groupId fallback: login settings have no groupId */
      ({ driverId, groupId }) => groupId ?? driverId,
    )
  }

  public getHomeDevicesByType(type: Home.DeviceType): Home.Device[] {
    return this.#homeRegistry.getByType(type)
  }

  public getHomeFacade(deviceId: string): Home.DeviceAtaFacade {
    const model = this.#homeRegistry.getById(deviceId)
    if (!model) {
      throw new Error(this.homey.__('errors.deviceNotFound'))
    }
    return this.#homeFacadeManager.get(model)
  }

  public async updateClassicAtaState({
    state,
    zoneId,
    zoneType,
  }: ZoneData & { state: Classic.GroupState }): Promise<void> {
    const { AttributeErrors } = await this.getClassicFacade(
      zoneType,
      zoneId,
    ).updateGroupState(state)
    throwOnErrors(AttributeErrors)
  }

  public async updateClassicFrostProtection({
    settings,
    zoneId,
    zoneType,
  }: ZoneData & { settings: Classic.FrostProtectionQuery }): Promise<void> {
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
  }: ZoneData & { settings: Classic.HolidayModeQuery }): Promise<void> {
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
    driverId?: string
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

  readonly #onSync: SyncCallback = async ({ ids, type } = {}) => {
    await this.#classicSyncDevices({
      driverId: type === undefined ? undefined : DRIVER_IDS_BY_TYPE[type],
      ids,
    })
  }

  /*
   * Sync matching classic devices by pulling their latest state from MELCloud.
   * Per-device sync failures are logged without aborting the full sync run.
   */
  async #classicSyncDevices(
    filter: { driverId?: string; ids?: (number | string)[] } = {},
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
    const { [version]: versionChangelog = {} } = changelog as Record<
      string,
      Record<string, string>
    >
    const { [language]: excerpt } = versionChangelog
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

  #createSettingManager(prefix = ''): SettingManager {
    const prefixKey = (key: string): string =>
      prefix === '' ? key : (
        `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`
      )
    return {
      get: (key: string): string | null | undefined =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Homey settings.get returns unknown
        this.homey.settings.get(prefixKey(key)) as string | null | undefined,
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
      { key: 'SetTemperature', options: setTemperature },
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
            ?.capabilitiesOptions?.[
              'thermostat_mode'
            ]?.values?.filter(({ id }) => id !== 'off'),
        },
      },
    ]
  }

  #getDevices({
    driverId,
    ids,
  }: {
    driverId?: string
    ids?: (number | string)[]
  } = {}): MELCloudDevice[] {
    const drivers = this.#getDrivers(driverId)
    const stringIds = ids?.map(String)
    return drivers.flatMap((driver) => {
      const devices = driver.getDevices()
      return stringIds ?
          devices.filter(({ id }) => stringIds.includes(String(id)))
        : devices
    })
  }

  /*
   * SDK v3 runs `App#onInit` before any `Driver#onInit`, so `onSync`
   * callbacks fired by the MELCloud API clients during `#initClassicApi`
   * / `#initHomeApi` find no ready drivers. Awaiting driver readiness
   * would deadlock: drivers can't init until `App#onInit` returns, which
   * awaits these API-client constructors. `getDrivers()` only exposes
   * drivers whose `onInit` has completed, so unready drivers are filtered
   * out naturally — an initial sync silently becomes a no-op. Each device
   * runs its own initial sync via `ensureDevice()` in `Device#onInit`,
   * and post-init `onSync` calls find every driver ready.
   */
  #getDrivers(driverId?: string): MELCloudDriver[] {
    const drivers = Object.values(this.homey.drivers.getDrivers())
    return driverId === undefined ? drivers : (
        drivers.filter((driver) => driver.id === driverId)
      )
  }

  async #initClassicApi(config: {
    language: string
    timezone: string
  }): Promise<void> {
    this.#classicApi = await Classic.API.create({
      ...config,
      logger: this.#createLogger(),
      onSync: this.#onSync,
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
      logger: this.#createLogger(),
      onSync: this.#onSync,
      settingManager: this.#createSettingManager('home'),
    })
    this.#homeFacadeManager = new Home.FacadeManager(this.#homeApi)
    await this.#homeApi.list()
  }

  #registerWidgetListeners(): void {
    this.homey.dashboards
      .getWidget('ata-group-setting')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        this.#facadeManager
          .getZones({ type: Classic.DeviceType.Ata })
          .filter(({ model }) => model !== 'devices')
          .filter(({ name }) =>
            name.toLowerCase().includes(query.toLowerCase()),
          ),
      )
    this.homey.dashboards
      .getWidget('charts')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        this.#facadeManager
          .getZones()
          .filter(({ model }) => model === 'devices')
          .filter(({ name }) =>
            name.toLowerCase().includes(query.toLowerCase()),
          ),
      )
  }
}
