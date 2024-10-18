import { Device } from 'homey'

import { addToLogs, withTimers } from '../lib'

import type {
  DeviceFacade,
  DeviceType,
  ListDevice,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type MELCloudApp from '../app'
import type { EnergyReportRegular, EnergyReportTotal } from '../reports'
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
  MELCloudDriver,
  OpCapabilities,
  OpCapabilityTagEntry,
  SetCapabilities,
  SetCapabilityTagMapping,
  Settings,
} from '../types'

import type { BaseEnergyReport } from './report'

const SYNC_DELAY = 1000

const modes: EnergyReportMode[] = ['regular', 'total']

const getErrorMessage = (error: unknown): string | null => {
  if (error !== null) {
    return error instanceof Error ? error.message : String(error)
  }
  return null
}

const isTotalEnergyKey = (key: string): boolean =>
  !key.startsWith('measure_power') && !key.includes('daily')

@addToLogs('getName()')
export abstract class BaseMELCloudDevice<
  T extends keyof typeof DeviceType,
> extends withTimers(Device) {
  public declare readonly driver: MELCloudDriver[T]

  readonly #app = this.homey.app as MELCloudApp

  readonly #id = (this.getData() as DeviceDetails<T>['data']).id

  readonly #reports: {
    regular?: BaseEnergyReport<T>
    total?: BaseEnergyReport<T>
  } = {}

  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping[T]> = {}

  #listCapabilityTagMapping: Partial<ListCapabilityTagMapping[T]> = {}

  #opCapabilityTagEntries: OpCapabilityTagEntry<T>[] = []

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
    facade: DeviceFacade[T],
  ) => BaseEnergyReport<T> & EnergyReportRegular[T]

  protected abstract EnergyReportTotal?: new (
    device: BaseMELCloudDevice<T>,
    facade: DeviceFacade[T],
  ) => BaseEnergyReport<T> & EnergyReportTotal[T]

  public override onDeleted(): void {
    modes.forEach((mode) => {
      this.#reports[mode]?.unschedule()
    })
  }

  public override async onInit(): Promise<void> {
    this.toDevice = {
      onoff: (onoff: boolean): boolean => this.getSetting('always_on') || onoff,
      ...this.toDevice,
    }
    await this.setWarning(null)
    await this.#fetchDevice()
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
    const device = await this.#fetchDevice()
    if (device) {
      await this.#updateDeviceOnSettings(device.data, {
        changedCapabilities,
        changedKeys,
        newSettings,
      })
      const changedEnergyKeys = changedCapabilities.filter((setting) =>
        this.#isEnergyCapability(setting),
      )
      if (changedEnergyKeys.length) {
        await this.#updateEnergyReportsOnSettings(device, {
          changedKeys: changedEnergyKeys,
        })
      }
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
  >(capability: K, options: object & CapabilitiesOptions[T][K]): Promise<void> {
    await super.setCapabilityOptions(capability, options)
  }

  public override async setCapabilityValue<
    K extends string & keyof Capabilities[T],
  >(capability: K, value: Capabilities[T][K]): Promise<void> {
    if (value !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, value)
    }
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

  public async syncFromDevice(data?: ListDevice[T]['Device']): Promise<void> {
    const newData = data ?? (await this.#fetchDevice())?.data
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

  async #fetchDevice(): Promise<DeviceFacade[T] | undefined> {
    if (!this.#device) {
      try {
        this.#device = this.#app.getFacade(
          'devices',
          this.#id,
        ) as DeviceFacade[T]
        await this.#init(this.#device)
      } catch (error) {
        await this.setWarning(getErrorMessage(error))
      }
    }
    return this.#device
  }

  async #handleEnergyReports(device: DeviceFacade[T]): Promise<void> {
    if (this.EnergyReportRegular) {
      this.#reports.regular = new this.EnergyReportRegular(this, device)
      await this.#reports.regular.handle()
    }
    if (this.EnergyReportTotal) {
      this.#reports.total = new this.EnergyReportTotal(this, device)
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
    if (
      changedCapabilities.some(
        (capability) => !this.#isEnergyCapability(capability),
      )
    ) {
      this.#setListCapabilityTagMappings()
    }
  }

  async #init(device: DeviceFacade[T]): Promise<void> {
    const { data } = device
    await this.#setCapabilities(data)
    await this.#setCapabilityOptions(data)
    this.#setCapabilityTagMappings()
    this.#registerCapabilityListeners(device)
    await this.syncFromDevice(data)
    await this.#handleEnergyReports(device)
  }

  #isCapability(setting: string): boolean {
    return (this.driver.capabilities ?? []).includes(setting)
  }

  #isEnergyCapability(setting: string): boolean {
    return setting in this.driver.energyCapabilityTagMapping
  }

  #registerCapabilityListeners(device: DeviceFacade[T]): void {
    this.registerMultipleCapabilityListener(
      Object.keys(this.#setCapabilityTagMapping),
      async (values) => {
        if (this.driver.type !== 'Atw' && 'thermostat_mode' in values) {
          const isOn = values.thermostat_mode !== 'off'
          values.onoff = isOn
          if (!isOn) {
            delete values.thermostat_mode
          }
        }
        await this.#set(device, values as Partial<SetCapabilities[T]>)
      },
      SYNC_DELAY,
    )
  }

  async #set(
    device: DeviceFacade[T],
    values: Partial<SetCapabilities[T]>,
  ): Promise<void> {
    const updateData = this.#buildUpdateData(values)
    if (Object.keys(updateData).length) {
      try {
        await device.set(updateData)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'No data to set') {
          await this.setWarning(error)
        }
      } finally {
        this.homey.setTimeout(
          async () => this.setCapabilityValues(device.data),
          SYNC_DELAY,
        )
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
            object &
              CapabilitiesOptions[T][Extract<
                keyof CapabilitiesOptions[T],
                string
              >],
          ]),
        ),
      ),
    )
  }

  #setCapabilityTagMappings(): void {
    this.#setCapabilityTagMapping = this.cleanMapping(
      this.driver.setCapabilityTagMapping as SetCapabilityTagMapping[T],
    )
    this.#getCapabilityTagMapping = this.cleanMapping(
      this.driver.getCapabilityTagMapping as GetCapabilityTagMapping[T],
    )
    this.#setListCapabilityTagMappings()
  }

  #setListCapabilityTagMappings(): void {
    this.#listCapabilityTagMapping = this.cleanMapping(
      this.driver.listCapabilityTagMapping as ListCapabilityTagMapping[T],
    )
    this.#setOpCapabilityTagEntries()
  }

  #setOpCapabilityTagEntries(): void {
    this.#opCapabilityTagEntries = Object.entries({
      ...this.#setCapabilityTagMapping,
      ...this.#getCapabilityTagMapping,
      ...this.#listCapabilityTagMapping,
    }) as OpCapabilityTagEntry<T>[]
  }

  async #updateDeviceOnSettings(
    data: ListDevice[T]['Device'],
    {
      changedCapabilities,
      changedKeys,
      newSettings,
    }: {
      changedCapabilities: string[]
      changedKeys: string[]
      newSettings: Settings
    },
  ): Promise<void> {
    if (changedCapabilities.length) {
      await this.#handleOptionalCapabilities(newSettings, changedCapabilities)
      await this.setWarning(this.homey.__('warnings.dashboard'))
    }
    if (
      changedKeys.includes('always_on') &&
      newSettings.always_on === true &&
      !data.Power
    ) {
      await this.triggerCapabilityListener('onoff', true)
    } else if (
      changedKeys.some(
        (setting) =>
          setting !== 'always_on' &&
          !(setting in this.driver.energyCapabilityTagMapping),
      )
    ) {
      await this.syncFromDevice(data)
    }
  }

  async #updateEnergyReportsOnSettings(
    device: DeviceFacade[T],
    {
      changedKeys,
    }: {
      changedKeys: string[]
    },
  ): Promise<void> {
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
