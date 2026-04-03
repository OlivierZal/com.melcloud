import type {
  DeviceFacade,
  DeviceType,
  ListDeviceData,
} from '@olivierzal/melcloud-api'

import type {
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  EnergyReportMode,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  OperationalCapabilities,
  OperationalCapabilityTagEntry,
  SetCapabilities,
  SetCapabilityTagMapping,
  Settings,
} from '../types/index.mts'
import { addToLogs } from '../decorators/add-to-logs.mts'
import { isTotalEnergyKey, typedEntries } from '../lib/index.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'
import { type EnergyReportConfig, EnergyReport } from './base-report.mts'
import { SharedBaseMELCloudDevice } from './shared-base-device.mts'

const modes: EnergyReportMode[] = ['regular', 'total']

@addToLogs('getName()')
export abstract class BaseMELCloudDevice<
  T extends DeviceType,
> extends SharedBaseMELCloudDevice {
  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping<T>> = {}

  readonly #reports: {
    regular?: EnergyReport<T>
    total?: EnergyReport<T>
  } = {}

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping<T>> = {}

  protected abstract override capabilityToDevice: Partial<
    Record<keyof SetCapabilities<T>, ConvertToDevice<T>>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<keyof OperationalCapabilities<T>, ConvertFromDevice<T>>
  >

  declare public readonly driver: BaseMELCloudDriver<T>

  protected abstract readonly energyReportRegular: EnergyReportConfig | null

  protected abstract readonly energyReportTotal: EnergyReportConfig | null

  declare public readonly getCapabilityOptions: <
    TKey extends string & keyof CapabilitiesOptions<T>,
  >(
    capability: TKey,
  ) => CapabilitiesOptions<T>[TKey]

  declare public readonly getCapabilityValue: <
    TKey extends string & keyof Capabilities<T>,
  >(
    capability: TKey,
  ) => Capabilities<T>[TKey]

  declare public readonly getData: () => DeviceDetails<T>['data']

  declare public readonly getSetting: <TKey extends keyof Settings>(
    setting: TKey,
  ) => NonNullable<Settings[TKey]>

  declare public readonly getSettings: () => Settings

  declare public readonly setCapabilityOptions: <
    TKey extends string & keyof CapabilitiesOptions<T>,
  >(
    capability: TKey,
    options: CapabilitiesOptions<T>[TKey] & Record<string, unknown>,
  ) => Promise<void>

  declare public readonly setCapabilityValue: <
    TKey extends string & keyof Capabilities<T>,
  >(
    capability: TKey,
    value: Capabilities<T>[TKey],
  ) => Promise<void>

  declare public readonly setSettings: (settings: Settings) => Promise<void>

  protected abstract override readonly thermostatMode: Record<
    string,
    string
  > | null

  get #data(): ListDeviceData<T> | undefined {
    return this.facade?.data
  }

  get #listCapabilityTagMapping(): Partial<ListCapabilityTagMapping<T>> {
    return this.cleanMapping(this.driver.listCapabilityTagMapping)
  }

  get #operationalCapabilityTagEntries(): OperationalCapabilityTagEntry<T>[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing merged entries to OperationalCapabilityTagEntry
    return typedEntries({
      ...this.#setCapabilityTagMapping,
      ...this.#getCapabilityTagMapping,
      ...this.#listCapabilityTagMapping,
    }) as OperationalCapabilityTagEntry<T>[]
  }

  protected get facade(): DeviceFacade<T> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from generic base FacadeWithSetValues
    return this.deviceFacade as DeviceFacade<T> | undefined
  }

  public get id(): number {
    return this.getData().id
  }

  public override async onSettings({
    changedKeys,
    newSettings,
  }: {
    changedKeys: string[]
    newSettings: Settings
  }): Promise<void> {
    const changedCapabilities = changedKeys.filter(
      (setting) =>
        this.isManifestCapability(setting) &&
        typeof newSettings[setting] === 'boolean',
    )
    await this.#updateDeviceOnSettings({
      changedCapabilities,
      changedKeys,
      newSettings,
    })
    const changedEnergyKeys = changedCapabilities.filter((setting) =>
      this.#isEnergyCapability(setting),
    )
    if (changedEnergyKeys.length > 0) {
      await this.#updateEnergyReportsOnSettings({
        changedKeys: changedEnergyKeys,
      })
    }
  }

  public cleanMapping<
    TMapping extends
      | EnergyCapabilityTagMapping<T>
      | GetCapabilityTagMapping<T>
      | ListCapabilityTagMapping<T>
      | SetCapabilityTagMapping<T>,
  >(capabilityTagMapping: TMapping): Partial<TMapping> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing filtered Object.fromEntries to Partial<TMapping>
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<TMapping>
  }

  public override async fetchDevice(): Promise<DeviceFacade<T> | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from base FacadeWithSetValues after super call
    return (await super.fetchDevice()) as DeviceFacade<T> | null
  }

  public override async syncFromDevice(): Promise<void> {
    const data = await this.#getDeviceData()
    /* v8 ignore next -- defensive guard: data is guaranteed after fetchDevice */
    if (data) {
      await this.setCapabilityValues(data)
    }
  }

  protected override cleanupDevice(): void {
    this.#unscheduleReports()
  }

  protected override getFacade(): DeviceFacade<T> {
    return this.homey.app.getFacade('devices', this.id)
  }

  protected override getRequiredCapabilities(): string[] {
    /* v8 ignore next -- defensive guard: facade is set after init */
    return this.#data ? this.driver.getRequiredCapabilities(this.#data) : []
  }

  protected override getSetCapabilityKeys(): string[] {
    return Object.keys(this.driver.setCapabilityTagMapping)
  }

  protected override getSetCapabilityTagMapping(): Record<string, string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- widening partial typed mapping to generic Record
    return this.#setCapabilityTagMapping as Record<string, string>
  }

  protected override async init(): Promise<void> {
    /* v8 ignore next -- #data is guaranteed after getFacade in initDevice */
    if (this.#data) {
      await this.#setCapabilityOptions(this.#data)
    }
    await super.init()
    this.#setCapabilityTagMapping = this.cleanMapping(
      this.driver.setCapabilityTagMapping,
    )
    this.#getCapabilityTagMapping = this.cleanMapping(
      this.driver.getCapabilityTagMapping,
    )
    await this.#handleEnergyReports()
  }

  protected async setCapabilityValues(data: ListDeviceData<T>): Promise<void> {
    this.homey.api.realtime('deviceupdate', null)
    await Promise.all(
      this.#operationalCapabilityTagEntries.map(async ([capability, tag]) => {
        if (tag in data) {
          await this.setCapabilityValue(
            capability,
            this.#convertFromDevice(capability, data[tag], data),
          )
        }
      }),
    )
  }

  #convertFromDevice<TKey extends keyof Capabilities<T>>(
    capability: TKey,
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): Capabilities<T>[TKey] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- converter output narrowed to specific capability type
    return (this.deviceToCapability[capability]?.(value, data) ??
      value) as Capabilities<T>[TKey]
  }

  async #fetchDeviceData(): Promise<ListDeviceData<T> | null> {
    try {
      const device = await this.fetchDevice()
      return device?.data ?? null
    } catch {
      await this.setWarning(this.homey.__('errors.deviceNotFound'))
      return null
    }
  }

  async #getDeviceData(): Promise<ListDeviceData<T> | null> {
    return this.#data ?? (await this.#fetchDeviceData())
  }

  async #handleEnergyReports(): Promise<void> {
    if (this.energyReportRegular) {
      this.#reports.regular = new EnergyReport(this, this.energyReportRegular)
      await this.#reports.regular.handle()
    }
    if (this.energyReportTotal) {
      this.#reports.total = new EnergyReport(this, this.energyReportTotal)
      await this.#reports.total.handle()
    }
  }

  async #handleOptionalCapabilities(
    newSettings: Settings,
    changedCapabilities: string[],
  ): Promise<void> {
    for (const capability of changedCapabilities) {
      // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
      await (newSettings[capability] === true ?
        this.addCapability(capability)
      : this.removeCapability(capability))
    }
  }

  #isEnergyCapability(capability: string): boolean {
    return capability in this.driver.energyCapabilityTagMapping
  }

  async #setCapabilityOptions(data: ListDeviceData<T>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing Object.entries to typed capability-options tuple
    for (const [capability, options] of Object.entries(
      this.driver.getCapabilitiesOptions(data),
    ) as [
      string & keyof CapabilitiesOptions<T>,
      CapabilitiesOptions<T>[Extract<keyof CapabilitiesOptions<T>, string>] &
        Record<string, unknown>,
    ][]) {
      // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
      await this.setCapabilityOptions(capability, options)
    }
  }

  #unscheduleReports(): void {
    for (const mode of modes) {
      this.#reports[mode]?.unschedule()
    }
  }

  async #updateDeviceOnSettings({
    changedCapabilities,
    changedKeys,
    newSettings,
  }: {
    changedCapabilities: string[]
    changedKeys: string[]
    newSettings: Settings
  }): Promise<void> {
    if (changedCapabilities.length > 0) {
      await this.#handleOptionalCapabilities(newSettings, changedCapabilities)
      await this.setWarning(this.homey.__('warnings.dashboard'))
    }

    if (changedKeys.includes('always_on') && newSettings.always_on === true) {
      await this.triggerCapabilityListener('onoff', true)
      return
    }

    if (
      changedKeys.some(
        (setting) =>
          setting !== 'always_on' &&
          !(setting in this.driver.energyCapabilityTagMapping),
      )
    ) {
      await this.syncFromDevice()
    }
  }

  async #updateEnergyReportsOnSettings({
    changedKeys,
  }: {
    changedKeys: string[]
  }): Promise<void> {
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
