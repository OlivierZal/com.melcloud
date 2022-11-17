import axios from 'axios'
import sourceMapSupport from 'source-map-support'
import Homey from 'homey'
import MELCloudDeviceMixin from './mixins/device_mixin'
import MELCloudDriverMixin from './mixins/driver_mixin'
import { Building, Data, Headers, ListDevice, ListDevices, LoginCredentials, LoginData } from './types'
sourceMapSupport.install()

export default class MELCloudApp extends Homey.App {
  baseUrl!: string
  contextKey!: string
  loginCredentials!: LoginCredentials

  async onInit (): Promise<void> {
    this.baseUrl = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
    this.contextKey = this.homey.settings.get('ContextKey') ?? ''
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
      const url: string = `${this.baseUrl}/Login/ClientLogin`
      const postData: Data = {
        AppVersion: '1.9.3.0',
        Email: username,
        Password: password,
        Persist: true
      }

      this.log('Login to MELCloud...', postData)
      try {
        const { data } = await axios.post<LoginData>(url, postData)
        this.log('Login to MELCloud:', data)
        if (data.LoginData?.ContextKey != null) {
          this.homey.settings.set('ContextKey', data.LoginData.ContextKey)
          this.contextKey = data.LoginData.ContextKey
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

  async listDevices (driver: MELCloudDriverMixin): Promise<ListDevices> {
    const listDevices: ListDevices = {}

    const url: string = `${this.baseUrl}/User/ListDevices`
    const config: Headers = { headers: { 'X-MitsContextKey': this.contextKey } }

    driver.log('Searching for devices...')
    try {
      const { data } = await axios.get<Building[]>(url, config)
      driver.log('Searching for devices:', data)
      data.forEach((building: Building) => {
        building.Structure.Devices.forEach((listDevice: ListDevice) => {
          if (driver.deviceType === listDevice.Device.DeviceType) {
            listDevices[listDevice.DeviceID] = listDevice
          }
        })
        building.Structure.Floors.forEach((floor) => {
          floor.Devices.forEach((listDevice) => {
            if (driver.deviceType === listDevice.Device.DeviceType) {
              listDevices[listDevice.DeviceID] = listDevice
            }
          })
          floor.Areas.forEach((area) => {
            area.Devices.forEach((listDevice) => {
              if (driver.deviceType === listDevice.Device.DeviceType) {
                listDevices[listDevice.DeviceID] = listDevice
              }
            })
          })
        })
        building.Structure.Areas.forEach((area) => {
          area.Devices.forEach((listDevice) => {
            if (driver.deviceType === listDevice.Device.DeviceType) {
              listDevices[listDevice.DeviceID] = listDevice
            }
          })
        })
      })
    } catch (error: unknown) {
      driver.error('Searching for devices:', error instanceof Error ? error.message : error)
    }
    return listDevices
  }

  async getDevice (device: MELCloudDeviceMixin): Promise<Data> {
    let data: Data = {}
    const deviceId: number = device.id
    const buildingId: number = device.buildingid

    const url: string = `${this.baseUrl}/Device/Get?id=${deviceId}&buildingID=${buildingId}`
    const config: Headers = { headers: { 'X-MitsContextKey': this.contextKey } }

    device.instanceLog('Syncing from device...')
    try {
      ({ data } = await axios.get<Data>(url, config))
      device.instanceLog('Syncing from device:', data)
    } catch (error: unknown) {
      device.instanceError('Syncing from device:', error instanceof Error ? error.message : error)
    }
    return data
  }

  async setDevice (device: MELCloudDeviceMixin, updateData: Data): Promise<Data> {
    let data: Data = {}
    const heatPumpType: string = device.driver.heatPumpType

    const url: string = `${this.baseUrl}/Device/Set${heatPumpType}`
    const config: Headers = { headers: { 'X-MitsContextKey': this.contextKey } }
    const postData = {
      DeviceID: device.id,
      HasPendingCommand: true,
      ...updateData
    }

    device.instanceLog('Syncing with device...', postData)
    try {
      ({ data } = await axios.post(url, postData, config))
      device.instanceLog('Syncing with device:', data)
    } catch (error) {
      device.instanceError('Syncing with device:', error instanceof Error ? error.message : error)
    }
    return data
  }

  async reportEnergyCost (device: MELCloudDeviceMixin, daily: boolean): Promise<Data> {
    let data: Data = {}
    const period = daily ? 'daily' : 'total'

    const yesterday: Date = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const toDate: string = `${yesterday.toISOString().split('T')[0]}T00:00:00`

    const url: string = `${this.baseUrl}/EnergyCost/Report`
    const config: Headers = { headers: { 'X-MitsContextKey': this.contextKey } }
    const postData: Data = {
      DeviceId: device.id,
      FromDate: daily ? toDate : '1970-01-01T00:00:00',
      ToDate: toDate,
      UseCurrency: false
    }

    device.instanceLog('Reporting', period, 'energy cost...', postData)
    try {
      ({ data } = await axios.post<Data>(url, postData, config))
      device.instanceLog('Reporting', period, 'energy cost:', data)
    } catch (error: unknown) {
      device.instanceError('Reporting', period, 'energy cost:', error instanceof Error ? error.message : error)
    }
    return data
  }
}

module.exports = MELCloudApp
