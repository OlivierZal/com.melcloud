import 'source-map-support/register.js'

import {
  type DeviceType,
  type HolidayModeUpdate,
  type Hour,
  type Logger,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type SettingManager,
  type SyncCallback,
  isClassicAtaFacade,
  NoChangesError,
  operationModeToClassic,
} from '@olivierzal/melcloud-api'
import { Intl, Temporal } from 'temporal-polyfill'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type { Api } from './types/api.mts'
import type { LocalizedStrings } from './types/bases.mts'
import type { GroupAtaStates } from './types/classic-ata.mts'
import type {
  DeviceSetting,
  DeviceSettings,
  Settings,
} from './types/device-settings.mts'
import type {
  DriverCapabilitiesOptions,
  DriverSetting,
} from './types/driver-settings.mts'
import type {
  FormattedErrorDetails,
  FormattedErrorLog,
} from './types/error-log.mts'
import type { HomeDeviceFacade } from './types/home.mts'
import type {
  LoginSetting,
  ManifestDriver,
  ManifestDriverCapabilitiesOptions,
} from './types/manifest.mts'
import type { MELCloudDevice, MELCloudDriver } from './types/melcloud.mts'
import type { GetAtaOptions } from './types/widgets.mts'
import type {
  DeviceOrZoneData,
  HomeBuildingZone,
  HomeDeviceZone,
  ZoneData,
} from './types/zone.mts'
import {
  changelog,
  fanSpeed,
  horizontal,
  power,
  targetTemperature,
  thermostatMode,
  vertical,
} from './files.mts'
import { setClassicFacadeManager } from './lib/classic-facade-manager.mts'
import { NotFoundError } from './lib/errors.mts'
import { fireAndForget } from './lib/fire-and-forget.mts'
import { type Homey, App } from './lib/homey.mts'
import { getTimeZone } from './lib/temporal.mts'
import { typedFromEntries } from './lib/typed-object.mts'
import { unwrapResult } from './lib/unwrap-result.mts'
import { fanSpeedValues } from './types/ata-erv.mts'

// Locale-aware by-name comparator shared by every zone/building sort.
const byName = (
  first: { readonly name: string },
  other: { readonly name: string },
): number => first.name.localeCompare(other.name)

const HOLIDAY_MODE_MAX_DURATION_DAYS = 365
const HOLIDAY_MODE_OFF_DURATION = 0

const NOTIFICATION_DELAY_MS = 10_000

const DRIVER_IDS_BY_TYPE: Partial<Record<DeviceType, string>> = {
  [Classic.DeviceType.Ata]: 'melcloud',
  [Classic.DeviceType.Atw]: 'melcloud_atw',
  [Classic.DeviceType.Erv]: 'melcloud_erv',
  [Home.DeviceType.Ata]: 'home-melcloud',
  [Home.DeviceType.Atw]: 'home-melcloud_atw',
}

// The report `to` bound defaults to now in the API timezone lib-side.
const daysAgo = (days: number, timezone: string): string =>
  Temporal.Now.plainDateTimeISO(timezone).subtract({ days }).toString()

// Day-chart windows anchor on local midnight so "N days" reads as N
// calendar days ending today, consistently across the report, the
// temperatures and the operation-modes charts; `days` 0 is the rolling
// last-24-hours choice the report picker offers when hourly buckets
// exist.
const chartDaysStart = (days: number, timezone: string): string =>
  days === 0 ?
    daysAgo(1, timezone)
  : Temporal.Now.zonedDateTimeISO(timezone)
      .startOfDay()
      .subtract({ days: days - 1 })
      .toPlainDateTime()
      .toString()

// The manifest min/max/step only constrain manual input: a flow token
// dropped into the field can carry anything at runtime. Only numbers
// and numeric strings are accepted — coercing other types (false,
// null, '') would silently read as 0 and turn holiday mode off.
const toDurationDays = (duration: unknown): number => {
  if (typeof duration === 'number') {
    return duration
  }
  if (typeof duration === 'string' && duration.trim() !== '') {
    return Number(duration)
  }
  return Number.NaN
}

// Flow-action arguments shared by the holiday-mode cards: `zone` always,
// `duration`/`time` only on the cards that declare them.
interface HolidayModeActionArgs {
  zone: HolidayModeTarget
  duration?: unknown
  time?: unknown
}

// A holiday-mode flow target: a Classic zone/device (zone coordinates) or a
// single Home device (its id). Run listeners discriminate on `deviceId`.
type HolidayModeTarget =
  | { readonly deviceId: string; readonly id: string; readonly name: string }
  | (DeviceOrZoneData & { readonly id: string; readonly name: string })

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const throwOnErrors = (
  errors: Record<string, readonly string[]> | null,
): void => {
  if (errors !== null) {
    throw new Error(formatErrors(errors))
  }
}

// Aggregates one device's settings into the per-driver map; a conflicting
// value across devices marks the setting as indeterminate (`null`) and stops
// processing the remaining settings of that device.
const mergeDeviceSettings = (
  driverSettings: DeviceSetting,
  settings: Record<string, unknown>,
): void => {
  for (const [settingId, value] of Object.entries(settings)) {
    if (!Object.hasOwn(driverSettings, settingId)) {
      driverSettings[settingId] = value
    } else if (driverSettings[settingId] !== value) {
      driverSettings[settingId] = null
      return
    }
  }
}

const localize = (
  strings: string | LocalizedStrings,
  language: string,
): string =>
  typeof strings === 'string' ? strings : (strings[language] ?? strings.en)

const getDriverSettings = (
  { id: driverId, name, settings }: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const driverLabel = localize(name, language)
  return (settings ?? []).flatMap(
    ({ children, id: groupId, label: groupLabel }) =>
      (children ?? []).map(({ id, label, max, min, type, units, values }) => ({
        driverId,
        driverLabel,
        groupId,
        groupLabel: localize(groupLabel, language),
        id,
        max,
        min,
        title: localize(label, language),
        type,
        units,
        values: values?.map(({ id: valueId, label: valueLabel }) => ({
          id: valueId,
          label: localize(valueLabel, language),
        })),
      })),
  )
}

const getDriverLoginSetting = (
  { id: driverId, name, pair }: ManifestDriver,
  language: string,
): DriverSetting[] => {
  const driverLabel = localize(name, language)
  const driverLoginSetting: Record<string, DriverSetting> = {}
  const loginOptions =
    pair?.find(
      (pairSetting): pairSetting is LoginSetting => pairSetting.id === 'login',
    )?.options ?? []
  for (const [option, label] of Object.entries(loginOptions)) {
    const isPassword = option.startsWith('password')
    const key = isPassword ? 'password' : 'username'
    driverLoginSetting[key] ??= {
      driverId,
      driverLabel,
      groupId: 'login',
      id: key,
      title: '',
      type: isPassword ? 'password' : 'text',
    }
    driverLoginSetting[key] = {
      ...driverLoginSetting[key],
      [option.endsWith('Placeholder') ? 'placeholder' : 'title']: localize(
        label,
        language,
      ),
    }
  }
  return Object.values(driverLoginSetting)
}

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?: Record<string, number | string>,
): DriverCapabilitiesOptions => ({
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    id:
      enumType !== undefined && Object.hasOwn(enumType, id) ?
        String(enumType[id])
      : id,
    label: title[language] ?? title.en,
  })),
})

// The ATA group surface shared by the zone facades and — per the
// melcloud-api contract this feature tracks — the ATA device facade, which
// emulates it as a group of one.
type ClassicAtaGroupFacade = Pick<
  Classic.ZoneFacade,
  'getGroup' | 'updateGroupState'
>

// Devices flat-listed outside their zone tree (chart pickers, device
// autocompletes) carry their building name, so same-named devices on
// different buildings stay tellable apart; tree-shaped lists keep the
// bare name — the hierarchy already locates the device.
const toFlatDeviceName = (name: string, buildingName?: string): string => {
  const trimmed = name.trim()
  return buildingName === undefined ? trimmed : (
      `${trimmed} (${buildingName.trim()})`
    )
}

const filterZonesByName = <T extends { readonly name: string }>(
  zones: readonly T[],
  query: string,
): T[] => {
  const lowerCaseQuery = query.toLowerCase()
  return zones.filter(({ name }) => name.toLowerCase().includes(lowerCaseQuery))
}

// Flow autocomplete items over the given zones (including single devices,
// which the holiday mode endpoints also accept). The zone target is
// carried on the selected item so run listeners need no id parsing.
const toZoneAutocompleteItems = (
  zones: readonly Classic.Zone[],
): (DeviceOrZoneData & { id: string; name: string })[] =>
  zones.map(({ id, model, name }) => ({
    id: `${model}_${String(id)}`,
    name,
    zoneId: String(id),
    zoneType: model,
  }))

// Flow autocomplete items over Home devices: each device is a standalone
// holiday-mode target, carried by id so run listeners route to the Home
// batch endpoints without id parsing.
const toHomeDeviceAutocompleteItems = (
  zones: readonly HomeDeviceZone[],
): { deviceId: string; id: string; name: string }[] =>
  zones.map(({ id, name }) => ({ deviceId: id, id: `homeDevices_${id}`, name }))

// MELCloud reports error timestamps either as UTC instants (Z or offset
// suffix) or as wall-clock times in the building's timezone.
const parseErrorDate = (date: string, timeZone: string): Temporal.Instant => {
  try {
    return Temporal.Instant.from(date)
  } catch {
    return Temporal.PlainDateTime.from(date)
      .toZonedDateTime(timeZone)
      .toInstant()
  }
}

// The webview always asks for 29-day pages; mirrored here for the synthetic
// window served when Classic is signed out.
const DEFAULT_ERROR_LOG_PERIOD_DAYS = 29
const HOME_ERROR_DEVICE_TYPES: readonly Home.DeviceType[] = [
  Home.DeviceType.Ata,
  Home.DeviceType.Atw,
]

interface RawErrorEntry {
  readonly device: string
  readonly error: string
  readonly instant: Temporal.Instant
}

// Mirrors the Classic pagination tiling (a page spans `period` days, the
// next one ends the day before it starts) so a Home-only account still
// browses windows when Classic is signed out.
const syntheticErrorLogWindow = (
  { from, period, to }: Classic.ErrorLogQuery,
  timeZone: string,
): Omit<Classic.ErrorLog, 'errors'> => {
  const periodDays = period ?? DEFAULT_ERROR_LOG_PERIOD_DAYS
  const toDate =
    to !== undefined && to !== '' ?
      Temporal.PlainDate.from(to)
    : Temporal.Now.plainDateISO(timeZone)
  // A user-picked "since" date pins the window start, like the
  // library's own parseErrorLogQuery does on the Classic path.
  const fromDate =
    from !== undefined && from !== '' ?
      Temporal.PlainDate.from(from)
    : toDate.subtract({ days: periodDays })
  const nextToDate = fromDate.subtract({ days: 1 })
  return {
    fromDate: fromDate.toString(),
    nextFromDate: nextToDate.subtract({ days: periodDays }).toString(),
    nextToDate: nextToDate.toString(),
  }
}

const isWithinErrorLogWindow = (
  instant: Temporal.Instant,
  {
    from,
    timeZone,
    to,
  }: {
    readonly from: Temporal.PlainDate
    readonly timeZone: string
    readonly to: Temporal.PlainDate | null
  },
): boolean => {
  const day = instant.toZonedDateTimeISO(timeZone).toPlainDate()
  return (
    Temporal.PlainDate.compare(day, from) >= 0 &&
    (to === null || Temporal.PlainDate.compare(day, to) <= 0)
  )
}

// MELCloud marks unrecorded error timestamps with a year-1 sentinel:
// anything before this floor is noise, shown as an em dash (the tabular
// missing-value convention — language-neutral, unlike an N/A) while the
// row itself is kept: the error is real even without its moment. The
// descending sort naturally sinks these entries to the end.
const MIN_PLAUSIBLE_ERROR_INSTANT = Temporal.Instant.from(
  '2000-01-01T00:00:00Z',
)
const UNKNOWN_DATE_PLACEHOLDER = '—'

const formatErrorEntries = (
  entries: readonly RawErrorEntry[],
  { locale, timeZone }: { locale: string; timeZone: string },
): FormattedErrorDetails[] => {
  // Reused across all entries instead of rebuilding a formatter per call.
  const dateTimeMedFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    month: 'short',
    timeZone,
    year: 'numeric',
  })
  return entries
    .toSorted((first, second) =>
      Temporal.Instant.compare(second.instant, first.instant),
    )
    .map(({ device, error, instant }) => ({
      date:
        Temporal.Instant.compare(instant, MIN_PLAUSIBLE_ERROR_INSTANT) < 0 ?
          UNKNOWN_DATE_PLACEHOLDER
        : dateTimeMedFormat.format(instant),
      device,
      error,
    }))
}

export default class MELCloudApp extends App {
  declare public readonly homey: Homey.Homey

  public get classicApi(): Classic.API {
    return this.#classicApi
  }

  public get homeApi(): Home.API {
    return this.#homeApi
  }

  // One shutdown signal for both API clients: onUninit aborts it so
  // in-flight requests cannot outlive the app instance (the SDK's
  // post-destroy accesses came from exactly those danglers).
  readonly #abortController = new AbortController()

  #classicApi!: Classic.API

  #facadeManager!: Classic.FacadeManager

  #homeApi!: Home.API

  #homeFacadeManager!: Home.FacadeManager

  // Loss-episode ledger, written SYNCHRONOUSLY by both lib event
  // callbacks and read by the deferred halves: 'pending' = loss
  // announced, deferred handler undecided; 'shown' = loss notification
  // actually displayed. A recovery arriving while a loss is still
  // 'pending' (a self-heal during boot, before `homey.ready()`
  // resolves) erases the episode so neither stale notification fires.
  readonly #sessionLossStates = new Map<Api, 'pending' | 'shown'>()

  get #classicRegistry(): Classic.Registry {
    return this.#classicApi.registry
  }

  get #homeRegistry(): Home.Registry {
    return this.#homeApi.registry
  }

  public override async onInit(): Promise<void> {
    // Boot marks: everything before the first line is module require +
    // SDK handshake, and `ready` lands once every driver and device
    // initialized — the discriminators for 2018-hardware
    // `ready_timeout` diagnostics.
    this.log('Boot: onInit after', process.uptime().toFixed(1), 's')
    const language = this.homey.i18n.getLanguage()
    await this.#initClassicApi({
      language,
      locale: language,
      timezone: getTimeZone(this.homey),
    })
    await this.#initHomeApi()
    this.#createNotification(language)
    this.#registerWidgetListeners()
    this.#registerFlowListeners()
    fireAndForget(
      this.#logBootReady(),
      (...args: unknown[]) => {
        this.error(...args)
      },
      'Boot readiness tracking failed:',
    )
  }

  public override async onUninit(): Promise<void> {
    this.#abortController.abort()
    this.#classicApi.clearSync()
    this.#homeApi.clearSync()
    await Promise.resolve()
  }

  public getClassicAtaCapabilities(): [
    keyof Classic.GroupState & keyof Classic.ListDeviceDataAta,
    DriverCapabilitiesOptions,
  ][] {
    return this.#getAtaCapabilityConfigs().map(
      ({
        enumType,
        key,
        options,
      }): [
        keyof Classic.GroupState & keyof Classic.ListDeviceDataAta,
        DriverCapabilitiesOptions,
      ] => [
        key,
        getLocalizedCapabilitiesOptions(
          options,
          this.homey.i18n.getLanguage(),
          enumType,
        ),
      ],
    )
  }

  public getClassicAtaDetailedStates({
    status,
    zoneId,
    zoneType,
  }: GetAtaOptions & ZoneData): GroupAtaStates {
    // Annotated to collapse the BuildingFacade | ZoneFacade `devices` union
    // into one array type, so the `.filter` type guard below can narrow.
    const { devices }: { devices: readonly Classic.DeviceAny[] } =
      this.getClassicFacade(zoneType, zoneId)
    if (devices.length === 0) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic Classic.GroupState to typed GroupAtaStates
    return typedFromEntries(
      this.getClassicAtaCapabilities().map(([key]) => [
        key,
        devices
          .filter((device) =>
            Classic.isDeviceOfType(device, Classic.DeviceType.Ata),
          )
          .map(({ data }) => data)
          .filter((data) => status !== 'on' || data.Power)
          .map((data) => data[key]),
      ]),
    ) as GroupAtaStates
  }

  public async getClassicAtaState({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): Promise<Classic.GroupState> {
    return unwrapResult(
      await this.#getClassicAtaGroupFacade({ zoneId, zoneType }).getGroup(),
    )
  }

  public getClassicDeviceZones(type?: Classic.DeviceType): Classic.Zone[] {
    const devices =
      type === undefined ?
        this.#classicRegistry.getDevices()
      : this.#classicRegistry.getDevicesByType(type)
    return devices
      .map((device) => ({
        id: device.id,
        level: 1,
        model: 'devices' as const,
        name: toFlatDeviceName(
          device.name,
          this.#classicRegistry.buildings.getById(device.buildingId)?.name,
        ),
      }))
      .toSorted(byName)
  }

  public async getClassicEnergyReport({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartLineOptions> {
    const from = chartDaysStart(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getEnergyReport({
        from,
      }),
    )
  }

  public getClassicFacade<T extends Classic.DeviceType>(
    zoneType: 'devices',
    id: number | string,
  ): Classic.DeviceFacade<T>
  public getClassicFacade(
    zoneType: ZoneData['zoneType'],
    id: number | string,
  ): Classic.BuildingFacade | Classic.ZoneFacade
  public getClassicFacade(
    zoneType: DeviceOrZoneData['zoneType'],
    id: number | string,
  ): Classic.Facade
  public getClassicFacade(
    zoneType: DeviceOrZoneData['zoneType'],
    id: number | string,
  ): Classic.Facade {
    const instance = this.#classicRegistry[zoneType].getById(Number(id))
    if (instance === undefined) {
      throw new NotFoundError(
        this.homey.__(
          `errors.${zoneType === 'devices' ? 'device' : 'zone'}NotFound`,
        ),
      )
    }
    return this.#facadeManager.get(instance)
  }

  public async getClassicFrostProtection({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): Promise<Classic.FrostProtectionData> {
    return unwrapResult(
      await this.getClassicFacade(zoneType, zoneId).getFrostProtection(),
    )
  }

  public async getClassicHolidayMode({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): Promise<Classic.HolidayModeData> {
    return unwrapResult(
      await this.getClassicFacade(zoneType, zoneId).getHolidayMode(),
    )
  }

  public async getClassicHourlyTemperatures({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getHourlyTemperatures(
        hour,
      ),
    )
  }

  public async getClassicOperationModes({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartPieOptions> {
    const from = chartDaysStart(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getOperationModes({
        from,
      }),
    )
  }

  public async getClassicSignal({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getSignalStrength(hour),
    )
  }

  public async getClassicTemperatures({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartLineOptions> {
    const from = chartDaysStart(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.getClassicFacade('devices', deviceId).getTemperatures({
        from,
      }),
    )
  }

  public getDeviceSettings(): DeviceSettings {
    const deviceSettings: DeviceSettings = {}
    for (const device of this.#getDevices()) {
      const {
        driver: { id: driverId },
      } = device
      deviceSettings[driverId] ??= {}
      mergeDeviceSettings(deviceSettings[driverId], device.getSettings())
    }
    return deviceSettings
  }

  public getDevicesByType<T extends Classic.DeviceType>(
    type: T,
  ): Classic.Device<T>[] {
    return this.#classicRegistry.getDevicesByType(type)
  }

  public getDriverSettings(): Partial<Record<string, DriverSetting[]>> {
    const language = this.homey.i18n.getLanguage()
    return Object.groupBy(
      this.homey.manifest.drivers.flatMap((driver) => [
        ...getDriverSettings(driver, language),
        ...getDriverLoginSetting(driver, language),
      ]),
      ({ driverId, groupId }) => groupId ?? driverId,
    )
  }

  // One chronological log across both accounts: the Classic page drives the
  // window (its tiling is authoritative), Home entries are fetched per
  // device and filtered into that window so pages never overlap.
  public async getErrorLog(
    query: Classic.ErrorLogQuery,
  ): Promise<FormattedErrorLog> {
    const locale = this.homey.i18n.getLanguage()
    const timeZone = getTimeZone(this.homey)
    const { errors, fromDate, ...rest } = await this.#getClassicErrorLogPage(
      query,
      timeZone,
    )
    const window = {
      from: Temporal.PlainDate.from(fromDate),
      timeZone,
      to:
        query.to !== undefined && query.to !== '' ?
          Temporal.PlainDate.from(query.to)
        : null,
    }
    const allHomeEntries = await this.#getHomeErrorEntries(timeZone)
    const homeEntries = allHomeEntries.filter((entry) =>
      isWithinErrorLogWindow(entry.instant, window),
    )
    const classicEntries = errors.map(
      ({ date, deviceId, error }): RawErrorEntry => ({
        device: this.#classicRegistry.devices.getById(deviceId)?.name ?? '',
        error,
        instant: parseErrorDate(date, timeZone),
      }),
    )
    return {
      ...rest,
      errors: formatErrorEntries([...classicEntries, ...homeEntries], {
        locale,
        timeZone,
      }),
      fromDateHuman: Temporal.PlainDate.from(fromDate).toLocaleString(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }
  }

  public async getHomeAtaState(deviceId: string): Promise<Classic.GroupState> {
    return unwrapResult(
      await this.getHomeFacade(deviceId, Home.DeviceType.Ata).getGroup(),
    )
  }

  // Every ATA target the group widget can address on the Home side: one
  // root entry per `/context` building (the account-level group), its
  // devices one level below, both alphabetical.
  public getHomeAtaTargets(): (HomeBuildingZone | HomeDeviceZone)[] {
    return this.#homeRegistry
      .getBuildingsByType(Home.DeviceType.Ata)
      .toSorted(byName)
      .flatMap(({ devices, id, name }) => [
        {
          id,
          level: 0,
          model: 'homeBuildings',
          name,
        } satisfies HomeBuildingZone,
        ...devices
          .map((device): HomeDeviceZone => ({
            id: device.id,
            level: 1,
            model: 'homeDevices',
            name: device.name,
          }))
          .toSorted(byName),
      ])
  }

  // Member operation modes in the Classic vocabulary — what the widget's
  // mixed-mode scene resolver consumes.
  public getHomeBuildingAtaModes(buildingId: string): number[] {
    return this.#getHomeBuildingFacade(buildingId).devices.map(
      (device) =>
        operationModeToClassic[
          this.#homeFacadeManager.get(device).operationMode
        ],
    )
  }

  public async getHomeBuildingAtaState(
    buildingId: string,
  ): Promise<Classic.GroupState> {
    return unwrapResult(
      await this.#getHomeBuildingFacade(buildingId).getGroup(),
    )
  }

  public getHomeDevicesByType(type: Home.DeviceType): Home.Device[] {
    return this.#homeRegistry.getByType(type)
  }

  // The charts widget vocabulary: Home devices as flat selectable
  // entries (no building nodes), alpha-sorted, both types by default.
  public getHomeDeviceZones(type?: Home.DeviceType): HomeDeviceZone[] {
    const devices =
      type === undefined ?
        this.#homeRegistry.getAll()
      : this.#homeRegistry.getByType(type)
    return devices
      .map((device): HomeDeviceZone => ({
        id: device.id,
        level: 1,
        model: 'homeDevices',
        name: toFlatDeviceName(device.name, device.building.name),
      }))
      .toSorted(byName)
  }

  public async getHomeEnergyReport({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartLineOptions> {
    const from = chartDaysStart(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.#getHomeDeviceFacade(deviceId).getEnergyReport({ from }),
    )
  }

  public getHomeFacade<T extends Home.DeviceType>(
    deviceId: string,
    type: T,
  ): HomeDeviceFacade<T>
  public getHomeFacade(
    deviceId: string,
    type: Home.DeviceType,
  ): Home.DeviceAtaFacade | Home.DeviceAtwFacade {
    const model = this.#homeRegistry.getById(deviceId)
    if (model?.type === type) {
      if (model.isAta()) {
        return this.#homeFacadeManager.get(model)
      }
      if (model.isAtw()) {
        return this.#homeFacadeManager.get(model)
      }
    }
    throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
  }

  public getHomeFrostProtection(deviceId: string): Home.FrostProtection | null {
    return this.#getHomeDeviceFacade(deviceId).frostProtection
  }

  public getHomeHolidayMode(deviceId: string): Home.HolidayMode | null {
    return this.#getHomeDeviceFacade(deviceId).holidayMode
  }

  public async getHomeHourlyTemperatures({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.getHomeFacade(
        deviceId,
        Home.DeviceType.Atw,
      ).getHourlyTemperatures(hour),
    )
  }

  public async getHomeOperationModes({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartPieOptions> {
    const from = chartDaysStart(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.getHomeFacade(deviceId, Home.DeviceType.Atw).getOperationModes(
        { from },
      ),
    )
  }

  public async getHomeSignal({
    deviceId,
    hour,
  }: {
    deviceId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getHomeDeviceFacade(deviceId).getSignalStrength(hour),
    )
  }

  public async getHomeTemperatures({
    days,
    deviceId,
  }: {
    days: number
    deviceId: string
  }): Promise<ReportChartLineOptions> {
    const from = chartDaysStart(days, getTimeZone(this.homey))
    return unwrapResult(
      await this.#getHomeDeviceFacade(deviceId).getTemperatures({ from }),
    )
  }

  public async updateClassicAtaState({
    state,
    zoneId,
    zoneType,
  }: DeviceOrZoneData & { state: Classic.GroupState }): Promise<void> {
    const { AttributeErrors } = await this.#getClassicAtaGroupFacade({
      zoneId,
      zoneType,
    }).updateGroupState(state)
    throwOnErrors(AttributeErrors)
  }

  public async updateClassicFrostProtection({
    settings,
    zoneId,
    zoneType,
  }: DeviceOrZoneData & {
    settings: Classic.FrostProtectionQuery
  }): Promise<void> {
    const { AttributeErrors } = await this.getClassicFacade(
      zoneType,
      zoneId,
    ).updateFrostProtection(settings)
    throwOnErrors(AttributeErrors)
  }

  public async updateClassicHolidayMode({
    settings,
    zoneId,
    zoneType,
  }: DeviceOrZoneData & {
    settings: HolidayModeUpdate
  }): Promise<void> {
    const { AttributeErrors } = await this.getClassicFacade(
      zoneType,
      zoneId,
    ).updateHolidayMode(settings)
    throwOnErrors(AttributeErrors)
  }

  public async updateDeviceSettings({
    driverId,
    settings,
  }: {
    settings: Settings
    driverId?: string | undefined
  }): Promise<void> {
    await Promise.all(
      this.#getDevices({ driverId }).map(async (device) => {
        const changedKeys = Object.keys(settings).filter(
          (changedKey) =>
            settings[changedKey] !== device.getSetting(changedKey),
        )
        if (changedKeys.length === 0) {
          return
        }
        await device.setSettings(
          Object.fromEntries(changedKeys.map((key) => [key, settings[key]])),
        )
        await device.onSettings({
          changedKeys,
          newSettings: device.getSettings(),
        })
      }),
    )
  }

  public async updateHomeAtaState({
    deviceId,
    state,
  }: {
    deviceId: string
    state: Classic.GroupState
  }): Promise<void> {
    try {
      await this.getHomeFacade(deviceId, Home.DeviceType.Ata).updateGroupState(
        state,
      )
    } catch (error) {
      // A delta the device already matches is fine by definition.
      if (!(error instanceof NoChangesError)) {
        throw error
      }
    }
  }

  public async updateHomeBuildingAtaState({
    buildingId,
    state,
  }: {
    buildingId: string
    state: Classic.GroupState
  }): Promise<void> {
    await this.#getHomeBuildingFacade(buildingId).updateGroupState(state)
  }

  public async updateHomeFrostProtection(
    deviceIds: readonly string[],
    settings: { isEnabled: boolean; max: number; min: number },
  ): Promise<void> {
    await this.#homeFacadeManager.updateFrostProtection(deviceIds, settings)
  }

  public async updateHomeHolidayMode(
    deviceIds: readonly string[],
    settings: HolidayModeUpdate,
  ): Promise<void> {
    await this.#homeFacadeManager.updateHolidayMode(deviceIds, settings)
  }

  readonly #onSync: SyncCallback = async ({ ids, type } = {}) => {
    await this.#classicSyncDevices({
      driverId: type === undefined ? undefined : DRIVER_IDS_BY_TYPE[type],
      ids,
    })
  }

  // Sync matching classic devices by pulling their latest state from MELCloud.
  // Per-device sync failures are logged without aborting the full sync run.
  // Deferred half of the loss notification: the readiness await
  // orders the device check after driver init — a backed-off resume
  // reports the loss during `App#onInit`, when `getDrivers()` is
  // still empty. The pending-state re-check after the notification
  // IPC keeps a recovery that landed mid-flight from resurrecting
  // the episode.
  async #announceSessionLost(api: Api): Promise<void> {
    await this.homey.ready()
    if (!this.#shouldAnnounceSessionLost(api)) {
      return
    }
    try {
      await this.homey.notifications.createNotification({
        excerpt: this.homey.__(`notifications.sessionExpired.${api}`),
      })
    } catch {
      // Non-critical: notification display is best-effort — the
      // episode stays 'pending', so no recovery follow-up will
      // reference a notification the user never saw.
      return
    }
    if (this.#sessionLossStates.get(api) === 'pending') {
      this.#sessionLossStates.set(api, 'shown')
    }
  }

  async #classicSyncDevices(
    filter: {
      driverId?: string | undefined
      ids?: (number | string)[] | undefined
    } = {},
  ): Promise<void> {
    const results = await Promise.allSettled(
      this.#getDevices(filter).map(async (device) => device.syncFromDevice()),
    )
    for (const result of results) {
      if (result.status === 'rejected') {
        this.error('Device sync failed:', result.reason)
      }
    }
  }

  #createLogger(): Logger {
    return {
      error: (...args: unknown[]): void => {
        this.error(...args)
      },
      log: (...args: unknown[]): void => {
        this.log(...args)
      },
    }
  }

  #createNotification(language: string): void {
    const { homey } = this
    const {
      manifest: { version },
      notifications,
      settings,
    } = homey
    if (settings.get('notifiedVersion') === version) {
      return
    }
    const changelogByVersion = changelog as Record<
      string,
      Record<string, string>
    >
    const versionChangelog = changelogByVersion[version] ?? {}
    const excerpt = versionChangelog[language]
    if (excerpt === undefined) {
      return
    }
    homey.setTimeout(async () => {
      try {
        await notifications.createNotification({ excerpt })
        settings.set('notifiedVersion', version)
      } catch {
        // Non-critical: notification display is best-effort
      }
    }, NOTIFICATION_DELAY_MS)
  }

  #createSettingManager(api: Api = 'classic'): SettingManager {
    // Classic owns the unprefixed keys (legacy); Home is namespaced to
    // avoid collisions (e.g. `username` → `homeUsername`).
    const prefixKey = (key: string): string =>
      api === 'classic' ? key : (
        `${api}${key.charAt(0).toUpperCase()}${key.slice(1)}`
      )
    return {
      get: (key: string): string | null | undefined => {
        const value: unknown = this.homey.settings.get(prefixKey(key))
        return typeof value === 'string' || value === null ? value : undefined
      },
      set: (key: string, value: string): void => {
        this.homey.settings.set(prefixKey(key), value)
      },
      unset: (key: string): void => {
        this.homey.settings.unset(prefixKey(key))
      },
    }
  }

  #getAtaCapabilityConfigs(): {
    key: keyof Classic.GroupState & keyof Classic.ListDeviceDataAta
    options: ManifestDriverCapabilitiesOptions
    enumType?: Record<string, number | string>
  }[] {
    return [
      { key: 'Power', options: power },
      { key: 'SetTemperature', options: targetTemperature },
      {
        enumType: Classic.FanSpeed,
        key: 'FanSpeed',
        options: { ...fanSpeed, type: 'enum', values: fanSpeedValues },
      },
      {
        enumType: Classic.Vertical,
        key: 'VaneVerticalDirection',
        options: vertical,
      },
      {
        enumType: Classic.Horizontal,
        key: 'VaneHorizontalDirection',
        options: horizontal,
      },
      {
        enumType: Classic.OperationMode,
        key: 'OperationMode',
        options: {
          ...thermostatMode,
          values: this.homey.manifest.drivers
            .find(({ id }) => id === 'melcloud')
            ?.capabilitiesOptions?.thermostat_mode?.values?.filter(
              ({ id }) => id !== 'off',
            ),
        },
      },
    ]
  }

  #getClassicAtaGroupFacade({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): ClassicAtaGroupFacade {
    if (zoneType !== 'devices') {
      return this.getClassicFacade(zoneType, zoneId)
    }
    const facade = this.getClassicFacade('devices', zoneId)
    if (!isClassicAtaFacade(facade)) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    return facade
  }

  async #getClassicErrorLogPage(
    query: Classic.ErrorLogQuery,
    timeZone: string,
  ): Promise<Classic.ErrorLog> {
    if (!this.classicApi.isAuthenticated()) {
      return { errors: [], ...syntheticErrorLogWindow(query, timeZone) }
    }
    return unwrapResult(await this.#classicApi.getErrorLog(query))
  }

  #getDevices({
    driverId,
    ids,
  }: {
    driverId?: string | undefined
    ids?: (number | string)[] | undefined
  } = {}): MELCloudDevice[] {
    const drivers = this.#getDrivers(driverId)
    const stringIds = ids?.map(String)
    return drivers.flatMap((driver) => {
      const devices = driver.getDevices()
      return stringIds === undefined ? devices : (
          devices.filter(({ id }) => stringIds.includes(String(id)))
        )
    })
  }

  // SDK v3 runs `App#onInit` before any `Driver#onInit`, so `onSync`
  // callbacks fired by the MELCloud API clients during `#initClassicApi`
  // / `#initHomeApi` find no ready drivers. Awaiting driver readiness
  // would deadlock: drivers can't init until `App#onInit` returns, which
  // awaits these API-client constructors. `getDrivers()` only exposes
  // drivers whose `onInit` has completed, so unready drivers are filtered
  // out naturally — an initial sync silently becomes a no-op. Each device
  // runs its own initial sync via `ensureDevice()` in `Device#onInit`,
  // and post-init `onSync` calls find every driver ready.
  #getDrivers(driverId?: string): MELCloudDriver[] {
    const drivers = Object.values(this.homey.drivers.getDrivers())
    return driverId === undefined ? drivers : (
        drivers.filter((driver) => driver.id === driverId)
      )
  }

  #getHomeBuildingFacade(buildingId: string): Home.BuildingAtaFacade {
    const facade = this.#homeFacadeManager.getBuilding(buildingId)
    if (facade === null) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    return facade
  }

  // Best-effort per device: one unreachable unit must not empty the log.
  async #getHomeDeviceErrorEntries(
    device: Home.Device,
    timeZone: string,
  ): Promise<RawErrorEntry[]> {
    const { id, name, type } = device
    const result = await this.getHomeFacade(id, type).getErrorLog()
    if (!result.ok) {
      this.error('Home error log fetch failed:', name, result.error)
      return []
    }
    return result.value.map(({ errorCode, errorReason, timestamp }) => ({
      device: name,
      error: errorReason ?? errorCode,
      instant: parseErrorDate(timestamp, timeZone),
    }))
  }

  // Type-agnostic device facade lookup for the chart surfaces shared by
  // both Home device types (temperatures, signal, energy report).
  #getHomeDeviceFacade(
    deviceId: string,
  ): Home.DeviceAtaFacade | Home.DeviceAtwFacade {
    const model = this.#homeRegistry.getById(deviceId)
    if (model?.isAta() === true) {
      return this.#homeFacadeManager.get(model)
    }
    if (model?.isAtw() === true) {
      return this.#homeFacadeManager.get(model)
    }
    throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
  }

  async #getHomeErrorEntries(timeZone: string): Promise<RawErrorEntry[]> {
    const logs = await Promise.all(
      HOME_ERROR_DEVICE_TYPES.flatMap((type) =>
        this.getHomeDevicesByType(type),
      ).map(async (device) =>
        this.#getHomeDeviceErrorEntries(device, timeZone),
      ),
    )
    return logs.flat()
  }

  // Driver ids are a store compat contract: Home drivers are namespaced
  // `home-*` (see DRIVER_IDS_BY_TYPE), Classic ids are bare.
  #hasPairedDevices(api: Api): boolean {
    return this.#getDrivers().some(
      (driver) =>
        (driver.id.startsWith('home-') ? 'home' : 'classic') === api &&
        driver.getDevices().length > 0,
    )
  }

  #holidayModeDays(duration: unknown): number {
    const days = toDurationDays(duration)
    if (
      !Number.isSafeInteger(days) ||
      days < HOLIDAY_MODE_OFF_DURATION ||
      days > HOLIDAY_MODE_MAX_DURATION_DAYS
    ) {
      throw new RangeError(this.homey.__('errors.invalidDuration'))
    }
    return days
  }

  #holidayModeEndTime(time: unknown): Temporal.PlainTime {
    if (
      typeof time !== 'string' ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/v.test(time)
    ) {
      throw new RangeError(this.homey.__('errors.invalidTime'))
    }
    return Temporal.PlainTime.from(time)
  }

  // Disabling holiday mode: both APIs ignore the window when off, so the
  // bounds are stamped at now for a valid, self-consistent payload.
  #holidayModeOff(): HolidayModeUpdate {
    const now = Temporal.Now.plainDateTimeISO(
      getTimeZone(this.homey),
    ).toString()
    return { endDate: now, isEnabled: false, startDate: now }
  }

  // The window a holiday card applies: start = now, end = `days` calendar
  // days after today at `endTime` (default 00:00 — the start of that day,
  // not 24:00). The end is rejected when it is not after now (e.g. 0 days
  // at a time already past today).
  #holidayModeWindow(
    days: number,
    endTime?: Temporal.PlainTime,
  ): HolidayModeUpdate {
    const now = Temporal.Now.plainDateTimeISO(getTimeZone(this.homey))
    const end = now.toPlainDate().add({ days }).toPlainDateTime(endTime)
    if (Temporal.PlainDateTime.compare(end, now) <= 0) {
      throw new RangeError(this.homey.__('errors.invalidHolidayModeEnd'))
    }
    return {
      endDate: end.toString(),
      isEnabled: true,
      startDate: now.toString(),
    }
  }

  async #initClassicApi(config: {
    language: string
    locale: string
    timezone: string
  }): Promise<void> {
    this.#classicApi = await Classic.API.create({
      ...config,
      abortSignal: this.#abortController.signal,
      events: {
        onSyncComplete: this.#onSync,
        onAuthenticationLost: () => {
          this.#notifySessionLost('classic')
        },
        onAuthenticationRestored: () => {
          this.#notifySessionRestored('classic')
        },
      },
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager(),
      shouldResumeSessionInBackground: true,
    })
    this.#facadeManager = new Classic.FacadeManager(
      this.#classicApi,
      this.#classicRegistry,
    )
    setClassicFacadeManager(this.#facadeManager)
  }

  // Mirrors #initClassicApi: create + facade wiring, no fetch. The
  // boot-time registry contract lives in melcloud-api, identically for
  // both APIs — the session restore runs in the BACKGROUND
  // (`shouldResumeSessionInBackground`), so `create()` returns
  // immediately and `onInit` stays within the SDK's 30-second ready
  // budget on slow devices and networks; the restore then populates the
  // registry and arms the auto-sync whenever a session or credentials
  // are available, `authenticate()` enforces a post-auth sync, and no
  // credentials means total silence.
  // An app-side `list()` here would duplicate that fetch when
  // authenticated and, for a Classic-only user, 401 — and keep 401ing
  // every cycle, since `runSyncCycle` reschedules from its `finally`.
  async #initHomeApi(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    this.#homeApi = await Home.API.create({
      abortSignal: this.#abortController.signal,
      events: {
        onSyncComplete: this.#onSync,
        onAuthenticationLost: () => {
          this.#notifySessionLost('home')
        },
        onAuthenticationRestored: () => {
          this.#notifySessionRestored('home')
        },
      },
      locale: language,
      logger: this.#createLogger(),
      settingManager: this.#createSettingManager('home'),
      shouldResumeSessionInBackground: true,
      timezone: getTimeZone(this.homey),
    })
    this.#homeFacadeManager = new Home.FacadeManager(this.#homeApi)
  }

  async #logBootReady(): Promise<void> {
    await this.homey.ready()
    this.log('Boot: ready after', process.uptime().toFixed(1), 's')
  }

  // User-facing half of melcloud-api's onAuthenticationLost contract:
  // nothing else can surface a background session loss (widgets have no
  // alert API and no webview is open when a sync loses the session).
  // The library fires once per loss episode, so no dedup is needed
  // here; the deferral mirrors #createNotification (off the event
  // callstack, best-effort). Residual credentials on an API without any
  // paired device (say, a Classic-only user who once tried Home) only
  // get a log line: the timeline nag is reserved for a loss that stops
  // device updates. The episode is recorded synchronously so a
  // recovery event can never outrun it.
  #notifySessionLost(api: Api): void {
    this.#sessionLossStates.set(api, 'pending')
    this.homey.setTimeout(async () => this.#announceSessionLost(api), 0)
  }

  // Recovery counterpart of #notifySessionLost, fed by melcloud-api's
  // onAuthenticationRestored (once per loss episode). Consumes the
  // episode synchronously: a loss still 'pending' means the user never
  // saw it — erasing it silences BOTH the stale loss (its parked
  // handler finds no pending episode) and this follow-up. Only a loss
  // actually displayed earns the "signed in again" confirmation.
  #notifySessionRestored(api: Api): void {
    const state = this.#sessionLossStates.get(api)
    this.#sessionLossStates.delete(api)
    if (state !== 'shown') {
      return
    }
    this.homey.setTimeout(async () => {
      try {
        await this.homey.notifications.createNotification({
          excerpt: this.homey.__(`notifications.sessionRestored.${api}`),
        })
      } catch {
        // Non-critical: notification display is best-effort
      }
    }, 0)
  }

  #registerFlowListeners(): void {
    // Both duration cards start now and only differ by the end-of-window
    // time — midnight for the bare card, the chosen time for the with-time
    // card; the false card just clears the window.
    this.#registerHolidayModeCard('holiday_mode_action', ({ duration }) => {
      const days = this.#holidayModeDays(duration)
      return days > HOLIDAY_MODE_OFF_DURATION ?
          this.#holidayModeWindow(days)
        : this.#holidayModeOff()
    })
    this.#registerHolidayModeCard(
      'holiday_mode_with_time_action',
      ({ duration, time }) =>
        this.#holidayModeWindow(
          this.#holidayModeDays(duration),
          this.#holidayModeEndTime(time),
        ),
    )
    this.#registerHolidayModeCard('holiday_mode_false_action', () =>
      this.#holidayModeOff(),
    )
    this.#registerHolidayModeCondition()
  }

  #registerHolidayModeCard(
    id: string,
    toSettings: (args: HolidayModeActionArgs) => HolidayModeUpdate,
  ): void {
    const card = this.homey.flow.getActionCard(id)
    card.registerArgumentAutocompleteListener('zone', (query) =>
      this.#searchHolidayModeTargets(query),
    )
    card.registerRunListener(async (args: HolidayModeActionArgs) => {
      const settings = toSettings(args)
      const { zone } = args
      if ('deviceId' in zone) {
        await this.updateHomeHolidayMode([zone.deviceId], settings)
        return
      }
      await this.updateClassicHolidayMode({
        settings,
        zoneId: zone.zoneId,
        zoneType: zone.zoneType,
      })
    })
  }

  #registerHolidayModeCondition(): void {
    const card = this.homey.flow.getConditionCard('holiday_mode_condition')
    card.registerArgumentAutocompleteListener('zone', (query) =>
      this.#searchHolidayModeTargets(query),
    )
    card.registerRunListener(async ({ zone }: { zone: HolidayModeTarget }) => {
      if ('deviceId' in zone) {
        return this.getHomeHolidayMode(zone.deviceId)?.enabled === true
      }
      const { HMEnabled: isEnabled } = await this.getClassicHolidayMode({
        zoneId: zone.zoneId,
        zoneType: zone.zoneType,
      })
      return isEnabled
    })
  }

  #registerWidgetListeners(): void {
    this.homey.dashboards
      .getWidget('ata-group-setting')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        this.#searchAtaTargets(query),
      )
    this.homey.dashboards
      .getWidget('charts')
      .registerSettingAutocompleteListener('default_zone', (query) =>
        [
          ...filterZonesByName(this.getClassicDeviceZones(), query),
          ...filterZonesByName(this.getHomeDeviceZones(), query),
        ].toSorted(byName),
      )
  }

  // Everything the ATA group widget can target: the Classic zones and
  // devices, then the Home buildings with their devices (alpha-sorted).
  #searchAtaTargets(
    query: string,
  ): (Classic.Zone | HomeBuildingZone | HomeDeviceZone)[] {
    return [
      ...this.#searchZones(query, { type: Classic.DeviceType.Ata }),
      ...filterZonesByName(this.getHomeAtaTargets(), query),
    ]
  }

  // Holiday-mode / condition targets: Classic zones and devices, then the
  // individual Home devices (alpha-sorted). Each selected item carries its
  // own routing — zone coordinates or a Home device id.
  #searchHolidayModeTargets(query: string): HolidayModeTarget[] {
    return [
      ...toZoneAutocompleteItems(this.#searchZones(query)),
      ...toHomeDeviceAutocompleteItems(
        filterZonesByName(this.getHomeDeviceZones(), query),
      ),
    ].toSorted(byName)
  }

  // One zone-search pipeline for the tree-shaped autocomplete surfaces
  // (flow zones, ATA group targets): registry fetch (instance state),
  // optional type narrowing, then query filtering.
  #searchZones(
    query: string,
    { type }: { type?: Classic.DeviceType } = {},
  ): Classic.Zone[] {
    const zones = this.#facadeManager.getZones(
      type === undefined ? {} : { type },
    )
    return filterZonesByName(zones, query)
  }

  // Residual credentials on an API without any paired device only get
  // a log line: the timeline nag is reserved for a loss that stops
  // device updates.
  #shouldAnnounceSessionLost(api: Api): boolean {
    if (this.#sessionLossStates.get(api) !== 'pending') {
      // The session recovered while we waited: the loss is stale.
      return false
    }
    if (this.#hasPairedDevices(api)) {
      return true
    }
    this.#sessionLossStates.delete(api)
    this.log('Session lost on', api, 'ignored: no paired device')
    return false
  }
}
