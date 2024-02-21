import type {
  Building,
  ErrorLogData,
  FailureData,
  FrostProtectionData,
  HolidayModeData,
  LoginCredentials,
  SuccessData,
} from './types/MELCloudAPITypes'
import type {
  DeviceSettings,
  DriverSetting,
  ErrorDetails,
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionSettings,
  HolidayModeSettings,
  LoginSetting,
  MELCloudDevice,
  ManifestDriver,
  ManifestDriverSetting,
  ManifestDriverSettingData,
  PairSetting,
  Settings,
  ValueOf,
} from './types/types'
import { DateTime } from 'luxon'
import type Homey from 'homey/lib/Homey'
import type MELCloudApp from './app'

const DEFAULT_LIMIT = 1
const DEFAULT_OFFSET = 0
const YEAR_1 = 1

const getDevice = (
  app: MELCloudApp,
  deviceId: number,
): MELCloudDevice | undefined =>
  app.getDevices().find(({ id }) => id === deviceId)

const getBuildingDeviceId = (homey: Homey, buildingId: number): number => {
  const device: MELCloudDevice | undefined = (homey.app as MELCloudApp)
    .getDevices({ buildingId })
    .find(({ id }) => typeof id !== 'undefined')
  if (!device) {
    throw new Error(homey.__('app.building.no_device', { buildingId }))
  }
  return device.id
}

const handleFailure = (data: FailureData): never => {
  const errorMessage: string = Object.entries(data.AttributeErrors)
    .map(
      ([error, messages]: [string, readonly string[]]): string =>
        `${error}: ${messages.join(', ')}`,
    )
    .join('\n')
  throw new Error(errorMessage)
}

const handleResponse = (data: FailureData | SuccessData): void => {
  if (data.AttributeErrors) {
    handleFailure(data)
  }
}

const getUnitErrorLog = async (
  homey: Homey,
  fromDate: DateTime,
  toDate: DateTime,
): Promise<ErrorLogData[]> => {
  const app: MELCloudApp = homey.app as MELCloudApp
  const { data } = await app.melcloudAPI.error({
    DeviceIDs: Object.keys(app.devicesPerId),
    FromDate: fromDate.toISODate() ?? '',
    ToDate: toDate.toISODate() ?? '',
  })
  if ('AttributeErrors' in data) {
    return handleFailure(data)
  }
  return data
}

const getDriverSettings = (
  driver: ManifestDriver,
  language: string,
): DriverSetting[] =>
  (driver.settings ?? []).flatMap(
    (setting: ManifestDriverSetting): DriverSetting[] =>
      (setting.children ?? []).map(
        (child: ManifestDriverSettingData): DriverSetting => ({
          driverId: driver.id,
          groupId: setting.id,
          groupLabel: setting.label[language],
          id: child.id,
          max: child.max,
          min: child.min,
          title: child.label[language],
          type: child.type,
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
        }),
      ),
  )

const getDriverLoginSetting = (
  driver: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const driverLoginSetting: LoginSetting | undefined = driver.pair?.find(
    (pairSetting: PairSetting): pairSetting is LoginSetting =>
      pairSetting.id === 'login',
  )
  return driverLoginSetting
    ? Object.values(
        Object.entries(driverLoginSetting.options).reduce<
          Record<string, DriverSetting>
        >((acc, [option, label]: [string, Record<string, string>]) => {
          const isPassword: boolean = option.startsWith('password')
          const key: keyof LoginCredentials = isPassword
            ? 'password'
            : 'username'
          if (!(key in acc)) {
            acc[key] = {
              driverId: driver.id,
              groupId: 'login',
              id: key,
              title: '',
              type: isPassword ? 'password' : 'text',
            }
          }
          acc[key][option.endsWith('Placeholder') ? 'placeholder' : 'title'] =
            label[language]
          return acc
        }, {}),
      )
    : []
}

const fromUTC = (utcDate: string | null, language?: string): string => {
  if (utcDate === null) {
    return ''
  }
  const localDateTime: DateTime = DateTime.fromISO(utcDate, {
    locale: language,
    zone: 'utc',
  }).toLocal()
  const localDate: string | null =
    typeof language === 'undefined'
      ? localDateTime.toISO({ includeOffset: false })
      : localDateTime.toLocaleString(DateTime.DATETIME_MED)
  return localDate ?? ''
}

const toUTC = (date: string, enabled: boolean): DateTime | null =>
  enabled ? DateTime.fromISO(date).toUTC() : null

const handleErrorLogQuery = (
  query: ErrorLogQuery,
): { fromDate: DateTime; period: number; toDate: DateTime } => {
  const from: DateTime | null =
    typeof query.from !== 'undefined' && query.from
      ? DateTime.fromISO(query.from)
      : null
  const to: DateTime =
    typeof query.to !== 'undefined' && query.to
      ? DateTime.fromISO(query.to)
      : DateTime.now()

  let period: number = Number.parseInt(String(query.limit), 10)
  period = Number.isNaN(period) ? DEFAULT_LIMIT : period

  let offset: number = Number.parseInt(String(query.offset), 10)
  offset = from !== null || Number.isNaN(offset) ? DEFAULT_OFFSET : offset

  const limit: number = from ? DEFAULT_LIMIT : period
  const days: number = limit * offset + offset
  return {
    fromDate: from ?? to.minus({ days: days + limit }),
    period,
    toDate: to.minus({ days }),
  }
}

export = {
  async getBuildings({ homey }: { homey: Homey }): Promise<Building[]> {
    const app: MELCloudApp = homey.app as MELCloudApp
    return (await app.getBuildings())
      .filter(({ ID: buildingId }) => app.getDevices({ buildingId }).length)
      .map(
        (building: Building): Building => ({
          ...building,
          HMEndDate: fromUTC(building.HMEndDate),
          HMStartDate: fromUTC(building.HMStartDate),
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
          ([settingId, value]: [string, ValueOf<Settings>]) => {
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
    const language: string = homey.i18n.getLanguage()
    return (
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ((homey.app as MELCloudApp).manifest.drivers as ManifestDriver[]).flatMap(
        (driver: ManifestDriver): DriverSetting[] => [
          ...getDriverSettings(driver, language),
          ...getDriverLoginSetting(driver, language),
        ],
      )
    )
  },
  async getFrostProtectionSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: { buildingId: number }
  }): Promise<FrostProtectionData> {
    return (
      await (homey.app as MELCloudApp).melcloudAPI.getFrostProtection(
        getBuildingDeviceId(homey, Number(params.buildingId)),
      )
    ).data
  },
  async getHolidayModeSettings({
    homey,
    params,
  }: {
    homey: Homey
    params: { buildingId: number }
  }): Promise<HolidayModeData> {
    const { data } = await (
      homey.app as MELCloudApp
    ).melcloudAPI.getHolidayMode(
      getBuildingDeviceId(homey, Number(params.buildingId)),
    )
    return {
      ...data,
      HMEndDate: fromUTC(data.HMEndDate),
      HMStartDate: fromUTC(data.HMStartDate),
    }
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
  },
  async getUnitErrorLog({
    homey,
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const { fromDate, toDate, period } = handleErrorLogQuery(query)
    const nextToDate: DateTime = fromDate.minus({ days: 1 })
    return {
      errors: (await getUnitErrorLog(homey, fromDate, toDate))
        .map(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }): ErrorDetails => {
            const date: string =
              DateTime.fromISO(startDate).year > YEAR_1
                ? fromUTC(startDate, homey.i18n.getLanguage())
                : ''
            const device: string =
              getDevice(app, deviceId)?.getName() ??
              app.devicesPerId[deviceId].DeviceName
            const error: string = errorMessage?.trim() ?? ''
            return { date, device, error }
          },
        )
        .filter((error: ErrorDetails) => error.date && error.error)
        .reverse(),
      fromDateHuman: fromDate
        .setLocale(homey.i18n.getLanguage())
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
    try {
      await Promise.all(
        (homey.app as MELCloudApp)
          .getDevices({ driverId: query?.driverId })
          .map(async (device: MELCloudDevice): Promise<void> => {
            const deviceChangedKeys: string[] = Object.keys(body).filter(
              (changedKey: string) =>
                body[changedKey] !== device.getSetting(changedKey),
            )
            if (deviceChangedKeys.length) {
              const deviceSettings: Settings = Object.fromEntries(
                deviceChangedKeys.map(
                  (key: string): [string, ValueOf<Settings>] => [
                    key,
                    body[key],
                  ],
                ),
              )
              try {
                await device.setSettings(deviceSettings)
                await device.onSettings({
                  changedKeys: deviceChangedKeys,
                  newSettings: device.getSettings() as Settings,
                })
              } catch (error: unknown) {
                const errorMessage: string =
                  error instanceof Error ? error.message : String(error)
                device.error('Settings:', errorMessage)
                throw new Error(errorMessage)
              }
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
    handleResponse(
      (
        await (homey.app as MELCloudApp).melcloudAPI.updateFrostProtection({
          ...body,
          BuildingIds: [Number(params.buildingId)],
        })
      ).data,
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
    const { enabled, startDate, endDate } = body
    if (enabled && (!startDate || !endDate)) {
      throw new Error(homey.__('app.holiday_mode.date_missing'))
    }
    const utcStartDate: DateTime | null = toUTC(startDate, enabled)
    const utcEndDate: DateTime | null = toUTC(endDate, enabled)
    handleResponse(
      (
        await (homey.app as MELCloudApp).melcloudAPI.updateHolidayMode({
          Enabled: enabled,
          EndDate: utcEndDate
            ? {
                Day: utcEndDate.day,
                Hour: utcEndDate.hour,
                Minute: utcEndDate.minute,
                Month: utcEndDate.month,
                Second: utcEndDate.second,
                Year: utcEndDate.year,
              }
            : null,
          HMTimeZones: [{ Buildings: [Number(params.buildingId)] }],
          StartDate: utcStartDate
            ? {
                Day: utcStartDate.day,
                Hour: utcStartDate.hour,
                Minute: utcStartDate.minute,
                Month: utcStartDate.month,
                Second: utcStartDate.second,
                Year: utcStartDate.year,
              }
            : null,
        })
      ).data,
    )
  },
}
