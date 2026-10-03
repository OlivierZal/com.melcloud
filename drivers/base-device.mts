import {
  fireAndForget,
  getErrorMessage,
  NotFoundError,
  sequential,
  settleAll,
} from '@olivierzal/homey-kit'
import {
  type AvailabilityAware,
  EntityNotFoundError,
  isAPIError,
  NoChangesError,
} from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'

import type { Api } from '../types/api.mts'
import type { CapabilityConverter } from '../types/bases.mts'
import type {
  ClassicDeviceFacade,
  EnergyReportMode,
  EnergyReportOperation,
} from '../types/device.mts'
import { type Homey, Device } from '../lib/homey.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'
import { withoutOptInCapabilities } from '../lib/opt-in-capabilities.mts'
import { getLocale, getNow } from '../lib/temporal.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'
import type { EnergyReportConfig } from './base-report.mts'

const capitalize = ([first = '', ...rest] = ''): string =>
  first.toUpperCase() + rest.join('')

const DEBOUNCE_DELAY = 1000
const modes: EnergyReportMode[] = ['regular', 'total']

// Homey exposes its status-indicator picker on some device classes only:
// a thermostat gets none, a heat pump does. The setting therefore drives
// the class, `heatpump` being the closest Homey class to these units. It
// is declared on the four thermostat drivers alone — the ERV is an
// airtreatment device, which already gets the picker.
const STATUS_INDICATOR_SETTING = 'custom_status_indicator'

export abstract class BaseMELCloudDevice<
  TFacade extends AvailabilityAware & ClassicDeviceFacade = AvailabilityAware &
    ClassicDeviceFacade,
  TId extends number | string = number | string,
> extends Device {
  declare public readonly driver: BaseMELCloudDriver

  declare public readonly getData: () => { id: TId }

  declare public readonly getSettings: () => Record<string, unknown>

  declare public readonly homey: Homey.Homey

  // The account the unit belongs to — names the registry a failed facade
  // lookup is judged against (see `ensureDevice`).
  protected abstract readonly api: Api

  protected abstract readonly capabilityToDevice: Partial<
    Record<string, CapabilityConverter>
  >

  // The message a stale unit shows: the two dialects word it differently
  // ('unitStale' reads a last-communication timestamp, 'unitOffline' a
  // disconnection streak) even though they answer the same contract.
  protected abstract readonly unreachableWarning: string

  public get id(): TId {
    return this.getData().id
  }

  // No energy reports unless a subclass provides both the configs and the
  // factory; thermostat vocabularies without an off value keep the null
  // default.
  protected readonly createEnergyReport:
    ((config: EnergyReportConfig) => EnergyReportOperation) | null = null

  protected readonly energyReportRegular: EnergyReportConfig | null = null

  protected readonly energyReportTotal: EnergyReportConfig | null = null

  protected readonly thermostatMode: Record<string, string> | null = null

  protected get cachedFacade(): TFacade | undefined {
    return this.#deviceFacade
  }

  protected get isAlwaysOn(): boolean {
    return Boolean(this.getSetting('always_on'))
  }

  protected get operationalCapabilityTagEntries(): [string, string][] {
    return Object.entries({
      ...this.#tagMappings.set,
      ...this.#tagMappings.get,
      ...this.#tagMappings.list,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined)
  }

  #deviceFacade?: TFacade

  // The lasting warning the device tile currently shows, `null` when none:
  // `holdWarning` skips a message already on the tile, and the toast
  // override returns to it instead of to a bare `null`.
  #heldWarning: string | null = null

  readonly #reports: {
    regular?: EnergyReportOperation
    total?: EnergyReportOperation
  } = {}

  #syncTimeout: NodeJS.Timeout | null = null

  readonly #tagMappings: {
    get: Partial<Readonly<Record<string, string>>>
    list: Partial<Readonly<Record<string, string>>>
    set: Partial<Readonly<Record<string, string>>>
  } = { get: {}, list: {}, set: {} }

  public override async onInit(): Promise<void> {
    await this.setWarning(null)
    this.#registerCapabilityListeners()
    await this.ensureDevice()
  }

  public override async onSettings({
    changedKeys,
    newSettings,
  }: {
    changedKeys: string[]
    newSettings: Record<string, unknown>
  }): Promise<void> {
    const changedCapabilities = changedKeys.filter(
      (setting) =>
        this.isCapabilitySupported(setting) &&
        typeof newSettings[setting] === 'boolean',
    )
    if (changedKeys.includes(STATUS_INDICATOR_SETTING)) {
      await this.setClass(
        newSettings[STATUS_INDICATOR_SETTING] === true
          ? 'heatpump'
          : 'thermostat',
      )
    }
    await this.#updateDeviceOnSettings(
      changedKeys,
      changedCapabilities,
      newSettings,
    )
    const changedEnergyKeys = changedCapabilities.filter((setting) =>
      this.isEnergyCapability(setting),
    )
    if (changedEnergyKeys.length > 0) {
      await this.#updateEnergyReportsOnSettings(changedEnergyKeys)
    }
  }

  public override onDeleted(): void {
    this.cleanupDevice()
  }

  public override async onUninit(): Promise<void> {
    this.onDeleted()
    await Promise.resolve()
  }

  // The capability sets and options are driver- and facade-specific: each
  // intermediate class derives them from its own facade shape.
  protected abstract getCapabilitiesOptions(): Partial<Record<string, unknown>>

  protected abstract getFacade(): TFacade

  protected abstract getRequiredCapabilities(): string[]

  // Where the dialects genuinely differ: each reads its own payload shape.
  protected abstract syncCapabilityValues(facade: TFacade): Promise<void>

  public override async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
    }
  }

  public cleanMapping<TMapping extends Readonly<Record<string, unknown>>>(
    capabilityTagMapping: TMapping,
  ): Partial<TMapping> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- fromEntries widens the filtered entries to Record<string, unknown>
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<TMapping>
  }

  public async ensureDevice(): Promise<TFacade | null> {
    try {
      return await this.#ensureDeviceFacade()
    } catch (error) {
      if (
        error instanceof NotFoundError &&
        this.homey.app.isRegistryPopulated(this.api)
      ) {
        // The registry lists units but not this one: a prune the facade
        // cache did not survive (an app restart, a unit never cached),
        // i.e. the lasting condition `syncFromDevice` holds for, reached
        // before any facade exists. Held, never toasted — a toast every
        // sync is the flash over frozen values the hold exists to end.
        await this.#holdUnreadableWarning(error)
      } else if (isAPIError(error) || error instanceof NotFoundError) {
        // Expected one-shot failures surface as the toast: a MELCloud
        // API error, or a lookup on a registry that has listed NOTHING
        // yet — the boot race, expected for up to a minute after start,
        // which is not a prune. Anything else is a programming error and
        // is only logged, so real bugs are not masked as device warnings.
        await this.setWarning(error)
      } else {
        this.error('Unexpected error while ensuring device:', error)
      }
      return null
    }
  }

  public override error(...args: unknown[]): void {
    super.error(this.getName(), '-', ...args)
  }

  // A LASTING condition (a unit the registry no longer resolves, sync
  // after sync) keeps its bubble on the tile until `releaseWarning`: the
  // toast below would flash it for an instant and leave frozen values
  // unexplained. Re-holding the message already shown is skipped — Homey
  // renders it idempotently, so the call would only cost IPC. The hold is
  // recorded BEFORE the IPC call, so the syncs that overlap in practice
  // (init's detached pass, a post-write sync, the app-level cycle) do not
  // hold the same message twice, and rolled back when the call fails, so
  // the next sync retries it. Never throws: the warning is IPC, and its
  // failure must not break the sync that reported the condition. Answers
  // whether THIS call put the message on the tile, so the caller writes
  // the condition to the diagnostic log once, never per sync.
  public async holdWarning(message: string): Promise<boolean> {
    if (this.#heldWarning === message) {
      return false
    }
    const previous = this.#heldWarning
    this.#heldWarning = message
    if (await this.#trySetWarning(message)) {
      return true
    }
    this.#heldWarning = previous
    return false
  }

  public override log(...args: unknown[]): void {
    super.log(this.getName(), '-', ...args)
  }

  // Clears a held warning on the first sync that read the unit again; a
  // no-op when nothing is held, so the per-minute sync costs no IPC. The
  // same bookkeeping as the hold: released before the call, restored when
  // the call fails so the next sync retries the clear. Answers whether a
  // held warning was cleared, for the caller's one closing log line.
  public async releaseWarning(): Promise<boolean> {
    const held = this.#heldWarning
    if (held === null) {
      return false
    }
    this.#heldWarning = null
    if (await this.#trySetWarning(null)) {
      return true
    }
    this.#heldWarning = held
    return false
  }

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }

  public setTimeout(
    callback: () => Promise<void>,
    interval: Temporal.DurationLike,
    actionType: string,
  ): NodeJS.Timeout {
    const duration = Temporal.Duration.from(interval)
    const locale = getLocale(this.homey)
    this.log(
      capitalize(actionType),
      'will run in',
      duration.round({ largestUnit: 'days' }).toLocaleString(locale),
      'on',
      getNow(this.homey)
        .add(duration)
        .toLocaleString(locale, { dateStyle: 'full', timeStyle: 'full' }),
    )
    return this.homey.setTimeout(
      callback,
      duration.total({ unit: 'milliseconds' }),
    )
  }

  // The transient toast for ONE-SHOT errors (a failed write, a refused
  // setting). Homey keeps a warning bubble on the device tile until it is
  // cleared: setting the message and resetting it right away shows the
  // toast without permanently flagging the device. The immediate reset is
  // intentional — do not "fix" it. A LASTING condition takes
  // `holdWarning`/`releaseWarning` instead, and the reset lands on the
  // held message rather than on `null`: a write on an unreadable unit
  // fails the same way and raises this toast, which must not wipe the
  // explanation off the tile until the unit recovers.
  public override async setWarning(error: unknown): Promise<void> {
    if (error !== null) {
      await super.setWarning(getErrorMessage(error))
    }
    await super.setWarning(this.#heldWarning)
  }

  // One skeleton for both dialects, which the facades' neutral
  // `isAvailable` contract makes possible — the contract is pinned in
  // melcloud-api's tests/contracts/is-available.test.ts.
  public async syncFromDevice(): Promise<void> {
    const device = await this.ensureDevice()
    if (device === null) {
      return
    }
    try {
      await this.syncAvailability(
        device.isAvailable,
        this.homey.__(this.unreachableWarning),
      )
      // The unit was read again: the first success lifts the hold, with
      // no threshold on either side — a one-minute bubble is honest, and
      // an entry that flaps in and out of the registry is a wire fact the
      // SDK's own drift streak logs, not something to hide.
      await this.#releaseUnreadableWarning()
      await this.syncCapabilityValues(device)
    } catch (error) {
      if (!(error instanceof EntityNotFoundError)) {
        throw error
      }
      // A cached facade over an id the registry no longer holds keeps the
      // last known availability under a held warning; the next sync that
      // resolves the fresh model releases it transparently.
      await this.#holdUnreadableWarning(error)
    }
  }

  protected async applyCapabilitiesOptions(): Promise<void> {
    await sequential(
      Object.entries(this.getCapabilitiesOptions()),
      async ([capability, options]) => {
        if (typeof options === 'object' && options !== null) {
          await this.setCapabilityOptions(capability, options)
        }
      },
    )
  }

  protected cleanupDevice(): void {
    if (this.#syncTimeout !== null) {
      this.homey.clearTimeout(this.#syncTimeout)
      this.#syncTimeout = null
    }
    this.#reports.regular?.unschedule()
    this.#reports.total?.unschedule()
  }

  // Manifest membership plus device-level support: subclasses veto
  // capabilities the hardware cannot serve (e.g. energy without a meter).
  protected isCapabilitySupported(capability: string): boolean {
    return this.isManifestCapability(capability)
  }

  protected isEnergyCapability(setting: string): boolean {
    return Object.hasOwn(this.driver.tagMappings.energy, setting)
  }

  protected isManifestCapability(capability: string): boolean {
    return this.driver.manifest.capabilities.includes(capability)
  }

  protected mapCapabilitiesToDeviceTags(
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    this.log('Requested data:', values)
    const tagMapping = this.#tagMappings.set
    const result: Record<string, unknown> = {}
    for (const [capability, value] of Object.entries(values)) {
      const tag = tagMapping[capability]
      if (tag === undefined) {
        continue
      }
      // `always_on` devices never switch off from Homey: the outgoing
      // value is coerced before any converter runs.
      const coerced = (capability === 'onoff' && this.isAlwaysOn) || value
      result[tag] = this.capabilityToDevice[capability]?.(coerced) ?? coerced
    }
    return result
  }

  protected async scheduleEnergyReports(): Promise<void> {
    if (this.createEnergyReport === null) {
      return
    }
    if (this.energyReportRegular !== null) {
      this.#reports.regular = this.createEnergyReport(this.energyReportRegular)
      await this.#reports.regular.start()
    }
    if (this.energyReportTotal === null) {
      return
    }

    this.#reports.total = this.createEnergyReport(this.energyReportTotal)
    await this.#reports.total.start()
  }

  protected async sendUpdate(values: Record<string, unknown>): Promise<void> {
    const device = await this.ensureDevice()
    if (device === null) {
      return
    }
    const updateData = this.mapCapabilitiesToDeviceTags(values)
    if (Object.keys(updateData).length > 0) {
      await this.#pushUpdate(device, updateData)
    }
    this.#scheduleSyncFromDevice()
  }

  // MELCloud accepting a write is not delivery: when the unit's cloud
  // link is down, writes are silently dropped and readings go stale —
  // an unreachable unit truly cannot be controlled, so surface it as
  // device availability. Only the facades' `isAvailable` contract may
  // feed this: the raw Classic `Offline` flag flaps on healthy units
  // (#1479/#1481).
  protected async syncAvailability(
    isAvailable: boolean,
    message: string,
  ): Promise<void> {
    await (isAvailable ? this.setAvailable() : this.setUnavailable(message))
  }

  async #ensureDeviceFacade(): Promise<TFacade> {
    if (this.#deviceFacade === undefined) {
      this.#deviceFacade = this.getFacade()
      await this.#init()
    }
    return this.#deviceFacade
  }

  // The per-capability IPC bulk (options reapplication, value sync)
  // and the network energy fetches: detached from the ready path — an
  // Early 2018 Homey burns the SDK's 30 s budget on serialized IPC
  // alone (a v45.7.8 field report still hit `ready_timeout` after the
  // fetches left). `#setCapabilities` stays awaited: its post-pairing
  // delta is usually empty and the tag mappings must exist before the
  // capability listeners fire.
  async #finishInit(): Promise<void> {
    await this.applyCapabilitiesOptions()
    await this.syncFromDevice()
    await this.scheduleEnergyReports()
  }

  // The registry no longer holds the id — on Home an entry the strict
  // `/context` parse refused, on either dialect a unit removed from the
  // account or a registry rebuilt on logout. Two entry points report it:
  // a cached facade throwing `EntityNotFoundError` on a read, and a
  // facade lookup failing (`NotFoundError`) on a populated registry when
  // no facade was ever cached. Neither error names the cause, and only
  // the first names the id (the device name prefixes the line either
  // way), so the warning text is dialect- and cause-neutral and points
  // at the diagnostic log, which this hold feeds ONCE: the SDK prunes in
  // silence, and a unit gone from the account would otherwise leave no
  // trace there.
  async #holdUnreadableWarning(
    error: EntityNotFoundError | NotFoundError,
  ): Promise<void> {
    if (await this.holdWarning(this.homey.__('errors.unitUnreadable'))) {
      this.error('Unit unreadable, warning held:', error)
    }
  }

  async #init(): Promise<void> {
    await this.#setCapabilities()
    fireAndForget(this.#finishInit(), this, 'Deferred device init failed:')
  }

  #isThermostatModeSupportingOff(): boolean {
    return this.thermostatMode !== null && 'off' in this.thermostatMode
  }

  // The library's observability seam logs a write that LANDS
  // (`dataType: 'API request'`, full body and `EffectiveFlags`), and its
  // error seam logs an `HttpError`. Neither covers the two failures
  // that matter here. A FOLDED write makes no request at all, so the
  // only trace would be an absence — worthless in a truncated
  // diagnostic report; the refusal stays non-fatal, the user asked for
  // a state the app already believes the unit holds. A failure OFF the
  // HTTP path — a timeout, an abort, a DNS failure — reaches no seam
  // either: only an `HttpError` is serialised, the transient-retry rung
  // is installed for GET alone, and `setWarning` is a toast that clears
  // its own message in the same call, so such a write is invisible
  // everywhere at once — the flow reports success, the tile keeps the
  // new value, and the unit never moved. Every failed write is logged
  // rather than only the two uncovered ones: sorting them would mean
  // re-deriving the seam's own predicate here, and a duplicated line
  // for an HTTP failure costs nothing beside a silent one.
  async #pushUpdate(
    device: TFacade,
    updateData: Record<string, unknown>,
  ): Promise<void> {
    try {
      await device.updateValues(updateData)
    } catch (error) {
      if (error instanceof NoChangesError) {
        this.log('Not sent, identical to the last synced state:', updateData)
        return
      }
      this.error('Write failed:', updateData, error)
      await this.setWarning(error)
    }
  }

  #registerCapabilityListeners(): void {
    this.registerMultipleCapabilityListener(
      Object.keys(this.driver.tagMappings.set),
      async (values) => {
        if (
          'thermostat_mode' in values &&
          this.#isThermostatModeSupportingOff()
        ) {
          const isOn = values.thermostat_mode !== 'off'
          values.onoff = isOn
          if (!isOn) {
            delete values.thermostat_mode
          }
        }
        await this.sendUpdate(values)
      },
      DEBOUNCE_DELAY,
    )
  }

  // One closing line pairs with the hold's opening one; nothing is
  // written on the syncs in between.
  async #releaseUnreadableWarning(): Promise<void> {
    if (await this.releaseWarning()) {
      this.log('Unit readable again, warning released')
    }
  }

  // Delay sync to let Homey's optimistic UI update and debounce settle.
  // The handle is kept so deletion cancels a pending sync, and failures are
  // logged instead of becoming unhandled rejections.
  #scheduleSyncFromDevice(): void {
    if (this.#syncTimeout !== null) {
      this.homey.clearTimeout(this.#syncTimeout)
    }
    this.#syncTimeout = this.homey.setTimeout(async () => {
      this.#syncTimeout = null
      try {
        await this.syncFromDevice()
      } catch (error) {
        this.error('Post-update sync failed:', error)
      }
    }, DEBOUNCE_DELAY)
  }

  async #setCapabilities(): Promise<void> {
    const settings = this.getSettings()
    const currentCapabilities = new Set(this.getCapabilities())

    const requiredCapabilities = new Set(
      [
        ...Object.keys(settings).filter(
          (setting) => settings[setting] === true,
        ),
        ...withoutOptInCapabilities(this.getRequiredCapabilities()),
      ].filter((capability) => this.isCapabilitySupported(capability)),
    )

    await sequential(
      [...currentCapabilities.symmetricDifference(requiredCapabilities)],
      async (capability) => {
        await (requiredCapabilities.has(capability)
          ? this.addCapability(capability)
          : this.removeCapability(capability))
      },
    )

    this.#tagMappings.set = this.cleanMapping(this.driver.tagMappings.set)
    this.#tagMappings.get = this.cleanMapping(this.driver.tagMappings.get)
    this.#tagMappings.list = this.cleanMapping(this.driver.tagMappings.list)
  }

  async #syncOptionalCapabilities(
    newSettings: Record<string, unknown>,
    changedCapabilities: string[],
  ): Promise<void> {
    await sequential(changedCapabilities, async (capability) => {
      await (newSettings[capability] === true
        ? this.addCapability(capability)
        : this.removeCapability(capability))
    })
    this.#tagMappings.list = this.cleanMapping(this.driver.tagMappings.list)
  }

  // The warning update is IPC: its own failure is logged, never thrown,
  // and the answer says whether the tile now shows `warning`.
  async #trySetWarning(warning: string | null): Promise<boolean> {
    try {
      await super.setWarning(warning)
      return true
    } catch (error) {
      this.error('Failed to update the device warning:', error)
      return false
    }
  }

  async #updateDeviceOnSettings(
    changedKeys: string[],
    changedCapabilities: string[],
    newSettings: Record<string, unknown>,
  ): Promise<void> {
    if (changedCapabilities.length > 0) {
      await this.#syncOptionalCapabilities(newSettings, changedCapabilities)
      await this.setWarning(this.homey.__('warnings.dashboard'))
    }
    // A device without onoff (a driver may compute its capabilities and
    // omit it) cannot be switched from Homey at all: always_on is inert
    // there, and triggering the listener would error on the missing
    // capability.
    if (
      changedKeys.includes('always_on') &&
      newSettings.always_on === true &&
      this.hasCapability('onoff')
    ) {
      await this.triggerCapabilityListener('onoff', true)
      return
    }
    // The status-indicator setting is purely Homey-side, like always_on:
    // neither carries a value the unit could report back.
    if (
      changedKeys.some(
        (setting) =>
          setting !== 'always_on' &&
          setting !== STATUS_INDICATOR_SETTING &&
          !this.isEnergyCapability(setting),
      )
    ) {
      await this.syncFromDevice()
    }
  }

  async #updateEnergyReportsOnSettings(changedKeys: string[]): Promise<void> {
    await settleAll(
      modes.map(async (mode) => {
        if (
          changedKeys.some(
            (setting) => isTotalEnergyKey(setting) === (mode === 'total'),
          )
        ) {
          await this.#reports[mode]?.start()
        }
      }),
      this,
      'Energy report update failed:',
    )
  }
}
