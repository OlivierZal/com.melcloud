import 'source-map-support/register'
import { App, type Driver } from 'homey'
import type {
  Building,
  DeviceLookup,
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
  ValueOf,
} from './types'
import { DateTime, Settings as LuxonSettings } from 'luxon'
import axios from 'axios'
import withAPI from './mixins/withAPI'
import withTimers from './mixins/withTimers'

const DEFAULT_DEVICES_PER_TYPE: DeviceLookup['devicesPerType'] = {
  0: [],
  1: [],
  3: [],
}
const MAX_INT32 = 2147483647
const NO_TIME_DIFF = 0

axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'

const getErrorMessage = (error: unknown): string =>
  axios.isAxiosError(error) || error instanceof Error
    ? error.message
    : String(error)

const flattenDevices = (
  flattenedDevices: DeviceLookup,
  devices: readonly ListDevice<MELCloudDriver>[],
): DeviceLookup =>
  devices.reduce<DeviceLookup>(
    (acc, device) => {
      acc.devicesPerId[device.DeviceID] = device
      const type: HeatPumpType = device.Device.DeviceType
      if (!(type in acc.devicesPerType)) {
        acc.devicesPerType[type] = []
      }
      acc.devicesPerType[type].push(device)
      return acc
    },
    {
      devicesPerId: { ...flattenedDevices.devicesPerId },
      devicesPerType: { ...flattenedDevices.devicesPerType },
    },
  )

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
  #devicesPerId: Record<number, ListDevice<MELCloudDriver>> = {}

  #devicesPerType: Record<string, readonly ListDevice<MELCloudDriver>[]> = {}

  #holdAPIListUntil: DateTime = DateTime.now()

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  #loginTimeout!: NodeJS.Timeout

  #syncInterval: NodeJS.Timeout | null = null

  public get devicesPerId(): Record<number, ListDevice<MELCloudDriver>> {
    return this.#devicesPerId
  }

  public get devicesPerType(): Record<
    string,
    readonly ListDevice<MELCloudDriver>[]
  > {
    return this.#devicesPerType
  }

  public get holdAPIListUntil(): DateTime {
    return this.#holdAPIListUntil
  }

  public set holdAPIListUntil(value: DateTime) {
    this.#holdAPIListUntil = value
  }

  public get retry(): boolean {
    return this.#retry
  }

  public set retry(value: boolean) {
    this.#retry = value
  }

  public get retryTimeout(): NodeJS.Timeout {
    return this.#retryTimeout
  }

  public set retryTimeout(value: NodeJS.Timeout) {
    this.#retryTimeout = value
  }

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

  public async runSyncFromDevices(): Promise<void> {
    this.clearSyncFromDevices()
    await this.syncDevicesFromList()
    this.#syncInterval = this.setInterval(
      async (): Promise<void> => {
        await this.syncDevicesFromList()
      },
      { minutes: 5 },
      { actionType: 'sync with device', units: ['minutes'] },
    )
  }

  public clearSyncFromDevices(): void {
    this.homey.clearInterval(this.#syncInterval)
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
      DeviceIDs: Object.keys(this.#devicesPerId),
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

  private async syncDevicesFromList(): Promise<void> {
    try {
      const { devicesPerId, devicesPerType } = (
        await this.getBuildings()
      ).reduce<DeviceLookup>(
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
        { devicesPerId: {}, devicesPerType: DEFAULT_DEVICES_PER_TYPE },
      )
      this.#devicesPerId = devicesPerId
      this.#devicesPerType = devicesPerType
    } catch (error: unknown) {
      this.#devicesPerType = DEFAULT_DEVICES_PER_TYPE
    } finally {
      await this.syncDevices()
    }
  }

  private async planRefreshLogin(): Promise<void> {
    const expiry: string = this.getHomeySetting('expiry') ?? ''
    const ms: number = DateTime.fromISO(expiry)
      .minus({ days: 1 })
      .diffNow()
      .as('milliseconds')
    if (ms > NO_TIME_DIFF) {
      if (!this.#syncInterval) {
        await this.runSyncFromDevices()
      }
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
    const [firstDeviceId]: number[] = deviceIds
    return firstDeviceId
  }

  private getDeviceIds({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): number[] {
    return this.getDevices({ buildingId, driverId }).map(({ id }): number => id)
  }

  private async syncDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device: MELCloudDevice): Promise<void> => {
        await device.syncFromDevice()
      }),
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
