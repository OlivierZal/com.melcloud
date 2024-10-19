import 'core-js/actual/object/group-by'
import 'source-map-support/register'

import {
  FacadeManager,
  FanSpeed,
  Horizontal,
  MELCloudAPI,
  OperationMode,
  Vertical,
  type AreaFacade,
  type BuildingFacade,
  type DeviceFacadeAny,
  type FloorFacade,
  type FrostProtectionData,
  type GroupAtaState,
  type HolidayModeData,
  type ListDeviceDataAta,
  type LoginCredentials,
} from '@olivierzal/melcloud-api'
import { App } from 'homey'
import fanSpeed from 'homey-lib/assets/capability/capabilities/fan_speed.json'
import power from 'homey-lib/assets/capability/capabilities/onoff.json'
import setTemperature from 'homey-lib/assets/capability/capabilities/target_temperature.json'
import thermostatMode from 'homey-lib/assets/capability/capabilities/thermostat_mode.json'
import { Settings as LuxonSettings } from 'luxon'

import changelog from './.homeychangelog.json'
import horizontal from './.homeycompose/capabilities/horizontal.json'
import vertical from './.homeycompose/capabilities/vertical.json'
import {
  fanSpeedValues,
  zoneModel,
  type DeviceSettings,
  type DriverCapabilitiesOptions,
  type DriverSetting,
  type ErrorLog,
  type ErrorLogQuery,
  type FrostProtectionSettings,
  type GetAtaOptions,
  type HolidayModeSettings,
  type LoginSetting,
  type MELCloudDevice,
  type Manifest,
  type ManifestDriver,
  type ManifestDriverCapabilitiesOptions,
  type Settings,
  type ZoneData,
} from './types'

const NOTIFICATION_DELAY = 10000

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
      acc[key][option.endsWith('Placeholder') ? 'placeholder' : 'title'] =
        label[language] ?? label.en
      return acc
    }, {}),
  )

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?:
    | typeof FanSpeed
    | typeof Horizontal
    | typeof OperationMode
    | typeof Vertical,
): DriverCapabilitiesOptions => ({
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    id:
      enumType && id in enumType ?
        String(enumType[id as keyof typeof enumType])
      : id,
    label: title[language] ?? title.en,
  })),
})

export = class extends App {
  readonly #language = this.homey.i18n.getLanguage()

  #api!: MELCloudAPI

  #facadeManager!: FacadeManager

  public get api(): MELCloudAPI {
    return this.#api
  }

  public override async onInit(): Promise<void> {
    const timezone = this.homey.clock.getTimezone()
    LuxonSettings.defaultZone = timezone
    LuxonSettings.defaultLocale = this.#language
    this.#api = await MELCloudAPI.create({
      language: this.#language,
      logger: {
        error: (...args) => {
          this.error(...args)
        },
        log: (...args) => {
          this.log(...args)
        },
      },
      onSync: async () => this.#syncFromDevices(),
      settingManager: this.homey.settings,
      timezone,
    })
    this.#facadeManager = new FacadeManager(this.#api)
    this.#createNotification()
  }

  public override async onUninit(): Promise<void> {
    this.#api.clearSync()
    return Promise.resolve()
  }

  public getAtaCapabilities(): [
    keyof GroupAtaState & keyof ListDeviceDataAta,
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
          values: (this.homey.manifest as Manifest).drivers
            .find(({ id }) => id === 'melcloud')
            ?.capabilitiesOptions?.thermostat_mode.values?.filter(
              ({ id }) => id !== 'off',
            ),
        },
      },
    ].map(({ enumType, key, options }) => [
      key as keyof GroupAtaState & keyof ListDeviceDataAta,
      getLocalizedCapabilitiesOptions(options, this.#language, enumType),
    ])
  }

  public async getAtaValues({
    zoneId,
    zoneType,
  }: ZoneData): Promise<GroupAtaState>
  public async getAtaValues<T extends keyof GroupAtaState>(
    { zoneId, zoneType }: ZoneData,
    mode: 'detailed',
    status?: GetAtaOptions['status'],
  ): Promise<Record<T, GroupAtaState[T][]>>
  public async getAtaValues<T extends keyof GroupAtaState>(
    { zoneId, zoneType }: ZoneData,
    mode?: GetAtaOptions['mode'],
    status?: GetAtaOptions['status'],
  ): Promise<GroupAtaState | Record<T, GroupAtaState[T][]>> {
    if (mode === 'detailed') {
      const { devices } = zoneModel[zoneType].getById(Number(zoneId)) ?? {}
      if (!devices) {
        throw new Error(this.homey.__('errors.deviceNotFound'))
      }
      return Object.fromEntries(
        this.getAtaCapabilities().map(([key]) => [
          key,
          devices
            .filter((device) => device.type === 'Ata')
            .filter(({ data }) => (status === 'on' ? data.Power : true))
            .map(({ data }) => data[key]),
        ]),
      )
    }
    return this.getFacade(zoneType, zoneId).getAta()
  }

  public getDeviceSettings(): DeviceSettings {
    return this.#getDevices().reduce<DeviceSettings>((acc, device) => {
      const {
        driver: { id: driverId },
      } = device
      acc[driverId] ??= {}
      for (const [id, value] of Object.entries(
        device.getSettings() as Settings,
      )) {
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
    return Object.groupBy(
      (this.homey.manifest as Manifest).drivers.flatMap((driver) => [
        ...getDriverSettings(driver, this.#language),
        ...getDriverLoginSetting(driver, this.#language),
      ]),
      ({ driverId, groupId }) => groupId ?? driverId,
    )
  }

  public async getErrors(query: ErrorLogQuery): Promise<ErrorLog> {
    return this.#facadeManager.getErrors(query)
  }

  public getFacade(zoneType: 'devices', id: number | string): DeviceFacadeAny
  public getFacade(
    zoneType: 'areas' | 'buildings' | 'floors',
    id: number | string,
  ): AreaFacade | BuildingFacade | FloorFacade
  public getFacade(
    zoneType: keyof typeof zoneModel,
    id: number | string,
  ): AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade {
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
    return this.getFacade(zoneType, zoneId).getFrostProtection()
  }

  public async getHolidayModeSettings({
    zoneId,
    zoneType,
  }: ZoneData): Promise<HolidayModeData> {
    return this.getFacade(zoneType, zoneId).getHolidayMode()
  }

  public getLanguage(): string {
    return this.homey.i18n.getLanguage()
  }

  public async login(credentials: LoginCredentials): Promise<boolean> {
    return this.api.login(credentials)
  }

  public async setAtaValues(
    state: GroupAtaState,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    handleResponse(
      (await this.getFacade(zoneType, zoneId).setAta(state)).AttributeErrors,
    )
  }

  public async setDeviceSettings(
    settings: Settings,
    driverId?: string,
  ): Promise<void> {
    await Promise.all(
      this.#getDevices(driverId).map(async (device) => {
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
            newSettings: device.getSettings() as Settings,
          })
        }
      }),
    )
  }

  public async setFrostProtectionSettings(
    settings: FrostProtectionSettings,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    handleResponse(
      (await this.getFacade(zoneType, zoneId).setFrostProtection(settings))
        .AttributeErrors,
    )
  }

  public async setHolidayModeSettings(
    settings: HolidayModeSettings,
    { zoneId, zoneType }: ZoneData,
  ): Promise<void> {
    handleResponse(
      (await this.getFacade(zoneType, zoneId).setHolidayMode(settings))
        .AttributeErrors,
    )
  }

  #createNotification(): void {
    const { version } = this.homey.manifest as Manifest
    if (
      this.homey.settings.get('notifiedVersion') !== version &&
      version in changelog
    ) {
      const { [version as keyof typeof changelog]: versionChangelog } =
        changelog
      this.homey.setTimeout(async () => {
        try {
          await this.homey.notifications.createNotification({
            excerpt:
              versionChangelog[
                this.#language in versionChangelog ?
                  (this.#language as keyof typeof versionChangelog)
                : 'en'
              ],
          })
          this.homey.settings.set('notifiedVersion', version)
        } catch (_error) {}
      }, NOTIFICATION_DELAY)
    }
  }

  #getDevices(driverId?: string): MELCloudDevice[] {
    return (
      driverId === undefined ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]).flatMap(
      (driver) => driver.getDevices() as MELCloudDevice[],
    )
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.#getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
