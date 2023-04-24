import { DateTime } from 'luxon'
import type Homey from 'homey/lib/Homey'
import type MELCloudApp from './app'
import {
  type Building,
  type DeviceSetting,
  type ErrorDetails,
  type ErrorLog,
  type ErrorLogData,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionSettings,
  type HolidayModeData,
  type HolidayModeSettings,
  type LoginCredentials,
  type LoginSetting,
  type ManifestDriver,
  type ManifestDriverSetting,
  type ManifestDriverSettingData,
  type MELCloudDevice,
  type PairSetting,
  type Settings
} from './types'

function fromUTCtoLocal(utcDate: string | null, language?: string): string {
  if (utcDate === null) {
    return ''
  }
  const localDate: DateTime = DateTime.fromISO(utcDate, {
    zone: 'utc',
    locale: language
  }).toLocal()
  return (
    (language !== undefined
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
    homey
  }: {
    homey: Homey
  }): Promise<DeviceSetting[]> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const language: string = app.getLanguage()
    const settings: DeviceSetting[] = app.manifest.drivers.flatMap(
      (driver: ManifestDriver): DeviceSetting[] =>
        (driver.settings ?? []).flatMap(
          (setting: ManifestDriverSetting): DeviceSetting[] =>
            (setting.children ?? []).map(
              (child: ManifestDriverSettingData): DeviceSetting => ({
                id: child.id,
                title: (driver.capabilitiesOptions?.[child.id]?.title ??
                  child.label)[language],
                type: child.type,
                min: child.min,
                max: child.max,
                units: child.units,
                values: child.values?.map(
                  (value: {
                    id: string
                    label: Record<string, string>
                  }): { id: string; label: string } => ({
                    id: value.id,
                    label: value.label[language]
                  })
                ),
                driverId: driver.id,
                groupId: setting.id,
                groupLabel: setting.label[language]
              })
            )
        )
    )

    const settingsLogin: DeviceSetting[] = app.manifest.drivers.flatMap(
      (driver: ManifestDriver): DeviceSetting[] => {
        const driverLoginSetting: LoginSetting | undefined = driver.pair?.find(
          (pairSetting: PairSetting): boolean => pairSetting.id === 'login'
        ) as LoginSetting | undefined
        if (driverLoginSetting === undefined) {
          return []
        }
        const driverLoginSettings: DeviceSetting[] = Object.values(
          Object.entries(driverLoginSetting.options ?? {}).reduce<
            Record<string, DeviceSetting>
          >((acc, [option, label]: [string, Record<string, string>]) => {
            const isPassword: boolean = option.startsWith('password')
            const key: keyof LoginCredentials = isPassword
              ? 'password'
              : 'username'
            if (!(key in acc)) {
              acc[key] = {
                groupId: 'login',
                id: key,
                title: '',
                type: isPassword ? 'password' : 'text',
                driverId: driver.id
              }
            }
            if (option.endsWith('Placeholder')) {
              acc[key].placeholder = label[language]
            } else {
              acc[key].title = label[language]
            }
            return acc
          }, {})
        )
        return driverLoginSettings
      }
    )
    return [...settings, ...settingsLogin]
  },

  async getFrostProtectionSettings({
    homey,
    params
  }: {
    homey: Homey
    params: { buildingId: number }
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
    params: { buildingId: number }
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

  async getLanguage({ homey }: { homey: Homey }): Promise<string> {
    return (homey.app as MELCloudApp).getLanguage()
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
    const data: ErrorLogData[] = await app.getUnitErrorLog(fromDate, toDate)

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
                ? fromUTCtoLocal(errorData.StartDate, app.getLanguage())
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
        .setLocale(app.getLanguage())
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
  }): Promise<void> {
    await (homey.app as MELCloudApp).setDeviceSettings(body, query?.driverId)
  },

  async updateFrostProtectionSettings({
    homey,
    params,
    body
  }: {
    homey: Homey
    params: { buildingId: string }
    body: FrostProtectionSettings
  }): Promise<void> {
    await (homey.app as MELCloudApp).updateFrostProtectionSettings(
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
  }): Promise<void> {
    await (homey.app as MELCloudApp).updateHolidayModeSettings(
      Number(params.buildingId),
      body
    )
  }
}
