import 'source-map-support/register.js'

import type {
  FullReportSurface,
  ReportSurface,
} from '@olivierzal/melcloud-api/report'
import type { DriverManifest } from 'homey/types/manifest'
import {
  announceChangelog,
  createSettingManager,
  fireAndForget,
  getErrorMessage,
  NotFoundError,
  settleAll,
} from '@olivierzal/homey-kit'
import {
  type DriverSetting,
  getDriverLoginSetting,
  getDriverSettings,
  localize,
  mergeDeviceSettings,
} from '@olivierzal/homey-kit/manifest'
import {
  type AtaGroup,
  type DeviceType,
  type FlatZone,
  type HolidayModeUpdate,
  type HomeBuildingZone,
  type HomeDeviceZone,
  type ProtectionUpdate,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type Result,
  type SettingManager,
  type SyncCallback,
  combineAtaGroups,
  isClassicAtaFacade,
  isWithinErrorLogWindow,
  logFailure,
  NoChangesError,
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
import type { MELCloudHomey } from './types/homey.mts'
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
import {
  API_DISPLAY_NAMES,
  OTHER_API,
  UNKNOWN_DATE_PLACEHOLDER,
} from './lib/constants.mts'
import { App } from './lib/homey.mts'
import { failureCause, unwrapResult } from './lib/unwrap-result.mts'
import { toNonNegativeInt, toZoneValueData } from './lib/validation.mts'
import {
  type MergedBuildingItem,
  type SameNamePair,
  getHomeBuildingId,
  getHomeDeviceId,
  getZoneId,
  isHomeBuildingValue,
  isHomeDeviceValue,
  isMergedBuildingValue,
  pairSameNameBuildings,
  tagSameNameBuildings,
  toMergedItem,
} from './public/zones.mts'
import { fanSpeedValues } from './types/ata-erv.mts'
import {
  type ManifestDriverCapabilitiesOptions,
  toCapabilitiesOptionsNarrowing,
} from './types/manifest.mts'

// Locale-aware by-name comparator shared by every zone/building sort.
const byName = (
  first: { readonly name: string },
  other: { readonly name: string },
): number => first.name.localeCompare(other.name)

const HOLIDAY_MODE_MAX_DURATION_DAYS = 365
const HOLIDAY_MODE_OFF_DURATION = 0

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

// Driver ids are a store compat contract: Home drivers are namespaced
// `home-*` (see DRIVER_IDS_BY_TYPE), Classic ids are bare — and that
// prefix IS the account membership rule, so a driver joins its account
// by its id alone (the settings page applies the same rule).
const toApi = (driverId: string): Api =>
  driverId.startsWith('home-') ? 'home' : 'classic'

// The one line a change of an account's unit counts leaves in the log:
// what the account lists, what Homey holds of it.
const formatUnitCounts = (
  api: Api,
  { added, listed }: { added: number; listed: number },
): string =>
  `${API_DISPLAY_NAMES[api]}: ${String(listed)} unit${listed === 1 ? '' : 's'} listed, ${String(added)} added in Homey`

// Day-chart windows anchor on local midnight so "N days" reads as N
// calendar days ending today, consistently across the report, the
// temperatures and the operation-modes charts; `days` 0 is the rolling
// last-24-hours choice the report picker offers when hourly buckets
// exist.
// The report `to` bound defaults to now in the API timezone lib-side.
const chartDaysStart = (days: number, timezone: string): string =>
  (days === 0
    ? Temporal.Now.plainDateTimeISO(timezone).subtract({ days: 1 })
    : Temporal.Now.zonedDateTimeISO(timezone)
        .startOfDay()
        .subtract({ days: days - 1 })
        .toPlainDateTime()
  ).toString()

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

// A capability card's value argument is named after the capability's
// root: the id before the first dot (`thermostat_mode.zone2` →
// `thermostat_mode`).
const getArg = (capability: string): string => capability.replace(/\..*/v, '')

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?: Record<string, number | string>,
): DriverCapabilitiesOptions => ({
  title: localize(options.title, language),
  type: options.type,
  ...(options.max !== undefined && { max: options.max }),
  ...(options.min !== undefined && { min: options.min }),
  ...(options.step !== undefined && { step: options.step }),
  values: options.values?.map(({ id, title }) => ({
    id:
      enumType !== undefined && Object.hasOwn(enumType, id)
        ? String(enumType[id])
        : id,
    label: localize(title, language),
  })),
})

// A fan-out's failures leaf by leaf, a fan-out nested in another — the
// units of a merged house's Home building — included.
const toFailures = (error: unknown): unknown[] =>
  error instanceof AggregateError
    ? error.errors.flatMap((failure: unknown) => toFailures(failure))
    : [error]

// A failure, or each of a fan-out's, named after the account it failed
// on; a fan-out keeps its own message.
const labelFailure = (error: unknown, account: string): Error =>
  error instanceof AggregateError
    ? new AggregateError(
        error.errors.map((failure: unknown) => labelFailure(failure, account)),
        error.message,
      )
    : new Error(`${account}: ${getErrorMessage(error)}`, { cause: error })

// A merged house's write reaches two accounts, either of which can fail
// alone: each one's failure names its account, so the message says which
// one did not apply the change. A no-change passes through untouched,
// for `combineAtaGroups` to count as the success it is.
const withAccountOnFailure = (group: AtaGroup, api: Api): AtaGroup => ({
  getGroup: async () => group.getGroup(),
  getMemberOperationModes: (options) => group.getMemberOperationModes(options),
  updateGroupState: async (state): Promise<void> => {
    try {
      await group.updateGroupState(state)
    } catch (error) {
      throw error instanceof NoChangesError
        ? error
        : labelFailure(error, API_DISPLAY_NAMES[api])
    }
  },
})

// A fan-out's failures — both accounts of a merged house, several units
// of a Home building — travel as one message, each distinct reason once,
// since the webview reads a thrown error's message alone.
const joinFailures = (error: AggregateError): Error => {
  const messages = new Set(
    toFailures(error).map((failure) => getErrorMessage(failure)),
  )
  return new Error(`${error.message}: ${[...messages].join('; ')}`, {
    cause: error,
  })
}

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

// The webview always asks for 29-day pages; mirrored here for the synthetic
// window served when Classic is signed out.
const DEFAULT_ERROR_LOG_PERIOD_DAYS = 29
// The page the settings page asks for: pinned on `from`, chained on
// `to`, never an offset one — the library's window rule would need that
// page's resolved end, which its query does not carry.
type ErrorLogPageQuery = Omit<Classic.ErrorLogQuery, 'offset'>

// The library anchors each entry's moment at its own boundary
// (`atEpochMs`, `null` where the wire cannot say); the app carries it
// as it is and never re-derives an instant from the wall-clock `at`.
interface RawErrorEntry {
  readonly atEpochMs: number | null
  readonly device: string
  readonly error: string
}

// Newest first; entries without an instant sink to the end — their
// dates render as the em-dash marker while the rows themselves are
// kept: the error is real even without its moment.
const compareErrorEntries = (
  first: RawErrorEntry,
  other: RawErrorEntry,
): number =>
  first.atEpochMs === null || other.atEpochMs === null
    ? Number(first.atEpochMs === null) - Number(other.atEpochMs === null)
    : other.atEpochMs - first.atEpochMs

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
    .toSorted(compareErrorEntries)
    .map(({ atEpochMs, device, error }) => ({
      date:
        atEpochMs === null
          ? UNKNOWN_DATE_PLACEHOLDER
          : dateTimeMedFormat.format(atEpochMs),
      device,
      error,
    }))
}

// The group form's mode picker: a capability's options minus `off`,
// which the form drives through its own power control, not as a mode.
const withoutOffMode = (
  options: ManifestDriverCapabilitiesOptions,
): ManifestDriverCapabilitiesOptions => ({
  ...options,
  values: options.values?.filter(({ id }) => id !== 'off'),
})

export default class MELCloudApp extends App {
  declare public readonly homey: MELCloudHomey

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

  // Each Home unit's error log as read since the newest window was last
  // asked for: a unit answers its whole log, so the older windows that
  // follow only filter it.
  readonly #homeErrorLogs = new Map<string, readonly RawErrorEntry[]>()

  #homeFacadeManager!: Home.FacadeManager

  // The accounts a registry sync has landed for (see `isRegistryListed`).
  readonly #listedApis = new Set<Api>()

  // The last unit-count line logged per account (see `#logUnitCounts`).
  readonly #loggedUnitCounts = new Map<Api, string>()

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

  // The SDK types the manifest's drivers as optional, for the apps that
  // declare none.
  get #manifestDrivers(): readonly DriverManifest[] {
    return this.homey.manifest.drivers ?? []
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

  // The Classic building tree, optionally narrowed to one device type:
  // what the extension's grouping and the ATA group widget read.
  public getClassicBuildings(
    type?: Classic.DeviceType,
  ): Classic.BuildingZone[] {
    return this.#facadeManager.getBuildings({ type })
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
        .filter((node) => node.model === 'homeDevices')
        .map((node) => ({ ...node, name: toFlatName(node) })),
    ].toSorted(byName)
  }

  public getDriverSettings(): Partial<Record<string, DriverSetting[]>> {
    const language = this.homey.i18n.getLanguage()
    return Object.groupBy(
      this.#manifestDrivers.flatMap((driver) => [
        ...getDriverSettings(driver, language),
        ...getDriverLoginSetting(driver, language),
      ]),
      ({ driverId, groupId = driverId }) => groupId,
    )
  }

  // One chronological log across both accounts: the Classic page drives the
  // window (its tiling is authoritative), Home entries are fetched per
  // device and filed into that window by the library's own rule, so
  // pages never overlap. The newest window (no `to`) reads the Home logs
  // afresh; the older ones reuse them.
  public async getErrorLog(
    query: ErrorLogPageQuery,
  ): Promise<FormattedErrorLog> {
    const locale = this.homey.i18n.getLanguage()
    const timeZone = this.homey.clock.getTimezone()
    const { entries, fromDate, ...rest } = await this.#getClassicErrorLogPage(
      query,
      timeZone,
    )
    const { to } = query
    const allHomeEntries = await this.#getHomeErrorEntries(
      to === undefined || to === '',
    )
    const homeEntries = allHomeEntries.filter((entry) =>
      isWithinErrorLogWindow(entry, { fromDate, to }, timeZone),
    )
    const classicEntries = entries.map(
      ({ atEpochMs, deviceId, message }): RawErrorEntry => ({
        atEpochMs,
        device: this.#classicRegistry.devices.getById(deviceId)?.name ?? '',
        error: message,
      }),
    )
    return {
      ...rest,
      errors: formatErrorEntries([...classicEntries, ...homeEntries], {
        locale,
        timeZone,
      }),
      // The short month a phone's date field shows, so the page's summary
      // spells the range's start as its "since" field does.
      fromDateHuman: Temporal.PlainDate.from(fromDate).toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
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

  public async getTargetHourlyTemperatures(
    targetId: string,
  ): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getFullReportTarget(targetId).getHourlyTemperatures(),
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

  public async getTargetSignal(
    targetId: string,
  ): Promise<ReportChartLineOptions> {
    return unwrapResult(
      await this.#getReportTarget(targetId).getSignalStrength(),
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

  // Whether this account is signed in and its listed registry holds no
  // unit at all: the account itself answered that it has nothing to
  // offer, which is what pairing, the settings page and a Classic tile
  // explain, each for its own account only.
  public isAccountEmpty(api: Api): boolean {
    return this.isRegistryListed(api) && this.#getListedUnitCount(api) === 0
  }

  // Whether a credential refusal on this dialect's pairing most likely
  // means the wizard was opened on the wrong driver: this account holds
  // no device in Homey while the OTHER one is signed in and lists units.
  // An account with a paired device is in use whatever the other lists —
  // a lost session or a mistyped password on it is its own failure, and
  // a repair always concerns such a device.
  public isPairingMisdirected(api: Api): boolean {
    return !this.#hasPairedDevices(api) && this.#hasListedUnits(OTHER_API[api])
  }

  // Whether the registry holds this account's own answer: the arbiter the
  // devices consult when their facade lookup fails. Both registries start
  // empty and stay so until the first sync of the restored session lands
  // (the boot race, expected for up to a minute after start); once a sync
  // landed, the registry is authoritative, EMPTY INCLUDED, so a lookup
  // that misses is a unit gone (the SDK dropped the entry, the unit left
  // the account, the account moved to MELCloud Home) rather than one not
  // listed yet. Neither registry carries a synced-yet flag, so the app
  // records each account's first notification. The session is read at
  // call time: a logout wipes the registry, and a cycle it raced still
  // notifies over the wiped one.
  public isRegistryListed(api: Api): boolean {
    return this.#listedApis.has(api) && this.#getClient(api).isAuthenticated()
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
  // so nothing can propagate and a no-change catch here would re-derive a
  // library invariant. The widget's arming gate blocks empty bodies, not
  // bodies the device caught up with meanwhile; those are successes too.
  public async updateTargetAtaState(
    targetId: string,
    state: Classic.GroupState,
  ): Promise<void> {
    // The write lands outside the members' own door, and the library
    // syncs every device from the refreshed models before it resolves:
    // the paired members' read-back watches end first, or that sync
    // would judge a value Homey itself asked for as the cloud's.
    const members = this.#getDevices({
      ids: this.#getAtaGroupMemberIds(targetId),
    })
    for (const device of members) {
      device.forgetWrites()
    }
    const target = this.#getAtaGroupTarget(targetId)
    try {
      await target.updateGroupState(state)
    } catch (error) {
      // Logged, never handled: the widget shows the message, and the
      // diagnostic log keeps the line.
      this.#logGroupWriteFailure(error)
      if (error instanceof AggregateError) {
        throw joinFailures(error)
      }
      throw error
    }
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
    await settleAll(
      this.#getDevices({
        driverId: type === undefined ? undefined : DRIVER_IDS_BY_TYPE[type],
        ids,
      }).map(async (device) => device.syncFromDevice()),
      this,
      'Device sync failed:',
    )
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

  async #announceSessionRestored(api: Api): Promise<void> {
    try {
      await this.homey.notifications.createNotification({
        excerpt: this.homey.__(`notifications.sessionRestored.${api}`),
      })
    } catch {
      // Non-critical: notification display is best-effort
    }
  }

  // The day-chart query every dialect's report reads. Derived once: the
  // window anchor and the timezone source must not drift between the six
  // call sites, which the facades' shared `(query?: ReportQuery)` contract
  // lets us state in a single place.
  #chartDaysQuery(days: number): { from: string } {
    return { from: chartDaysStart(days, this.homey.clock.getTimezone()) }
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
      this.homey.clock.getTimezone(),
    ).toString()
    return {
      endDate: endDate ?? nowAtHomey,
      isEnabled,
      startDate: startDate ?? nowAtHomey,
    }
  }

  #createNotification(language: string): void {
    const { homey } = this
    // The Homey instance is the scheduler: its `setTimeout` is
    // `this`-bound and disposed at uninit, which a bare reference loses.
    announceChangelog({
      changelog,
      homey,
      language,
      notifications: homey.notifications,
      settings: homey.settings,
      version: homey.manifest.version,
    })
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
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion --
         the library's SettingManager contract types its keys as plain
         strings */
      (api === 'classic'
        ? key
        : `${api}${key.charAt(0).toUpperCase()}${key.slice(1)}`) as keyof HomeySettings
    return createSettingManager(this.homey.settings, prefixKey)
  }

  #getAtaCapabilityConfigs(): {
    key: keyof Classic.GroupState & keyof Classic.ListDeviceDataAta
    options: ManifestDriverCapabilitiesOptions
    enumType?: Record<string, number | string>
  }[] {
    const ataOptions = this.#manifestDrivers.find(
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
          ...toCapabilitiesOptionsNarrowing(ataOptions?.target_temperature),
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
        // Narrowed as the setpoint is: the manifest's list when it declares
        // one, the vendored list otherwise — never an empty picker.
        options: withoutOffMode({
          ...thermostatMode,
          ...toCapabilitiesOptionsNarrowing(ataOptions?.thermostat_mode),
        }),
      },
    ]
  }

  // The units a group write addresses: a Home device target is its own
  // member, every other target's facades list them.
  #getAtaGroupMemberIds(targetId: string): (number | string)[] {
    if (isMergedBuildingValue(targetId)) {
      const { classic, home } = this.#getMergedBuildingFacades(targetId)
      return [...classic.devices, ...home.devices].map(({ id }) => id)
    }
    if (isHomeDeviceValue(targetId)) {
      return [getHomeDeviceId(targetId)]
    }
    if (isHomeBuildingValue(targetId)) {
      return this.#getHomeBuildingFacade(
        getHomeBuildingId(targetId),
      ).devices.map(({ id }) => id)
    }
    const { zoneId, zoneType } = toZoneValueData(targetId)
    return this.getClassicFacade(zoneType, zoneId).devices.map(({ id }) => id)
  }

  // The ATA group twin of `#getSettingsTarget`: the targetId is the
  // picker value verbatim, and addressing is the only family-visible
  // step — everything downstream speaks the one group vocabulary. A
  // merged house is the SDK's combination of its two buildings, the app
  // only addressing them.
  #getAtaGroupTarget(targetId: string): AtaGroup {
    if (isMergedBuildingValue(targetId)) {
      const { classic, home } = this.#getMergedBuildingFacades(targetId)
      return combineAtaGroups([
        withAccountOnFailure(classic, 'classic'),
        withAccountOnFailure(home, 'home'),
      ])
    }
    if (isHomeBuildingValue(targetId)) {
      return this.#getHomeBuildingFacade(getHomeBuildingId(targetId))
    }
    return isHomeDeviceValue(targetId)
      ? this.getHomeFacade(getHomeDeviceId(targetId), Home.DeviceType.Ata)
      : this.#getClassicAtaGroupFacade(toZoneValueData(targetId))
  }

  // The houses both accounts list under one name, paired from the lists
  // the ATA group widget pairs, so every merged value it offers resolves
  // here while the registries still hold it.
  #getAtaSameNamePairs(): SameNamePair[] {
    return pairSameNameBuildings([
      ...this.getClassicBuildings(Classic.DeviceType.Ata),
      ...this.getHomeTargets(Home.DeviceType.Ata),
    ])
  }

  #getClassicAtaGroupFacade({ zoneId, zoneType }: DeviceOrZoneData): AtaGroup {
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
    query: ErrorLogPageQuery,
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

  #getClient(api: Api): Classic.API | Home.API {
    return api === 'home' ? this.#homeApi : this.#classicApi
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

  // A Home unit's entries: the log a read already brought, else a fresh
  // read, kept for the windows that follow when it succeeds — a failed
  // read keeps nothing, so the next window asks the unit again.
  async #getHomeDeviceErrorEntries(
    device: Home.Device,
  ): Promise<readonly RawErrorEntry[]> {
    const kept = this.#homeErrorLogs.get(device.id)
    if (kept !== undefined) {
      return kept
    }
    const entries = await this.#getHomeDeviceErrorLog(device)
    if (entries === null) {
      return []
    }
    this.#homeErrorLogs.set(device.id, entries)
    return entries
  }

  // Best-effort per device: one unreachable unit must not empty the log.
  // The failure line names the unit by its id, as the SDK's own lines
  // do, and its cause on one line when the SDK has a class for it; the
  // read then answers `null`.
  async #getHomeDeviceErrorLog({
    id,
    name,
    type,
  }: Home.Device): Promise<RawErrorEntry[] | null> {
    const result = await this.getHomeFacade(id, type).getErrorLog()
    if (!result.ok) {
      logFailure(
        this,
        `Home error log fetch failed for unit ${id}:`,
        failureCause(result.error),
      )
      return null
    }
    return result.value.map(({ atEpochMs, code = '', message = code }) => ({
      atEpochMs,
      device: name,
      error: message,
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

  async #getHomeErrorEntries(
    isNewestWindow: boolean,
  ): Promise<RawErrorEntry[]> {
    if (isNewestWindow) {
      this.#homeErrorLogs.clear()
    }
    const logs = await Promise.all(
      this.#homeRegistry
        .getDevices()
        .map(async (device) => this.#getHomeDeviceErrorEntries(device)),
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

  #getListedUnitCount(api: Api): number {
    return this.#getClient(api).registry.getDevices().length
  }

  // A merged value is looked up, never split, among the pairs the
  // registries hold now: one no pair matches — a building renamed, an
  // account signed out, a second building of that name — answers
  // zone-not-found, before any write.
  #getMergedBuildingFacades(targetId: string): {
    classic: Classic.BuildingFacade | Classic.ZoneFacade
    home: Home.BuildingFacade
  } {
    const pair = this.#getAtaSameNamePairs().find((candidate) => {
      const { id, model } = toMergedItem(candidate)
      return getZoneId(id, model) === targetId
    })
    if (pair === undefined) {
      throw new NotFoundError(this.homey.__('errors.zoneNotFound'))
    }
    return {
      classic: this.getClassicFacade('buildings', pair.classic.id),
      home: this.#getHomeBuildingFacade(pair.home.id),
    }
  }

  // This account's devices paired in Homey, across every driver of its
  // dialect.
  #getPairedDevices(api: Api): MELCloudDevice[] {
    return this.#getDrivers()
      .filter((driver) => toApi(driver.id) === api)
      .flatMap((driver): MELCloudDevice[] => driver.getDevices())
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

  // Whether this account is signed in and its listed registry holds at
  // least one unit: it has something to pair.
  #hasListedUnits(api: Api): boolean {
    return this.isRegistryListed(api) && this.#getListedUnitCount(api) > 0
  }

  #hasPairedDevices(api: Api): boolean {
    return this.#getPairedDevices(api).length > 0
  }

  // The zero lower bound (`HOLIDAY_MODE_OFF_DURATION`) is what
  // `toNonNegativeInt` already enforces; the boundary only translates
  // the failure into the user's language.
  #holidayModeDays(duration: unknown): number {
    try {
      return toNonNegativeInt(duration, { max: HOLIDAY_MODE_MAX_DURATION_DAYS })
    } catch (error) {
      throw new RangeError(this.homey.__('errors.invalidDuration'), {
        cause: error,
      })
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
    const now = Temporal.Now.plainDateTimeISO(this.homey.clock.getTimezone())
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
        onSyncComplete: this.#onRegistrySync('classic'),
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
      timezone: this.homey.clock.getTimezone(),
    })
    this.#facadeManager = new Classic.FacadeManager(this.#classicApi)
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
        onSyncComplete: this.#onRegistrySync('home'),
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
      timezone: this.homey.clock.getTimezone(),
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

  // One line per failure, a fan-out's included, so each names what it
  // failed on.
  #logGroupWriteFailure(error: unknown): void {
    for (const failure of toFailures(error)) {
      logFailure(this, 'Group write failed:', failure)
    }
  }

  // One line per account when the pair (listed by the account, added in
  // Homey) changes, the first sync included: diagnostic reports omit
  // list bodies over 4 KiB, so this is the only trace of how many units
  // an account lists — and a repeat would only pad the log. The count
  // waits for readiness, as the session-lost gate does: the restored
  // session's first sync lands during `App#onInit`, when `getDrivers()`
  // still exposes nothing, and the report's first line must not read 0.
  // The same change gate pushes `accountupdate` to the settings page,
  // whose account hints can only move when these counts do: a page
  // opened across the restored session's first sync hears it land, and
  // a device added while the page is open takes the no-device hint away
  // — one event per line written, never one per sync.
  async #logUnitCounts(api: Api): Promise<void> {
    await this.homey.ready()
    const line = formatUnitCounts(api, {
      added: this.#getPairedDevices(api).length,
      listed: this.#getListedUnitCount(api),
    })
    if (this.#loggedUnitCounts.get(api) === line) {
      return
    }
    this.#loggedUnitCounts.set(api, line)
    this.log(line)
    fireAndForget(
      this.homey.api.realtime('accountupdate', null),
      this,
      'Account update push failed:',
    )
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
    this.homey.setTimeout(() => {
      fireAndForget(
        this.#announceSessionLost(api),
        this,
        'Session loss announcement failed:',
      )
    }, 0)
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
    this.homey.setTimeout(() => {
      fireAndForget(
        this.#announceSessionRestored(api),
        this,
        'Session restore announcement failed:',
      )
    }, 0)
  }

  // Records the account as listed before its devices sync, so the units
  // they look up are judged against a registry the account itself
  // filled, and logs what that listing holds against what Homey added —
  // detached, because the library awaits this callback and the count
  // waits for readiness.
  #onRegistrySync(api: Api): SyncCallback {
    return async (params) => {
      this.#listedApis.add(api)
      fireAndForget(
        this.#logUnitCounts(api),
        this,
        'Unit count logging failed:',
      )
      await this.#onSync(params)
    }
  }

  // Forwards the argument to the device's own capability listener, so an
  // action card names only drivers that write its capability (pinned in
  // `tests/unit/flow-cards.test.ts`).
  #registerCapabilityAction(id: string, capability: string): void {
    this.homey.flow
      .getActionCard(id)
      .registerRunListener(
        async (
          args: Record<string, unknown> & {
            device: {
              triggerCapabilityListener: (
                key: string,
                value: unknown,
              ) => Promise<void>
            }
          },
        ) => {
          await args.device.triggerCapabilityListener(
            capability,
            args[getArg(capability)],
          )
        },
      )
  }

  // A boolean capability is its own answer; any other compares with the
  // card's value argument.
  #registerCapabilityCondition(id: string, capability: string): void {
    this.homey.flow
      .getConditionCard(id)
      .registerRunListener(
        (
          args: Record<string, unknown> & {
            device: { getCapabilityValue: (key: string) => unknown }
          },
        ) => {
          const value = args.device.getCapabilityValue(capability)
          return typeof value === 'string' || typeof value === 'number'
            ? value === args[getArg(capability)]
            : value
        },
      )
  }

  // The capability cards are app-level: one card per capability, shared
  // by every driver its device filter names, so each gets ONE listener,
  // generic over `args.device`. The manifest is the list: a card whose id
  // names no driver capability is an app card of its own (holiday mode,
  // below), and a declared card the runtime cannot hand out throws from
  // `onInit` — a contract break, never swallowed.
  #registerCapabilityFlowListeners(): void {
    const { actions = [], conditions = [] } = this.homey.manifest.flow ?? {}
    const capabilities = new Set(
      this.#manifestDrivers.flatMap((driver) => driver.capabilities),
    )
    for (const { id } of conditions) {
      const capability = id.replace(/_condition$/v, '')
      if (capabilities.has(capability)) {
        this.#registerCapabilityCondition(id, capability)
      }
    }
    for (const { id } of actions) {
      const capability = id.replace(/_action$/v, '')
      if (capabilities.has(capability)) {
        this.#registerCapabilityAction(id, capability)
      }
    }
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
    this.#registerCapabilityFlowListeners()
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
  // and every Home building/device, each leaf suffixed with its building,
  // a house both accounts list under one name as ONE item in place of
  // its two buildings, and a name either account holds twice tagged with
  // each building's account; the whole list drawn from the two shared
  // sources and name-sorted.
  #searchAtaTargets(
    query: string,
  ): (Classic.Zone | HomeBuildingZone | HomeDeviceZone | MergedBuildingItem)[] {
    const pairs = this.#getAtaSameNamePairs()
    const houseBuildings = new Set(
      pairs.flatMap(({ classic, home }) => [
        getZoneId(classic.id, 'buildings'),
        getZoneId(home.id, 'homeBuildings'),
      ]),
    )
    return filterZonesByName(
      tagSameNameBuildings([
        ...[
          ...this.getClassicTargets(Classic.DeviceType.Ata),
          ...this.getHomeTargets(Home.DeviceType.Ata),
        ]
          .filter(({ id, model }) => !houseBuildings.has(getZoneId(id, model)))
          .map((node) => ({ ...node, name: toFlatName(node) })),
        ...pairs.map((pair) => toMergedItem(pair)),
      ]).toSorted(byName),
      query,
    )
  }

  // Holiday-mode / condition targets: every Classic zone/device and every
  // Home building/device, each carrying its `${model}_${id}` routing value
  // and a building-suffixed display name, each building both accounts
  // list under one name tagged with its own account, name-sorted.
  #searchHolidayModeTargets(query: string): FlatZoneItem[] {
    const targets = tagSameNameBuildings([
      ...this.getClassicTargets(),
      ...this.getHomeTargets(),
    ])
    return filterZonesByName(toFlatZoneItems(targets), query)
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
