import { DateTime } from 'luxon'
import type Homey from 'homey/lib/Homey'
import type MELCloudApp from './app'
import type {
  Building,
  DeviceSettings,
  DriverSetting,
  ErrorDetails,
  ErrorLog,
  ErrorLogData,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionSettings,
  HolidayModeData,
  HolidayModeSettings,
  LoginCredentials,
  LoginSetting,
  ManifestDriver,
  ManifestDriverSetting,
  ManifestDriverSettingData,
  MELCloudDevice,
  PairSetting,
  Settings,
  SettingValue,
} from './types'

const fromUTCtoLocal = (utcDate: string | null, language?: string): string => {
  if (utcDate === null) {
    return ''
  }
  const localDateTime: DateTime = DateTime.fromISO(utcDate, {
    zone: 'utc',
    locale: language,
  }).toLocal()
  const localDate: string | null =
    language !== undefined
      ? localDateTime.toLocaleString(DateTime.DATETIME_MED)
      : localDateTime.toISO({ includeOffset: false })
  return localDate ?? ''
}

export = {
  async getBuildings({ homey }: { homey: Homey }): Promise<Building[]> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const buildings: Building[] = await app.getBuildings()
    return buildings
      .filter(({ ID: buildingId }) => app.getDevices({ buildingId }).length)
      .map(
        (building: Building): Building => ({
          ...building,
          HMStartDate: fromUTCtoLocal(building.HMStartDate),
          HMEndDate: fromUTCtoLocal(building.HMEndDate),
        }),
      )
      .sort((building1: Building, building2: Building) =>
        building1.Name.localeCompare(building2.Name),
      )
  },
  getDeviceSettings({ homey }: { homey: Homey }): DeviceSettings {
    return (homey.app as MELCloudApp)
      .getDevices()
      .reduce<DeviceSettings>((acc, device) => {
        const driverId: string = device.driver.id
        if (!(driverId in acc)) {
          acc[driverId] = {}
        }
        Object.entries(device.getSettings() as Settings).forEach(
          ([settingId, value]: [string, SettingValue]): void => {
            if (!(settingId in acc[driverId])) {
              acc[driverId][settingId] = []
            }
            if (!acc[driverId][settingId].includes(value)) {
              acc[driverId][settingId].push(value)
            }
          },
        )
        return acc
      }, {})
  },
  getDriverSettings({ homey }: { homey: Homey }): DriverSetting[] {
    const app: MELCloudApp = homey.app as MELCloudApp
    const language: string = app.getLanguage()
    const settings: DriverSetting[] =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (app.manifest.drivers as ManifestDriver[]).flatMap(
        (driver: ManifestDriver): DriverSetting[] =>
          (driver.settings ?? []).flatMap(
            (setting: ManifestDriverSetting): DriverSetting[] =>
              (setting.children ?? []).map(
                (child: ManifestDriverSettingData): DriverSetting => ({
                  id: child.id,
                  title: child.label[language],
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
                      label: value.label[language],
                    }),
                  ),
                  driverId: driver.id,
                  groupId: setting.id,
                  groupLabel: setting.label[language],
                }),
              ),
          ),
      )
    const settingsLogin: DriverSetting[] =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (app.manifest.drivers as ManifestDriver[]).flatMap(
        (driver: ManifestDriver): DriverSetting[] => {
          const driverLoginSetting: LoginSetting | undefined =
            driver.pair?.find(
              (pairSetting: PairSetting): pairSetting is LoginSetting =>
                pairSetting.id === 'login',
            )
          if (!driverLoginSetting) {
            return []
          }
          return Object.values(
            Object.entries(driverLoginSetting.options).reduce<
              Record<string, DriverSetting>
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
                  driverId: driver.id,
                }
              }
              acc[key][
                option.endsWith('Placeholder') ? 'placeholder' : 'title'
              ] = label[language]
              return acc
            }, {}),
          )
        },
      )
    return [...settings, ...settingsLogin]
  },
  async getFrostProtectionSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: { buildingId: number }
  }): Promise<FrostProtectionData> {
    return (homey.app as MELCloudApp).getFrostProtectionSettings(
      Number(params.buildingId),
    )
  },
  async getHolidayModeSettings({
    homey,
    params,
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
      HMEndDate: fromUTCtoLocal(data.HMEndDate),
    }
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return (homey.app as MELCloudApp).getLanguage()
  },
  async getUnitErrorLog({
    homey,
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    const app: MELCloudApp = homey.app as MELCloudApp

    const handleErrorLogQuery = (): {
      fromDate: DateTime
      period: number
      toDate: DateTime
    } => {
      const defaultLimit = 1
      const defaultOffset = 0
      const from: DateTime | null =
        query.from !== undefined && query.from
          ? DateTime.fromISO(query.from)
          : null
      const to: DateTime =
        query.to !== undefined && query.to
          ? DateTime.fromISO(query.to)
          : DateTime.now()

      let period: number = Number.parseInt(String(query.limit), 10)
      period = !Number.isNaN(period) ? period : defaultLimit

      let offset: number = Number.parseInt(String(query.offset), 10)
      offset = !from && !Number.isNaN(offset) ? offset : defaultOffset

      const limit: number = !from ? period : defaultLimit
      const days: number = limit * offset + offset
      return {
        fromDate: from ?? to.minus({ days: days + limit }),
        toDate: to.minus({ days }),
        period,
      }
    }

    const { fromDate, toDate, period } = handleErrorLogQuery()
    const nextToDate: DateTime = fromDate.minus({ days: 1 })
    const data: ErrorLogData[] = await app.getUnitErrorLog(fromDate, toDate)
    return {
      errors: data
        .map(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }): ErrorDetails => {
            const date: string =
              DateTime.fromISO(startDate).year > 1
                ? fromUTCtoLocal(startDate, app.getLanguage())
                : ''
            const device: string =
              app.getDevice(deviceId)?.getName() ?? app.deviceIds[deviceId]
            const error: string = errorMessage?.trim() ?? ''
            return { date, device, error }
          },
        )
        .filter((error: ErrorDetails) => error.date && error.error)
        .reverse(),
      fromDateHuman: fromDate
        .setLocale(app.getLanguage())
        .toLocaleString(DateTime.DATE_FULL),
      nextFromDate: nextToDate.minus({ days: period }).toISODate() ?? '',
      nextToDate: nextToDate.toISODate() ?? '',
    }
  },
  async login({
    homey,
    body,
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return (homey.app as MELCloudApp).login(body, true)
  },
  async setDeviceSettings({
    homey,
    body,
    query,
  }: {
    body: Settings
    homey: Homey
    query?: { driverId: string }
  }): Promise<void> {
    const changedKeys: string[] = Object.keys(body)
    if (!changedKeys.length) {
      return
    }
    try {
      await Promise.all(
        (homey.app as MELCloudApp)
          .getDevices({ driverId: query?.driverId })
          .map(async (device: MELCloudDevice): Promise<void> => {
            const deviceChangedKeys: string[] = changedKeys.filter(
              (changedKey: string) =>
                body[changedKey] !== device.getSetting(changedKey),
            )
            if (!deviceChangedKeys.length) {
              return
            }
            const deviceSettings: Settings = Object.fromEntries(
              deviceChangedKeys.map((key: string): [string, SettingValue] => [
                key,
                body[key],
              ]),
            )
            try {
              await device.setSettings(deviceSettings)
              device.log('Settings:', deviceSettings)
              await device.onSettings({
                newSettings: device.getSettings() as Settings,
                changedKeys: deviceChangedKeys,
              })
            } catch (error: unknown) {
              const errorMessage: string =
                error instanceof Error ? error.message : String(error)
              device.error('Settings:', errorMessage)
              throw new Error(errorMessage)
            }
          }),
      )
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : String(error))
    }
  },
  async updateFrostProtectionSettings({
    homey,
    params,
    body,
  }: {
    body: FrostProtectionSettings
    homey: Homey
    params: { buildingId: string }
  }): Promise<void> {
    await (homey.app as MELCloudApp).updateFrostProtectionSettings(
      Number(params.buildingId),
      body,
    )
  },
  async updateHolidayModeSettings({
    homey,
    params,
    body,
  }: {
    body: HolidayModeSettings
    homey: Homey
    params: { buildingId: string }
  }): Promise<void> {
    await (homey.app as MELCloudApp).updateHolidayModeSettings(
      Number(params.buildingId),
      body,
    )
  },
}
