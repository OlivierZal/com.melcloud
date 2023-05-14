import axios from 'axios'
import { DateTime, Duration, type DurationLikeObject, Settings } from 'luxon'
import { App, type Driver } from 'homey'
import {
  type SyncFromMode,
  type Building,
  type ErrorLogData,
  type ErrorLogPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type FrostProtectionSettings,
  type GetDeviceData,
  type HolidayModeData,
  type HolidayModePostData,
  type HolidayModeSettings,
  type ListDevice,
  type LoginCredentials,
  type LoginData,
  type LoginPostData,
  type MELCloudDevice,
  type PostData,
  type ReportData,
  type ReportPostData,
  type SetDeviceData,
  type SuccessData,
} from './types'

export default class MELCloudApp extends App {
  buildings!: Record<number, string>

  deviceList!: Array<ListDevice<MELCloudDevice>>
  deviceIds!: Record<number, string>
  loginTimeout!: NodeJS.Timeout
  syncInterval!: NodeJS.Timeout | null
  syncTimeout!: NodeJS.Timeout

  async onInit(): Promise<void> {
    Settings.defaultLocale = 'en-us'
    Settings.defaultZone = this.homey.clock.getTimezone()
    axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    axios.defaults.headers.common['X-MitsContextKey'] =
      this.homey.settings.get('ContextKey') ?? ''

    this.buildings = {}
    this.deviceIds = {}
    this.deviceList = []

    this.syncInterval = null
    await this.refreshLogin()
    await this.listDevices()
  }

  async login(loginCredentials: LoginCredentials): Promise<boolean> {
    this.clearLoginRefresh()
    try {
      const { username, password } = loginCredentials
      if (username === '' || password === '') {
        return false
      }
      const postData: LoginPostData = {
        AppVersion: '1.26.2.0',
        Email: username,
        Password: password,
        Persist: true,
      }
      this.log('Login...')
      const { data } = await axios.post<LoginData>(
        '/Login/ClientLogin',
        postData
      )
      this.log('Login:\n', data)
      if (data.LoginData?.ContextKey === undefined) {
        return false
      }
      axios.defaults.headers.common['X-MitsContextKey'] =
        data.LoginData.ContextKey
      this.setSettings({
        ContextKey: data.LoginData.ContextKey,
        Expiry: data.LoginData.Expiry,
        username,
        password,
      })
      this.applySyncFromDevices()
      await this.refreshLogin()
      return true
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error)
      this.error('Login:', errorMessage)
      throw new Error(errorMessage)
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
    const ms: number =
      expiry !== null
        ? Number(DateTime.fromISO(expiry).minus({ days: 1 }).diffNow())
        : 0
    if (ms > 0) {
      const maxTimeout: number = Math.pow(2, 31) - 1
      const interval: number = Math.min(ms, maxTimeout)
      this.loginTimeout = this.setTimeout(
        'login refresh',
        async (): Promise<void> => {
          await this.login(loginCredentials).catch(this.error)
        },
        interval,
        'days'
      )
      return
    }
    await this.login(loginCredentials).catch(this.error)
  }

  getFirstDeviceId({
    buildingId,
    driverId,
  }: {
    buildingId?: number
    driverId?: string
  } = {}): number {
    const deviceIds = this.getDeviceIds({ buildingId, driverId })
    if (deviceIds.length === 0) {
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
    return this.getDevices({ buildingId, driverId }).map(
      (device: MELCloudDevice): number => device.id
    )
  }

  getDevice(
    id: number,
    { buildingId, driverId }: { buildingId?: number; driverId?: string } = {}
  ): MELCloudDevice | undefined {
    return this.getDevices({ buildingId, driverId }).find(
      (device: MELCloudDevice): boolean => device.id === id
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
      driverId !== undefined
        ? [this.homey.drivers.getDriver(driverId)]
        : Object.values(this.homey.drivers.getDrivers())
    ).flatMap(
      (driver: Driver): MELCloudDevice[] =>
        driver.getDevices() as MELCloudDevice[]
    )
    if (buildingId !== undefined) {
      devices = devices.filter(
        (device: MELCloudDevice): boolean => device.buildingid === buildingId
      )
    }
    return devices
  }

  getDeviceFromList<T extends MELCloudDevice>(
    id: number
  ): ListDevice<T> | undefined {
    return this.deviceList.find(
      (device: ListDevice<T>): boolean => device.DeviceID === id
    )
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

  async listDevices<T extends MELCloudDevice>(
    deviceType?: number,
    syncMode?: SyncFromMode
  ): Promise<Array<ListDevice<T>>> {
    const buildings: Array<Building<T>> = await this.getBuildings().catch(
      (): Array<Building<T>> => []
    )
    let { devices, deviceIds, newBuildings } = buildings.reduce<{
      devices: Array<ListDevice<T>>
      deviceIds: Record<number, string>
      newBuildings: Record<number, string>
    }>(
      (acc, building: Building<T>) => {
        const buildingDevices: Array<ListDevice<T>> = [
          ...building.Structure.Devices,
          ...building.Structure.Areas.flatMap((area) => area.Devices),
          ...building.Structure.Floors.flatMap((floor) => [
            ...floor.Devices,
            ...floor.Areas.flatMap((area) => area.Devices),
          ]),
        ]
        const buildingDeviceIds: Record<number, string> =
          buildingDevices.reduce<Record<number, string>>(
            (deviceIds, device: ListDevice<T>) => ({
              ...deviceIds,
              [device.DeviceID]: device.DeviceName,
            }),
            {}
          )
        acc.devices.push(...buildingDevices)
        acc.deviceIds = { ...acc.deviceIds, ...buildingDeviceIds }
        acc.newBuildings[building.ID] = building.Name
        return acc
      },
      { devices: [], deviceIds: {}, newBuildings: {} }
    )
    if (deviceType !== undefined) {
      devices = devices.filter(
        (device: ListDevice<T>): boolean =>
          deviceType === device.Device.DeviceType
      )
    }
    this.buildings = newBuildings
    this.deviceIds = deviceIds
    this.deviceList = devices
    await this.syncDevicesFromList(syncMode).catch(this.error)
    await this.planSyncFromDevices()
    return devices
  }

  clearListDevicesRefresh(): void {
    this.homey.clearTimeout(this.syncTimeout)
    this.homey.clearInterval(this.syncInterval)
    this.syncInterval = null
    this.log('Device list refresh has been paused')
  }

  async getBuildings(): Promise<Array<Building<MELCloudDevice>>> {
    try {
      this.log('Searching for buildings...')
      const { data } = await axios.get<Array<Building<MELCloudDevice>>>(
        '/User/ListDevices'
      )
      this.log('Searching for buildings:\n', data)
      return data
    } catch (error: unknown) {
      const errorMessage: string =
        error instanceof Error ? error.message : String(error)
      this.error('Searching for buildings:', errorMessage)
      throw new Error(errorMessage)
    }
  }

  async syncDevicesFromList(syncMode?: SyncFromMode): Promise<void> {
    await Promise.all(
      this.getDevices().reduce<Array<Promise<void>>>(
        (syncDevices, device: MELCloudDevice) => {
          if (!device.isDiff()) {
            syncDevices.push(device.syncDeviceFromList(syncMode))
          }
          return syncDevices
        },
        []
      )
    )
  }

  async planSyncFromDevices(): Promise<void> {
    if (this.syncInterval !== null) {
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

  async getDeviceData<T extends MELCloudDevice>(
    device: T
  ): Promise<GetDeviceData<T> | null> {
    try {
      device.log('Syncing from device...')
      const { data } = await axios.get<GetDeviceData<T>>(
        `/Device/Get?id=${device.id}&buildingID=${device.buildingid}`
      )
      device.log('Syncing from device:\n', data)
      return data
    } catch (error: unknown) {
      device.error(
        'Syncing from device:',
        error instanceof Error ? error.message : error
      )
    }
    return null
  }

  async setDeviceData<T extends MELCloudDevice>(
    device: T,
    updateData: SetDeviceData<T>
  ): Promise<GetDeviceData<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: device.id,
        HasPendingCommand: true,
        ...updateData,
      }
      device.log('Syncing with device...\n', postData)
      const { data } = await axios.post<GetDeviceData<T>>(
        `/Device/Set${device.driver.heatPumpType}`,
        postData
      )
      device.log('Syncing with device:\n', data)
      return data
    } catch (error: unknown) {
      device.error(
        'Syncing with device:',
        error instanceof Error ? error.message : error
      )
    }
    return null
  }

  async reportEnergyCost<T extends MELCloudDevice>(
    device: T,
    fromDate: DateTime,
    toDate: DateTime
  ): Promise<ReportData<T> | null> {
    try {
      const postData: ReportPostData = {
        DeviceID: device.id,
        FromDate: fromDate.toISODate() ?? '',
        ToDate: toDate.toISODate() ?? '',
        UseCurrency: false,
      }
      device.log('Reporting energy...\n', postData)
      const { data } = await axios.post<ReportData<T>>(
        '/EnergyCost/Report',
        postData
      )
      device.log('Reporting energy:\n', data)
      return data
    } catch (error: unknown) {
      device.error(
        'Reporting energy:',
        error instanceof Error ? error.message : error
      )
    }
    return null
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
    this.log('Reporting error log...\n', postData)
    const { data } = await axios.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData
    )
    this.log('Reporting error log:\n', data)
    if ('AttributeErrors' in data) {
      this.handleFailure(data)
    }
    return data
  }

  async getFrostProtectionSettings(
    buildingId: number
  ): Promise<FrostProtectionData> {
    const buildingName: string = this.getBuildingName(buildingId)
    this.log(
      'Getting frost protection settings for building',
      buildingName,
      '...'
    )
    const buildingDeviceId: number = this.getFirstDeviceId({
      buildingId,
    })
    const { data } = await axios.get<FrostProtectionData>(
      `/FrostProtection/GetSettings?tableName=DeviceLocation&id=${buildingDeviceId}`
    )
    this.log(
      'Getting frost protection settings for building',
      buildingName,
      ':\n',
      data
    )
    return data
  }

  async updateFrostProtectionSettings(
    buildingId: number,
    settings: FrostProtectionSettings
  ): Promise<void> {
    const buildingName: string = this.getBuildingName(buildingId)
    const postData: FrostProtectionPostData = {
      ...settings,
      BuildingIds: [buildingId],
    }
    this.log(
      'Updating frost protection settings for building',
      buildingName,
      '...\n',
      postData
    )
    const { data } = await axios.post<SuccessData | FailureData>(
      '/FrostProtection/Update',
      postData
    )
    this.log(
      'Updating frost protection settings for building',
      buildingName,
      ':\n',
      data
    )
    this.handleResponse(data)
  }

  async getHolidayModeSettings(buildingId: number): Promise<HolidayModeData> {
    const buildingName: string = this.getBuildingName(buildingId)
    this.log('Getting holiday mode settings for building', buildingName, '...')
    const buildingDeviceId: number = this.getFirstDeviceId({
      buildingId,
    })
    const { data } = await axios.get<HolidayModeData>(
      `/HolidayMode/GetSettings?tableName=DeviceLocation&id=${buildingDeviceId}`
    )
    this.log(
      'Getting holiday mode settings for building',
      buildingName,
      ':\n',
      data
    )
    return data
  }

  async updateHolidayModeSettings(
    buildingId: number,
    settings: HolidayModeSettings
  ): Promise<void> {
    const buildingName: string = this.getBuildingName(buildingId)
    const { Enabled, StartDate, EndDate } = settings
    if (Enabled && (StartDate === '' || EndDate === '')) {
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
      StartDate:
        utcStartDate !== null
          ? {
              Year: utcStartDate.year,
              Month: utcStartDate.month,
              Day: utcStartDate.day,
              Hour: utcStartDate.hour,
              Minute: utcStartDate.minute,
              Second: utcStartDate.second,
            }
          : null,
      EndDate:
        utcEndDate !== null
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
    this.log(
      'Updating holiday mode settings for building',
      buildingName,
      '...\n',
      postData
    )
    const { data } = await axios.post<SuccessData | FailureData>(
      '/HolidayMode/Update',
      postData
    )
    this.log(
      'Updating holiday mode settings for building',
      buildingName,
      ':\n',
      data
    )
    this.handleResponse(data)
  }

  handleResponse(data: SuccessData | FailureData): void {
    if (data.AttributeErrors !== null) {
      this.handleFailure(data)
    }
  }

  handleFailure(data: FailureData): never {
    const errorMessage: string = Object.entries(data.AttributeErrors)
      .map(
        ([error, messages]: [string, string[]]): string =>
          `${error}: ${messages.join(', ')}`
      )
      .join('\n')
    throw new Error(errorMessage)
  }

  getBuildingName(buildingId: number): string {
    if (this.buildings[buildingId] === undefined) {
      throw new Error(this.homey.__('app.building.not_found', { buildingId }))
    }
    return this.buildings[buildingId]
  }

  setSettings(settings: Settings): void {
    Object.entries(settings).forEach(
      ([setting, value]: [string, any]): void => {
        if (value !== this.homey.settings.get(setting)) {
          this.homey.settings.set(setting, value)
        }
      }
    )
  }

  setInterval(
    type: string,
    callback: () => Promise<void>,
    interval: number | object,
    ...units: Array<keyof DurationLikeObject>
  ): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      'will run every',
      duration.shiftTo(...units).toHuman(),
      'starting',
      DateTime.now()
        .plus(duration)
        .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setInterval(callback, Number(duration))
  }

  setTimeout(
    type: string,
    callback: () => Promise<any>,
    interval: number | object,
    ...units: Array<keyof DurationLikeObject>
  ): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next',
      type,
      'will run in',
      duration.shiftTo(...units).toHuman(),
      'on',
      DateTime.now()
        .plus(duration)
        .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setTimeout(callback, Number(duration))
  }

  getLanguage(): string {
    return this.homey.i18n.getLanguage()
  }
}

module.exports = MELCloudApp
