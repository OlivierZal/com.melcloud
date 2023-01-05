import axios from 'axios'
import { DateTime, Duration, Settings } from 'luxon'
import { App } from 'homey'
import {
  Building,
  Data,
  ErrorLogData,
  ErrorLogPostData,
  ListDevice,
  LoginCredentials,
  LoginData,
  LoginPostData,
  MELCloudDevice,
  PostData,
  ReportData,
  ReportPostData,
  UpdateData
} from './types'

export default class MELCloudApp extends App {
  loginTimeout!: NodeJS.Timeout

  async onInit (): Promise<void> {
    Settings.defaultZone = this.homey.clock.getTimezone()
    axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    axios.defaults.headers.common['X-MitsContextKey'] = this.homey.settings.get('ContextKey')
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
    try {
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

  async listDevices <T extends MELCloudDevice> (driver: T['driver']): Promise<Array<ListDevice<T>>> {
    const devices: Array<ListDevice<T>> = []
    driver.log('Searching for devices...')
    try {
      const { data } = await axios.get<Array<Building<T>>>('/User/ListDevices')
      driver.log('Searching for devices:', data)
      for (const building of data) {
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
    } catch (error: unknown) {
      driver.error('Searching for devices:', error instanceof Error ? error.message : error)
    }
    return devices
  }

  async getDevice <T extends MELCloudDevice> (device: T): Promise<Data<T> | null> {
    device.log('Syncing from device...')
    try {
      const { data } = await axios.get<Data<T>>(`/Device/Get?id=${device.id}&buildingID=${device.buildingid}`)
      device.log('Syncing from device:', data)
      return data
    } catch (error: unknown) {
      device.error('Syncing from device:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async setDevice <T extends MELCloudDevice> (device: T, updateData: UpdateData<T>): Promise<Data<T> | null> {
    const postData: PostData<T> = {
      DeviceID: device.id,
      HasPendingCommand: true,
      ...updateData
    }
    device.log('Syncing with device...', postData)
    try {
      const { data } = await axios.post<Data<T>>(`/Device/Set${device.driver.heatPumpType}`, postData)
      device.log('Syncing with device:', data)
      return data
    } catch (error: unknown) {
      device.error('Syncing with device:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async reportEnergyCost <T extends MELCloudDevice> (device: T, fromDate: DateTime, toDate: DateTime): Promise<ReportData<T> | null> {
    const postData: ReportPostData = {
      DeviceID: device.id,
      FromDate: fromDate.toISODate(),
      ToDate: toDate.toISODate(),
      UseCurrency: false
    }
    device.log('Reporting energy cost...', postData)
    try {
      const { data } = await axios.post<ReportData<T>>('/EnergyCost/Report', postData)
      device.log('Reporting energy cost:', data)
      return data
    } catch (error: unknown) {
      device.error('Reporting energy cost:', error instanceof Error ? error.message : error)
    }
    return null
  }

  async setSettings (settings: Settings): Promise<boolean> {
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

  getDevices (): MELCloudDevice[] {
    const devices: MELCloudDevice[] = []
    for (const driver of Object.values(this.homey.drivers.getDrivers())) {
      for (const device of driver.getDevices()) {
        devices.push(device as MELCloudDevice)
      }
    }
    return devices
  }

  async getUnitErrorLog (): Promise<ErrorLogData | null> {
    const postData: ErrorLogPostData = {
      DeviceIDs: this.getDevices().map((device: MELCloudDevice): number => device.id),
      Duration: Math.round(Math.abs(Number(DateTime.local(1970).diffNow('days').toObject().days)))
    }
    this.log('Reporting error log...', postData)
    try {
      const { data } = await axios.post<ErrorLogData>('/Report/GetUnitErrorLog2', postData)
      this.log('Reporting error log:', data)
      return data
    } catch (error: unknown) {
      this.error('Reporting error log:', error instanceof Error ? error.message : error)
    }
    return null
  }

  setTimeout (type: string, callback: Function, interval: number | object): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next', type, 'will run in', duration.shiftTo('days').toHuman(),
      'on', DateTime.now().plus(duration).toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
    )
    return this.homey.setTimeout(callback, Number(duration))
  }
}

module.exports = MELCloudApp
