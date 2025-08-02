import type {
  DeviceType,
  IDeviceFacade,
  ListDeviceData,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

// eslint-disable-next-line import-x/no-extraneous-dependencies
import Homey from 'homey'

import type {
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  EnergyReportMode,
  EnergyReportRegular,
  EnergyReportTotal,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  OpCapabilities,
  OpCapabilityTagEntry,
  SetCapabilities,
  SetCapabilityTagMapping,
  Settings,
} from '../types/index.mts'

import { addToLogs } from '../decorators/add-to-logs.mts'
import { isTotalEnergyKey, LENGTH_ZERO } from '../lib/index.mts'
import { withTimers } from '../mixins/with-timers.mts'

import type { BaseMELCloudDriver } from './base-driver.mts'

const DEBOUNCE_DELAY = 1000

const modes: EnergyReportMode[] = ['regular', 'total']

const getErrorMessage = (error: unknown): string | null =>
  error instanceof Error ? error.message : String(error)

@addToLogs('getName()')
export abstract class BaseMELCloudDevice<
  T extends DeviceType,
  // eslint-disable-next-line import-x/no-named-as-default-member
> extends withTimers(Homey.Device) {
  declare public readonly driver: BaseMELCloudDriver<T>

  declare public readonly getCapabilityOptions: <
    K extends string & keyof CapabilitiesOptions<T>,
  >(
    capability: K,
  ) => CapabilitiesOptions<T>[K]

  declare public readonly getCapabilityValue: <
    K extends string & keyof Capabilities<T>,
  >(
    capability: K,
  ) => Capabilities<T>[K]

  declare public readonly getData: () => DeviceDetails<T>['data']

  declare public readonly getSetting: <K extends keyof Settings>(
    setting: K,
  ) => NonNullable<Settings[K]>

  declare public readonly getSettings: () => Settings

  declare public readonly homey: Homey.Homey

  declare public readonly setCapabilityOptions: <
    K extends string & keyof CapabilitiesOptions<T>,
  >(
    capability: K,
    options: CapabilitiesOptions<T>[K] & Record<string, unknown>,
  ) => Promise<void>

  declare public readonly setCapabilityValue: <
    K extends string & keyof Capabilities<T>,
  >(
    capability: K,
    value: Capabilities<T>[K],
  ) => Promise<void>

  declare public readonly setSettings: (settings: Settings) => Promise<void>

  readonly #reports: {
    regular?: EnergyReportRegular<T>
    total?: EnergyReportTotal<T>
  } = {}

  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping<T>> = {}

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping<T>> = {}

  #device?: IDeviceFacade<T>

  protected abstract readonly EnergyReportRegular:
    | (new (device: BaseMELCloudDevice<T>) => EnergyReportRegular<T>)
    | null

  protected abstract readonly EnergyReportTotal:
    | (new (device: BaseMELCloudDevice<T>) => EnergyReportTotal<T>)
    | null

  protected abstract readonly fromDevice: Partial<
    Record<keyof OpCapabilities<T>, ConvertFromDevice<T>>
  >

  protected abstract readonly thermostatMode: object | null

  protected abstract toDevice: Partial<
    Record<keyof SetCapabilities<T>, ConvertToDevice<T>>
  >

  public get id(): number {
    return this.getData().id
  }

  get #listCapabilityTagMapping(): Partial<ListCapabilityTagMapping<T>> {
    return this.cleanMapping(this.driver.listCapabilityTagMapping)
  }

  get #opCapabilityTagEntries(): OpCapabilityTagEntry<T>[] {
    return Object.entries({
      ...this.#setCapabilityTagMapping,
      ...this.#getCapabilityTagMapping,
      ...this.#listCapabilityTagMapping,
    }) as OpCapabilityTagEntry<T>[]
  }

  public override onDeleted(): void {
    this.#unscheduleReports()
  }

  public override async onInit(): Promise<void> {
    this.toDevice = {
      onoff: (onoff: boolean): boolean => this.getSetting('always_on') || onoff,
      ...this.toDevice,
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
    if (changedEnergyKeys.length > LENGTH_ZERO) {
      await this.#updateEnergyReportsOnSettings({
        changedKeys: changedEnergyKeys,
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async onUninit(): Promise<void> {
    this.onDeleted()
  }

  public override async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
    }
  }

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }

  public override async setWarning(error: unknown): Promise<void> {
    const warning = getErrorMessage(error)
    if (warning !== null) {
      await super.setWarning(warning)
    }
    await super.setWarning(null)
  }

  public cleanMapping<
    M extends
      | EnergyCapabilityTagMapping<T>
      | GetCapabilityTagMapping<T>
      | ListCapabilityTagMapping<T>
      | SetCapabilityTagMapping<T>,
  >(capabilityTagMapping: M): Partial<M> {
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<M>
  }

  public async fetchDevice(): Promise<IDeviceFacade<T> | null> {
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

  public async syncFromDevice(data?: ListDeviceData<T>): Promise<void> {
    const newData = data ?? (await this.#fetchData())
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
            this.#convertFromDevice(
              capability,
              data[tag],
              data,
            ) as Capabilities<T>[string & keyof OpCapabilities<T>],
          )
        }
      }),
    )
  }

  #buildUpdateData(values: Partial<SetCapabilities<T>>): UpdateDeviceData<T> {
    this.log('Requested data:', values)
    return Object.fromEntries(
      Object.entries(values).map(([capability, value]) => [
        this.#setCapabilityTagMapping[
          capability as keyof SetCapabilityTagMapping<T>
        ],
        this.#convertToDevice(
          capability as keyof SetCapabilities<T>,
          value as UpdateDeviceData<T>[keyof UpdateDeviceData<T>],
        ),
      ]),
    ) as UpdateDeviceData<T>
  }

  #convertFromDevice<K extends keyof OpCapabilities<T>>(
    capability: K,
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): OpCapabilities<T>[K] {
    return (this.fromDevice[capability]?.(value, data) ??
      value) as OpCapabilities<T>[K]
  }

  #convertToDevice(
    capability: keyof SetCapabilities<T>,
    value: UpdateDeviceData<T>[keyof UpdateDeviceData<T>],
  ): UpdateDeviceData<T>[keyof UpdateDeviceData<T>] {
    return (
      this.toDevice[capability]?.(
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
    if (this.EnergyReportRegular) {
      this.#reports.regular = new this.EnergyReportRegular(this)
      await this.#reports.regular.handle()
    }
    if (this.EnergyReportTotal) {
      this.#reports.total = new this.EnergyReportTotal(this)
      await this.#reports.total.handle()
    }
  }

  async #handleOptionalCapabilities(
    newSettings: Settings,
    changedCapabilities: string[],
  ): Promise<void> {
    for (const capability of changedCapabilities) {
      // eslint-disable-next-line no-await-in-loop
      await (newSettings[capability] === true ?
        this.addCapability(capability)
      : this.removeCapability(capability))
    }
  }

  async #init(data: ListDeviceData<T>): Promise<void> {
    await this.#setCapabilities(data)
    await this.#setCapabilityOptions(data)
    await this.syncFromDevice(data)
    await this.#handleEnergyReports()
  }

  #isCapability(setting: string): boolean {
    return (this.driver.manifest.capabilities ?? []).includes(setting)
  }

  #isEnergyCapability(setting: string): boolean {
    return setting in this.driver.energyCapabilityTagMapping
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
        await this.#set(values as Partial<SetCapabilities<T>>)
      },
      DEBOUNCE_DELAY,
    )
  }

  async #set(values: Partial<SetCapabilities<T>>): Promise<void> {
    const device = await this.fetchDevice()
    if (device) {
      const updateData = this.#buildUpdateData(values)
      if (Object.keys(updateData).length > LENGTH_ZERO) {
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
    const requiredCapabilities = new Set([
      ...Object.keys(settings).filter(
        (setting) =>
          this.#isCapability(setting) &&
          typeof settings[setting] === 'boolean' &&
          settings[setting],
      ),
      ...this.driver.getRequiredCapabilities(data),
    ])
    for (const capability of currentCapabilities.symmetricDifference(
      requiredCapabilities,
    )) {
      // eslint-disable-next-line no-await-in-loop
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
    for (const [capability, options] of Object.entries(
      this.driver.getCapabilitiesOptions(data),
    ) as [
      string & keyof CapabilitiesOptions<T>,
      CapabilitiesOptions<T>[Extract<keyof CapabilitiesOptions<T>, string>] &
        Record<string, unknown>,
    ][]) {
      // eslint-disable-next-line no-await-in-loop
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
    if (changedCapabilities.length > LENGTH_ZERO) {
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
