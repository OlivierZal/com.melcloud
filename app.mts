import 'source-map-support/register.js'
import 'core-js/actual/array/to-sorted.js'
import 'core-js/actual/object/group-by.js'

// eslint-disable-next-line import-x/no-extraneous-dependencies
import Homey from 'homey'

import {
  type ErrorLog,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionQuery,
  type GroupState,
  type HolidayModeData,
  type HolidayModeQuery,
  type IBuildingFacade,
  type IDeviceFacade,
  type IFacade,
  type ISuperDeviceFacade,
  type ListDeviceDataAta,
  type LoginCredentials,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  DeviceType,
  FacadeManager,
  FanSpeed,
  Horizontal,
  MELCloudAPI,
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
} from './json-files.mts'
import { getZones } from './lib/get-zones.mts'
import {
  type DeviceSettings,
  type DriverCapabilitiesOptions,
  type DriverSetting,
  type GetAtaOptions,
  type GroupAtaStates,
  type LoginSetting,
  type ManifestDriver,
  type ManifestDriverCapabilitiesOptions,
  type MELCloudDevice,
  type Settings,
  type ZoneData,
  fanSpeedValues,
  zoneModel,
} from './types/common.mts'

const NOTIFICATION_DELAY = 10000

const drivers: Record<DeviceType, string> = {
  [DeviceType.Ata]: 'melcloud',
  [DeviceType.Atw]: 'melcloud_atw',
  [DeviceType.Erv]: 'melcloud_erv',
}

const hasChangelogLanguage = (
  versionChangelog: object,
  language: string,
): language is keyof typeof versionChangelog => language in versionChangelog

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
): DriverSetting[] =>
  Object.values(
    Object.entries(
      pair?.find(
        (pairSetting): pairSetting is LoginSetting =>
          pairSetting.id === 'login',
      )?.options ?? [],
    ).reduce<Record<string, DriverSetting>>((acc, [option, label]) => {
      const isPassword = option.startsWith('password')
      const key = isPassword ? 'password' : 'username'
      acc[key] ??= {
        driverId,
        groupId: 'login',
        id: key,
        title: '',
        type: isPassword ? 'password' : 'text',
      }
      acc[key] = {
        ...acc[key],
        [option.endsWith('Placeholder') ? 'placeholder' : 'title']:
          label[language] ?? label.en,
      }
      return acc
    }, {}),
  )

const isKeyofEnum = (
  enumType: object,
  key: string,
): key is keyof typeof enumType => key in enumType

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?: object,
): DriverCapabilitiesOptions => ({
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    id: enumType && isKeyofEnum(enumType, id) ? enumType[id] : id,
    label: title[language] ?? title.en,
  })),
})

// eslint-disable-next-line import-x/no-named-as-default-member
export default class MELCloudApp extends Homey.App {
  declare public readonly homey: Homey.Homey

  #api!: MELCloudAPI

  #facadeManager!: FacadeManager

  public get api(): MELCloudAPI {
    return this.#api
  }

  public override async onInit(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    const timezone = this.homey.clock.getTimezone()
    LuxonSettings.defaultLocale = language
    LuxonSettings.defaultZone = timezone
    this.#api = await MELCloudAPI.create({
      language,
      logger: {
        error: (...args) => {
          this.error(...args)
        },
        log: (...args) => {
          this.log(...args)
        },
      },
      settingManager: this.homey.settings,
      timezone,
      onSync: async (params) => this.#syncFromDevices(params),
    })
    this.#facadeManager = new FacadeManager(this.#api)
    this.#createNotification(language)
    this.#registerWidgetListeners()
  }

  public override async onUninit(): Promise<void> {
    this.#api.clearSync()
    return Promise.resolve()
  }

  public getAtaCapabilities(): [
    keyof GroupState & keyof ListDeviceDataAta,
    DriverCapabilitiesOptions,
  ][] {
    return [
      { key: 'Power', options: power },
      { key: 'SetTemperature', options: setTemperature },
      {
        enumType: FanSpeed,
        key: 'FanSpeed',
        options: { ...fanSpeed, type: 'enum', values: fanSpeedValues },
      },
      { enumType: Vertical, key: 'VaneVerticalDirection', options: vertical },
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
    ].map(({ enumType, key, options }) => [
      key,
      getLocalizedCapabilitiesOptions(
        options,
        this.homey.i18n.getLanguage(),
        enumType,
      ),
    ]) as [
      keyof GroupState & keyof ListDeviceDataAta,
      DriverCapabilitiesOptions,
    ][]
  }

  public getAtaDetailedValues(
    { zoneId, zoneType }: ZoneData,
    { status }: { status?: GetAtaOptions['status'] } = {},
  ): GroupAtaStates {
    const { devices } = zoneModel[zoneType].getById(Number(zoneId)) ?? {}
    if (!devices) {
      throw new Error(this.homey.__('errors.deviceNotFound'))
    }
    return Object.fromEntries(
      this.getAtaCapabilities().map(([key]) => [
        key,
        devices
          .filter((device) => device.type === DeviceType.Ata)
          .filter(({ data }) => (status === 'on' ? data.Power : true))
          .map(({ data }) => data[key]),
      ]),
    ) as unknown as GroupAtaStates
  }

  public async getAtaValues({
    zoneId,
    zoneType,
  }: ZoneData): Promise<GroupState> {
    return this.getFacade(zoneType, zoneId).group()
  }

  public getDeviceSettings(): DeviceSettings {
    return this.#getDevices().reduce<DeviceSettings>((acc, device) => {
      const {
        driver: { id: driverId },
      } = device
      acc[driverId] ??= {}
      for (const [id, value] of Object.entries(device.getSettings())) {
        if (!(id in acc[driverId])) {
          acc[driverId][id] = value
        } else if (acc[driverId][id] !== value) {
          acc[driverId][id] = null
          break
        }
      }
      return acc
    }, {})
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

  public async getErrors(query: ErrorLogQuery): Promise<ErrorLog> {
    return this.#api.errorLog(query)
  }

  public getFacade<T extends DeviceType>(
    zoneType: 'devices',
    id: number | string,
  ): IDeviceFacade<T>
  public getFacade(
    zoneType: Exclude<keyof typeof zoneModel, 'devices'>,
    id: number | string,
  ): IBuildingFacade | ISuperDeviceFacade
  public getFacade(
    zoneType: keyof typeof zoneModel,
    id: number | string,
  ): IFacade {
    const instance = zoneModel[zoneType].getById(Number(id))
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
    return this.getFacade(zoneType, zoneId).frostProtection()
  }

  public async getHolidayModeSettings({
    zoneId,
    zoneType,
  }: ZoneData): Promise<HolidayModeData> {
    return this.getFacade(zoneType, zoneId).holidayMode()
  }

  public async getHourlyTemperatures(
    deviceId: string,
    hour?: HourNumbers,
  ): Promise<ReportChartLineOptions> {
    return this.getFacade('devices', deviceId).hourlyTemperatures(hour)
  }

  public async getOperationModes(
    deviceId: string,
    days: number,
  ): Promise<ReportChartPieOptions> {
    const now = DateTime.now()
    return this.getFacade('devices', deviceId).operationModes({
      from: now.minus({ days }).toISO({ includeOffset: false }),
      to: now.toISO({ includeOffset: false }),
    })
  }

  public async getSignal(
    deviceId: string,
    hour?: HourNumbers,
  ): Promise<ReportChartLineOptions> {
    return this.getFacade('devices', deviceId).signal(hour)
  }

  public async getTemperatures(
    deviceId: string,
    days: number,
  ): Promise<ReportChartLineOptions> {
    const now = DateTime.now()
    return this.getFacade('devices', deviceId).temperatures({
      from: now.minus({ days }).toISO({ includeOffset: false }),
      to: now.toISO({ includeOffset: false }),
    })
  }

  public async login(data: LoginCredentials): Promise<boolean> {
    return this.api.authenticate(data)
  }

  public async setAtaValues(
    state: GroupState,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    handleResponse(
      (await this.getFacade(zoneType, zoneId).setGroup(state)).AttributeErrors,
    )
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
        if (changedKeys.length) {
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
    handleResponse(
      (await this.getFacade(zoneType, zoneId).setFrostProtection(settings))
        .AttributeErrors,
    )
  }

  public async setHolidayModeSettings(
    settings: HolidayModeQuery,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    handleResponse(
      (await this.getFacade(zoneType, zoneId).setHolidayMode(settings))
        .AttributeErrors,
    )
  }

  #createNotification(language: string): void {
    const {
      homey: {
        manifest: { version },
      },
    } = this
    if (this.homey.settings.get('notifiedVersion') !== version) {
      const { [version]: versionChangelog = {} } = changelog
      if (language in versionChangelog) {
        this.homey.setTimeout(async () => {
          try {
            if (hasChangelogLanguage(versionChangelog, language)) {
              await this.homey.notifications.createNotification({
                excerpt: versionChangelog[language],
              })
              this.homey.settings.set('notifiedVersion', version)
            }
          } catch {}
        }, NOTIFICATION_DELAY)
      }
    }
  }

  #getDevices({
    driverId,
    ids,
  }: {
    driverId?: string
    ids?: number[]
  } = {}): MELCloudDevice[] {
    return (
      driverId === undefined ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]).flatMap((driver) => {
      const devices = driver.getDevices()
      return ids === undefined ? devices : (
          devices.filter(({ id }) => ids.includes(id))
        )
    })
  }

  #registerWidgetListeners(): void {
    this.homey.dashboards
      .getWidget('ata-group-setting')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        getZones({ type: DeviceType.Ata })
          .filter(({ model }) => model !== 'devices')
          .filter(({ name }) =>
            name.toLowerCase().includes(query.toLowerCase()),
          ),
      )
    this.homey.dashboards
      .getWidget('charts')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        getZones()
          .filter(({ model }) => model === 'devices')
          .filter(({ name }) =>
            name.toLowerCase().includes(query.toLowerCase()),
          ),
      )
  }

  async #syncFromDevices({
    ids,
    type,
  }: {
    ids?: number[]
    type?: DeviceType
  } = {}): Promise<void> {
    await Promise.all(
      this.#getDevices({
        driverId: type === undefined ? undefined : drivers[type],
        ids,
      }).map(async (device) => device.syncFromDevice()),
    )
  }
}
