import { type DurationLike, DateTime, Duration } from 'luxon'

import type {
  DeviceFacade,
  EnergyReportMode,
  EnergyReportOperation,
} from '../types/index.mts'
import { type Homey, Device } from '../lib/homey.mts'
import { getErrorMessage, isTotalEnergyKey } from '../lib/index.mts'
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
    Record<string, (...args: never[]) => unknown>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<string, (...args: never[]) => unknown>
  >

  protected abstract readonly energyReportRegular: EnergyReportConfig | null

  protected abstract readonly energyReportTotal: EnergyReportConfig | null

  protected abstract readonly thermostatMode: Record<string, string> | null

  public get id(): number | string {
    return this.getData().id
  }

  protected get cachedFacade(): DeviceFacade | undefined {
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
    })
  }

  #deviceFacade?: DeviceFacade

  #getCapabilityTagMapping: Record<string, string> = {}

  readonly #reports: {
    regular?: EnergyReportOperation
    total?: EnergyReportOperation
  } = {}

  #setCapabilityTagMapping: Record<string, string> = {}

  public override async onInit(): Promise<void> {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean => this.isAlwaysOn || isOn,
      ...this.capabilityToDevice,
    }
    await this.setWarning(null)
    this.#registerCapabilityListeners()
    await this.fetchDevice()
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

  protected abstract getFacade(): DeviceFacade

  public abstract syncFromDevice(): Promise<void>

  public override async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
    }
  }

  public cleanMapping(
    capabilityTagMapping: Record<string, unknown>,
  ): Record<string, string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- driver tag mappings are Record<string, string> at runtime; unknown comes from BaseMELCloudDriver's broad type
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Record<string, string>
  }

  /* v8 ignore start -- trivial override: prepends device name to all error logs */
  public override error(...args: unknown[]): void {
    super.error(this.getName(), '-', ...args)
  }
  /* v8 ignore stop */

  public async fetchDevice(): Promise<DeviceFacade | null> {
    try {
      if (!this.#deviceFacade) {
        this.#deviceFacade = this.getFacade()
        await this.#init()
      }
      return this.#deviceFacade
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  /* v8 ignore start -- trivial override: prepends device name to all logs */
  public override log(...args: unknown[]): void {
    super.log(this.getName(), '-', ...args)
  }
  /* v8 ignore stop */

  #listCapabilityTagMapping: Record<string, string> = {}

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }

  public setInterval(
    callback: () => Promise<void>,
    interval: DurationLike,
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
    interval: DurationLike,
    actionType: string,
  ): NodeJS.Timeout {
    return this.#setTimer(callback, interval, {
      actionType,
      timerType: 'setTimeout',
      timerWords: { dateSpecifier: 'on', timeSpecifier: 'in' },
    })
  }

  public override async setWarning(error: unknown): Promise<void> {
    if (error !== null) {
      await super.setWarning(getErrorMessage(error))
    }
    await super.setWarning(null)
  }

  protected async applyCapabilitiesOptions(data?: unknown): Promise<void> {
    for (const [capability, options] of Object.entries(
      this.driver.getCapabilitiesOptions(data),
    )) {
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
    this.#reports.regular?.unschedule()
    this.#reports.total?.unschedule()
  }

  protected getRequiredCapabilities(): string[] {
    return this.driver.getRequiredCapabilities()
  }

  protected isEnergyCapability(setting: string): boolean {
    return setting in this.driver.energyCapabilityTagMapping
  }

  protected isManifestCapability(capability: string): boolean {
    return this.driver.manifest.capabilities.includes(capability)
  }

  protected mapCapabilitiesToDeviceTags(
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    this.log('Requested data:', values)
    const tagMapping = this.#setCapabilityTagMapping
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Object.fromEntries returns { [k: string]: any }
    return Object.fromEntries(
      Object.entries(values).map(([capability, value]) => [
        tagMapping[capability],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- value is cast to never for variadic converter args
        this.capabilityToDevice[capability]?.(value as never) ?? value,
      ]),
    )
  }

  protected async scheduleEnergyReports(): Promise<void> {
    if (this.energyReportRegular) {
      this.#reports.regular = this.createEnergyReport(this.energyReportRegular)
      await this.#reports.regular.start()
    }
    if (this.energyReportTotal) {
      this.#reports.total = this.createEnergyReport(this.energyReportTotal)
      await this.#reports.total.start()
    }
  }

  protected async sendUpdate(values: Record<string, unknown>): Promise<void> {
    const device = await this.fetchDevice()
    if (!device) {
      return
    }
    const updateData = this.mapCapabilitiesToDeviceTags(values)
    if (Object.keys(updateData).length > 0) {
      try {
        await device.setValues(updateData)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'No data to set') {
          await this.setWarning(error)
        }
      }
    }
    // Delay sync to let Homey's optimistic UI update and debounce settle
    this.homey.setTimeout(async () => this.syncFromDevice(), DEBOUNCE_DELAY)
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
          const isOn = values['thermostat_mode'] !== 'off'
          values['onoff'] = isOn
          if (!isOn) {
            delete values['thermostat_mode']
          }
        }
        await this.sendUpdate(values)
      },
      DEBOUNCE_DELAY,
    )
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
    interval: DurationLike,
    { actionType, timerType, timerWords }: TimerOptions,
  ): NodeJS.Timeout {
    const duration = Duration.fromDurationLike(interval)
    this.log(
      capitalize(actionType),
      'will run',
      timerWords.timeSpecifier,
      duration.rescale().toHuman(),
      timerWords.dateSpecifier,
      DateTime.now()
        .plus(duration)
        .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS),
    )

    return this.homey[timerType](callback, duration.as('milliseconds'))
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
    if (
      changedKeys.includes('always_on') &&
      newSettings['always_on'] === true
    ) {
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
