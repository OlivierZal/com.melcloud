import {
  type BuildingFacade,
  type DeviceFacade,
  type DeviceModel,
  type ErrorLogQuery,
  type Facade,
  type FrostProtectionData,
  type FrostProtectionQuery,
  type GroupState,
  type HolidayModeData,
  type HolidayModeQuery,
  type HomeDeviceModel,
  type ListDeviceDataAta,
  type LoginCredentials,
  type ModelRegistry,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type ZoneFacade,
  DeviceType,
  FacadeManager,
  FanSpeed,
  HomeDeviceAtaFacade,
  HomeDeviceType,
  Horizontal,
  MELCloudAPI,
  MELCloudHomeAPI,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { type HourNumbers, DateTime, Settings as LuxonSettings } from 'luxon'

import {
  changelog,
  fanSpeed,
  horizontal,
  power,
  setTemperature,
  thermostatMode,
  vertical,
} from './files.mts'
import { setFacadeManager } from './lib/get-zones.mts'
import { type Homey, App } from './lib/homey.mts'
import { typedFromEntries } from './lib/index.mts'
import {
  type DeviceSettings,
  type DriverCapabilitiesOptions,
  type DriverSetting,
  type FormattedErrorLog,
  type GetAtaOptions,
  type GroupAtaStates,
  type LoginSetting,
  type ManifestDriver,
  type ManifestDriverCapabilitiesOptions,
  type MELCloudDevice,
  type Settings,
  type ZoneData,
  fanSpeedValues,
} from './types/index.mts'

const NOTIFICATION_DELAY_MS = 10_000

const drivers: Partial<Record<DeviceType | HomeDeviceType, string>> = {
  [DeviceType.Ata]: 'melcloud',
  [DeviceType.Atw]: 'melcloud_atw',
  [DeviceType.Erv]: 'melcloud_erv',
  [HomeDeviceType.Ata]: 'home-melcloud',
}

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const handleResponse = (
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
  #api!: MELCloudAPI

  #facadeManager!: FacadeManager

  #homeApi!: MELCloudHomeAPI

  declare public readonly homey: Homey.Homey

  get #registry(): ModelRegistry {
    return this.#api.registry
  }

  public get api(): MELCloudAPI {
    return this.#api
  }

  public get homeApi(): MELCloudHomeAPI {
    return this.#homeApi
  }

  public override async onInit(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    const timezone = this.homey.clock.getTimezone()
    LuxonSettings.defaultLocale = language
    LuxonSettings.defaultZone = timezone
    await this.#initApi({ language, timezone })
    await this.#initHomeApi()
    this.#createNotification(language)
    this.#registerWidgetListeners()
  }

  public override async onUninit(): Promise<void> {
    this.#api.clearSync()
    this.#homeApi.clearSync()
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public getAtaCapabilities(): [
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

  public getAtaDetailedValues(
    { zoneId, zoneType }: ZoneData,
    { status }: { status?: GetAtaOptions['status'] } = {},
  ): GroupAtaStates {
    const { devices } = this.getFacade(zoneType, zoneId)
    if (devices.length === 0) {
      throw new Error(this.homey.__('errors.deviceNotFound'))
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic GroupState to typed GroupAtaStates
    return typedFromEntries(
      this.getAtaCapabilities().map(([key]) => [
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

  public async getAtaValues({
    zoneId,
    zoneType,
  }: ZoneData): Promise<GroupState> {
    return this.getFacade(zoneType, zoneId).getGroup()
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

  public getDevicesByType<T extends DeviceType>(type: T): DeviceModel<T>[] {
    return this.#registry.getDevicesByType(type)
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

  public async getErrorLog(query: ErrorLogQuery): Promise<FormattedErrorLog> {
    const { errors, fromDate, ...rest } = await this.#api.getErrorLog(query)
    return {
      ...rest,
      errors: errors.map(({ date, deviceId, ...errorRest }) => ({
        ...errorRest,
        date: DateTime.fromISO(date).toLocaleString(DateTime.DATETIME_MED),
        device: this.#registry.devices.getById(deviceId)?.name ?? '',
      })),
      fromDateHuman: DateTime.fromISO(fromDate).toLocaleString(
        DateTime.DATE_FULL,
      ),
    }
  }

  public getFacade<T extends DeviceType>(
    zoneType: 'devices',
    id: number | string,
  ): DeviceFacade<T>
  public getFacade(
    zoneType: 'areas' | 'buildings' | 'floors',
    id: number | string,
  ): BuildingFacade | ZoneFacade
  public getFacade(
    zoneType: 'areas' | 'buildings' | 'devices' | 'floors',
    id: number | string,
  ): Facade {
    const instance = this.#registry[zoneType].getById(Number(id))
    if (!instance) {
      throw new Error(
        this.homey.__(
          `errors.${zoneType === 'devices' ? 'device' : 'zone'}NotFound`,
        ),
      )
    }
    return this.#facadeManager.get(instance)
  }

  public async getFrostProtectionSettings({
    zoneId,
    zoneType,
  }: ZoneData): Promise<FrostProtectionData> {
    return this.getFacade(zoneType, zoneId).getFrostProtection()
  }

  public async getHolidayModeSettings({
    zoneId,
    zoneType,
  }: ZoneData): Promise<HolidayModeData> {
    return this.getFacade(zoneType, zoneId).getHolidayMode()
  }

  public getHomeDevicesByType(type: HomeDeviceType): HomeDeviceModel[] {
    return this.#homeApi.registry.getByType(type)
  }

  public getHomeFacade(deviceId: string): HomeDeviceAtaFacade {
    const model = this.#homeApi.registry.getById(deviceId)
    if (!model) {
      throw new Error(this.homey.__('errors.deviceNotFound'))
    }
    return new HomeDeviceAtaFacade(this.#homeApi, model)
  }

  public async getHourlyTemperatures(
    deviceId: string,
    hour?: HourNumbers,
  ): Promise<ReportChartLineOptions> {
    return this.getFacade('devices', deviceId).getHourlyTemperatures(hour)
  }

  public async getOperationModes(
    deviceId: string,
    days: number,
  ): Promise<ReportChartPieOptions> {
    const now = DateTime.now()
    return this.getFacade('devices', deviceId).getOperationModes({
      from: now.minus({ days }).toISO({ includeOffset: false }),
      to: now.toISO({ includeOffset: false }),
    })
  }

  public async getSignal(
    deviceId: string,
    hour?: HourNumbers,
  ): Promise<ReportChartLineOptions> {
    return this.getFacade('devices', deviceId).getSignalStrength(hour)
  }

  public async getTemperatures(
    deviceId: string,
    days: number,
  ): Promise<ReportChartLineOptions> {
    const now = DateTime.now()
    return this.getFacade('devices', deviceId).getTemperatures({
      from: now.minus({ days }).toISO({ includeOffset: false }),
      to: now.toISO({ includeOffset: false }),
    })
  }

  public async homeLogin(data: LoginCredentials): Promise<boolean> {
    return this.#homeApi.authenticate(data)
  }

  public async login(data: LoginCredentials): Promise<boolean> {
    return this.api.authenticate(data)
  }

  public async setAtaValues(
    state: GroupState,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    const data = await this.getFacade(zoneType, zoneId).setGroup(state)
    handleResponse(data.AttributeErrors)
  }

  public async setDeviceSettings(
    settings: Settings,
    { driverId }: { driverId?: string } = {},
  ): Promise<void> {
    await Promise.all(
      this.#getDevices({ driverId }).map(async (device) => {
        const changedKeys = Object.keys(settings).filter(
          (changedKey) =>
            settings[changedKey] !== device.getSetting(changedKey),
        )
        if (changedKeys.length > 0) {
          await device.setSettings(
            Object.fromEntries(changedKeys.map((key) => [key, settings[key]])),
          )
          await device.onSettings({
            changedKeys,
            newSettings: device.getSettings(),
          })
        }
      }),
    )
  }

  public async setFrostProtectionSettings(
    settings: FrostProtectionQuery,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    const data = await this.getFacade(zoneType, zoneId).setFrostProtection(
      settings,
    )
    handleResponse(data.AttributeErrors)
  }

  public async setHolidayModeSettings(
    settings: HolidayModeQuery,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    const data = await this.getFacade(zoneType, zoneId).setHolidayMode(settings)
    handleResponse(data.AttributeErrors)
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
    if (settings.get('notifiedVersion') !== version) {
      const { [version]: versionChangelog = {} } = changelog as Record<
        string,
        Record<string, string>
      >
      const { [language]: excerpt } = versionChangelog
      if (excerpt !== undefined) {
        homey.setTimeout(async () => {
          try {
            await notifications.createNotification({ excerpt })
            settings.set('notifiedVersion', version)
          } catch {
            // Non-critical: notification display is best-effort
          }
        }, NOTIFICATION_DELAY_MS)
      }
    }
  }

  #createSettingManager(prefix: string): {
    get: (key: string) => string | null | undefined
    set: (key: string, value: string) => void
  } {
    const prefixKey = (key: string): string =>
      `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`
    return {
      get: (key: string): string | null | undefined =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Homey settings.get returns unknown
        this.homey.settings.get(prefixKey(key)) as string | null | undefined,
      set: (key: string, value: string): void => {
        this.homey.settings.set(prefixKey(key), value)
      },
    }
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
  } = {}): MELCloudDevice[] {
    const targetDrivers =
      driverId === undefined ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]
    return targetDrivers.flatMap((driver) => {
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
    this.#api = await MELCloudAPI.create({
      language,
      logger: this.#createLogger(),
      settingManager: this.homey.settings,
      timezone,
      onSync: async ({ ids, type } = {}) =>
        this.#syncDevices(type === undefined ? undefined : drivers[type], ids),
    })
    this.#facadeManager = new FacadeManager(this.#api, this.#registry)
    setFacadeManager(this.#facadeManager)
  }

  async #initHomeApi(): Promise<void> {
    this.#homeApi = await MELCloudHomeAPI.create({
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager('home'),
      onSync: async () => this.#syncDevices(drivers[HomeDeviceType.Ata]),
    })
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
    try {
      const targetDrivers =
        driverId === undefined ?
          Object.values(this.homey.drivers.getDrivers())
        : [this.homey.drivers.getDriver(driverId)]
      await Promise.all(
        targetDrivers.flatMap((driver) => {
          const devices = driver.getDevices()
          const filtered =
            ids ? devices.filter(({ id }) => ids.includes(Number(id))) : devices
          return filtered.map(async (device) =>
            (
              device as { syncFromDevice: () => Promise<void> }
            ).syncFromDevice(),
          )
        }),
      )
    } catch {
      // Driver not yet initialized during app startup — devices will sync once ready
    }
  }
}
