import 'source-map-support/register.js'

import type {
  FullReportSurface,
  ReportSurface,
} from '@olivierzal/melcloud-api/report'
import {
  fireAndForget,
  NotFoundError,
  selectChangelogEntries,
  sequential,
} from '@olivierzal/homey-kit'
import {
  type DriverSetting,
  getDriverLoginSetting,
  getDriverSettings,
  mergeDeviceSettings,
} from '@olivierzal/homey-kit/manifest'
import {
  type DeviceType,
  type FlatZone,
  type HolidayModeUpdate,
  type HomeBuildingZone,
  type HomeDeviceZone,
  type Hour,
  type ProtectionUpdate,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type Result,
  type SettingManager,
  type SyncCallback,
  isClassicAtaFacade,
  resolveErrorLogWindow,
} from '@olivierzal/melcloud-api'
import { Intl, Temporal } from 'temporal-polyfill'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type {
  Api,
  HolidayModeSettings,
  TargetHolidayModeState,
  TargetProtectionState,
} from './types/api.mts'
import type { HomeySettings } from './types/app-settings.mts'
import type { DeviceSettings, Settings } from './types/device-settings.mts'
import type { DriverCapabilitiesOptions } from './types/driver-settings.mts'
import type {
  FormattedErrorDetails,
  FormattedErrorLog,
} from './types/error-log.mts'
import type { HomeDeviceFacade } from './types/home.mts'
import type { ManifestDriverCapabilitiesOptions } from './types/manifest.mts'
import type { MELCloudDevice, MELCloudDriver } from './types/melcloud.mts'
import type {
  DeviceOrZoneData,
  FlatDeviceZone,
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
import { getCapabilityFlowStep } from './lib/capability-flow-step.mts'
import { setClassicFacadeManager } from './lib/classic-facade-manager.mts'
import { type Homey, App } from './lib/homey.mts'
import { getTimeZone } from './lib/temporal.mts'
import { unwrapResult } from './lib/unwrap-result.mts'
import { toNonNegativeInt, toZoneValueData } from './lib/validation.mts'
import {
  getHomeBuildingId,
  getHomeDeviceId,
  getZoneId,
  isHomeBuildingValue,
  isHomeDeviceValue,
} from './public/zones.mts'
import { fanSpeedValues } from './types/ata-erv.mts'

// Locale-aware by-name comparator shared by every zone/building sort.
const byName = (
  first: { readonly name: string },
  other: { readonly name: string },
): number => first.name.localeCompare(other.name)

const HOLIDAY_MODE_MAX_DURATION_DAYS = 365
const HOLIDAY_MODE_OFF_DURATION = 0

const NOTIFICATION_DELAY_MS = 10_000

// The one surface every settings target answers — Classic zone/device
// facades, Home device facades and the Home building facade alike; the
// widened return unions absorb the building aggregates' per-field nulls.
interface SettingsTarget {
  readonly getFrostProtection: () => Promise<Result<TargetProtectionState>>
  readonly getHolidayMode: () => Promise<Result<TargetHolidayModeState>>
  readonly updateFrostProtection: (update: ProtectionUpdate) => Promise<void>
  readonly updateHolidayMode: (update: HolidayModeUpdate) => Promise<void>
}

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
  days === 0
    ? daysAgo(1, timezone)
    : Temporal.Now.zonedDateTimeISO(timezone)
        .startOfDay()
        .subtract({ days: days - 1 })
        .toPlainDateTime()
        .toString()

// The manifest min/max/step only constrain manual input: a flow token
// dropped into the field can carry anything at runtime. Only numbers
// and numeric strings are accepted — coercing other types (false,
// null, '') would silently read as 0 and turn holiday mode off.
// Flow-action arguments shared by the holiday-mode cards: `zone` always,
// `duration`/`time` only on the cards that declare them. The zone carries
// its `${model}_${id}` option value as `id` — the shape stored card args
// in existing Flows carry — so run listeners route by parsing it.
interface HolidayModeActionArgs {
  zone: FlatZoneItem
  duration?: unknown
  time?: unknown
}

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?: Record<string, number | string>,
): DriverCapabilitiesOptions => ({
  title: options.title[language] ?? options.title.en,
  type: options.type,
  ...(options.max !== undefined && { max: options.max }),
  ...(options.min !== undefined && { min: options.min }),
  ...(options.step !== undefined && { step: options.step }),
  values: options.values?.map(({ id, title }) => ({
    id:
      enumType !== undefined && Object.hasOwn(enumType, id)
        ? String(enumType[id])
        : id,
    label: title[language] ?? title.en,
  })),
})

// The ATA group surface every target answers — Classic zone facades,
// both families' ATA device facades (each a group of one) and the Home
// building facade — per the melcloud-api contract this feature tracks:
// state and member modes speak the ONE Classic-numbered vocabulary
// whichever API serves the target.
type AtaGroupTarget = Pick<
  Classic.ZoneFacade,
  'getGroup' | 'getMemberOperationModes' | 'updateGroupState'
>

// A flat autocomplete/select item: the `${model}_${id}` option value as
// `id` (unique, and the routing key run listeners parse) plus the display
// name. Shared by the holiday flow cards and the settings zone selector.
interface FlatZoneItem {
  readonly id: string
  readonly name: string
}

// A flat picker lists every node at one level, so a leaf's bare name can
// collide with a same-named leaf on another building; suffixing it with its
// owning building keeps them apart. Building nodes locate themselves and
// keep the bare name — as do tree-shaped lists, where the hierarchy already
// places each node. The one suffix rule for every flat surface (holiday
// flow, chart and group widget pickers).
const toFlatName = ({ buildingName, model, name }: FlatZone): string => {
  const trimmed = name.trim()
  return model === 'buildings' || model === 'homeBuildings'
    ? trimmed
    : `${trimmed} (${buildingName.trim()})`
}

// Flat autocomplete items over the given nodes, name-sorted. The selected
// item's `id` carries the `${model}_${id}` routing value run listeners parse.
const toFlatZoneItems = (nodes: readonly FlatZone[]): FlatZoneItem[] =>
  nodes
    .map((node) => ({
      id: getZoneId(node.id, node.model),
      name: toFlatName(node),
    }))
    .toSorted(byName)

const filterZonesByName = <T extends { readonly name: string }>(
  zones: readonly T[],
  query: string,
): T[] => {
  const lowerCaseQuery = query.toLowerCase()
  return zones.filter(({ name }) => name.toLowerCase().includes(lowerCaseQuery))
}

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
interface RawErrorEntry {
  readonly device: string
  readonly error: string
  readonly instant: Temporal.Instant
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
        Temporal.Instant.compare(instant, MIN_PLAUSIBLE_ERROR_INSTANT) < 0
          ? UNKNOWN_DATE_PLACEHOLDER
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
    await this.#initClassicApi()
    await this.#initHomeApi()
    this.#createNotification(this.homey.i18n.getLanguage())
    this.#registerWidgetListeners()
    this.#registerFlowListeners()
    // Poke any open webview to re-run its freshness handshake: an app
    // (re)boot is exactly when the served hashes may have moved.
    this.homey.api.realtime('webview_hashes_changed', null)
    fireAndForget(this.#logBootReady(), this, 'Boot readiness tracking failed:')
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
    const facade = this.#facadeManager.getById(zoneType, Number(id))
    if (facade === null) {
      throw new NotFoundError(
        this.homey.__(
          `errors.${zoneType === 'devices' ? 'device' : 'zone'}NotFound`,
        ),
      )
    }
    return facade
  }

  // The Classic zone source: every zone (buildings, floors, areas, devices)
  // flattened, each stamped with its owning building name, optionally
  // narrowed to one device type. Every flat Classic picker draws from
  // here with the filters it needs.
  public getClassicTargets(type?: Classic.DeviceType): Classic.FlatZone[] {
    return this.#facadeManager.getZones({ type })
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

  // The chart pickers' vocabulary: the flat device leaves of BOTH
  // dialects as one alphabetical list, each suffixed with its building
  // and carrying its `deviceType` tag, so the widget derives every
  // per-chart line-up from a single fetch.
  public getDeviceZones(): FlatDeviceZone[] {
    return [
      ...this.getClassicTargets()
        .filter((node) => node.model === 'devices')
        .map((node) => ({
          deviceType: node.deviceType,
          id: node.id,
          level: node.level,
          model: 'devices' as const,
          name: toFlatName(node),
        })),
      ...this.getHomeTargets()
        .filter((node): node is HomeDeviceZone => node.model === 'homeDevices')
        .map((node) => ({ ...node, name: toFlatName(node) })),
    ].toSorted(byName)
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
    const { entries, fromDate, ...rest } = await this.#getClassicErrorLogPage(
      query,
      timeZone,
    )
    const window = {
      from: Temporal.PlainDate.from(fromDate),
      timeZone,
      to:
        query.to !== undefined && query.to !== ''
          ? Temporal.PlainDate.from(query.to)
          : null,
    }
    const allHomeEntries = await this.#getHomeErrorEntries(timeZone)
    const homeEntries = allHomeEntries.filter((entry) =>
      isWithinErrorLogWindow(entry.instant, window),
    )
    const classicEntries = entries.map(
      ({ at, deviceId, message }): RawErrorEntry => ({
        device: this.#classicRegistry.devices.getById(deviceId)?.name ?? '',
        error: message,
        instant: parseErrorDate(at, timeZone),
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

  public getHomeDevicesByType(type: Home.DeviceType): Home.Device[] {
    return this.#homeRegistry.getDevicesByType(type)
  }

  public getHomeFacade<T extends Home.DeviceType>(
    deviceId: string,
    type: T,
  ): HomeDeviceFacade<T>
  public getHomeFacade(
    deviceId: string,
    type: Home.DeviceType,
  ): Home.DeviceAtaFacade | Home.DeviceAtwFacade {
    return this.#getHomeDeviceFacade(deviceId, type)
  }

  // The flattened Home picker list — name-sorted buildings (level 0) each
  // followed by its own devices (level 1); `type` narrows to one
  // connection type (the ATA group widget), omitted spans both (the
  // settings selector).
  public getHomeTargets(
    type?: Home.DeviceType,
  ): (HomeBuildingZone | HomeDeviceZone)[] {
    return this.#homeFacadeManager.getZones({ type })
  }

  // Member operation modes for the widget's mixed-mode scene resolver —
  // powered units only (an off unit paints no scene), Classic-numbered
  // whichever API serves the members.
  public getTargetAtaModes(targetId: string): Classic.OperationMode[] {
    return this.#getAtaGroupTarget(targetId).getMemberOperationModes({
      poweredOnly: true,
    })
  }

  public async getTargetAtaState(
    targetId: string,
  ): Promise<Classic.GroupState> {
    return unwrapResult(await this.#getAtaGroupTarget(targetId).getGroup())
  }

  public async getTargetEnergyReport({
    days,
    targetId,
  }: {
    days: number
    targetId: string
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getReportTarget(targetId).getEnergyReport(
        this.#chartDaysQuery(days),
      ),
    )
  }

  public async getTargetFrostProtection(
    targetId: string,
  ): Promise<TargetProtectionState> {
    return unwrapResult(
      await this.#getSettingsTarget(targetId).getFrostProtection(),
    )
  }

  public async getTargetHolidayMode(
    targetId: string,
  ): Promise<TargetHolidayModeState> {
    return unwrapResult(
      await this.#getSettingsTarget(targetId).getHolidayMode(),
    )
  }

  public async getTargetHourlyTemperatures({
    hour,
    targetId,
  }: {
    targetId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getFullReportTarget(targetId).getHourlyTemperatures(hour),
    )
  }

  public async getTargetOperationModes({
    days,
    targetId,
  }: {
    days: number
    targetId: string
  }): Promise<ReportChartPieOptions> {
    return unwrapResult(
      await this.#getFullReportTarget(targetId).getOperationModes(
        this.#chartDaysQuery(days),
      ),
    )
  }

  // Overheat protection exists on Home targets only: a Classic target
  // reads `null`, like a Home target that never configured it.
  public async getTargetOverheatProtection(
    targetId: string,
  ): Promise<TargetProtectionState> {
    const target = this.#getHomeTarget(targetId)
    return target === null
      ? null
      : unwrapResult(await target.getOverheatProtection())
  }

  public async getTargetSignal({
    hour,
    targetId,
  }: {
    targetId: string
    hour?: Hour | undefined
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getReportTarget(targetId).getSignalStrength(hour),
    )
  }

  public async getTargetTemperatures({
    days,
    targetId,
  }: {
    days: number
    targetId: string
  }): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getReportTarget(targetId).getTemperatures(
        this.#chartDaysQuery(days),
      ),
    )
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

  // VERDICT (2026-08): no app-side no-change handling, on any leg. The
  // pre-unification handlers disagreed (the Home device leg swallowed
  // `NoChangesError`, its twins propagated), but melcloud-api 53.0.0
  // pins no-op tolerance in the library itself — every `updateGroupState`
  // resolves a delta the target already matches as the success it is —
  // so nothing can propagate and a catch here would re-derive a library
  // invariant. The widget's arming gate blocks empty bodies, not bodies
  // the device caught up with meanwhile; those are successes too.
  public async updateTargetAtaState(
    targetId: string,
    state: Classic.GroupState,
  ): Promise<void> {
    await this.#getAtaGroupTarget(targetId).updateGroupState(state)
  }

  public async updateTargetFrostProtection(
    targetId: string,
    settings: ProtectionUpdate,
  ): Promise<void> {
    await this.#getSettingsTarget(targetId).updateFrostProtection(settings)
  }

  public async updateTargetHolidayMode(
    targetId: string,
    settings: HolidayModeSettings,
  ): Promise<void> {
    await this.#getSettingsTarget(targetId).updateHolidayMode(
      this.#completeHolidayModeWindow(settings),
    )
  }

  public async updateTargetOverheatProtection(
    targetId: string,
    settings: ProtectionUpdate,
  ): Promise<void> {
    const target = this.#getHomeTarget(targetId)
    if (target === null) {
      // Overheat protection does not exist on the Classic wire: a write
      // addressed to a Classic target is a caller error, not a no-op.
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    await target.updateOverheatProtection(settings)
  }

  readonly #onSync: SyncCallback = async ({ ids, type } = {}) => {
    await this.#classicSyncDevices({
      driverId: type === undefined ? undefined : DRIVER_IDS_BY_TYPE[type],
      ids,
    })
  }

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

  // The day-chart query every dialect's report reads. Derived once: the
  // window anchor and the timezone source must not drift between the six
  // call sites, which the facades' shared `(query?: ReportQuery)` contract
  // lets us state in a single place.
  #chartDaysQuery(days: number): { from: string } {
    return { from: chartDaysStart(days, getTimeZone(this.homey)) }
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

  // One clock for every entry point: the Homey's. An absent bound means
  // "now" — stamping here keeps the settings page and the flow cards on
  // the same clock whatever timezone the phone sits in.
  #completeHolidayModeWindow({
    endDate,
    isEnabled,
    startDate,
  }: HolidayModeSettings): HolidayModeUpdate {
    const nowAtHomey = Temporal.Now.plainDateTimeISO(
      getTimeZone(this.homey),
    ).toString()
    return {
      endDate: endDate ?? nowAtHomey,
      isEnabled,
      startDate: startDate ?? nowAtHomey,
    }
  }

  #createNotification(language: string): void {
    const { homey } = this
    const {
      manifest: { version },
      notifications,
      settings,
    } = homey
    // Every release since the one already announced, not just the
    // running one: a user who updates rarely would otherwise never hear
    // about the versions in between. The SDK read is untyped, as
    // everywhere else settings are read: a stored value that is not a
    // string reads as no baseline at all.
    const notified: unknown = settings.get('notifiedVersion')
    const { entries } = selectChangelogEntries({
      changelog,
      from: typeof notified === 'string' ? notified : null,
      language,
      to: version,
    })
    if (entries.length === 0) {
      return
    }
    homey.setTimeout(async () => {
      try {
        await sequential(entries, async ({ excerpt }) => {
          await notifications.createNotification({ excerpt })
        })
        settings.set('notifiedVersion', version)
      } catch {
        // Non-critical: notification display is best-effort
      }
    }, NOTIFICATION_DELAY_MS)
  }

  #createSettingManager(api: Api = 'classic'): SettingManager {
    // Classic owns the unprefixed keys (legacy); Home is namespaced to
    // avoid collisions (e.g. `username` → `homeUsername`).
    // The one boundary where a settings key arrives untyped: the
    // library's `SettingManager` is keyed by plain strings, and it
    // derives each key from the name of the accessor its `@setting`
    // decorator wraps — so the key set belongs to the library and grows
    // with its releases. The narrowing rides the prefixing that already
    // happens here, and nowhere else in the app.
    const prefixKey = (key: string): keyof HomeySettings =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the library's SettingManager contract types its keys as plain strings
      (api === 'classic'
        ? key
        : `${api}${key.charAt(0).toUpperCase()}${key.slice(1)}`) as keyof HomeySettings
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
    const ataOptions = this.homey.manifest.drivers.find(
      ({ id }) => id === 'melcloud',
    )?.capabilitiesOptions
    return [
      { key: 'Power', options: power },
      {
        key: 'SetTemperature',
        // The vendored capability is the generic definition (4–35);
        // this driver's manifest narrows the bounds (10–31), and the
        // step comes from the capability's own flow argument — see
        // `getCapabilityFlowStep` for why that field, and what keeps it
        // honest — and why neither API's increment is read instead.
        options: {
          ...targetTemperature,
          ...ataOptions?.target_temperature,
          step: getCapabilityFlowStep(targetTemperature),
        },
      },
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
          values: ataOptions?.thermostat_mode?.values?.filter(
            ({ id }) => id !== 'off',
          ),
        },
      },
    ]
  }

  // The ATA group twin of `#getSettingsTarget`: the targetId is the
  // picker value verbatim, and addressing is the only family-visible
  // step — everything downstream speaks the one group vocabulary.
  #getAtaGroupTarget(targetId: string): AtaGroupTarget {
    if (isHomeBuildingValue(targetId)) {
      return this.#getHomeBuildingFacade(getHomeBuildingId(targetId))
    }
    if (isHomeDeviceValue(targetId)) {
      return this.getHomeFacade(getHomeDeviceId(targetId), Home.DeviceType.Ata)
    }
    return this.#getClassicAtaGroupFacade(toZoneValueData(targetId))
  }

  #getClassicAtaGroupFacade({
    zoneId,
    zoneType,
  }: DeviceOrZoneData): AtaGroupTarget {
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
    if (!this.#classicApi.isAuthenticated()) {
      // A Home-only account pages the same windows the Classic API
      // would have answered: the library publishes its own tiling.
      const { fromDate, nextFromDate, nextToDate } = resolveErrorLogWindow(
        { period: DEFAULT_ERROR_LOG_PERIOD_DAYS, ...query },
        timeZone,
      )
      return { entries: [], fromDate, nextFromDate, nextToDate }
    }
    return unwrapResult(await this.#classicApi.getErrorLog(query))
  }

  // The Classic leg both chart resolvers share: only the flat device
  // leaves chart, so any other zone level answers the device error.
  #getClassicReportDevice(targetId: string): FullReportSurface {
    const { zoneId, zoneType } = toZoneValueData(targetId)
    if (zoneType !== 'devices') {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    return this.getClassicFacade('devices', zoneId)
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
      return stringIds === undefined
        ? devices
        : devices.filter(({ id }) => stringIds.includes(String(id)))
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
    return driverId === undefined
      ? drivers
      : drivers.filter((driver) => driver.id === driverId)
  }

  // Chart-target resolver for the ATW-only reads (hourly temperatures,
  // operation modes): the Home leg pins the ATW type — a Home ATA
  // target answers NotFoundError, nothing emulated, because its wire
  // has no such report — while every Classic device answers the full
  // surface (non-ATW types resolve empty charts wire-side).
  #getFullReportTarget(targetId: string): FullReportSurface {
    return isHomeDeviceValue(targetId)
      ? this.getHomeFacade(getHomeDeviceId(targetId), Home.DeviceType.Atw)
      : this.#getClassicReportDevice(targetId)
  }

  // A Home building is a zone in the picker vocabulary, so a missing
  // one answers the same error class as its Classic counterpart.
  #getHomeBuildingFacade(buildingId: string): Home.BuildingFacade {
    const facade = this.#homeFacadeManager.getBuilding(buildingId)
    if (facade === null) {
      throw new NotFoundError(this.homey.__('errors.zoneNotFound'))
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
    return result.value.map(({ at, code, message }) => ({
      device: name,
      error: message ?? code ?? '',
      instant: parseErrorDate(at, timeZone),
    }))
  }

  // Device facade lookup shared by every Home surface: type-agnostic
  // for the chart routes both device types serve, type-checked when a
  // caller names the type it needs.
  #getHomeDeviceFacade(
    deviceId: string,
    type?: Home.DeviceType,
  ): Home.DeviceAtaFacade | Home.DeviceAtwFacade {
    const facade = this.#homeFacadeManager.getById(deviceId)
    if (facade === null || (type !== undefined && facade.type !== type)) {
      throw new NotFoundError(this.homey.__('errors.deviceNotFound'))
    }
    return facade
  }

  async #getHomeErrorEntries(timeZone: string): Promise<RawErrorEntry[]> {
    const logs = await Promise.all(
      this.#homeRegistry
        .getDevices()
        .map(async (device) =>
          this.#getHomeDeviceErrorEntries(device, timeZone),
        ),
    )
    return logs.flat()
  }

  // The Home target for a picker value, or `null` when the value
  // addresses the Classic family. Doubles as the overheat resolver:
  // overheat protection exists on Home targets only.
  #getHomeTarget(
    targetId: string,
  ): Home.BuildingFacade | Home.DeviceAtaFacade | Home.DeviceAtwFacade | null {
    if (isHomeBuildingValue(targetId)) {
      return this.#getHomeBuildingFacade(getHomeBuildingId(targetId))
    }
    return isHomeDeviceValue(targetId)
      ? this.#getHomeDeviceFacade(getHomeDeviceId(targetId))
      : null
  }

  // Chart-target resolver for the reads every device-level target
  // answers, on either dialect.
  #getReportTarget(targetId: string): ReportSurface {
    return isHomeDeviceValue(targetId)
      ? this.#getHomeDeviceFacade(getHomeDeviceId(targetId))
      : this.#getClassicReportDevice(targetId)
  }

  // The one target resolver behind the neutral settings routes: the
  // targetId is the picker value verbatim (`${model}_${id}`), so
  // addressing is the only family-visible step left.
  #getSettingsTarget(targetId: string): SettingsTarget {
    const homeTarget = this.#getHomeTarget(targetId)
    if (homeTarget !== null) {
      return homeTarget
    }
    const { zoneId, zoneType } = toZoneValueData(targetId)
    return this.getClassicFacade(zoneType, zoneId)
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

  // The zero lower bound (`HOLIDAY_MODE_OFF_DURATION`) is what
  // `toNonNegativeInt` already enforces; the boundary only translates
  // the failure into the user's language.
  #holidayModeDays(duration: unknown): number {
    try {
      return toNonNegativeInt(duration, { max: HOLIDAY_MODE_MAX_DURATION_DAYS })
    } catch {
      throw new RangeError(this.homey.__('errors.invalidDuration'))
    }
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

  async #initClassicApi(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    this.#classicApi = await Classic.API.create({
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
      language,
      locale: language,
      logger: this,
      settingManager: this.#createSettingManager(),
      shouldResumeSessionInBackground: true,
      timezone: getTimeZone(this.homey),
    })
    this.#facadeManager = new Classic.FacadeManager(this.#classicApi)
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
      logger: this,
      settingManager: this.#createSettingManager('home'),
      shouldResumeSessionInBackground: true,
      timezone: getTimeZone(this.homey),
    })
    this.#homeFacadeManager = new Home.FacadeManager(this.#homeApi)
  }

  // Is holiday mode on for a flat target value? The option value IS the
  // targetId, so the neutral read answers directly — a building is "on"
  // only when every member agrees (the aggregate's `null` reads false).
  async #isHolidayModeEnabled(value: string): Promise<boolean> {
    const holidayMode = await this.getTargetHolidayMode(value)
    return holidayMode?.isEnabled === true
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
  // callstack, best-effort). The episode is recorded synchronously so a
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
      return days > HOLIDAY_MODE_OFF_DURATION
        ? this.#holidayModeWindow(days)
        : { isEnabled: false }
    })
    this.#registerHolidayModeCard(
      'holiday_mode_with_time_action',
      ({ duration, time }) =>
        this.#holidayModeWindow(
          this.#holidayModeDays(duration),
          this.#holidayModeEndTime(time),
        ),
    )
    this.#registerHolidayModeCard('holiday_mode_false_action', () => ({
      isEnabled: false,
    }))
    this.#registerHolidayModeCondition()
  }

  #registerHolidayModeCard(
    id: string,
    toSettings: (args: HolidayModeActionArgs) => HolidayModeSettings,
  ): void {
    const card = this.homey.flow.getActionCard(id)
    card.registerArgumentAutocompleteListener('zone', (query) =>
      this.#searchHolidayModeTargets(query),
    )
    card.registerRunListener(async (args: HolidayModeActionArgs) => {
      await this.updateTargetHolidayMode(args.zone.id, toSettings(args))
    })
  }

  #registerHolidayModeCondition(): void {
    const card = this.homey.flow.getConditionCard('holiday_mode_condition')
    card.registerArgumentAutocompleteListener('zone', (query) =>
      this.#searchHolidayModeTargets(query),
    )
    card.registerRunListener(async ({ zone }: { zone: FlatZoneItem }) =>
      this.#isHolidayModeEnabled(zone.id),
    )
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
        filterZonesByName(this.getDeviceZones(), query),
      )
  }

  // Everything the ATA group widget can target: every Classic zone/device
  // and every Home building/device, each leaf suffixed with its building
  // and the whole list drawn from the two shared sources.
  #searchAtaTargets(
    query: string,
  ): (Classic.Zone | HomeBuildingZone | HomeDeviceZone)[] {
    return filterZonesByName(
      [
        ...this.getClassicTargets(Classic.DeviceType.Ata),
        ...this.getHomeTargets(Home.DeviceType.Ata),
      ].map((node) => ({ ...node, name: toFlatName(node) })),
      query,
    )
  }

  // Holiday-mode / condition targets: every Classic zone/device and every
  // Home building/device, each carrying its `${model}_${id}` routing value
  // and a building-suffixed display name, name-sorted.
  #searchHolidayModeTargets(query: string): FlatZoneItem[] {
    return filterZonesByName(
      toFlatZoneItems([...this.getClassicTargets(), ...this.getHomeTargets()]),
      query,
    )
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
