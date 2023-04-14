import { DateTime } from 'luxon'
import type Homey from 'homey/lib/Homey'
import type MELCloudApp from './app'
import {
  type Building,
  type ErrorDetails,
  type ErrorLog,
  type ErrorLogData,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionSettings,
  type HolidayModeData,
  type HolidayModeSettings,
  type LoginCredentials,
  type MELCloudDevice,
  type Settings,
  type SettingsData
} from './types'

function fromUTCtoLocal(utcDate: string | null, locale?: string): string {
  if (utcDate === null) {
    return ''
  }
  const localDate: DateTime = DateTime.fromISO(utcDate, {
    zone: 'utc',
    locale
  }).toLocal()
  return (
    (locale !== undefined
      ? localDate.toLocaleString(DateTime.DATETIME_MED)
      : localDate.toISO({ includeOffset: false })) ?? ''
  )
}

function handleErrorLogQuery(query: ErrorLogQuery): {
  fromDate: DateTime
  toDate: DateTime
  period: number
} {
  const defaultLimit: number = 1
  const defaultOffset: number = 0
  const from: DateTime | null =
    query.from !== undefined && query.from !== ''
      ? DateTime.fromISO(query.from)
      : null
  const to: DateTime =
    query.to !== undefined && query.to !== ''
      ? DateTime.fromISO(query.to)
      : DateTime.now()

  let period: number = Number.parseInt(String(query.limit))
  period = !Number.isNaN(period) ? period : defaultLimit

  let offset: number = Number.parseInt(String(query.offset))
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
  async getBuildings({
    homey
  }: {
    homey: Homey
  }): Promise<Array<Building<MELCloudDevice>>> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const buildings: Array<Building<MELCloudDevice>> = await app.getBuildings()
    return buildings
      .filter(
        (building: Building<MELCloudDevice>): boolean =>
          app.getDevices({ buildingId: building.ID }).length > 0
      )
      .sort(
        (
          building1: Building<MELCloudDevice>,
          building2: Building<MELCloudDevice>
        ): number => building1.Name.localeCompare(building2.Name)
      )
      .map(
        (building: Building<MELCloudDevice>): Building<MELCloudDevice> => ({
          ...building,
          HMStartDate: fromUTCtoLocal(building.HMStartDate),
          HMEndDate: fromUTCtoLocal(building.HMEndDate)
        })
      )
  },

  async getDevices({
    homey,
    query
  }: {
    homey: Homey
    query?: { driverId: string }
  }): Promise<MELCloudDevice[]> {
    return (homey.app as MELCloudApp).getDevices({
      driverId: query?.driverId
    })
  },

  async getDeviceSettings({
    homey,
    query
  }: {
    homey: Homey
    query: { id?: string; driverId?: string }
  }): Promise<SettingsData[]> {
    let settings: any = homey.app.manifest.drivers.flatMap(
      (driver: any): SettingsData[] =>
        driver.settings.flatMap((setting: any): any[] =>
          setting.children.map((child: any): any => ({
            id: child.id,
            driverId: driver.id,
            label: setting.label,
            title:
              driver?.capabilitiesOptions?.[child.id]?.title ?? child.label,
            min: child.min,
            max: child.max,
            units: child.units
          }))
        )
    )
    if (query.id !== undefined) {
      settings = settings.filter(
        (setting: SettingsData): boolean => setting.id === query.id
      )
    }
    if (query.driverId !== undefined) {
      settings = settings.filter(
        (setting: SettingsData): boolean => setting.driverId === query.driverId
      )
    }
    return settings
  },

  async getFrostProtectionSettings({
    homey,
    params
  }: {
    homey: Homey
    params: { buildingId: Building<MELCloudDevice>['ID'] }
  }): Promise<FrostProtectionData> {
    return await (homey.app as MELCloudApp).getFrostProtectionSettings(
      Number(params.buildingId)
    )
  },

  async getHolidayModeSettings({
    homey,
    params
  }: {
    homey: Homey
    params: { buildingId: Building<MELCloudDevice>['ID'] }
  }): Promise<HolidayModeData> {
    const data: HolidayModeData = await (
      homey.app as MELCloudApp
    ).getHolidayModeSettings(Number(params.buildingId))
    return {
      ...data,
      HMStartDate: fromUTCtoLocal(data.HMStartDate),
      HMEndDate: fromUTCtoLocal(data.HMEndDate)
    }
  },

  async getLocale({ homey }: { homey: Homey }): Promise<string> {
    return (homey.app as MELCloudApp).locale
  },

  async getUnitErrorLog({
    homey,
    query
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const { fromDate, toDate, period } = handleErrorLogQuery(query)
    const data: ErrorLogData[] = (await app.getUnitErrorLog(
      fromDate,
      toDate
    )) as ErrorLogData[]

    const NextToDate: DateTime = fromDate.minus({ days: 1 })
    return {
      Errors: data
        .map(
          (errorData: ErrorLogData): ErrorDetails => ({
            Device:
              app.getDevice(errorData.DeviceId)?.getName() ??
              app.deviceIds[errorData.DeviceId],
            Date:
              errorData.StartDate !== null &&
              DateTime.fromISO(errorData.StartDate).year > 1
                ? fromUTCtoLocal(errorData.StartDate, app.locale)
                : '',
            Error: errorData.ErrorMessage ?? ''
          })
        )
        .filter(
          (error: ErrorDetails): boolean =>
            error.Date !== '' && error.Error !== ''
        )
        .reverse(),
      FromDateHuman: fromDate
        .setLocale(app.locale)
        .toLocaleString(DateTime.DATE_FULL),
      NextFromDate: NextToDate.minus({ days: period }).toISODate() ?? '',
      NextToDate: NextToDate.toISODate() ?? ''
    }
  },

  async login({
    homey,
    body
  }: {
    homey: Homey
    body: LoginCredentials
  }): Promise<boolean> {
    return await (homey.app as MELCloudApp).login(body)
  },

  async setDeviceSettings({
    homey,
    body,
    query
  }: {
    homey: Homey
    body: Settings
    query?: { driverId: string }
  }): Promise<boolean> {
    return await (homey.app as MELCloudApp).setDeviceSettings(
      body,
      query?.driverId
    )
  },

  async updateFrostProtectionSettings({
    homey,
    params,
    body
  }: {
    homey: Homey
    params: { buildingId: string }
    body: FrostProtectionSettings
  }): Promise<boolean> {
    return await (homey.app as MELCloudApp).updateFrostProtectionSettings(
      Number(params.buildingId),
      body
    )
  },

  async updateHolidayModeSettings({
    homey,
    params,
    body
  }: {
    homey: Homey
    params: { buildingId: string }
    body: HolidayModeSettings
  }): Promise<boolean> {
    return await (homey.app as MELCloudApp).updateHolidayModeSettings(
      Number(params.buildingId),
      body
    )
  }
}
