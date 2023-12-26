import 'source-map-support/register'
import { App, type Driver } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import axios from 'axios'
import {
  DateTime,
  Duration,
  Settings as LuxonSettings,
  type DurationLike,
} from 'luxon'
import withAPI, { getErrorMessage } from './mixins/withAPI'
import withTimers from './mixins/withTimers'
import type {
  Building,
  ErrorLogData,
  ErrorLogPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  FrostProtectionSettings,
  HolidayModeData,
  HolidayModePostData,
  HolidayModeSettings,
  HomeySettings,
  HomeySettingValue,
  ListDeviceAny,
  LoginCredentials,
  LoginData,
  LoginPostData,
  MELCloudDevice,
  SuccessData,
  SyncFromMode,
} from './types'

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const MAX_INT32: number = 2 ** 31 - 1

axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'

const handleFailure = (data: FailureData): never => {
  const errorMessage: string = Object.entries(data.AttributeErrors)
    .map(
      ([error, messages]: [string, readonly string[]]): string =>
        `${error}: ${messages.join(', ')}`,
    )
    .join('\n')
  throw new Error(errorMessage)
}

const handleResponse = (data: FailureData | SuccessData): void => {
  if (data.AttributeErrors) {
    handleFailure(data)
  }
}

export = class MELCloudApp extends withAPI(withTimers(App)) {
  public retry = true

  public deviceList: ListDeviceAny[] = []

  public deviceIds: Record<number, string> = {}

  #loginTimeout!: NodeJS.Timeout

  #syncTimeout!: NodeJS.Timeout

  readonly #retryTimeout!: NodeJS.Timeout

  public async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.planRefreshLogin()
  }

  public async login(
    loginCredentials: LoginCredentials = {
      username:
        (this.homey.settings.get('username') as HomeySettings['username']) ??
        '',
      password:
        (this.homey.settings.get('password') as HomeySettings['password']) ??
        '',
    },
    raise = false,
  ): Promise<boolean> {
    this.clearLoginRefresh()
    try {
      const { username, password } = loginCredentials
      if (!username || !password) {
        return false
      }
      const postData: LoginPostData = {
        /* eslint-disable @typescript-eslint/naming-convention */
        AppVersion: '1.30.5.0',
        Email: username,
        Password: password,
        Persist: true,
        /* eslint-enable @typescript-eslint/naming-convention */
      }
      const { data } = await this.api.post<LoginData>(this.loginURL, postData)
      if (data.LoginData) {
        const { ContextKey: contextKey, Expiry: expiry } = data.LoginData
        this.setSettings({ contextKey, expiry, username, password })
        await this.planRefreshLogin()
      }
      return !!data.LoginData
    } catch (error: unknown) {
      if (raise) {
        throw new Error(getErrorMessage(error))
      }
      return false
    }
  }

  public getDevice(
    deviceId: number,
    { buildingId, driverId }: { buildingId?: number; driverId?: string } = {},
  ): MELCloudDevice | undefined {
    return this.getDevices({ buildingId, driverId }).find(
      ({ id }) => id === deviceId,
    )
  }

  public getDevices({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): MELCloudDevice[] {
    let devices: MELCloudDevice[] = (
      driverId !== undefined
        ? [this.homey.drivers.getDriver(driverId)]
        : Object.values(this.homey.drivers.getDrivers())
    ).flatMap(
      (driver: Driver): MELCloudDevice[] =>
        driver.getDevices() as MELCloudDevice[],
    )
    if (buildingId !== undefined) {
      devices = devices.filter(({ buildingid }) => buildingid === buildingId)
    }
    return devices
  }

  public applySyncFromDevices({
    syncMode,
    interval,
  }: { syncMode?: SyncFromMode; interval?: DurationLike } = {}): void {
    this.clearListDevicesRefresh()
    this.#syncTimeout = this.setTimeout(
      async (): Promise<void> => {
        await this.listDevices(undefined, syncMode)
      },
      interval ?? { seconds: 1 },
      { actionType: 'sync with device', units: ['minutes', 'seconds'] },
    )
  }

  public async listDevices(
    deviceType?: number,
    syncMode?: SyncFromMode,
  ): Promise<ListDeviceAny[]> {
    this.clearListDevicesRefresh()
    try {
      const buildings = await this.getBuildings()
      const buildingData: {
        deviceIds: Record<number, string>
        deviceList: ListDeviceAny[]
      } = buildings.reduce<{
        deviceIds: Record<number, string>
        deviceList: ListDeviceAny[]
      }>(
        (
          acc,
          { Structure: { Devices: devices, Areas: areas, Floors: floors } },
        ) => {
          const buildingDevices: ListDeviceAny[] = [
            ...devices,
            ...areas.flatMap((area): readonly ListDeviceAny[] => area.Devices),
            ...floors.flatMap((floor): ListDeviceAny[] => [
              ...floor.Devices,
              ...floor.Areas.flatMap(
                (area): readonly ListDeviceAny[] => area.Devices,
              ),
            ]),
          ]
          const buildingDeviceIds: Record<number, string> = Object.fromEntries(
            buildingDevices.map((device: ListDeviceAny): [number, string] => [
              device.DeviceID,
              device.DeviceName,
            ]),
          )
          acc.deviceIds = { ...acc.deviceIds, ...buildingDeviceIds }
          acc.deviceList.push(...buildingDevices)
          return acc
        },
        { deviceIds: {}, deviceList: [] },
      )
      let { deviceList } = buildingData
      if (deviceType !== undefined) {
        deviceList = deviceList.filter(
          (device: ListDeviceAny) => deviceType === device.Device.DeviceType,
        )
      }
      this.deviceList = deviceList
      this.deviceIds = buildingData.deviceIds
      await this.syncDevicesFromList(syncMode)
      return deviceList
    } catch (error: unknown) {
      return []
    } finally {
      this.applySyncFromDevices({ interval: { minutes: 3 } })
    }
  }

  public clearListDevicesRefresh(): void {
    this.homey.clearTimeout(this.#syncTimeout)
    this.log('Device list refresh has been paused')
  }

  public async getBuildings(): Promise<Building[]> {
    try {
      const { data } = await this.api.get<Building[]>('/User/ListDevices')
      return data
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error))
    }
  }

  public async getUnitErrorLog(
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ErrorLogData[]> {
    const postData: ErrorLogPostData = {
      /* eslint-disable @typescript-eslint/naming-convention */
      DeviceIDs: Object.keys(this.deviceIds),
      FromDate: fromDate.toISODate() ?? '',
      ToDate: toDate.toISODate() ?? '',
      /* eslint-enable @typescript-eslint/naming-convention */
    }
    const { data } = await this.api.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData,
    )
    if ('AttributeErrors' in data) {
      return handleFailure(data)
    }
    return data
  }

  public async getFrostProtectionSettings(
    buildingId: number,
  ): Promise<FrostProtectionData> {
    const buildingDeviceId: number = this.getFirstDeviceId({ buildingId })
    const { data } = await this.api.get<FrostProtectionData>(
      `/FrostProtection/GetSettings?tableName=DeviceLocation&id=${buildingDeviceId}`,
    )
    return data
  }

  public async updateFrostProtectionSettings(
    buildingId: number,
    settings: FrostProtectionSettings,
  ): Promise<void> {
    const postData: FrostProtectionPostData = {
      ...settings,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      BuildingIds: [buildingId],
    }
    const { data } = await this.api.post<FailureData | SuccessData>(
      '/FrostProtection/Update',
      postData,
    )
    handleResponse(data)
  }

  public async getHolidayModeSettings(
    buildingId: number,
  ): Promise<HolidayModeData> {
    const buildingDeviceId: number = this.getFirstDeviceId({ buildingId })
    const { data } = await this.api.get<HolidayModeData>(
      `/HolidayMode/GetSettings?tableName=DeviceLocation&id=${buildingDeviceId}`,
    )
    return data
  }

  public async updateHolidayModeSettings(
    buildingId: number,
    settings: HolidayModeSettings,
  ): Promise<void> {
    const {
      Enabled: enabled,
      StartDate: startDate,
      EndDate: endDate,
    } = settings
    if (enabled && (!startDate || !endDate)) {
      throw new Error(this.homey.__('app.holiday_mode.date_missing'))
    }
    const utcStartDate: DateTime | null = enabled
      ? DateTime.fromISO(startDate).toUTC()
      : null
    const utcEndDate: DateTime | null = enabled
      ? DateTime.fromISO(endDate).toUTC()
      : null
    const postData: HolidayModePostData = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Enabled: enabled,
      StartDate: utcStartDate
        ? {
            Year: utcStartDate.year,
            Month: utcStartDate.month,
            Day: utcStartDate.day,
            Hour: utcStartDate.hour,
            Minute: utcStartDate.minute,
            Second: utcStartDate.second,
          }
        : null,
      EndDate: utcEndDate
        ? {
            Year: utcEndDate.year,
            Month: utcEndDate.month,
            Day: utcEndDate.day,
            Hour: utcEndDate.hour,
            Minute: utcEndDate.minute,
            Second: utcEndDate.second,
          }
        : null,
      HMTimeZones: [{ Buildings: [buildingId] }],
      /* eslint-enable @typescript-eslint/naming-convention */
    }
    const { data } = await this.api.post<FailureData | SuccessData>(
      '/HolidayMode/Update',
      postData,
    )
    handleResponse(data)
  }

  public getLanguage(): string {
    return this.homey.i18n.getLanguage()
  }

  public handleRetry(): void {
    this.retry = false
    this.homey.clearTimeout(this.#retryTimeout)
    this.homey.setTimeout(
      () => {
        this.retry = true
      },
      Duration.fromObject({ minutes: 1 }).as('milliseconds'),
    )
  }

  private async planRefreshLogin(): Promise<void> {
    const expiry: string =
      (this.homey.settings.get('expiry') as HomeySettings['expiry']) ?? ''
    const ms: number = DateTime.fromISO(expiry)
      .minus({ days: 1 })
      .diffNow()
      .as('milliseconds')
    if (ms > 0) {
      this.applySyncFromDevices()
      this.#loginTimeout = this.setTimeout(
        async (): Promise<void> => {
          await this.login()
        },
        Math.min(ms, MAX_INT32),
        { actionType: 'login refresh', units: ['days'] },
      )
      return
    }
    await this.login()
  }

  private clearLoginRefresh(): void {
    this.homey.clearTimeout(this.#loginTimeout)
    this.log('Login refresh has been paused')
  }

  private getFirstDeviceId({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): number {
    const deviceIds = this.getDeviceIds({ buildingId, driverId })
    if (!deviceIds.length) {
      throw new Error(this.homey.__('app.building.no_device', { buildingId }))
    }
    return deviceIds[0]
  }

  private getDeviceIds({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): number[] {
    return this.getDevices({ buildingId, driverId }).map(({ id }): number => id)
  }

  private async syncDevicesFromList(syncMode?: SyncFromMode): Promise<void> {
    await Promise.all(
      this.getDevices()
        .filter((device: MELCloudDevice) => !device.isDiff())
        .map(
          async (device: MELCloudDevice): Promise<void> =>
            device.syncDeviceFromList(syncMode),
        ),
    )
  }

  private setSettings(settings: Partial<HomeySettings>): void {
    Object.entries(settings)
      .filter(
        ([setting, value]: [string, HomeySettingValue]) =>
          value !== this.homey.settings.get(setting),
      )
      .forEach(([setting, value]: [string, HomeySettingValue]): void => {
        this.homey.settings.set(setting, value)
      })
  }
}
