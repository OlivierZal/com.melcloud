/* eslint-disable max-lines */
import type {
  Building,
  ErrorLogData,
  FrostProtectionData,
  HolidayModeData,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type {
  DeviceSettings,
  DriverSetting,
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionSettings,
  HolidayModeSettings,
  LoginSetting,
  MELCloudDevice,
  Manifest,
  ManifestDriver,
  PairSetting,
  Settings,
} from './types'
import { DateTime } from 'luxon'
import type Homey from 'homey/lib/Homey'
import type MELCloudApp from '.'

const DEFAULT_LIMIT = 1
const DEFAULT_OFFSET = 0
const YEAR_1 = 1

const getDevice = (
  app: MELCloudApp,
  deviceId: number,
): MELCloudDevice | undefined =>
  app.getDevices().find(({ id }) => id === deviceId)

const getBuildingDeviceId = (homey: Homey, buildingId: number): number => {
  const device = (homey.app as MELCloudApp)
    .getDevices({ buildingId })
    .find(({ id }) => typeof id !== 'undefined')
  if (!device) {
    throw new Error(homey.__('app.building.no_device', { buildingId }))
  }
  return device.id
}

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const handleResponse = (
  errors: Record<string, readonly string[]> | null,
): void => {
  if (errors) {
    throw new Error(formatErrors(errors))
  }
}

const getErrors = async (
  homey: Homey,
  fromDate: DateTime,
  toDate: DateTime,
): Promise<ErrorLogData[]> => {
  const app = homey.app as MELCloudApp
  const { data } = await app.melcloudAPI.errors({
    DeviceIDs: Object.keys(app.devices),
    FromDate: fromDate.toISODate() ?? '',
    ToDate: toDate.toISODate() ?? '',
  })
  if ('AttributeErrors' in data) {
    throw new Error(formatErrors(data.AttributeErrors))
  }
  return data
}

const getDriverSettings = (
  { settings, id: driverId }: ManifestDriver,
  language: string,
): DriverSetting[] =>
  (settings ?? []).flatMap((setting) =>
    (setting.children ?? []).map(
      ({ id, max, min, label, type, units, values }) => ({
        driverId,
        groupId: setting.id,
        groupLabel: setting.label[language],
        id,
        max,
        min,
        title: label[language],
        type,
        units,
        values: values?.map(({ id: valueId, label: valueLabel }) => ({
          id: valueId,
          label: valueLabel[language],
        })),
      }),
    ),
  )

const getDriverLoginSetting = (
  { id: driverId, pair }: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const driverLoginSetting = pair?.find(
    (pairSetting: PairSetting): pairSetting is LoginSetting =>
      pairSetting.id === 'login',
  )
  return driverLoginSetting ?
      Object.values(
        Object.entries(driverLoginSetting.options).reduce<
          Record<string, DriverSetting>
        >((acc, [option, label]) => {
          const isPassword = option.startsWith('password')
          const key = isPassword ? 'password' : 'username'
          acc[key] ??= {
            driverId,
            groupId: 'login',
            id: key,
            title: '',
            type: isPassword ? 'password' : 'text',
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
  const localDateTime = DateTime.fromISO(utcDate, {
    locale: language,
    zone: 'utc',
  }).toLocal()
  const localDate =
    typeof language === 'undefined' ?
      localDateTime.toISO({ includeOffset: false })
    : localDateTime.toLocaleString(DateTime.DATETIME_MED)
  return localDate ?? ''
}

const toUTC = (date: string, enabled: boolean): DateTime | null =>
  enabled ? DateTime.fromISO(date).toUTC() : null

const handleErrorLogQuery = ({
  from,
  to,
  limit,
  offset,
}: ErrorLogQuery): { fromDate: DateTime; period: number; toDate: DateTime } => {
  const fromDate =
    typeof from !== 'undefined' && from ? DateTime.fromISO(from) : null
  const toDate =
    typeof to !== 'undefined' && to ? DateTime.fromISO(to) : DateTime.now()

  let period = Number.parseInt(String(limit), 10)
  period = Number.isNaN(period) ? DEFAULT_LIMIT : period

  let daysOffset = Number.parseInt(String(offset), 10)
  daysOffset =
    fromDate !== null || Number.isNaN(daysOffset) ? DEFAULT_OFFSET : daysOffset

  const daysLimit = fromDate ? DEFAULT_LIMIT : period
  const days = daysLimit * daysOffset + daysOffset
  return {
    fromDate: fromDate ?? toDate.minus({ days: days + daysLimit }),
    period,
    toDate: toDate.minus({ days }),
  }
}

export = {
  async getBuildings({ homey }: { homey: Homey }): Promise<Building[]> {
    const app = homey.app as MELCloudApp
    return (await app.getBuildings())
      .map((building) => ({
        ...building,
        HMEndDate: fromUTC(building.HMEndDate),
        HMStartDate: fromUTC(building.HMStartDate),
      }))
      .sort((building1, building2) =>
        building1.Name.localeCompare(building2.Name),
      )
  },
  getDeviceSettings({ homey }: { homey: Homey }): DeviceSettings {
    return (homey.app as MELCloudApp)
      .getDevices()
      .reduce<DeviceSettings>((acc, device) => {
        const driverId = device.driver.id
        acc[driverId] ??= {}
        Object.entries(device.getSettings() as Settings).forEach(
          ([settingId, value]) => {
            acc[driverId][settingId] ??= []
            if (!acc[driverId][settingId].includes(value)) {
              acc[driverId][settingId].push(value)
            }
          },
        )
        return acc
      }, {})
  },
  getDriverSettings({ homey }: { homey: Homey }): DriverSetting[] {
    const language = homey.i18n.getLanguage()
    return ((homey.app as MELCloudApp).manifest as Manifest).drivers.flatMap(
      (driver) => [
        ...getDriverSettings(driver, language),
        ...getDriverLoginSetting(driver, language),
      ],
    )
  },
  async getErrors({
    homey,
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    const app = homey.app as MELCloudApp
    const { fromDate, toDate, period } = handleErrorLogQuery(query)
    const nextToDate = fromDate.minus({ days: 1 })
    return {
      errors: (await getErrors(homey, fromDate, toDate))
        .map(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }) => {
            const date =
              DateTime.fromISO(startDate).year > YEAR_1 ?
                fromUTC(startDate, homey.i18n.getLanguage())
              : ''
            const device =
              getDevice(app, deviceId)?.getName() ??
              app.devices[deviceId]?.DeviceName ??
              ''
            const error = errorMessage?.trim() ?? ''
            return { date, device, error }
          },
        )
        .filter((error) => error.date && error.error)
        .reverse(),
      fromDateHuman: fromDate
        .setLocale(homey.i18n.getLanguage())
        .toLocaleString(DateTime.DATE_FULL),
      nextFromDate: nextToDate.minus({ days: period }).toISODate() ?? '',
      nextToDate: nextToDate.toISODate() ?? '',
    }
  },
  async getFrostProtectionSettings({
    homey,
    params: { buildingId },
  }: {
    homey: Homey
    params: { buildingId: number }
  }): Promise<FrostProtectionData> {
    return (
      await (homey.app as MELCloudApp).melcloudAPI.getFrostProtection(
        getBuildingDeviceId(homey, Number(buildingId)),
      )
    ).data
  },
  async getHolidayModeSettings({
    homey,
    params: { buildingId },
  }: {
    homey: Homey
    params: { buildingId: number }
  }): Promise<HolidayModeData> {
    const { data } = await (
      homey.app as MELCloudApp
    ).melcloudAPI.getHolidayMode(getBuildingDeviceId(homey, Number(buildingId)))
    return {
      ...data,
      HMEndDate: fromUTC(data.HMEndDate),
      HMStartDate: fromUTC(data.HMStartDate),
    }
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
  },
  async login({
    homey,
    body,
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return (homey.app as MELCloudApp).applyLogin(body)
  },
  async setDeviceSettings({
    homey,
    body,
    query,
  }: {
    query?: { driverId: string }
    body: Settings
    homey: Homey
  }): Promise<void> {
    await Promise.all(
      (homey.app as MELCloudApp)
        .getDevices({ driverId: query?.driverId })
        .map(async (device) => {
          const changedKeys = Object.keys(body).filter(
            (changedKey) => body[changedKey] !== device.getSetting(changedKey),
          )
          if (changedKeys.length) {
            await device.setSettings(
              Object.fromEntries(changedKeys.map((key) => [key, body[key]])),
            )
            await device.onSettings({
              changedKeys,
              newSettings: device.getSettings() as Settings,
            })
          }
        }),
    )
  },
  async updateFrostProtectionSettings({
    homey,
    params: { buildingId },
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
          BuildingIds: [Number(buildingId)],
        })
      ).data.AttributeErrors,
    )
  },
  async updateHolidayModeSettings({
    homey,
    params: { buildingId },
    body: { isEnabled, startDate, endDate },
  }: {
    body: HolidayModeSettings
    homey: Homey
    params: { buildingId: string }
  }): Promise<void> {
    if (isEnabled && (!startDate || !endDate)) {
      throw new Error(homey.__('app.holiday_mode.date_missing'))
    }
    const utcStartDate = toUTC(startDate, isEnabled)
    const utcEndDate = toUTC(endDate, isEnabled)
    handleResponse(
      (
        await (homey.app as MELCloudApp).melcloudAPI.updateHolidayMode({
          Enabled: isEnabled,
          EndDate:
            utcEndDate ?
              {
                Day: utcEndDate.day,
                Hour: utcEndDate.hour,
                Minute: utcEndDate.minute,
                Month: utcEndDate.month,
                Second: utcEndDate.second,
                Year: utcEndDate.year,
              }
            : null,
          HMTimeZones: [{ Buildings: [Number(buildingId)] }],
          StartDate:
            utcStartDate ?
              {
                Day: utcStartDate.day,
                Hour: utcStartDate.hour,
                Minute: utcStartDate.minute,
                Month: utcStartDate.month,
                Second: utcStartDate.second,
                Year: utcStartDate.year,
              }
            : null,
        })
      ).data.AttributeErrors,
    )
  },
}
