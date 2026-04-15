import {
  type BuildingFacade,
  type ClassicRegistry,
  type Device,
  type DeviceFacade,
  type ErrorLogQuery,
  type Facade,
  type FrostProtectionData,
  type FrostProtectionQuery,
  type GroupState,
  type HolidayModeData,
  type HolidayModeQuery,
  type HomeDevice,
  type HomeDeviceAtaFacade,
  type HomeRegistry,
  type ListDeviceDataAta,
  type LoginCredentials,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type ZoneFacade,
  ClassicAPI,
  ClassicFacadeManager,
  DeviceType,
  FanSpeed,
  HomeAPI,
  HomeDeviceType,
  HomeFacadeManager,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { type HourNumbers, DateTime, Settings as LuxonSettings } from 'luxon'

import type { ClassicMELCloudDriver } from './drivers/classic-base-driver.mts'
import type { ClassicMELCloudDevice } from './types/classic.mts'
import type {
  DeviceSettings,
  DriverCapabilitiesOptions,
  DriverSetting,
  FormattedErrorLog,
  GetAtaOptions,
  GroupAtaStates,
  LoginSetting,
  ManifestDriver,
  ManifestDriverCapabilitiesOptions,
  Settings,
  ZoneData,
} from './types/index.mts'
import {
  changelog,
  fanSpeed,
  horizontal,
  power,
  setTemperature,
  thermostatMode,
  vertical,
} from './files.mts'
import { type Homey, App } from './lib/homey.mts'
import { setClassicFacadeManager, typedFromEntries } from './lib/index.mts'
import { fanSpeedValues } from './types/ata-erv.mts'

const NOTIFICATION_DELAY_MS = 10_000

const DRIVER_IDS_BY_TYPE: Partial<Record<DeviceType | HomeDeviceType, string>> =
  {
    [DeviceType.Ata]: 'melcloud',
    [DeviceType.Atw]: 'melcloud_atw',
    [DeviceType.Erv]: 'melcloud_erv',
    [HomeDeviceType.Ata]: 'home-melcloud',
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
    /* v8 ignore next -- manifest children is optional in SDK type */
    (children ?? []).map(({ id, label, max, min, type, units, values }) => ({
      driverId,
      groupId,
      /* v8 ignore next -- language fallback to English */
      groupLabel: groupLabel[language] ?? groupLabel.en,
      id,
      max,
      min,
      /* v8 ignore next -- language fallback to English */
      title: label[language] ?? label.en,
      type,
      units,
      values: values?.map(({ id: valueId, label: valueLabel }) => ({
        id: valueId,
        /* v8 ignore next -- language fallback to English */
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
        /* v8 ignore next -- language fallback to English */
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
  /* v8 ignore next -- language fallback to English */
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    /* v8 ignore next -- enumType mapping: resolves string enum to numeric value */
    id: enumType && id in enumType ? String(enumType[id]) : id,
    /* v8 ignore next -- language fallback to English */
    label: title[language] ?? title.en,
  })),
})

export default class MELCloudApp extends App {
  declare public readonly homey: Homey.Homey

  public get classicApi(): ClassicAPI {
    return this.#classicApi
  }

  public get homeApi(): HomeAPI {
    return this.#homeApi
  }

  #classicApi!: ClassicAPI

  #facadeManager!: ClassicFacadeManager

  #homeApi!: HomeAPI

  #homeFacadeManager!: HomeFacadeManager

  get #classicRegistry(): ClassicRegistry {
    return this.#classicApi.registry
  }

  get #homeRegistry(): HomeRegistry {
    return this.#homeApi.registry
  }

  public override async onInit(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    const timezone = this.homey.clock.getTimezone()
    LuxonSettings.defaultLocale = language
    LuxonSettings.defaultZone = timezone
    await Promise.all(
      Object.values(this.homey.drivers.getDrivers()).map(async (driver) =>
        driver.ready(),
      ),
    )
    await this.#initApi({ language, timezone })
    await this.#initHomeApi()
    this.#createNotification(language)
    this.#registerWidgetListeners()
  }

  public override async onUninit(): Promise<void> {
    this.#classicApi.clearSync()
    this.#homeApi.clearSync()
    await Promise.resolve()
  }

  public async authenticateClassic(data: LoginCredentials): Promise<boolean> {
    return this.#classicApi.authenticate(data)
  }

  public async authenticateHome(data: LoginCredentials): Promise<boolean> {
    return this.#homeApi.authenticate(data)
  }

  public getClassicAtaCapabilities(): [
    keyof GroupState & keyof ListDeviceDataAta,
    DriverCapabilitiesOptions,
  ][] {
    return this.#getAtaCapabilityConfigs().map(
      ({
        enumType,
        key,
        options,
      }): [
        keyof GroupState & keyof ListDeviceDataAta,
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic GroupState to typed GroupAtaStates
    return typedFromEntries(
      this.getClassicAtaCapabilities().map(([key]) => [
        key,
        devices
          .filter((device) => device.type === DeviceType.Ata)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic DeviceModel data to ATA-specific type
          .map(({ data }) => data as ListDeviceDataAta)
          .filter((data) => status !== 'on' || data.Power)
          .map((data) => data[key]),
      ]),
    ) as GroupAtaStates
  }

  public async getClassicAtaState({
    zoneId,
    zoneType,
  }: ZoneData): Promise<GroupState> {
    return this.getClassicFacade(zoneType, zoneId).getGroup()
  }

  public async getClassicErrorLog(
    query: ErrorLogQuery,
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

  public getClassicFacade<T extends DeviceType>(
    zoneType: 'devices',
    id: number | string,
  ): DeviceFacade<T>
  public getClassicFacade(
    zoneType: 'areas' | 'buildings' | 'floors',
    id: number | string,
  ): BuildingFacade | ZoneFacade
  public getClassicFacade(
    zoneType: 'areas' | 'buildings' | 'devices' | 'floors',
    id: number | string,
  ): Facade {
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
  }: ZoneData): Promise<FrostProtectionData> {
    return this.getClassicFacade(zoneType, zoneId).getFrostProtection()
  }

  public async getClassicHolidayMode({
    zoneId,
    zoneType,
  }: ZoneData): Promise<HolidayModeData> {
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

  public getDevicesByType<T extends DeviceType>(type: T): Device<T>[] {
    return this.#classicRegistry.getDevicesByType(type)
  }

  public getDriverSettings(): Partial<Record<string, DriverSetting[]>> {
    const language = this.homey.i18n.getLanguage()
    return Object.groupBy(
      this.homey.manifest.drivers.flatMap((driver) => [
        ...getDriverSettings(driver, language),
        ...getDriverLoginSetting(driver, language),
      ]),
      /* v8 ignore next -- groupId fallback: login settings have no groupId */
      ({ driverId, groupId }) => groupId ?? driverId,
    )
  }

  public getHomeDevicesByType(type: HomeDeviceType): HomeDevice[] {
    return this.#homeRegistry.getByType(type)
  }

  public getHomeFacade(deviceId: string): HomeDeviceAtaFacade {
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
  }: ZoneData & { state: GroupState }): Promise<void> {
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
  }: ZoneData & { settings: FrostProtectionQuery }): Promise<void> {
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
  }: ZoneData & { settings: HolidayModeQuery }): Promise<void> {
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

  #createLogger(): {
    error: (...args: unknown[]) => void
    log: (...args: unknown[]) => void
  } {
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

  #createSettingManager(prefix = ''): {
    get: (key: string) => string | null | undefined
    set: (key: string, value: string) => void
  } {
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

  #getDrivers(driverId?: string): ClassicMELCloudDriver<DeviceType>[] {
    if (driverId === undefined) {
      return Object.values(this.homey.drivers.getDrivers())
    }
    return [this.homey.drivers.getDriver(driverId)]
  }

  /*
   * ATA capability configuration. `enumType` maps Homey's string capability IDs
   * to MELCloud's numeric enum values for localization
   */
  #getAtaCapabilityConfigs(): {
    key: keyof GroupState & keyof ListDeviceDataAta
    options: ManifestDriverCapabilitiesOptions
    enumType?: Record<string, number | string>
  }[] {
    return [
      { key: 'Power', options: power },
      { key: 'SetTemperature', options: setTemperature },
      {
        enumType: FanSpeed,
        key: 'FanSpeed',
        options: { ...fanSpeed, type: 'enum', values: fanSpeedValues },
      },
      {
        enumType: Vertical,
        key: 'VaneVerticalDirection',
        options: vertical,
      },
      {
        enumType: Horizontal,
        key: 'VaneHorizontalDirection',
        options: horizontal,
      },
      {
        enumType: OperationMode,
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
    ids?: number[]
  } = {}): ClassicMELCloudDevice[] {
    const drivers = this.#getDrivers(driverId)
    return drivers.flatMap((driver) => {
      const devices = driver.getDevices()
      return ids ?
          devices.filter(({ id }) => ids.includes(Number(id)))
        : devices
    })
  }

  async #initApi({
    language,
    timezone,
  }: {
    language: string
    timezone: string
  }): Promise<void> {
    this.#classicApi = await ClassicAPI.create({
      language,
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager(),
      timezone,
      onSync: async (params) => {
        const { ids, type } = params ?? {}
        await this.#syncDevices(
          type === undefined ? undefined : DRIVER_IDS_BY_TYPE[type],
          ids,
        )
      },
    })
    this.#facadeManager = new ClassicFacadeManager(
      this.#classicApi,
      this.#classicRegistry,
    )
    setClassicFacadeManager(this.#facadeManager)
  }

  async #initHomeApi(): Promise<void> {
    this.#homeApi = await HomeAPI.create({
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager('home'),
      onSync: async () =>
        this.#syncDevices(DRIVER_IDS_BY_TYPE[HomeDeviceType.Ata]),
    })
    this.#homeFacadeManager = new HomeFacadeManager(this.#homeApi)
    await this.#homeApi.list()
  }

  #registerWidgetListeners(): void {
    this.homey.dashboards
      .getWidget('ata-group-setting')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        this.#facadeManager
          .getZones({ type: DeviceType.Ata })
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

  async #syncDevices(driverId?: string, ids?: number[]): Promise<void> {
    const results = await Promise.allSettled(
      this.#getDevices({ driverId, ids }).map(async (device) =>
        device.syncFromDevice(),
      ),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        this.error('Device sync failed:', result.reason)
      }
    }
  }
}
