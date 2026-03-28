import type {
  DeviceFacade,
  DeviceType,
  ListDeviceData,
  UpdateDeviceData,
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
import { type Homey, Device } from '../lib/homey.mts'
import { isTotalEnergyKey, typedEntries } from '../lib/index.mts'
import { withTimers } from '../mixins/with-timers.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'
import { type EnergyReportConfig, EnergyReport } from './base-report.mts'

const DEBOUNCE_DELAY = 1000

const modes: EnergyReportMode[] = ['regular', 'total']

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

@addToLogs('getName()')
export abstract class BaseMELCloudDevice<
  T extends DeviceType,
> extends withTimers(Device) {
  #device?: DeviceFacade<T>

  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping<T>> = {}

  readonly #reports: {
    regular?: EnergyReport<T>
    total?: EnergyReport<T>
  } = {}

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping<T>> = {}

  protected abstract capabilityToDevice: Partial<
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

  declare public readonly homey: Homey.Homey

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

  protected abstract readonly thermostatMode: Record<string, string> | null

  get #listCapabilityTagMapping(): Partial<ListCapabilityTagMapping<T>> {
    return this.cleanMapping(this.driver.listCapabilityTagMapping)
  }

  get #opCapabilityTagEntries(): OperationalCapabilityTagEntry<T>[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return typedEntries({
      ...this.#setCapabilityTagMapping,
      ...this.#getCapabilityTagMapping,
      ...this.#listCapabilityTagMapping,
    }) as OperationalCapabilityTagEntry<T>[]
  }

  protected get facade(): DeviceFacade<T> | undefined {
    return this.#device
  }

  public get id(): number {
    return this.getData().id
  }

  public override onDeleted(): void {
    this.#unscheduleReports()
  }

  public override async onInit(): Promise<void> {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean => this.getSetting('always_on') || isOn,
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
    newSettings: Settings
  }): Promise<void> {
    const changedCapabilities = changedKeys.filter(
      (setting) =>
        this.#isCapability(setting) &&
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

  public override async onUninit(): Promise<void> {
    this.onDeleted()
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public override async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
    }
  }

  public cleanMapping<
    TMapping extends
      | EnergyCapabilityTagMapping<T>
      | GetCapabilityTagMapping<T>
      | ListCapabilityTagMapping<T>
      | SetCapabilityTagMapping<T>,
  >(capabilityTagMapping: TMapping): Partial<TMapping> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<TMapping>
  }

  public async fetchDevice(): Promise<DeviceFacade<T> | null> {
    try {
      if (!this.#device) {
        this.#device = this.homey.app.getFacade('devices', this.id)
        await this.#init(this.#device.data)
      }
      return this.#device
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }

  public override async setWarning(error: unknown): Promise<void> {
    if (error !== null) {
      await super.setWarning(getErrorMessage(error))
    }
    await super.setWarning(null)
  }

  public async syncFromDevice(data?: ListDeviceData<T>): Promise<void> {
    const newData = data ?? (await this.#fetchData())
    /* v8 ignore next */
    if (newData) {
      await this.setCapabilityValues(newData)
    }
  }

  protected async setCapabilityValues(data: ListDeviceData<T>): Promise<void> {
    this.homey.api.realtime('deviceupdate', null)
    await Promise.all(
      this.#opCapabilityTagEntries.map(async ([capability, tag]) => {
        if (tag in data) {
          await this.setCapabilityValue(
            capability,
            this.#convertFromDevice(capability, data[tag], data),
          )
        }
      }),
    )
  }

  #buildUpdateData(values: Partial<SetCapabilities<T>>): UpdateDeviceData<T> {
    this.log('Requested data:', values)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return Object.fromEntries(
      Object.entries(values).map(([capability, value]) => [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        this.#setCapabilityTagMapping[capability as keyof SetCapabilities<T>],
        this.#convertToDevice(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          capability as keyof SetCapabilities<T>,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          value as UpdateDeviceData<T>[keyof UpdateDeviceData<T>],
        ),
      ]),
    ) as UpdateDeviceData<T>
  }

  #convertFromDevice<TKey extends keyof Capabilities<T>>(
    capability: TKey,
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): Capabilities<T>[TKey] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return (this.deviceToCapability[capability]?.(value, data) ??
      value) as Capabilities<T>[TKey]
  }

  #convertToDevice(
    capability: keyof SetCapabilities<T>,
    value: UpdateDeviceData<T>[keyof UpdateDeviceData<T>],
  ): UpdateDeviceData<T>[keyof UpdateDeviceData<T>] {
    return (
      this.capabilityToDevice[capability]?.(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        value as SetCapabilities<T>[keyof SetCapabilities<T>],
      ) ?? value
    )
  }

  async #fetchData(): Promise<ListDeviceData<T> | null> {
    try {
      const device = await this.fetchDevice()
      return device?.data ?? null
    } catch {
      await this.setWarning(
        this.homey.__(this.homey.__('errors.deviceNotFound')),
      )
      return null
    }
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

  async #init(data: ListDeviceData<T>): Promise<void> {
    // Configure capabilities based on device data
    await this.#setCapabilities(data)
    // Set capability options from driver
    await this.#setCapabilityOptions(data)
    // Sync initial values from device
    await this.syncFromDevice(data)
    // Schedule energy reports
    await this.#handleEnergyReports()
  }

  #isCapability(capability: string): boolean {
    /* v8 ignore next */
    return (this.driver.manifest.capabilities ?? []).includes(capability)
  }

  #isEnergyCapability(capability: string): boolean {
    return capability in this.driver.energyCapabilityTagMapping
  }

  #isThermostatModeSupportingOff(): boolean {
    return this.thermostatMode !== null && 'off' in this.thermostatMode
  }

  #registerCapabilityListeners(): void {
    this.registerMultipleCapabilityListener(
      Object.keys(this.driver.setCapabilityTagMapping),
      async (values) => {
        /*
         * When thermostat_mode is set to 'off', sync onoff to false and
         * remove thermostat_mode from the update (MELCloud uses
         * Power=false, not OperationMode=off)
         */
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        await this.#set(values as Partial<SetCapabilities<T>>)
      },
      DEBOUNCE_DELAY,
    )
  }

  async #set(values: Partial<SetCapabilities<T>>): Promise<void> {
    const device = await this.fetchDevice()
    if (device) {
      const updateData = this.#buildUpdateData(values)
      if (Object.keys(updateData).length > 0) {
        try {
          await device.setValues(updateData)
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'No data to set') {
            await this.setWarning(error)
          }
        }
      }
    }
  }

  async #setCapabilities(data: ListDeviceData<T>): Promise<void> {
    const settings = this.getSettings()
    const currentCapabilities = new Set(this.getCapabilities())

    const requiredCapabilities = new Set(
      [
        ...Object.keys(settings).filter(
          (setting) =>
            typeof settings[setting] === 'boolean' && settings[setting],
        ),
        ...this.driver.getRequiredCapabilities(data),
      ].filter((capability) => this.#isCapability(capability)),
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
  }

  async #setCapabilityOptions(data: ListDeviceData<T>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
