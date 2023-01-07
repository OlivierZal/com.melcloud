import { DateTime } from 'luxon'
import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import {
  Building,
  Error,
  ErrorData,
  ErrorLog,
  ErrorLogData,
  FrostProtectionData,
  HolidayModeData,
  LoginCredentials,
  MELCloudDevice,
  Settings
} from './types'

module.exports = {
  async getBuildings ({ homey }: { homey: Homey }): Promise<Array<Building<MELCloudDevice>>> {
    return await (homey.app as MELCloudApp).getBuildings()
  },

  async getFrostProtectionSettings ({ homey, params }: { homey: Homey, params: { buildingId: string } }): Promise<FrostProtectionData | null> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const building: Building<MELCloudDevice> | null = await app.getBuilding(Number(params.buildingId))
    if (building === null) {
      return null
    }
    return await app.getFrostProtectionSettings(building)
  },

  async getHolidayModeSettings ({ homey, params }: { homey: Homey, params: { buildingId: string } }): Promise<HolidayModeData | null> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const building: Building<MELCloudDevice> | null = await app.getBuilding(Number(params.buildingId))
    if (building === null) {
      return null
    }
    const data: HolidayModeData | null = await app.getHolidayModeSettings(building)
    if (data === null) {
      return null
    }
    return {
      HMEnabled: data.HMEnabled,
      HMStartDate: data.HMStartDate !== null ? DateTime.fromISO(data.HMStartDate, { zone: 'utc' }).toLocal().toISO({ includeOffset: false }) : null,
      HMEndDate: data.HMEndDate !== null ? DateTime.fromISO(data.HMEndDate, { zone: 'utc' }).toLocal().toISO({ includeOffset: false }) : null
    }
  },

  async getUnitErrorLog ({ homey }: { homey: Homey }): Promise<ErrorLog | null> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const data: ErrorLogData | null = await app.getUnitErrorLog()
    if (data === null) {
      return null
    }
    return data.map((errorData: ErrorData): Error => (
      {
        Device: app.getDevices().filter((device: MELCloudDevice): boolean => device.id === errorData.DeviceId)[0].getName(),
        Date: errorData.StartDate !== null && DateTime.fromISO(errorData.StartDate).year !== 1
          ? DateTime.fromISO(errorData.StartDate, { zone: 'utc' }).toLocal().toFormat('dd LLL yy HH:mm')
          : '',
        Error: errorData.ErrorMessage ?? ''
      }
    )).filter((error: Error): boolean => error.Date !== '' && error.Error !== '')
  },

  async login ({ homey, body }: { homey: Homey, body: LoginCredentials }): Promise<boolean> {
    return await (homey.app as MELCloudApp).login(body)
  },

  async setDeviceSettings ({ homey, body }: { homey: Homey, body: Settings }): Promise<boolean> {
    return await (homey.app as MELCloudApp).setDeviceSettings(body)
  },

  async updateFrostProtectionSettings ({ homey, params, body }: {
    homey: Homey
    params: { buildingId: string }
    body: { enabled: boolean, minimumTemperature: number, maximumTemperature: number }
  }): Promise<boolean> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const building: Building<MELCloudDevice> | null = await app.getBuilding(Number(params.buildingId))
    if (building === null) {
      return false
    }
    const { enabled, minimumTemperature, maximumTemperature } = body
    return await app.updateFrostProtectionSettings(
      building,
      enabled,
      minimumTemperature,
      maximumTemperature
    )
  },

  async updateHolidayModeSettings ({ homey, params, body }: {
    homey: Homey
    params: { buildingId: string }
    body: { enabled: boolean, startDate: string, endDate: string }
  }): Promise<boolean> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const building: Building<MELCloudDevice> | null = await app.getBuilding(Number(params.buildingId))
    if (building === null) {
      return false
    }
    const { enabled, startDate, endDate } = body
    return await app.updateHolidayModeSettings(
      building,
      enabled,
      startDate !== '' ? DateTime.fromISO(startDate).toUTC() : null,
      endDate !== '' ? DateTime.fromISO(endDate).toUTC() : null
    )
  }
}
