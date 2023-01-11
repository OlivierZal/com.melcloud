import { DateTime } from 'luxon'
import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import {
  Building,
  Error,
  ErrorData,
  ErrorLog,
  ErrorLogData,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionSettings,
  HolidayModeData,
  HolidayModeSettings,
  LoginCredentials,
  MELCloudDevice,
  Settings
} from './types'

const format: string = 'dd LLL yy HH:mm'

function fromUTCtoLocal (utcDate: string | null, format?: string, yesterday: boolean = false): string {
  if (utcDate === null) {
    return ''
  }
  const localDate: DateTime = DateTime.fromISO(utcDate, { zone: 'utc' }).toLocal()
  if (yesterday) {
    localDate.minus({ days: 1 })
  }
  return format !== undefined ? localDate.toFormat(format) : localDate.toISO({ includeOffset: false })
}

module.exports = {
  async getBuildings ({ homey }: { homey: Homey }): Promise<Array<Building<MELCloudDevice>>> {
    const buildings: Array<Building<MELCloudDevice>> = await (homey.app as MELCloudApp).getBuildings()
    return buildings.map((building) => (
      {
        ...building,
        HMStartDate: fromUTCtoLocal(building.HMStartDate),
        HMEndDate: fromUTCtoLocal(building.HMEndDate)
      }
    ))
  },

  async getFrostProtectionSettings ({ homey, params }: {
    homey: Homey
    params: { buildingId: string }
  }): Promise<FrostProtectionData | null> {
    return await (homey.app as MELCloudApp).getFrostProtectionSettings(Number(params.buildingId))
  },

  async getHolidayModeSettings ({ homey, params }: {
    homey: Homey
    params: { buildingId: string }
  }): Promise<HolidayModeData | null> {
    const app = homey.app as MELCloudApp
    const data: HolidayModeData | null = await app.getHolidayModeSettings(Number(params.buildingId))
    if (data === null) {
      return null
    }
    return {
      ...data,
      HMStartDate: fromUTCtoLocal(data.HMStartDate),
      HMEndDate: fromUTCtoLocal(data.HMEndDate)
    }
  },

  async getUnitErrorLog ({ homey, query }: { homey: Homey, query: ErrorLogQuery }): Promise<ErrorLog | null> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const data: ErrorLogData | null = await app.getUnitErrorLog({
      ...query,
      offset: query.offset !== undefined ? Number(query.offset) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined
    })
    if (data === null) {
      return null
    }
    return {
      Errors: data.Errors
        .map((errorData: ErrorData): Error => {
          const devices: MELCloudDevice[] = app.getDevices()
            .filter((device: MELCloudDevice): boolean => device.id === errorData.DeviceId)
          return {
            Device: devices.length > 0 ? devices[0].getName() : 'Undefined',
            Date: errorData.StartDate !== null && DateTime.fromISO(errorData.StartDate).year > 1
              ? fromUTCtoLocal(errorData.StartDate, format)
              : '',
            Error: errorData.ErrorMessage ?? ''
          }
        })
        .filter((error: Error): boolean => error.Date !== '' && error.Error !== '')
        .sort((error1: Error, error2: Error): number => {
          const date1 = DateTime.fromFormat(error1.Date, format)
          const date2 = DateTime.fromFormat(error2.Date, format)
          return Number(date2.diff(date1))
        }),
      FromDateHuman: fromUTCtoLocal(data.FromDate, format),
      FromDateMinusOneDay: fromUTCtoLocal(data.FromDate, undefined, true)
    }
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
    body: FrostProtectionSettings
  }): Promise<boolean> {
    return await (homey.app as MELCloudApp).updateFrostProtectionSettings(
      Number(params.buildingId), body)
  },

  async updateHolidayModeSettings ({ homey, params, body }: {
    homey: Homey
    params: { buildingId: string }
    body: HolidayModeSettings
  }): Promise<boolean> {
    const { Enabled } = body
    let { StartDate, EndDate } = body
    StartDate = StartDate !== null && StartDate !== '' ? DateTime.fromISO(StartDate).toUTC().toISO() : null
    EndDate = EndDate !== null && EndDate !== '' ? DateTime.fromISO(EndDate).toUTC().toISO() : null
    return await (homey.app as MELCloudApp).updateHolidayModeSettings(
      Number(params.buildingId),
      { Enabled, StartDate, EndDate }
    )
  }
}
