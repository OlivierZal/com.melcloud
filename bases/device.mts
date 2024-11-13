import { Homey } from '../homey.mjs'
import { addToLogs } from '../lib/addToLogs.mjs'
import { getErrorMessage } from '../lib/getErrorMessage.mjs'
import { isTotalEnergyKey } from '../lib/isTotalEnergyKey.mjs'
import { withTimers } from '../lib/withTimers.mjs'

import type {
  DeviceFacade,
  DeviceType,
  ListDevice,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type MELCloudApp from '../app.mjs'
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
  MELCloudDriver,
  OpCapabilities,
  OpCapabilityTagEntry,
  SetCapabilities,
  SetCapabilityTagMapping,
  Settings,
} from '../types/index.mjs'

const DEBOUNCE_DELAY = 1000

const modes:   EnergyReportMode[] = ['regular', 'total']

@addToLogs('getName()')
export abstract class BaseMELCloudDevice<
  T extends keyof typeof DeviceType,
> extends withTimers(Homey.Device) {
  public declare readonly driver: MELCloudDriver[T]

  public readonly id = (this.getData() as DeviceDetails<T>['data']).id

  readonly #app = this.homey.app as MELCloudApp

  readonly #reports: {
    regular?: EnergyReportRegular[T]
    total?: EnergyReportTotal[T]
  } = {}

  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping[T]> = {}

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping[T]> = {}

  #device?: DeviceFacade[T]

  protected abstract readonly fromDevice: Partial<
    Record<keyof OpCapabilities[T], ConvertFromDevice<T>>
  >

  protected abstract toDevice: Partial<
    Record<keyof SetCapabilities[T], ConvertToDevice<T>>
  >

  protected abstract EnergyReportRegular?: new (
    device: BaseMELCloudDevice<T>,
  ) => EnergyReportRegular[T]

  protected abstract EnergyReportTotal?: new (
    device: BaseMELCloudDevice<T>,
  ) => EnergyReportTotal[T]

  get #listCapabilityTagMapping(): Partial<ListCapabilityTagMapping[T]> {
    return this.cleanMapping(
      this.driver.listCapabilityTagMapping as ListCapabilityTagMapping[T],
    )
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
    if (changedEnergyKeys.length) {
      await this.#updateEnergyReportsOnSettings({
        changedKeys: changedEnergyKeys,
      })
    }
  }

  public override async onUninit(): Promise<void> {
    this.onDeleted()
    return Promise.resolve()
  }

  public override async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
    }
  }

  public override getCapabilityOptions<
    K extends string & keyof CapabilitiesOptions[T],
  >(capability: K): CapabilitiesOptions[T][K] {
    return super.getCapabilityOptions(capability) as CapabilitiesOptions[T][K]
  }

  public override getCapabilityValue<K extends string & keyof Capabilities[T]>(
    capability: K,
  ): Capabilities[T][K] {
    return super.getCapabilityValue(capability) as Capabilities[T][K]
  }

  public override getSetting<K extends Extract<keyof Settings, string>>(
    setting: K,
  ): NonNullable<Settings[K]> {
    return super.getSetting(setting) as NonNullable<Settings[K]>
  }

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }

  public override async setCapabilityOptions<
    K extends string & keyof CapabilitiesOptions[T],
  >(
    capability: K,
    options: CapabilitiesOptions[T][K] & Record<string, unknown>,
  ): Promise<void> {
    await super.setCapabilityOptions(capability, options)
  }

  public override async setCapabilityValue<
    K extends string & keyof Capabilities[T],
  >(capability: K, value: Capabilities[T][K]): Promise<void> {
    await super.setCapabilityValue(capability, value)
    this.log('Capability', capability, 'is', value)
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
      | EnergyCapabilityTagMapping[T]
      | GetCapabilityTagMapping[T]
      | ListCapabilityTagMapping[T]
      | SetCapabilityTagMapping[T],
  >(capabilityTagMapping: M): Partial<M> {
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<M>
  }

  public async fetchDevice(): Promise<DeviceFacade[T] | undefined> {
    try {
      if (!this.#device) {
        this.#device = this.#app.getFacade('devices', this.id) as
          | DeviceFacade[T]
          | undefined
        if (this.#device) {
          await this.#init(this.#device.data)
        }
      }
      return this.#device
    } catch (error) {
      await this.setWarning(error)
    }
  }

  public async syncFromDevice(data?: ListDevice[T]['Device']): Promise<void> {
    const newData = data ?? (await this.#fetchData())
    if (newData) {
      await this.setCapabilityValues(newData)
    }
  }

  protected async setCapabilityValues(
    data: ListDevice[T]['Device'],
  ): Promise<void> {
    this.homey.api.realtime('deviceupdate', undefined)
    await Promise.all(
      this.#opCapabilityTagEntries.map(async ([capability, tag]) => {
        if (tag in data) {
          await this.setCapabilityValue(
            capability,
            this.#convertFromDevice(
              capability,
              data[tag as keyof ListDevice[T]['Device']],
              data,
            ) as Capabilities[T][Extract<keyof OpCapabilities[T], string>],
          )
        }
      }),
    )
  }

  #buildUpdateData(values: Partial<SetCapabilities[T]>): UpdateDeviceData[T] {
    this.log('Requested data:', values)
    return Object.fromEntries(
      Object.entries(values).map(([capability, value]) => [
        this.#setCapabilityTagMapping[
          capability as keyof SetCapabilityTagMapping[T]
        ],
        this.#convertToDevice(
          capability as keyof SetCapabilities[T],
          value as UpdateDeviceData[T][keyof UpdateDeviceData[T]],
        ),
      ]),
    ) as UpdateDeviceData[T]
  }

  #convertFromDevice<K extends keyof OpCapabilities[T]>(
    capability: K,
    value: ListDevice[T]['Device'][keyof ListDevice[T]['Device']],
    data?: ListDevice[T]['Device'],
  ): OpCapabilities[T][K] {
    return (this.fromDevice[capability]?.(value, data) ??
      value) as OpCapabilities[T][K]
  }

  #convertToDevice(
    capability: keyof SetCapabilities[T],
    value: UpdateDeviceData[T][keyof UpdateDeviceData[T]],
  ): UpdateDeviceData[T][keyof UpdateDeviceData[T]] {
    return (
      this.toDevice[capability]?.(
        value as SetCapabilities[T][keyof SetCapabilities[T]],
      ) ?? value
    )
  }

  async #fetchData(): Promise<ListDevice[T]['Device'] | undefined> {
    try {
      return (await this.fetchDevice())?.data
    } catch {
      await this.setWarning(
        this.homey.__(this.homey.__('errors.deviceNotFound')),
      )
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
    await changedCapabilities.reduce(async (acc, capability) => {
      await acc
      if (newSettings[capability] === true) {
        await this.addCapability(capability)
        return
      }
      await this.removeCapability(capability)
    }, Promise.resolve())
  }

  async #init(data: ListDevice[T]['Device']): Promise<void> {
    await this.#setCapabilities(data)
    await this.#setCapabilityOptions(data)
    await this.syncFromDevice(data)
    await this.#handleEnergyReports()
  }

  #isCapability(setting: string): boolean {
    return (this.driver.capabilities ?? []).includes(setting)
  }

  #isEnergyCapability(setting: string): boolean {
    return setting in this.driver.energyCapabilityTagMapping
  }

  #registerCapabilityListeners(): void {
    this.registerMultipleCapabilityListener(
      Object.keys(this.driver.setCapabilityTagMapping),
      async (values) => {
        if (this.driver.type !== 'Atw' && 'thermostat_mode' in values) {
          const isOn = values.thermostat_mode !== 'off'
          values.onoff = isOn
          if (!isOn) {
            delete values.thermostat_mode
          }
        }
        await this.#set(values as Partial<SetCapabilities[T]>)
      },
      DEBOUNCE_DELAY,
    )
  }

  async #set(values: Partial<SetCapabilities[T]>): Promise<void> {
    const device = await this.fetchDevice()
    if (device) {
      const updateData = this.#buildUpdateData(values)
      if (Object.keys(updateData).length) {
        try {
          await device.set(updateData)
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'No data to set') {
            await this.setWarning(error)
          }
        }
      }
    }
  }

  async #setCapabilities(data: ListDevice[T]['Device']): Promise<void> {
    const settings = this.getSettings() as Settings
    const capabilities = [
      ...(
        this.driver.getRequiredCapabilities as (
          data: ListDevice[T]['Device'],
        ) => string[]
      )(data),
      ...Object.keys(settings).filter(
        (setting) =>
          this.#isCapability(setting) &&
          typeof settings[setting] === 'boolean' &&
          settings[setting],
      ),
    ]
    await capabilities.reduce(async (acc, capability) => {
      await acc
      return this.addCapability(capability)
    }, Promise.resolve())
    await this.getCapabilities()
      .filter((capability) => !capabilities.includes(capability))
      .reduce(async (acc, capability) => {
        await acc
        await this.removeCapability(capability)
      }, Promise.resolve())
    this.#setCapabilityTagMapping = this.cleanMapping(
      this.driver.setCapabilityTagMapping as SetCapabilityTagMapping[T],
    )
    this.#getCapabilityTagMapping = this.cleanMapping(
      this.driver.getCapabilityTagMapping as GetCapabilityTagMapping[T],
    )
  }

  async #setCapabilityOptions(data: ListDevice[T]['Device']): Promise<void> {
    await Promise.all(
      Object.entries(
        (
          this.driver.getCapabilitiesOptions as (
            data: ListDevice[T]['Device'],
          ) => Partial<CapabilitiesOptions[T]>
        )(data),
      ).map(async (capabilityOptions) =>
        this.setCapabilityOptions(
          ...(capabilityOptions as [
            string & keyof CapabilitiesOptions[T],
            CapabilitiesOptions[T][Extract<
              keyof CapabilitiesOptions[T],
              string
            >] &
              Record<string, unknown>,
          ]),
        ),
      ),
    )
  }

  #unscheduleReports(): void {
    modes.forEach((mode) => {
      this.#reports[mode]?.unschedule()
    })
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
    if (changedCapabilities.length) {
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
