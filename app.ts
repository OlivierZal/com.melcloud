import 'source-map-support/register'

import axios from 'axios'
import Homey from 'homey'
import * as types from './types'

export default class MELCloudApp extends Homey.App {
  loginCredentials!: types.LoginCredentials

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

  async login (loginCredentials: types.LoginCredentials): Promise<boolean> {
    const { username, password } = loginCredentials
    if (username !== '' && password !== '') {
      const postData: types.LoginPostData = {
        AppVersion: '1.9.3.0',
        Email: username,
        Password: password,
        Persist: true
      }

      this.log('Login to MELCloud...', postData)
      try {
        const { data } = await axios.post<types.LoginData>('/Login/ClientLogin', postData)
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

  async listDevices (driver: types.MELCloudDriver): Promise<types.ListDevices> {
    const devices: types.ListDevices = {}

    driver.log('Searching for devices...')
    try {
      const { data } = await axios.get<types.Building[]>('/User/ListDevices')
      driver.log('Searching for devices:', data)
      data.forEach((building: types.Building) => {
        building.Structure.Devices.forEach((device: types.ListDevice) => {
          if (driver.deviceType === device.Device.DeviceType) {
            devices[device.DeviceID] = device
          }
        })
        building.Structure.Floors.forEach((floor) => {
          floor.Devices.forEach((device: types.ListDevice) => {
            if (driver.deviceType === device.Device.DeviceType) {
              devices[device.DeviceID] = device
            }
          })
          floor.Areas.forEach((area) => {
            area.Devices.forEach((device: types.ListDevice) => {
              if (driver.deviceType === device.Device.DeviceType) {
                devices[device.DeviceID] = device
              }
            })
          })
        })
        building.Structure.Areas.forEach((area) => {
          area.Devices.forEach((device: types.ListDevice) => {
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

  async getDevice (device: types.MELCloudDevice): Promise<types.GetData<typeof device> | {}> {
    device.instanceLog('Syncing from device...')
    try {
      const { data } = await axios.get<types.GetData<typeof device>>(`/Device/Get?id=${device.id}&buildingID=${device.buildingid}`)
      device.instanceLog('Syncing from device:', data)
      return data
    } catch (error: unknown) {
      device.instanceError('Syncing from device:', error instanceof Error ? error.message : error)
    }
    return {}
  }

  async setDevice (device: types.MELCloudDevice, updateData: types.UpdateData<typeof device>): Promise<types.GetData<typeof device> | {}> {
    const postData: types.PostData<typeof device> = {
      DeviceID: device.id,
      HasPendingCommand: true,
      ...updateData
    }

    device.instanceLog('Syncing with device...', postData)
    try {
      const { data } = await axios.post<types.GetData<typeof device>>(`/Device/Set${device.driver.heatPumpType}`, postData)
      device.instanceLog('Syncing with device:', data)
      return data
    } catch (error: unknown) {
      device.instanceError('Syncing with device:', error instanceof Error ? error.message : error)
    }
    return {}
  }

  async reportEnergyCost (device: types.MELCloudDevice, daily: boolean): Promise<types.ReportData<typeof device> | {}> {
    const period = daily ? 'daily' : 'total'

    const yesterday: Date = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const toDate: string = `${yesterday.toISOString().split('T')[0]}T00:00:00`

    const postData: types.ReportPostData = {
      DeviceID: device.id,
      FromDate: daily ? toDate : '1970-01-01T00:00:00',
      ToDate: toDate,
      UseCurrency: false
    }

    device.instanceLog('Reporting', period, 'energy cost...', postData)
    try {
      const { data } = await axios.post<types.ReportData<typeof device>>('/EnergyCost/Report', postData)
      device.instanceLog('Reporting', period, 'energy cost:', data)
      return data
    } catch (error: unknown) {
      device.instanceError('Reporting', period, 'energy cost:', error instanceof Error ? error.message : error)
    }
    return {}
  }
}

module.exports = MELCloudApp
