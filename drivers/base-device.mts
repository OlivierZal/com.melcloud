import { isAPIError, NoChangesError } from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'

import type { CapabilityConverter } from '../types/capabilities.mts'
import type {
  ClassicDeviceFacade,
  EnergyReportMode,
  EnergyReportOperation,
} from '../types/device.mts'
import { NotFoundError } from '../lib/errors.mts'
import { getErrorMessage } from '../lib/get-error-message.mts'
import { type Homey, Device } from '../lib/homey.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'
import { getLocale, getNow } from '../lib/temporal.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'
import type { EnergyReportConfig } from './base-report.mts'

interface TimerOptions {
  readonly actionType: string
  readonly timerType: 'setInterval' | 'setTimeout'
  readonly timerWords: {
    readonly dateSpecifier: string
    readonly timeSpecifier: string
  }
}

const capitalize = ([first = '', ...rest] = ''): string =>
  first.toUpperCase() + rest.join('')

const DEBOUNCE_DELAY = 1000
const modes: EnergyReportMode[] = ['regular', 'total']

export abstract class BaseMELCloudDevice extends Device {
  declare public readonly driver: BaseMELCloudDriver

  declare public readonly getData: () => { id: number | string }

  declare public readonly getSettings: () => Record<string, unknown>

  declare public readonly homey: Homey.Homey

  protected abstract capabilityToDevice: Partial<
    Record<string, CapabilityConverter>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<string, CapabilityConverter>
  >

  protected abstract readonly energyReportRegular: EnergyReportConfig | null

  protected abstract readonly energyReportTotal: EnergyReportConfig | null

  protected abstract readonly thermostatMode: Record<string, string> | null

  public get id(): number | string {
    return this.getData().id
  }

  protected get cachedFacade(): ClassicDeviceFacade | undefined {
    return this.#deviceFacade
  }

  protected get isAlwaysOn(): boolean {
    return Boolean(this.getSetting('always_on'))
  }

  protected get operationalCapabilityTagEntries(): [string, string][] {
    return Object.entries({
      ...this.#setCapabilityTagMapping,
      ...this.#getCapabilityTagMapping,
      ...this.#listCapabilityTagMapping,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined)
  }

  #deviceFacade?: ClassicDeviceFacade

  #getCapabilityTagMapping: Partial<Readonly<Record<string, string>>> = {}

  #listCapabilityTagMapping: Partial<Readonly<Record<string, string>>> = {}

  readonly #reports: {
    regular?: EnergyReportOperation
    total?: EnergyReportOperation
  } = {}

  #setCapabilityTagMapping: Partial<Readonly<Record<string, string>>> = {}

  #syncTimeout: NodeJS.Timeout | null = null

  public override async onInit(): Promise<void> {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean => this.isAlwaysOn || isOn,
      ...this.capabilityToDevice,
    }
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
        this.isManifestCapability(setting) &&
        typeof newSettings[setting] === 'boolean',
    )
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

  protected abstract createEnergyReport(
    config: EnergyReportConfig,
  ): EnergyReportOperation

  protected abstract getFacade(): ClassicDeviceFacade

  public abstract syncFromDevice(): Promise<void>

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

  public async ensureDevice(): Promise<ClassicDeviceFacade | null> {
    try {
      return await this.#ensureDeviceFacade()
    } catch (error) {
      // Expected failures (MELCloud API, entity lookup) surface as a
      // user-visible warning; anything else is a programming error and is
      // only logged, so real bugs are not masked as device warnings.
      if (isAPIError(error) || error instanceof NotFoundError) {
        await this.setWarning(error)
      } else {
        this.error('Unexpected error while ensuring device:', error)
      }
      return null
    }
  }

  /* v8 ignore start -- trivial override: prepends device name to all error logs */
  public override error(...args: unknown[]): void {
    super.error(this.getName(), '-', ...args)
  }

  /* v8 ignore start -- trivial override: prepends device name to all logs */
  public override log(...args: unknown[]): void {
    super.log(this.getName(), '-', ...args)
  }
  /* v8 ignore stop */

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }
  /* v8 ignore stop */

  public setInterval(
    callback: () => Promise<void>,
    interval: Temporal.DurationLike,
    actionType: string,
  ): NodeJS.Timeout {
    return this.#setTimer(callback, interval, {
      actionType,
      timerType: 'setInterval',
      timerWords: { dateSpecifier: 'starting', timeSpecifier: 'every' },
    })
  }

  public setTimeout(
    callback: () => Promise<void>,
    interval: Temporal.DurationLike,
    actionType: string,
  ): NodeJS.Timeout {
    return this.#setTimer(callback, interval, {
      actionType,
      timerType: 'setTimeout',
      timerWords: { dateSpecifier: 'on', timeSpecifier: 'in' },
    })
  }

  // Homey keeps a warning bubble on the device tile until it is cleared:
  // setting the message and clearing it right away shows the transient toast
  // without permanently flagging the device. The immediate reset to `null`
  // is intentional — do not "fix" it.
  public override async setWarning(error: unknown): Promise<void> {
    if (error !== null) {
      await super.setWarning(getErrorMessage(error))
    }
    await super.setWarning(null)
  }

  protected async applyCapabilitiesOptions(data?: unknown): Promise<void> {
    const capabilitiesOptions = this.driver.getCapabilitiesOptions(data)
    for (const [capability, options] of Object.entries(capabilitiesOptions)) {
      /* v8 ignore next -- options is always defined in practice; Partial type is defensive */
      if (options !== undefined) {
        // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
        await this.setCapabilityOptions(
          capability,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing options from unknown
          options as Record<string, unknown>,
        )
      }
    }
  }

  protected cleanupDevice(): void {
    if (this.#syncTimeout !== null) {
      this.homey.clearTimeout(this.#syncTimeout)
      this.#syncTimeout = null
    }
    this.#reports.regular?.unschedule()
    this.#reports.total?.unschedule()
  }

  protected getRequiredCapabilities(): string[] {
    return this.driver.getRequiredCapabilities()
  }

  protected isEnergyCapability(setting: string): boolean {
    return Object.hasOwn(this.driver.energyCapabilityTagMapping, setting)
  }

  protected isManifestCapability(capability: string): boolean {
    return this.driver.manifest.capabilities.includes(capability)
  }

  protected mapCapabilitiesToDeviceTags(
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    this.log('Requested data:', values)
    const tagMapping = this.#setCapabilityTagMapping
    const result: Record<string, unknown> = {}
    for (const [capability, value] of Object.entries(values)) {
      const tag = tagMapping[capability]
      if (tag !== undefined) {
        result[tag] = this.capabilityToDevice[capability]?.(value) ?? value
      }
    }
    return result
  }

  protected async scheduleEnergyReports(): Promise<void> {
    if (this.energyReportRegular !== null) {
      this.#reports.regular = this.createEnergyReport(this.energyReportRegular)
      await this.#reports.regular.start()
    }
    if (this.energyReportTotal !== null) {
      this.#reports.total = this.createEnergyReport(this.energyReportTotal)
      await this.#reports.total.start()
    }
  }

  protected async sendUpdate(values: Record<string, unknown>): Promise<void> {
    const device = await this.ensureDevice()
    if (device === null) {
      return
    }
    const updateData = this.mapCapabilitiesToDeviceTags(values)
    if (Object.keys(updateData).length > 0) {
      try {
        await device.updateValues(updateData)
      } catch (error) {
        if (!(error instanceof NoChangesError)) {
          await this.setWarning(error)
        }
      }
    }
    this.#scheduleSyncFromDevice()
  }

  async #ensureDeviceFacade(): Promise<ClassicDeviceFacade> {
    if (this.#deviceFacade === undefined) {
      this.#deviceFacade = this.getFacade()
      await this.#init()
    }
    return this.#deviceFacade
  }

  async #init(): Promise<void> {
    await this.#setCapabilities()
    await this.applyCapabilitiesOptions()
    await this.syncFromDevice()
    await this.scheduleEnergyReports()
  }

  #isThermostatModeSupportingOff(): boolean {
    return this.thermostatMode !== null && 'off' in this.thermostatMode
  }

  #registerCapabilityListeners(): void {
    this.registerMultipleCapabilityListener(
      Object.keys(this.driver.setCapabilityTagMapping),
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
        ...this.getRequiredCapabilities(),
      ].filter((capability) => this.isManifestCapability(capability)),
    )

    for (const capability of currentCapabilities.symmetricDifference(
      requiredCapabilities,
    )) {
      // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
      await (requiredCapabilities.has(capability) ?
        this.addCapability(capability)
      : this.removeCapability(capability))
    }

    this.#setCapabilityTagMapping = this.cleanMapping(
      this.driver.setCapabilityTagMapping,
    )
    this.#getCapabilityTagMapping = this.cleanMapping(
      this.driver.getCapabilityTagMapping,
    )
    this.#listCapabilityTagMapping = this.cleanMapping(
      this.driver.listCapabilityTagMapping,
    )
  }

  #setTimer(
    callback: () => Promise<void>,
    interval: Temporal.DurationLike,
    { actionType, timerType, timerWords }: TimerOptions,
  ): NodeJS.Timeout {
    const duration = Temporal.Duration.from(interval)
    const locale = getLocale(this.homey)
    this.log(
      capitalize(actionType),
      'will run',
      timerWords.timeSpecifier,
      duration.round({ largestUnit: 'days' }).toLocaleString(locale),
      timerWords.dateSpecifier,
      getNow(this.homey).add(duration).toLocaleString(locale, {
        dateStyle: 'full',
        timeStyle: 'full',
      }),
    )

    return this.homey[timerType](
      callback,
      duration.total({ unit: 'milliseconds' }),
    )
  }

  async #syncOptionalCapabilities(
    newSettings: Record<string, unknown>,
    changedCapabilities: string[],
  ): Promise<void> {
    for (const capability of changedCapabilities) {
      // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
      await (newSettings[capability] === true ?
        this.addCapability(capability)
      : this.removeCapability(capability))
    }
    this.#listCapabilityTagMapping = this.cleanMapping(
      this.driver.listCapabilityTagMapping,
    )
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
    if (changedKeys.includes('always_on') && newSettings.always_on === true) {
      await this.triggerCapabilityListener('onoff', true)
      return
    }
    if (
      changedKeys.some(
        (setting) =>
          setting !== 'always_on' && !this.isEnergyCapability(setting),
      )
    ) {
      await this.syncFromDevice()
    }
  }

  async #updateEnergyReportsOnSettings(changedKeys: string[]): Promise<void> {
    const results = await Promise.allSettled(
      modes.map(async (mode) => {
        if (
          changedKeys.some(
            (setting) => isTotalEnergyKey(setting) === (mode === 'total'),
          )
        ) {
          await this.#reports[mode]?.start()
        }
      }),
    )
    for (const result of results) {
      /* v8 ignore next -- defensive: report.start() rejection is not reachable in unit tests */
      if (result.status === 'rejected') {
        this.error('Energy report update failed:', result.reason)
      }
    }
  }
}
