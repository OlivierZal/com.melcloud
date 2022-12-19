import axios from 'axios'
import { DateTime, Duration, Settings } from 'luxon'
import { App } from 'homey'

import {
  Building,
  Data,
  ListDevices,
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
  loginCredentials!: LoginCredentials
  loginTimeout!: NodeJS.Timeout

  async onInit (): Promise<void> {
    Settings.defaultZone = this.homey.clock.getTimezone()
    axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    axios.defaults.headers.common['X-MitsContextKey'] = this.homey.settings.get('ContextKey')

    this.loginCredentials = {
      username: this.homey.settings.get('username') ?? '',
      password: this.homey.settings.get('password') ?? ''
    }
    this.refreshLogin()
  }

  refreshLogin (): void {
    const expiry: string = this.homey.settings.get('Expiry')
    if (expiry !== null) {
      this.homey.clearTimeout(this.loginTimeout)
      const interval: number = Math.min(Number(DateTime.fromISO(expiry).minus({ days: 1 }).diffNow()), Math.pow(2, 31) - 1)
      this.loginTimeout = this.setTimeout('login refresh', async (): Promise<boolean> => await this.login(this.loginCredentials), interval)
    }
  }

  async login (loginCredentials: LoginCredentials): Promise<boolean> {
    const { username, password } = loginCredentials
    if (username !== '' && password !== '') {
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
          if (username !== this.loginCredentials.username) {
            this.refreshCredentials('username', username)
          }
          if (password !== this.loginCredentials.password) {
            this.refreshCredentials('password', password)
          }
          this.refreshLogin()
          return true
        }
      } catch (error: unknown) {
        this.error('Login to MELCloud:', error instanceof Error ? error.message : error)
      }
    }
    return false
  }

  refreshCredentials (setting: 'username' | 'password', value: string): void {
    this.homey.settings.set(setting, value)
    this.loginCredentials[setting] = value
  }

  async listDevices <T extends MELCloudDevice> (driver: T['driver']): Promise<ListDevices<T>> {
    const devices: ListDevices<T> = {}
    driver.log('Searching for devices...')
    try {
      const { data } = await axios.get<Array<Building<T>>>('/User/ListDevices')
      driver.log('Searching for devices:', data)
      for (const building of data) {
        for (const device of building.Structure.Devices) {
          if (driver.deviceType === device.Device.DeviceType) {
            devices[device.DeviceID] = device
          }
        }
        for (const floor of building.Structure.Floors) {
          for (const device of floor.Devices) {
            if (driver.deviceType === device.Device.DeviceType) {
              devices[device.DeviceID] = device
            }
          }
          for (const area of floor.Areas) {
            for (const device of area.Devices) {
              if (driver.deviceType === device.Device.DeviceType) {
                devices[device.DeviceID] = device
              }
            }
          }
        }
        for (const area of building.Structure.Areas) {
          for (const device of area.Devices) {
            if (driver.deviceType === device.Device.DeviceType) {
              devices[device.DeviceID] = device
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

  setTimeout (type: string, callback: Function, interval: number | object): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next', type, 'will run in', duration.shiftTo('days').toHuman(),
      'on', DateTime.now().plus(duration).toLocaleString(DateTime.DATE_FULL)
    )
    return this.homey.setTimeout(callback, Number(duration))
  }
}

module.exports = MELCloudApp
