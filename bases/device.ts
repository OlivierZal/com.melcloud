import { Device } from 'homey'
import { DateTime, type DurationLike } from 'luxon'

import { K_MULTIPLIER, addToLogs, withTimers } from '../lib'

import type {
  DeviceFacade,
  DeviceType,
  EnergyData,
  ListDevice,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type MELCloudApp from '../app'
import type {
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  DeviceDetails,
  EnergyCapabilities,
  EnergyCapabilityTagEntry,
  EnergyCapabilityTagMapping,
  EnergyReportMode,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  MELCloudDriver,
  OpCapabilities,
  OpCapabilityTagEntry,
  ReportPlanParameters,
  SetCapabilities,
  SetCapabilityTagMapping,
  Settings,
} from '../types'

const INITIAL_SUM = 0
const DEFAULT_DEVICE_COUNT = 1
const DEFAULT_DIVISOR = 1
const SYNC_DELAY = 1000

const modes: EnergyReportMode[] = ['regular', 'total']

const reportPlanParametersTotal = {
  duration: { days: 1 },
  interval: { days: 1 },
  values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
} as const

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

  readonly #reportInterval: {
    regular?: NodeJS.Timeout
    total?: NodeJS.Timeout
  } = {}

  readonly #reportTimeout: {
    regular: NodeJS.Timeout | null
    total: NodeJS.Timeout | null
  } = { regular: null, total: null }

  #energyCapabilityTagEntries: {
    regular?: EnergyCapabilityTagEntry<T>[]
    total?: EnergyCapabilityTagEntry<T>[]
  } = {}

  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping[T]> = {}

  #linkedDeviceCount = DEFAULT_DEVICE_COUNT

  #listCapabilityTagMapping: Partial<ListCapabilityTagMapping[T]> = {}

  #opCapabilityTagEntries: OpCapabilityTagEntry<T>[] = []

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping[T]> = {}

  #device?: DeviceFacade[T]

  protected abstract readonly fromDevice: Partial<
    Record<keyof OpCapabilities[T], ConvertFromDevice<T>>
  >

  protected abstract readonly reportPlanParameters: ReportPlanParameters | null

  protected abstract toDevice: Partial<
    Record<keyof SetCapabilities[T], ConvertToDevice<T>>
  >

  public override onDeleted(): void {
    modes.forEach((mode) => {
      this.#unscheduleEnergyReport(mode)
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

  #calculateCopValue(
    data: EnergyData[T],
    capability: string & keyof EnergyCapabilities[T],
  ): number {
    const producedTags = this.driver.producedTagMapping[
      capability
    ] as (keyof EnergyData[T])[]
    const consumedTags = this.driver.consumedTagMapping[
      capability
    ] as (keyof EnergyData[T])[]
    return (
      producedTags.reduce(
        (acc, tag) => acc + (data[tag] as number),
        INITIAL_SUM,
      ) /
      (consumedTags.reduce(
        (acc, tag) => acc + (data[tag] as number),
        INITIAL_SUM,
      ) || DEFAULT_DIVISOR)
    )
  }

  #calculateEnergyValue(
    data: EnergyData[T],
    tags: (keyof EnergyData[T])[],
  ): number {
    return (
      tags.reduce((acc, tag) => acc + (data[tag] as number), INITIAL_SUM) /
      this.#linkedDeviceCount
    )
  }

  #calculatePowerValue(
    data: EnergyData[T],
    tags: (keyof EnergyData[T])[],
    hour: number,
  ): number {
    return (
      tags.reduce(
        (acc, tag) => acc + (data[tag] as number[])[hour] * K_MULTIPLIER,
        INITIAL_SUM,
      ) / this.#linkedDeviceCount
    )
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

  async #getEnergyReport(
    device: DeviceFacade[T],
    mode: EnergyReportMode,
    minus: DurationLike,
  ): Promise<void> {
    try {
      const toDateTime = DateTime.now().minus(minus)
      const to = toDateTime.toISODate()
      await this.#setEnergyCapabilities(
        (await device.getEnergyReport({
          from: mode === 'total' ? undefined : to,
          to,
        })) as EnergyData[T],
        toDateTime.hour,
        mode,
      )
    } catch (error) {
      await this.setWarning(error)
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

  async #handleReports(device: DeviceFacade[T]): Promise<void> {
    this.#setEnergyCapabilityTagEntries()
    await Promise.all(
      modes.map(async (mode) => this.#runEnergyReport(device, mode)),
    )
  }

  async #init(device: DeviceFacade[T]): Promise<void> {
    const { data } = device
    await this.#setCapabilities(data)
    await this.#setCapabilityOptions(data)
    this.#setCapabilityTagMappings()
    this.#registerCapabilityListeners(device)
    await this.syncFromDevice(data)
    await this.#handleReports(device)
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

  async #runEnergyReport(
    device: DeviceFacade[T],
    mode: EnergyReportMode,
  ): Promise<void> {
    if (this.reportPlanParameters) {
      if (!(this.#energyCapabilityTagEntries[mode] ?? []).length) {
        this.#unscheduleEnergyReport(mode)
        return
      }
      const { duration, interval, values } =
        mode === 'total' ? reportPlanParametersTotal : this.reportPlanParameters
      await this.#getEnergyReport(device, mode, this.reportPlanParameters.minus)
      this.#scheduleEnergyReport(device, mode, { duration, interval, values })
    }
  }

  #scheduleEnergyReport(
    device: DeviceFacade[T],
    mode: EnergyReportMode,
    { duration, interval, values }: Omit<ReportPlanParameters, 'minus'>,
  ): void {
    if (!this.#reportTimeout[mode]) {
      const actionType = `${mode} energy report`
      this.#reportTimeout[mode] = this.setTimeout(
        async () => {
          await this.#runEnergyReport(device, mode)
          this.#reportInterval[mode] = this.setInterval(
            async () => this.#runEnergyReport(device, mode),
            interval,
            actionType,
          )
        },
        DateTime.now().plus(duration).set(values).diffNow(),
        actionType,
      )
    }
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

  async #setEnergyCapabilities(
    data: EnergyData[T],
    hour: number,
    mode: EnergyReportMode,
  ): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      ;({ length: this.#linkedDeviceCount } =
        data.UsageDisclaimerPercentages.split(','))
    }
    await Promise.all(
      (this.#energyCapabilityTagEntries[mode] ?? []).map(
        async <
          K extends Extract<keyof EnergyCapabilities[T], string>,
          L extends keyof EnergyData[T],
        >([capability, tags]: [K, L[]]) => {
          if (capability.includes('cop')) {
            await this.setCapabilityValue(
              capability,
              this.#calculateCopValue(data, capability) as Capabilities[T][K],
            )
            return
          }
          if (capability.startsWith('measure_power')) {
            await this.setCapabilityValue(
              capability,
              this.#calculatePowerValue(data, tags, hour) as Capabilities[T][K],
            )
            return
          }
          await this.setCapabilityValue(
            capability,
            this.#calculateEnergyValue(data, tags) as Capabilities[T][K],
          )
        },
      ),
    )
  }

  #setEnergyCapabilityTagEntries(mode?: EnergyReportMode): void {
    const energyCapabilityTagEntries = Object.entries(
      this.cleanMapping(
        this.driver.energyCapabilityTagMapping as EnergyCapabilityTagMapping[T],
      ),
    ) as EnergyCapabilityTagEntry<T>[]
    if (mode !== undefined) {
      this.#energyCapabilityTagEntries[mode] =
        energyCapabilityTagEntries.filter(
          ([capability]) => isTotalEnergyKey(capability) === (mode === 'total'),
        )
      return
    }
    this.#energyCapabilityTagEntries = Object.groupBy(
      energyCapabilityTagEntries,
      ([capability]) => (isTotalEnergyKey(capability) ? 'total' : 'regular'),
    )
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

  #unscheduleEnergyReport(mode: EnergyReportMode): void {
    this.homey.clearTimeout(this.#reportTimeout[mode])
    this.homey.clearInterval(this.#reportInterval[mode])
    this.#reportTimeout[mode] = null
    this.log(`${mode} energy report has been stopped`)
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

  async #updateEnergyReport(
    device: DeviceFacade[T],
    mode: EnergyReportMode,
  ): Promise<void> {
    this.#setEnergyCapabilityTagEntries(mode)
    await this.#runEnergyReport(device, mode)
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
          await this.#updateEnergyReport(device, mode)
        }
      }),
    )
  }
}
