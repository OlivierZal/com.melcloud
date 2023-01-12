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

function fromUTCtoLocal (utcDate: string | null, format?: string): string {
  if (utcDate === null) {
    return ''
  }
  const localDate: DateTime = DateTime.fromISO(utcDate, { zone: 'utc' }).toLocal()
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
  }): Promise<FrostProtectionData> {
    return await (homey.app as MELCloudApp).getFrostProtectionSettings(Number(params.buildingId))
  },

  async getHolidayModeSettings ({ homey, params }: {
    homey: Homey
    params: { buildingId: string }
  }): Promise<HolidayModeData> {
    const app = homey.app as MELCloudApp
    const data: HolidayModeData = await app.getHolidayModeSettings(Number(params.buildingId))
    return {
      ...data,
      HMStartDate: fromUTCtoLocal(data.HMStartDate),
      HMEndDate: fromUTCtoLocal(data.HMEndDate)
    }
  },

  async getUnitErrorLog ({ homey, query }: { homey: Homey, query: ErrorLogQuery }): Promise<ErrorLog> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const data: ErrorLogData = await app.getUnitErrorLog({
      ...query,
      offset: query.offset !== undefined ? Number(query.offset) : undefined,
      limit: query.limit !== undefined ? Number(query.limit) : undefined
    })
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
      FromDateHuman: DateTime.fromISO(data.FromDate).toFormat('dd LLL yy'),
      FromDateMinusOneDay: DateTime.fromISO(data.FromDate).minus({ days: 1 }).toISODate()
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
