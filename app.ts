import 'source-map-support/register'
import { App, type Driver } from 'homey'
import type {
  Building,
  BuildingDevices,
  ErrorLogData,
  FailureData,
  FrostProtectionData,
  FrostProtectionSettings,
  HeatPumpType,
  HolidayModeData,
  HolidayModeSettings,
  HomeySettings,
  ListDevice,
  LoginCredentials,
  MELCloudDevice,
  MELCloudDriver,
  SuccessData,
  SyncFromMode,
  ValueOf,
} from './types'
import {
  DateTime,
  Duration,
  type DurationLike,
  Settings as LuxonSettings,
} from 'luxon'
import withAPI, { getErrorMessage } from './mixins/withAPI'
import axios from 'axios'
import withTimers from './mixins/withTimers'

const MAX_INT32 = 2147483647

axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'

const flattenDevices = (
  acc: BuildingDevices,
  devices: readonly ListDevice<MELCloudDriver>[],
): BuildingDevices => {
  const newDeviceIds = devices.reduce<Record<number, string>>(
    (ids, device: ListDevice<MELCloudDriver>) => {
      ids[device.DeviceID] = device.DeviceName
      return ids
    },
    { ...acc.deviceIds },
  )
  const newDeviceList = [...acc.deviceList, ...devices]
  return { deviceIds: newDeviceIds, deviceList: newDeviceList }
}

const throwIfRequested = (error: unknown, raise: boolean): void => {
  if (raise) {
    throw new Error(getErrorMessage(error))
  }
}

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

  public deviceList: ListDevice<MELCloudDriver>[] = []

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
    { password, username }: LoginCredentials = {
      password: this.getHomeySetting('password') ?? '',
      username: this.getHomeySetting('username') ?? '',
    },
    raise = false,
  ): Promise<boolean> {
    this.clearLoginRefresh()
    if (username && password) {
      try {
        const { LoginData } = (
          await this.apiLogin({
            AppVersion: '1.32.1.0',
            Email: username,
            Password: password,
            Persist: true,
          })
        ).data
        if (LoginData) {
          this.setHomeySettings({
            contextKey: LoginData.ContextKey,
            expiry: LoginData.Expiry,
            password,
            username,
          })
          await this.planRefreshLogin()
        }
        return Boolean(LoginData)
      } catch (error: unknown) {
        throwIfRequested(error, raise)
      }
    }
    return false
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
      typeof driverId === 'undefined'
        ? Object.values(this.homey.drivers.getDrivers())
        : [this.homey.drivers.getDriver(driverId)]
    ).flatMap(
      (driver: Driver): MELCloudDevice[] =>
        driver.getDevices() as MELCloudDevice[],
    )
    if (typeof buildingId !== 'undefined') {
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
        await this.listDevices(null, syncMode)
      },
      interval ?? { seconds: 1 },
      { actionType: 'sync with device', units: ['minutes', 'seconds'] },
    )
  }

  public async listDevices(
    deviceType: HeatPumpType | null = null,
    syncMode?: SyncFromMode,
  ): Promise<ListDevice<MELCloudDriver>[]> {
    this.clearListDevicesRefresh()
    try {
      const { deviceIds, deviceList } = (await this.getBuildings()).reduce<{
        deviceIds: Record<number, string>
        deviceList: ListDevice<MELCloudDriver>[]
      }>(
        (
          acc,
          { Structure: { Devices: devices, Areas: areas, Floors: floors } },
        ) => {
          let newAcc = { ...acc }
          newAcc = flattenDevices(newAcc, devices)
          areas.forEach(({ Devices: areaDevices }) => {
            newAcc = flattenDevices(newAcc, areaDevices)
          })
          floors.forEach((floor) => {
            newAcc = flattenDevices(newAcc, floor.Devices)
            floor.Areas.forEach(({ Devices: areaDevices }) => {
              newAcc = flattenDevices(newAcc, areaDevices)
            })
          })
          return newAcc
        },
        { deviceIds: {}, deviceList: [] },
      )
      this.deviceIds = deviceIds
      this.deviceList =
        deviceType === null
          ? deviceList
          : deviceList.filter(
              ({ Device: { DeviceType: type } }) => deviceType === type,
            )
      await this.syncDevicesFromList(syncMode)
      return this.deviceList
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
      return (await this.apiList()).data
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error))
    }
  }

  public async getUnitErrorLog(
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ErrorLogData[]> {
    const { data } = await this.apiError({
      DeviceIDs: Object.keys(this.deviceIds),
      FromDate: fromDate.toISODate() ?? '',
      ToDate: toDate.toISODate() ?? '',
    })
    if ('AttributeErrors' in data) {
      return handleFailure(data)
    }
    return data
  }

  public async getFrostProtectionSettings(
    buildingId: number,
  ): Promise<FrostProtectionData> {
    return (
      await this.apiGetFrostProtection(this.getFirstDeviceId({ buildingId }))
    ).data
  }

  public async updateFrostProtectionSettings(
    buildingId: number,
    settings: FrostProtectionSettings,
  ): Promise<void> {
    handleResponse(
      (
        await this.apiUpdateFrostProtection({
          ...settings,
          BuildingIds: [buildingId],
        })
      ).data,
    )
  }

  public async getHolidayModeSettings(
    buildingId: number,
  ): Promise<HolidayModeData> {
    return (await this.apiGetHolidayMode(this.getFirstDeviceId({ buildingId })))
      .data
  }

  public async updateHolidayModeSettings(
    buildingId: number,
    {
      Enabled: enabled,
      StartDate: startDate,
      EndDate: endDate,
    }: HolidayModeSettings,
  ): Promise<void> {
    if (enabled && (!startDate || !endDate)) {
      throw new Error(this.homey.__('app.holiday_mode.date_missing'))
    }
    const utcStartDate: DateTime | null = enabled
      ? DateTime.fromISO(startDate).toUTC()
      : null
    const utcEndDate: DateTime | null = enabled
      ? DateTime.fromISO(endDate).toUTC()
      : null
    handleResponse(
      (
        await this.apiUpdateHolidayMode({
          Enabled: enabled,
          EndDate: utcEndDate
            ? {
                Day: utcEndDate.day,
                Hour: utcEndDate.hour,
                Minute: utcEndDate.minute,
                Month: utcEndDate.month,
                Second: utcEndDate.second,
                Year: utcEndDate.year,
              }
            : null,
          HMTimeZones: [{ Buildings: [buildingId] }],
          StartDate: utcStartDate
            ? {
                Day: utcStartDate.day,
                Hour: utcStartDate.hour,
                Minute: utcStartDate.minute,
                Month: utcStartDate.month,
                Second: utcStartDate.second,
                Year: utcStartDate.year,
              }
            : null,
        })
      ).data,
    )
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
    const expiry: string = this.getHomeySetting('expiry') ?? ''
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

  private setHomeySettings(settings: Partial<HomeySettings>): void {
    Object.entries(settings)
      .filter(
        ([setting, value]: [string, ValueOf<HomeySettings>]) =>
          value !== this.getHomeySetting(setting as keyof HomeySettings),
      )
      .forEach(([setting, value]: [string, ValueOf<HomeySettings>]) => {
        this.homey.settings.set(setting, value)
      })
  }
}
