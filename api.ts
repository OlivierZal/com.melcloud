import { DateTime } from 'luxon'
import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import {
  Building,
  ErrorDetails,
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
const defaultLimit: number = 1
const defaultOffset: number = 0

function fromUTCtoLocal (utcDate: string | null, format?: string): string {
  if (utcDate === null) {
    return ''
  }
  const localDate: DateTime = DateTime.fromISO(utcDate, { zone: 'utc' }).toLocal()
  return format !== undefined ? localDate.toFormat(format) : localDate.toISO({ includeOffset: false })
}

function handleErrorLogQuery (query: ErrorLogQuery): { fromDate: DateTime, toDate: DateTime, period: number } {
  const from: DateTime | null = query.from !== undefined && query.from !== '' ? DateTime.fromISO(query.from) : null
  const to: DateTime = query.to !== undefined && query.to !== '' ? DateTime.fromISO(query.to) : DateTime.now()

  let period: number = Number.parseInt(query.limit)
  period = !Number.isNaN(period) ? period : defaultLimit

  let offset: number = Number.parseInt(query.offset)
  offset = from === null && !Number.isNaN(offset) ? offset : defaultOffset

  const limit: number = from === null ? period : defaultLimit
  const days: number = limit * offset + offset
  return {
    fromDate: from ?? to.minus({ days: days + limit }),
    toDate: to.minus({ days }),
    period
  }
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

  async getFrostProtectionSettings (
    { homey, params }: { homey: Homey, params: { buildingId: string } }
  ): Promise<FrostProtectionData> {
    return await (homey.app as MELCloudApp).getFrostProtectionSettings(Number(params.buildingId))
  },

  async getHolidayModeSettings (
    { homey, params }: { homey: Homey, params: { buildingId: string } }
  ): Promise<HolidayModeData> {
    const data: HolidayModeData = await (homey.app as MELCloudApp).getHolidayModeSettings(Number(params.buildingId))
    return {
      ...data,
      HMStartDate: fromUTCtoLocal(data.HMStartDate),
      HMEndDate: fromUTCtoLocal(data.HMEndDate)
    }
  },

  async getUnitErrorLog ({ homey, query }: { homey: Homey, query: ErrorLogQuery }): Promise<ErrorLog> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const { fromDate, toDate, period } = handleErrorLogQuery(query)
    const data: ErrorLogData[] = await app.getUnitErrorLog(fromDate, toDate) as ErrorLogData[]

    const NextToDate: DateTime = fromDate.minus({ days: 1 })
    return {
      Errors: data
        .map((errorData: ErrorLogData): ErrorDetails => {
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
        .filter((error: ErrorDetails): boolean => error.Date !== '' && error.Error !== '')
        .sort((error1: ErrorDetails, error2: ErrorDetails): number => {
          const date1 = DateTime.fromFormat(error1.Date, format)
          const date2 = DateTime.fromFormat(error2.Date, format)
          return Number(date2.diff(date1))
        }),
      FromDateHuman: fromDate.toFormat('dd LLL yy'),
      NextFromDate: NextToDate.minus({ days: period }).toISODate(),
      NextToDate: NextToDate.toISODate()
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
    return await (homey.app as MELCloudApp).updateFrostProtectionSettings(Number(params.buildingId), body)
  },

  async updateHolidayModeSettings ({ homey, params, body }: {
    homey: Homey
    params: { buildingId: string }
    body: HolidayModeSettings
  }): Promise<boolean> {
    return await (homey.app as MELCloudApp).updateHolidayModeSettings(Number(params.buildingId), body)
  }
}
