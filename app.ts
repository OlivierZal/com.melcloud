import 'source-map-support/register'

import axios from 'axios'
import Homey from 'homey'
import { Building, GetData, ListDevice, ListDevices, LoginCredentials, LoginData, LoginPostData, MELCloudDevice, MELCloudDriver, PostData, ReportData, ReportPostData, UpdateData } from './types'

export default class MELCloudApp extends Homey.App {
  loginCredentials!: LoginCredentials

  async onInit (): Promise<void> {
    axios.defaults.baseURL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    axios.defaults.headers.common['X-MitsContextKey'] = this.homey.settings.get('ContextKey')

    this.loginCredentials = {
      username: this.homey.settings.get('username') ?? '',
      password: this.homey.settings.get('password') ?? ''
    }
    this.refreshLogin()
  }

  refreshLogin (): void {
    this.homey.setInterval(async () => {
      await this.login(this.loginCredentials)
    }, 24 * 60 * 60 * 1000)
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
        if (data.LoginData?.ContextKey != null) {
          this.homey.settings.set('ContextKey', data.LoginData.ContextKey)
          axios.defaults.headers.common['X-MitsContextKey'] = data.LoginData.ContextKey
          if (username !== this.loginCredentials.username) {
            this.homey.settings.set('username', username)
            this.loginCredentials.username = username
          }
          if (password !== this.loginCredentials.password) {
            this.homey.settings.set('password', password)
            this.loginCredentials.password = password
          }
          return true
        }
      } catch (error: unknown) {
        this.error('Login to MELCloud:', error instanceof Error ? error.message : error)
      }
    }
    return false
  }

  async listDevices <T extends MELCloudDriver> (driver: T): Promise<ListDevices> {
    const devices: ListDevices = {}

    driver.log('Searching for devices...')
    try {
      const { data } = await axios.get<Building[]>('/User/ListDevices')
      driver.log('Searching for devices:', data)
      data.forEach((building: Building) => {
        building.Structure.Devices.forEach((device: ListDevice) => {
          if (driver.deviceType === device.Device.DeviceType) {
            devices[device.DeviceID] = device
          }
        })
        building.Structure.Floors.forEach((floor) => {
          floor.Devices.forEach((device: ListDevice) => {
            if (driver.deviceType === device.Device.DeviceType) {
              devices[device.DeviceID] = device
            }
          })
          floor.Areas.forEach((area) => {
            area.Devices.forEach((device: ListDevice) => {
              if (driver.deviceType === device.Device.DeviceType) {
                devices[device.DeviceID] = device
              }
            })
          })
        })
        building.Structure.Areas.forEach((area) => {
          area.Devices.forEach((device: ListDevice) => {
            if (driver.deviceType === device.Device.DeviceType) {
              devices[device.DeviceID] = device
            }
          })
        })
      })
    } catch (error: unknown) {
      driver.error('Searching for devices:', error instanceof Error ? error.message : error)
    }
    return devices
  }

  async getDevice <T extends MELCloudDevice> (device: T): Promise<GetData<T> | {}> {
    device.log('Syncing from device...')
    try {
      const { data } = await axios.get<GetData<T>>(`/Device/Get?id=${device.id}&buildingID=${device.buildingid}`)
      device.log('Syncing from device:', data)
      return data
    } catch (error: unknown) {
      device.error('Syncing from device:', error instanceof Error ? error.message : error)
    }
    return {}
  }

  async setDevice <T extends MELCloudDevice> (device: T, updateData: UpdateData<T>): Promise<GetData<T> | {}> {
    const postData: PostData<T> = {
      DeviceID: device.id,
      HasPendingCommand: true,
      ...updateData
    }

    device.log('Syncing with device...', postData)
    try {
      const { data } = await axios.post<GetData<T>>(`/Device/Set${device.driver.heatPumpType}`, postData)
      device.log('Syncing with device:', data)
      return data
    } catch (error: unknown) {
      device.error('Syncing with device:', error instanceof Error ? error.message : error)
    }
    return {}
  }

  async reportEnergyCost <T extends MELCloudDevice> (device: T, daily: boolean): Promise<ReportData<T> | {}> {
    const period = daily ? 'daily' : 'total'

    const yesterday: Date = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const toDate: string = `${yesterday.toISOString().split('T')[0]}T00:00:00`

    const postData: ReportPostData = {
      DeviceID: device.id,
      FromDate: daily ? toDate : '1970-01-01T00:00:00',
      ToDate: toDate,
      UseCurrency: false
    }

    device.log('Reporting', period, 'energy cost...', postData)
    try {
      const { data } = await axios.post<ReportData<T>>('/EnergyCost/Report', postData)
      device.log('Reporting', period, 'energy cost:', data)
      return data
    } catch (error: unknown) {
      device.error('Reporting', period, 'energy cost:', error instanceof Error ? error.message : error)
    }
    return {}
  }
}

module.exports = MELCloudApp
