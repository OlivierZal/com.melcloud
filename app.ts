import axios from 'axios'
import { DateTime, Duration, Settings } from 'luxon'
import { App } from 'homey'
import {
  Building,
  Data,
  ErrorLogData,
  ErrorLogPostData,
  FrostProtectionData,
  FrostProtectionPostData,
  HolidayModeData,
  HolidayModePostData,
  ListDevice,
  LoginCredentials,
  LoginData,
  LoginPostData,
  MELCloudDevice,
  PostData,
  ReportData,
  ReportPostData,
  UpdateData,
  UpdateSettingsData
} from './types'

export default class MELCloudApp extends App {
  buildings!: Record<Building<MELCloudDevice>['ID'], Building<MELCloudDevice>['Name']>
  loginTimeout!: NodeJS.Timeout

  async onInit (): Promise<void> {
    Settings.defaultZone = this.homey.clock.getTimezone()
    axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    axios.defaults.headers.common['X-MitsContextKey'] = this.homey.settings.get('ContextKey')

    this.buildings = {}
    await this.refreshLogin()
  }

  async refreshLogin (): Promise<void> {
    this.clearLoginRefresh()
    const loginCredentials: LoginCredentials = {
      username: this.homey.settings.get('username') ?? '',
      password: this.homey.settings.get('password') ?? ''
    }
    const expiry: string | null = this.homey.settings.get('Expiry')
    const ms: number = expiry !== null ? Number(DateTime.fromISO(expiry).minus({ days: 1 }).diffNow()) : 0
    if (ms > 0) {
      const maxTimeout: number = Math.pow(2, 31) - 1
      const interval: number = Math.min(ms, maxTimeout)
      this.loginTimeout = this.setTimeout('login refresh', async (): Promise<boolean> => await this.login(loginCredentials), interval)
    } else {
      await this.login(loginCredentials)
    }
  }

  clearLoginRefresh (): void {
    this.homey.clearTimeout(this.loginTimeout)
    this.log('Login refresh has been stopped')
  }

  async login (loginCredentials: LoginCredentials): Promise<boolean> {
    try {
      const { username, password } = loginCredentials
      if (username === '' && password === '') {
        return false
      }
      const postData: LoginPostData = {
        AppVersion: '1.9.3.0',
        Email: username,
        Password: password,
        Persist: true
      }
      this.log('Login to MELCloud...', postData)
      const { data } = await axios.post<LoginData>('/Login/ClientLogin', postData)
      this.log('Login to MELCloud:', data)
      if (data.LoginData?.ContextKey !== undefined) {
        this.homey.settings.set('ContextKey', data.LoginData.ContextKey)
        this.homey.settings.set('Expiry', data.LoginData.Expiry)
        axios.defaults.headers.common['X-MitsContextKey'] = data.LoginData.ContextKey
        if (username !== this.homey.settings.get('username')) {
          this.homey.settings.set('username', username)
        }
        if (password !== this.homey.settings.get('password')) {
          this.homey.settings.set('password', password)
        }
        await this.refreshLogin()
        return true
      }
    } catch (error: unknown) {
      this.error('Login to MELCloud:', error instanceof Error ? error.message : error)
    }
    return false
  }

  getDeviceIds (buildingId?: number): Array<MELCloudDevice['id']> {
    const devices: MELCloudDevice[] = buildingId !== undefined ? this.getDevices(buildingId) : this.getDevices()
    return devices.map((device: MELCloudDevice): MELCloudDevice['id'] => device.id)
  }

  getDevices (buildingId?: number): MELCloudDevice[] {
    const devices: MELCloudDevice[] = []
    for (const driver of Object.values(this.homey.drivers.getDrivers())) {
      for (const device of driver.getDevices()) {
        devices.push(device as MELCloudDevice)
      }
    }
    if (buildingId !== undefined) {
      return devices.filter((device: MELCloudDevice): boolean => device.buildingid === buildingId)
    }
    return devices
  }

  async getBuildings (): Promise<Array<Building<MELCloudDevice>>> {
    try {
      this.log('Searching for buildings...')
      const { data } = await axios.get<Array<Building<MELCloudDevice>>>('/User/ListDevices')
      this.log('Searching for buildings:', data)
      return data
    } catch (error: unknown) {
      this.error('Searching for buildings:', error instanceof Error ? error.message : error)
    }
    return []
  }

  async listDevices <T extends MELCloudDevice> (driver: T['driver']): Promise<Array<ListDevice<T>>> {
    const buildings: Array<Building<T>> = await this.getBuildings()
    const devices: Array<ListDevice<T>> = []
    for (const building of buildings) {
      if (!(building.ID in this.buildings) || this.buildings[building.ID] !== building.Name) {
        this.buildings[building.ID] = building.Name
      }
      for (const device of building.Structure.Devices) {
        if (driver.deviceType === device.Device.DeviceType) {
          devices.push(device)
        }
      }
      for (const floor of building.Structure.Floors) {
        for (const device of floor.Devices) {
          if (driver.deviceType === device.Device.DeviceType) {
            devices.push(device)
          }
        }
        for (const area of floor.Areas) {
          for (const device of area.Devices) {
            if (driver.deviceType === device.Device.DeviceType) {
              devices.push(device)
            }
          }
        }
      }
      for (const area of building.Structure.Areas) {
        for (const device of area.Devices) {
          if (driver.deviceType === device.Device.DeviceType) {
            devices.push(device)
          }
        }
      }
    }
    return devices
  }

  async getDevice <T extends MELCloudDevice> (device: T): Promise<Data<T> | null> {
    try {
      device.log('Syncing from device...')
      const { data } = await axios.get<Data<T>>(`/Device/Get?id=${device.id}&buildingID=${device.buildingid}`)
      device.log('Syncing from device:', data)
      return data
    } catch (error: unknown) {
      device.error('Syncing from device:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async setDevice <T extends MELCloudDevice> (device: T, updateData: UpdateData<T>): Promise<Data<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: device.id,
        HasPendingCommand: true,
        ...updateData
      }
      device.log('Syncing with device...', postData)
      const { data } = await axios.post<Data<T>>(`/Device/Set${device.driver.heatPumpType}`, postData)
      device.log('Syncing with device:', data)
      return data
    } catch (error: unknown) {
      device.error('Syncing with device:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async reportEnergyCost <T extends MELCloudDevice> (device: T, fromDate: DateTime, toDate: DateTime): Promise<ReportData<T> | null> {
    try {
      const postData: ReportPostData<T> = {
        DeviceID: device.id,
        FromDate: fromDate.toISODate(),
        ToDate: toDate.toISODate(),
        UseCurrency: false
      }
      device.log('Reporting energy cost...', postData)
      const { data } = await axios.post<ReportData<T>>('/EnergyCost/Report', postData)
      device.log('Reporting energy cost:', data)
      return data
    } catch (error: unknown) {
      device.error('Reporting energy cost:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async setDeviceSettings (settings: Settings): Promise<boolean> {
    const changedKeys: string[] = Object.keys(settings)
    if (changedKeys.length === 0) {
      return false
    }
    for (const device of this.getDevices()) {
      await device.setSettings(settings)
      await device.onSettings({ newSettings: device.getSettings(), changedKeys })
    }
    return true
  }

  async getUnitErrorLog (): Promise<ErrorLogData | null> {
    try {
      const postData: ErrorLogPostData = {
        DeviceIDs: this.getDeviceIds(),
        Duration: Math.round(Math.abs(Number(DateTime.local(1970).diffNow('days').toObject().days)))
      }
      this.log('Reporting error log...', postData)
      const { data } = await axios.post<ErrorLogData>('/Report/GetUnitErrorLog2', postData)
      this.log('Reporting error log:', data)
      return data
    } catch (error: unknown) {
      this.error('Reporting error log:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async getFrostProtectionSettings (buildingId: number): Promise<FrostProtectionData | null> {
    if (!(buildingId in this.buildings)) {
      this.error(`Building ${buildingId} does not exist`)
      return null
    }
    const buildingName: Building<MELCloudDevice>['Name'] = this.buildings[buildingId]

    try {
      const buildingDeviceIds: Array<MELCloudDevice['id']> = this.getDeviceIds(buildingId)
      if (buildingDeviceIds.length === 0) {
        throw new Error(`building ${buildingId} has no device`)
      }
      this.log(`Getting frost protection settings for building ${buildingName}...`)
      const { data } = await axios.get<FrostProtectionData>(`/FrostProtection/GetSettings?tableName=DeviceLocation&id=${buildingDeviceIds[0]}`)
      this.log(`Getting frost protection settings for building ${buildingName}:`, data)
      return data
    } catch (error: unknown) {
      this.error(`Getting frost protection settings for building ${buildingName}:`, error instanceof Error ? error.message : error)
    }
    return null
  }

  async updateFrostProtectionSettings (buildingId: number, enabled: boolean, minimumTemperature: number, maximumTemperature: number): Promise<boolean> {
    if (!(buildingId in this.buildings)) {
      this.error(`Building ${buildingId} does not exist`)
      return false
    }
    const buildingName: Building<MELCloudDevice>['Name'] = this.buildings[buildingId]

    try {
      const postData: FrostProtectionPostData = {
        Enabled: enabled,
        MinimumTemperature: minimumTemperature,
        MaximumTemperature: maximumTemperature,
        BuildingIds: [
          buildingId
        ]
      }
      this.log(`Updating frost protection settings for building ${buildingName}...`, postData)
      const { data } = await axios.post<UpdateSettingsData>('/FrostProtection/Update', postData)
      this.log(`Updating frost protection settings for building ${buildingName}:`, data)
      if (!data.Success && data.AttributeErrors !== null) {
        let errorMessage: string = ''
        for (const [error, messages] of Object.entries(data.AttributeErrors)) {
          errorMessage += `${error}: `
          for (const message of messages) {
            errorMessage += `${message}, `
          }
          errorMessage = `${errorMessage.slice(0, -2)}; `
        }
        throw new Error(errorMessage.slice(0, -2))
      }
      return data.Success
    } catch (error: unknown) {
      this.error(`Updating frost protection settings for building ${buildingName}:`, error instanceof Error ? error.message : error)
    }
    return false
  }

  async getHolidayModeSettings (buildingId: number): Promise<HolidayModeData | null> {
    if (!(buildingId in this.buildings)) {
      this.error(`Building ${buildingId} does not exist`)
      return null
    }
    const buildingName: Building<MELCloudDevice>['Name'] = this.buildings[buildingId]

    try {
      const buildingDeviceIds: Array<MELCloudDevice['id']> = this.getDeviceIds(buildingId)
      if (buildingDeviceIds.length === 0) {
        throw new Error(`building ${buildingId} has no device`)
      }
      this.log(`Getting holiday mode settings for building ${buildingName}...`)
      const { data } = await axios.get<HolidayModeData>(`/HolidayMode/GetSettings?tableName=DeviceLocation&id=${buildingDeviceIds[0]}`)
      this.log(`Getting holiday mode settings for building ${buildingName}:`, data)
      return data
    } catch (error: unknown) {
      this.error(`Getting holiday mode settings for building ${buildingName}:`, error instanceof Error ? error.message : error)
    }
    return null
  }

  async updateHolidayModeSettings (buildingId: number, enabled: boolean, utcStartDate: DateTime | null, utcEndDate: DateTime | null): Promise<boolean> {
    if (!(buildingId in this.buildings)) {
      this.error(`Building ${buildingId} does not exist`)
      return false
    }
    const buildingName: Building<MELCloudDevice>['Name'] = this.buildings[buildingId]

    try {
      if (enabled && (utcStartDate === null || utcEndDate === null)) {
        throw new Error('Date: Missing')
      }
      const postData: HolidayModePostData = {
        Enabled: enabled,
        StartDate: utcStartDate !== null
          ? {
              Year: utcStartDate.year,
              Month: utcStartDate.month,
              Day: utcStartDate.day,
              Hour: utcStartDate.hour,
              Minute: utcStartDate.minute,
              Second: utcStartDate.second
            }
          : null,
        EndDate: utcEndDate !== null
          ? {
              Year: utcEndDate.year,
              Month: utcEndDate.month,
              Day: utcEndDate.day,
              Hour: utcEndDate.hour,
              Minute: utcEndDate.minute,
              Second: utcEndDate.second
            }
          : null,
        HMTimeZones: [
          {
            Buildings: [
              buildingId
            ]
          }
        ]
      }
      this.log(`Updating holiday mode settings for building ${buildingName}...`, postData)
      const { data } = await axios.post<UpdateSettingsData>('/HolidayMode/Update', postData)
      this.log(`Updating holiday mode settings for building ${buildingName}:`, data)
      if (!data.Success && data.AttributeErrors !== null) {
        let errorMessage: string = ''
        for (const [error, messages] of Object.entries(data.AttributeErrors)) {
          errorMessage += `${error}: `
          for (const message of messages) {
            errorMessage += `${message}, `
          }
          errorMessage = `${errorMessage.slice(0, -2)}; `
        }
        throw new Error(errorMessage.slice(0, -2))
      }
      return data.Success
    } catch (error: unknown) {
      this.error(`Updating holiday mode settings for building ${buildingName}:`, error instanceof Error ? error.message : error)
    }
    return false
  }

  setTimeout (type: string, callback: Function, interval: number | object): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next', type, 'will run in', duration.shiftTo('days').toHuman(),
      'on', DateTime.now().plus(duration).toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setTimeout(callback, Number(duration))
  }
}

module.exports = MELCloudApp
