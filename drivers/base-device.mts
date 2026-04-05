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
  #deviceFacade?: DeviceFacade

  #getCapabilityTagMapping: Record<string, string> = {}

  #listCapabilityTagMapping: Record<string, string> = {}

  readonly #reports: {
    regular?: EnergyReportOperation
    total?: EnergyReportOperation
  } = {}

  #setCapabilityTagMapping: Record<string, string> = {}

  protected abstract capabilityToDevice: Partial<
    Record<string, (...args: never[]) => unknown>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<string, (...args: never[]) => unknown>
  >

  declare public readonly driver: BaseMELCloudDriver

  protected abstract readonly energyReportRegular: EnergyReportConfig | null

  protected abstract readonly energyReportTotal: EnergyReportConfig | null

  declare public readonly getData: () => { id: number | string }

  declare public readonly getSettings: () => Record<string, unknown>

  declare public readonly homey: Homey.Homey

  protected abstract readonly thermostatMode: Record<string, string> | null

  protected get cachedFacade(): DeviceFacade | undefined {
    return this.#deviceFacade
  }

  public get id(): number | string {
    return this.getData().id
  }

  protected get isAlwaysOn(): boolean {
    return Boolean(this.getSetting('always_on'))
  }

  protected get operationalCapabilityTagEntries(): [string, string][] {
    return Object.entries({
      ...this.getSetCapabilityTagMapping(),
      ...this.getGetCapabilityTagMapping(),
      ...this.getListCapabilityTagMapping(),
    })
  }

  public override onDeleted(): void {
    this.cleanupDevice()
  }

  public override async onInit(): Promise<void> {
    this.applyBaseConverters()
    await this.setWarning(null)
    await this.initDevice()
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

  public override async onUninit(): Promise<void> {
    this.onDeleted()
    await Promise.resolve()
  }

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

  public override error(...args: unknown[]): void {
    super.error(this.getName(), '-', ...args)
  }

  public async fetchDevice(): Promise<DeviceFacade | null> {
    try {
      if (!this.#deviceFacade) {
        this.#deviceFacade = this.getFacade()
        await this.init()
      }
      return this.#deviceFacade
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  public override log(...args: unknown[]): void {
    super.log(this.getName(), '-', ...args)
  }

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

  public abstract syncFromDevice(): Promise<void>

  protected applyBaseConverters(): void {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean => this.isAlwaysOn || isOn,
      ...this.capabilityToDevice,
    }
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

  protected buildUpdateData(
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    this.log('Requested data:', values)
    const tagMapping = this.getSetCapabilityTagMapping()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Object.fromEntries returns { [k: string]: any }
    return Object.fromEntries(
      Object.entries(values).map(([capability, value]) => [
        tagMapping[capability],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- value is cast to never for variadic converter args
        this.capabilityToDevice[capability]?.(value as never) ?? value,
      ]),
    )
  }

  protected cleanupDevice(): void {
    this.#reports.regular?.unschedule()
    this.#reports.total?.unschedule()
  }

  protected abstract createEnergyReport(
    config: EnergyReportConfig,
  ): EnergyReportOperation

  protected abstract getFacade(): DeviceFacade

  protected getGetCapabilityTagMapping(): Record<string, string> {
    return this.#getCapabilityTagMapping
  }

  protected getListCapabilityTagMapping(): Record<string, string> {
    return this.#listCapabilityTagMapping
  }

  protected getRequiredCapabilities(): string[] {
    return this.driver.getRequiredCapabilities()
  }

  protected getSetCapabilityTagMapping(): Record<string, string> {
    return this.#setCapabilityTagMapping
  }

  protected async handleEnergyReports(): Promise<void> {
    if (this.energyReportRegular) {
      this.#reports.regular = this.createEnergyReport(this.energyReportRegular)
      await this.#reports.regular.handle()
    }
    if (this.energyReportTotal) {
      this.#reports.total = this.createEnergyReport(this.energyReportTotal)
      await this.#reports.total.handle()
    }
  }

  protected async init(): Promise<void> {
    this.#setCapabilityTagMapping = this.cleanMapping(
      this.driver.setCapabilityTagMapping,
    )
    this.#getCapabilityTagMapping = this.cleanMapping(
      this.driver.getCapabilityTagMapping,
    )
    this.#listCapabilityTagMapping = this.cleanMapping(
      this.driver.listCapabilityTagMapping,
    )
    await this.applyCapabilitiesOptions()
    await this.#setCapabilities()
    await this.syncFromDevice()
    await this.handleEnergyReports()
  }

  protected async initDevice(): Promise<void> {
    await this.fetchDevice()
    this.#registerCapabilityListeners()
  }

  protected isEnergyCapability(setting: string): boolean {
    return setting in this.driver.energyCapabilityTagMapping
  }

  protected isManifestCapability(capability: string): boolean {
    return this.driver.manifest.capabilities.includes(capability)
  }

  protected async sendUpdate(values: Record<string, unknown>): Promise<void> {
    const device = await this.fetchDevice()
    if (!device) {
      return
    }
    const updateData = this.buildUpdateData(values)
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

  async #handleOptionalCapabilities(
    newSettings: Record<string, unknown>,
    changedCapabilities: string[],
  ): Promise<void> {
    for (const capability of changedCapabilities) {
      // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
      await (newSettings[capability] === true ?
        this.addCapability(capability)
      : this.removeCapability(capability))
    }
  }

  #isThermostatModeSupportingOff(): boolean {
    return this.thermostatMode !== null && 'off' in this.thermostatMode
  }

  #registerCapabilityListeners(): void {
    this.registerMultipleCapabilityListener(
      Object.keys(this.getSetCapabilityTagMapping()).filter((capability) =>
        this.hasCapability(capability),
      ),
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

  async #updateDeviceOnSettings(
    changedKeys: string[],
    changedCapabilities: string[],
    newSettings: Record<string, unknown>,
  ): Promise<void> {
    if (changedCapabilities.length > 0) {
      await this.#handleOptionalCapabilities(newSettings, changedCapabilities)
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
    await Promise.all(
      modes.map(async (mode) => {
        if (
          changedKeys.some(
            (setting) => isTotalEnergyKey(setting) === (mode === 'total'),
          )
        ) {
          await this.#reports[mode]?.handle()
        }
      }),
    )
  }
}
