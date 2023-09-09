import 'source-map-support/register'
import { App, type Driver } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import axios from 'axios'
import { DateTime, Settings as LuxonSettings } from 'luxon'
import { WithAPIAndLogging } from './mixins'
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

axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'

function handleFailure(data: FailureData): never {
  const errorMessage: string = Object.entries(data.AttributeErrors)
    .map(
      ([error, messages]: [string, string[]]): string =>
        `${error}: ${messages.join(', ')}`
    )
    .join('\n')
  throw new Error(errorMessage)
}

function handleResponse(data: SuccessData | FailureData): void {
  if (data.AttributeErrors) {
    handleFailure(data)
  }
}

export = class MELCloudApp extends WithAPIAndLogging(App) {
  deviceList: ListDeviceAny[] = []

  deviceIds: Record<number, string> = {}

  loginTimeout!: NodeJS.Timeout

  syncInterval: NodeJS.Timeout | null = null

  syncTimeout!: NodeJS.Timeout

  async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.refreshLogin()
    await this.listDevices()
  }

  async login(loginCredentials: LoginCredentials): Promise<boolean> {
    this.clearLoginRefresh()
    try {
      const { username, password } = loginCredentials
      if (!username || !password) {
        return false
      }
      const postData: LoginPostData = {
        AppVersion: '1.27.6.0',
        Email: username,
        Password: password,
        Persist: true,
      }
      const { data } = await this.api.post<LoginData>(
        '/Login/ClientLogin',
        postData
      )
      if (!data.LoginData?.ContextKey) {
        return false
      }
      const { ContextKey, Expiry } = data.LoginData
      this.setSettings({
        ContextKey,
        Expiry,
        username,
        password,
      })
      this.applySyncFromDevices()
      await this.refreshLogin()
      return true
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : String(error))
    }
  }

  clearLoginRefresh(): void {
    this.homey.clearTimeout(this.loginTimeout)
    this.log('Login refresh has been paused')
  }

  async refreshLogin(): Promise<void> {
    const loginCredentials: LoginCredentials = {
      username: this.homey.settings.get('username') ?? '',
      password: this.homey.settings.get('password') ?? '',
    }
    const expiry: string | null = this.homey.settings.get('Expiry')
    const ms: number = expiry
      ? Number(DateTime.fromISO(expiry).minus({ days: 1 }).diffNow())
      : 0
    if (ms) {
      const maxTimeout: number = 2 ** 31 - 1
      const interval: number = Math.min(ms, maxTimeout)
      this.loginTimeout = this.setTimeout(
        'login refresh',
        async (): Promise<void> => {
          await this.login(loginCredentials).catch((error: Error): void => {
            this.error(error.message)
          })
        },
        interval,
        'days'
      )
      return
    }
    await this.login(loginCredentials).catch((error: Error): void => {
      this.error(error.message)
    })
  }

  getFirstDeviceId({
    buildingId,
    driverId,
  }: {
    buildingId?: number
    driverId?: string
  } = {}): number {
    const deviceIds = this.getDeviceIds({ buildingId, driverId })
    if (!deviceIds.length) {
      throw new Error(this.homey.__('app.building.no_device', { buildingId }))
    }
    return deviceIds[0]
  }

  getDeviceIds({
    buildingId,
    driverId,
  }: {
    buildingId?: number
    driverId?: string
  } = {}): number[] {
    return this.getDevices({ buildingId, driverId }).map(({ id }): number => id)
  }

  getDevice(
    deviceId: number,
    { buildingId, driverId }: { buildingId?: number; driverId?: string } = {}
  ): MELCloudDevice | undefined {
    return this.getDevices({ buildingId, driverId }).find(
      ({ id }) => id === deviceId
    )
  }

  getDevices({
    buildingId,
    driverId,
  }: {
    buildingId?: number
    driverId?: string
  } = {}): MELCloudDevice[] {
    let devices: MELCloudDevice[] = (
      driverId
        ? [this.homey.drivers.getDriver(driverId)]
        : Object.values(this.homey.drivers.getDrivers())
    ).flatMap(
      (driver: Driver): MELCloudDevice[] =>
        driver.getDevices() as MELCloudDevice[]
    )
    if (buildingId) {
      devices = devices.filter(({ buildingid }) => buildingid === buildingId)
    }
    return devices
  }

  applySyncFromDevices(deviceType?: number, syncMode?: SyncFromMode): void {
    this.clearListDevicesRefresh()
    this.syncTimeout = this.setTimeout(
      'sync with device',
      async (): Promise<void> => {
        await this.listDevices(deviceType, syncMode)
      },
      { seconds: 1 },
      'seconds'
    )
  }

  async listDevices(
    deviceType?: number,
    syncMode?: SyncFromMode
  ): Promise<ListDeviceAny[]> {
    const buildings: Building[] = await this.getBuildings().catch(
      (): Building[] => []
    )
    const buildingData: {
      deviceIds: Record<number, string>
      deviceList: ListDeviceAny[]
    } = buildings.reduce<{
      deviceIds: Record<number, string>
      deviceList: ListDeviceAny[]
    }>(
      (acc, { Structure: { Devices, Areas, Floors } }) => {
        const buildingDevices: ListDeviceAny[] = [
          ...Devices,
          ...Areas.flatMap((area): ListDeviceAny[] => area.Devices),
          ...Floors.flatMap((floor): ListDeviceAny[] => [
            ...floor.Devices,
            ...floor.Areas.flatMap((area): ListDeviceAny[] => area.Devices),
          ]),
        ]
        const buildingDeviceIds: Record<number, string> = Object.fromEntries(
          buildingDevices.map((device: ListDeviceAny): [number, string] => [
            device.DeviceID,
            device.DeviceName,
          ])
        )
        acc.deviceIds = { ...acc.deviceIds, ...buildingDeviceIds }
        acc.deviceList.push(...buildingDevices)
        return acc
      },
      { deviceIds: {}, deviceList: [] }
    )
    let { deviceList } = buildingData
    if (deviceType) {
      deviceList = deviceList.filter(
        (device: ListDeviceAny) => deviceType === device.Device.DeviceType
      )
    }
    this.deviceList = deviceList
    this.deviceIds = buildingData.deviceIds
    await this.syncDevicesFromList(syncMode).catch((error: Error): void => {
      this.error(error.message)
    })
    this.planSyncFromDevices()
    return deviceList
  }

  clearListDevicesRefresh(): void {
    this.homey.clearTimeout(this.syncTimeout)
    this.homey.clearInterval(this.syncInterval)
    this.syncInterval = null
    this.log('Device list refresh has been paused')
  }

  async getBuildings(): Promise<Building[]> {
    try {
      const { data } = await this.api.get<Building[]>('/User/ListDevices')
      return data
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : String(error))
    }
  }

  async syncDevicesFromList(syncMode?: SyncFromMode): Promise<void> {
    await Promise.all(
      this.getDevices()
        .filter((device: MELCloudDevice) => !device.isDiff())
        .map(
          (device: MELCloudDevice): Promise<void> =>
            device.syncDeviceFromList(syncMode)
        )
    )
  }

  planSyncFromDevices(): void {
    if (this.syncInterval) {
      return
    }
    this.syncInterval = this.setInterval(
      'device list refresh',
      async (): Promise<void> => {
        await this.listDevices()
      },
      { minutes: 3 },
      'minutes'
    )
  }

  async getUnitErrorLog(
    fromDate: DateTime,
    toDate: DateTime
  ): Promise<ErrorLogData[]> {
    const postData: ErrorLogPostData = {
      DeviceIDs: Object.keys(this.deviceIds),
      FromDate: fromDate.toISODate() ?? '',
      ToDate: toDate.toISODate() ?? '',
    }
    const { data } = await this.api.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData
    )
    if ('AttributeErrors' in data) {
      handleFailure(data)
    }
    return data
  }

  async getFrostProtectionSettings(
    buildingId: number
  ): Promise<FrostProtectionData> {
    const buildingDeviceId: number = this.getFirstDeviceId({
      buildingId,
    })
    const { data } = await this.api.get<FrostProtectionData>(
      `/FrostProtection/GetSettings?tableName=DeviceLocation&id=${buildingDeviceId}`
    )
    return data
  }

  async updateFrostProtectionSettings(
    buildingId: number,
    settings: FrostProtectionSettings
  ): Promise<void> {
    const postData: FrostProtectionPostData = {
      ...settings,
      BuildingIds: [buildingId],
    }
    const { data } = await this.api.post<SuccessData | FailureData>(
      '/FrostProtection/Update',
      postData
    )
    handleResponse(data)
  }

  async getHolidayModeSettings(buildingId: number): Promise<HolidayModeData> {
    const buildingDeviceId: number = this.getFirstDeviceId({
      buildingId,
    })
    const { data } = await this.api.get<HolidayModeData>(
      `/HolidayMode/GetSettings?tableName=DeviceLocation&id=${buildingDeviceId}`
    )
    return data
  }

  async updateHolidayModeSettings(
    buildingId: number,
    settings: HolidayModeSettings
  ): Promise<void> {
    const { Enabled, StartDate, EndDate } = settings
    if (Enabled && (!StartDate || !EndDate)) {
      throw new Error(this.homey.__('app.holiday_mode.date_missing'))
    }
    const utcStartDate: DateTime | null = Enabled
      ? DateTime.fromISO(StartDate).toUTC()
      : null
    const utcEndDate: DateTime | null = Enabled
      ? DateTime.fromISO(EndDate).toUTC()
      : null
    const postData: HolidayModePostData = {
      Enabled,
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
    }
    const { data } = await this.api.post<SuccessData | FailureData>(
      '/HolidayMode/Update',
      postData
    )
    handleResponse(data)
  }

  setSettings(settings: Partial<HomeySettings>): void {
    Object.entries(settings)
      .filter(
        ([setting, value]: [string, HomeySettingValue]) =>
          value !== this.homey.settings.get(setting)
      )
      .forEach(([setting, value]: [string, HomeySettingValue]): void => {
        this.homey.settings.set(setting, value)
      })
  }

  getLanguage(): string {
    return this.homey.i18n.getLanguage()
  }
}
