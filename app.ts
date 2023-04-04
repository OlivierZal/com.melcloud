import axios from 'axios'
import { DateTime, Duration, type DurationLikeObject, Settings } from 'luxon'
import { App, type Driver } from 'homey'
import {
  type SyncFromMode,
  type Building,
  type Data,
  type ErrorLogData,
  type ErrorLogPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type FrostProtectionSettings,
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
  type SuccessData,
  type UpdateData
} from './types'

export default class MELCloudApp extends App {
  locale!: string
  buildings!: Record<
    Building<MELCloudDevice>['ID'],
    Building<MELCloudDevice>['Name']
  >

  deviceList!: Array<ListDevice<MELCloudDevice>>
  deviceIds!: Array<MELCloudDevice['id']>
  loginTimeout!: NodeJS.Timeout
  syncInterval!: NodeJS.Timeout | null
  syncTimeout!: NodeJS.Timeout

  async onInit(): Promise<void> {
    this.locale = this.homey.i18n.getLanguage()
    Settings.defaultLocale = 'en-us'
    Settings.defaultZone = this.homey.clock.getTimezone()
    axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    axios.defaults.headers.common['X-MitsContextKey'] =
      this.homey.settings.get('ContextKey') ?? ''

    this.buildings = {}
    this.deviceIds = []
    this.deviceList = []

    this.syncInterval = null
    await this.refreshLogin()
    await this.listDevices()
  }

  async login(loginCredentials: LoginCredentials): Promise<boolean> {
    this.clearLoginRefresh()
    try {
      const { username, password } = loginCredentials
      if (username === '' && password === '') {
        return false
      }
      const postData: LoginPostData = {
        AppVersion: '1.26.2.0',
        Email: username,
        Password: password,
        Persist: true
      }
      this.log('Login...')
      const { data } = await axios.post<LoginData>(
        '/Login/ClientLogin',
        postData
      )
      this.log('Login:\n', data)
      if (data.LoginData?.ContextKey !== undefined) {
        axios.defaults.headers.common['X-MitsContextKey'] =
          data.LoginData.ContextKey
        this.setSettings({
          ContextKey: data.LoginData.ContextKey,
          Expiry: data.LoginData.Expiry,
          username,
          password
        })
        this.applySyncFromDevices()
        await this.refreshLogin()
        return true
      }
    } catch (error: unknown) {
      this.error('Login:', error instanceof Error ? error.message : error)
    }
    return false
  }

  clearLoginRefresh(): void {
    this.homey.clearTimeout(this.loginTimeout)
    this.log('Login refresh has been paused')
  }

  async refreshLogin(): Promise<void> {
    const loginCredentials: LoginCredentials = {
      username: this.homey.settings.get('username') ?? '',
      password: this.homey.settings.get('password') ?? ''
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
        async (): Promise<boolean> => await this.login(loginCredentials),
        interval,
        'days'
      )
      return
    }
    await this.login(loginCredentials)
  }

  getFirstDeviceId(
    { buildingId, driverId }: { buildingId?: number; driverId?: string } = {},
    safe: boolean = true
  ): MELCloudDevice['id'] {
    return this.getDeviceIds({ buildingId, driverId }, safe)[0]
  }

  getDeviceIds(
    { buildingId, driverId }: { buildingId?: number; driverId?: string } = {},
    safe: boolean = true
  ): Array<MELCloudDevice['id']> {
    return this.getDevices({ buildingId, driverId }, safe).map(
      (device: MELCloudDevice): MELCloudDevice['id'] => device.id
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

  getDevices(
    { buildingId, driverId }: { buildingId?: number; driverId?: string } = {},
    safe: boolean = true
  ): MELCloudDevice[] {
    const drivers: Driver[] =
      driverId !== undefined
        ? [this.homey.drivers.getDriver(driverId)]
        : Object.values(this.homey.drivers.getDrivers())
    let devices: MELCloudDevice[] = []
    for (const driver of drivers) {
      for (const device of driver.getDevices()) {
        devices.push(device as MELCloudDevice)
      }
    }
    if (buildingId !== undefined) {
      devices = devices.filter(
        (device: MELCloudDevice): boolean => device.buildingid === buildingId
      )
      if (!safe && devices.length === 0) {
        throw new Error(this.homey.__('app.building.no_device', { buildingId }))
      }
    }
    return devices
  }

  getDeviceFromList<T extends MELCloudDevice>(
    id: number
  ): ListDevice<T> | null {
    return (
      this.deviceList.find(
        (device: ListDevice<T>): boolean => device.DeviceID === id
      ) ?? null
    )
  }

  applySyncFromDevices(
    deviceType?: number,
    syncMode: SyncFromMode = 'refresh'
  ): void {
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
    syncMode: SyncFromMode = 'refresh'
  ): Promise<Array<ListDevice<T>>> {
    const buildings: Array<Building<T>> = await this.getBuildings()
    const newBuildings: Record<
      Building<MELCloudDevice>['ID'],
      Building<MELCloudDevice>['Name']
    > = {}
    let devices: Array<ListDevice<T>> = []
    for (const building of buildings) {
      newBuildings[building.ID] = building.Name
      devices.push(...building.Structure.Devices)
      for (const floor of building.Structure.Floors) {
        devices.push(...floor.Devices)
        for (const area of floor.Areas) {
          devices.push(...area.Devices)
        }
      }
      for (const area of building.Structure.Areas) {
        devices.push(...area.Devices)
      }
    }
    if (deviceType !== undefined) {
      devices = devices.filter(
        (device: ListDevice<T>): boolean =>
          deviceType === device.Device.DeviceType
      )
    }
    this.buildings = newBuildings
    this.deviceIds = devices.map(
      (device: ListDevice<T>): MELCloudDevice['id'] => device.DeviceID
    )
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
      this.error(
        'Searching for buildings:',
        error instanceof Error ? error.message : error
      )
    }
    return []
  }

  async syncDevicesFromList(syncMode: SyncFromMode): Promise<void> {
    for (const device of this.getDevices()) {
      if (!device.isDiff()) {
        await device.syncDeviceFromList(syncMode)
      }
    }
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
  ): Promise<Data<T> | null> {
    try {
      device.log('Syncing from device...')
      const { data } = await axios.get<Data<T>>(
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
    updateData: UpdateData<T>
  ): Promise<Data<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: device.id,
        HasPendingCommand: true,
        ...updateData
      }
      device.log('Syncing with device...\n', postData)
      const { data } = await axios.post<Data<T>>(
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
      const postData: ReportPostData<T> = {
        DeviceID: device.id,
        FromDate: fromDate.toISODate() ?? '',
        ToDate: toDate.toISODate() ?? '',
        UseCurrency: false
      }
      device.log('Reporting energy cost...\n', postData)
      const { data } = await axios.post<ReportData<T>>(
        '/EnergyCost/Report',
        postData
      )
      device.log('Reporting energy cost:\n', data)
      return data
    } catch (error: unknown) {
      device.error(
        'Reporting energy cost:',
        error instanceof Error ? error.message : error
      )
    }
    return null
  }

  async setDeviceSettings(
    settings: Settings,
    driverId?: string
  ): Promise<boolean> {
    const changedKeys: string[] = Object.keys(settings)
    if (changedKeys.length === 0) {
      return true
    }
    try {
      for (const device of this.getDevices({ driverId })) {
        await device.setSettings(settings)
        await device.onSettings({
          newSettings: device.getSettings(),
          changedKeys
        })
      }
      return true
    } catch (error: unknown) {
      this.error(error instanceof Error ? error.message : error)
    }
    return false
  }

  async getUnitErrorLog(
    fromDate: DateTime,
    toDate: DateTime
  ): Promise<ErrorLogData[] | boolean> {
    const postData: ErrorLogPostData = {
      DeviceIDs: this.deviceIds,
      FromDate: fromDate.toISODate() ?? '',
      ToDate: toDate.toISODate() ?? ''
    }
    this.log('Reporting error log...\n', postData)
    const { data } = await axios.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData
    )
    this.log('Reporting error log:\n', data)
    if ('Success' in data) {
      return this.handleFailure(data)
    }
    return data
  }

  async getFrostProtectionSettings(
    buildingId: number
  ): Promise<FrostProtectionData> {
    if (!(buildingId in this.buildings)) {
      throw new Error(this.homey.__('app.building.not_found', { buildingId }))
    }
    const buildingName: Building<MELCloudDevice>['Name'] =
      this.buildings[buildingId]
    this.log(
      'Getting frost protection settings for building',
      buildingName,
      '...'
    )
    const buildingDeviceId: MELCloudDevice['id'] = this.getFirstDeviceId(
      { buildingId },
      false
    )
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
  ): Promise<boolean> {
    if (!(buildingId in this.buildings)) {
      throw new Error(this.homey.__('app.building.not_found', { buildingId }))
    }
    const buildingName: Building<MELCloudDevice>['Name'] =
      this.buildings[buildingId]
    const postData: FrostProtectionPostData = {
      ...settings,
      BuildingIds: [buildingId]
    }
    this.log(
      'Updating frost protection settings for building',
      buildingName,
      '...\n',
      postData
    )
    const { data } = await axios.post<SuccessData>(
      '/FrostProtection/Update',
      postData
    )
    this.log(
      'Updating frost protection settings for building',
      buildingName,
      ':\n',
      data
    )
    return this.handleFailure(data)
  }

  async getHolidayModeSettings(buildingId: number): Promise<HolidayModeData> {
    if (!(buildingId in this.buildings)) {
      throw new Error(this.homey.__('app.building.not_found', { buildingId }))
    }
    const buildingName: Building<MELCloudDevice>['Name'] =
      this.buildings[buildingId]
    this.log('Getting holiday mode settings for building', buildingName, '...')
    const buildingDeviceId: MELCloudDevice['id'] = this.getFirstDeviceId(
      { buildingId },
      false
    )
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
  ): Promise<boolean> {
    if (!(buildingId in this.buildings)) {
      throw new Error(this.homey.__('app.building.not_found', { buildingId }))
    }
    const buildingName: Building<MELCloudDevice>['Name'] =
      this.buildings[buildingId]
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
              Second: utcStartDate.second
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
              Second: utcEndDate.second
            }
          : null,
      HMTimeZones: [{ Buildings: [buildingId] }]
    }
    this.log(
      'Updating holiday mode settings for building',
      buildingName,
      '...\n',
      postData
    )
    const { data } = await axios.post<SuccessData>(
      '/HolidayMode/Update',
      postData
    )
    this.log(
      'Updating holiday mode settings for building',
      buildingName,
      ':\n',
      data
    )
    return this.handleFailure(data)
  }

  handleFailure(data: SuccessData): boolean {
    if (data.Success || data.AttributeErrors === null) {
      return data.Success
    }
    let errorMessage: string = ''
    for (const [error, messages] of Object.entries(data.AttributeErrors)) {
      errorMessage += `${error}: `
      for (const message of messages) {
        errorMessage += `${message} `
      }
      errorMessage = `${errorMessage.slice(0, -1)}\n`
    }
    throw new Error(errorMessage.slice(0, -1))
  }

  setSettings(settings: Settings): void {
    for (const [setting, value] of Object.entries(settings)) {
      if (value !== this.homey.settings.get(setting)) {
        this.homey.settings.set(setting, value)
      }
    }
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
}

module.exports = MELCloudApp
