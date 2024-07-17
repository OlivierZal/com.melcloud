import {
  type Capabilities,
  type CapabilitiesOptions,
  type ConvertFromDevice,
  type ConvertToDevice,
  type DeviceDetails,
  type EnergyCapabilities,
  type EnergyCapabilityTagEntry,
  type EnergyCapabilityTagMapping,
  type GetCapabilityTagMapping,
  K_MULTIPLIER,
  type ListCapabilityTagMapping,
  type MELCloudDriver,
  type OpCapabilities,
  type OpCapabilityTagEntry,
  type ReportPlanParameters,
  type SetCapabilities,
  type SetCapabilityTagMapping,
  type Settings,
  type Store,
} from '../types'
import {
  type DeviceFacade,
  DeviceModel,
  type DeviceType,
  type EnergyData,
  type ListDevice,
  type SetDeviceData,
  type UpdateDeviceData,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'
import { Device } from 'homey'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withTimers from '../mixins/withTimers'

const NUMBER_0 = 0
const NUMBER_1 = 1

const getErrorMessage = (error: unknown): string | null => {
  if (error !== null) {
    return error instanceof Error ? error.message : String(error)
  }
  return null
}

const isTotalEnergyKey = (key: string): boolean =>
  !key.startsWith('measure_power') && !key.includes('daily')

@addToLogs('getName()')
export default abstract class<
  T extends keyof typeof DeviceType,
> extends withTimers(Device) {
  #device?: DeviceFacade[T]

  public declare readonly driver: MELCloudDriver[T]

  protected readonly diff = new Map<
    keyof SetCapabilities[T],
    SetCapabilities[T][keyof SetCapabilities[T]]
  >()

  #energyCapabilityTagEntries: {
    false?: EnergyCapabilityTagEntry<T>[]
    true?: EnergyCapabilityTagEntry<T>[]
  } = {}

  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping[T]> = {}

  #linkedDeviceCount = NUMBER_1

  #listCapabilityTagMapping: Partial<ListCapabilityTagMapping[T]> = {}

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping[T]> = {}

  #syncToDeviceTimeout: NodeJS.Timeout | null = null

  readonly #reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } =
    {}

  readonly #reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { false: null, true: null }

  protected abstract toDevice: Partial<
    Record<keyof SetCapabilities[T], ConvertToDevice<T>>
  >

  protected abstract readonly fromDevice: Partial<
    Record<keyof OpCapabilities[T], ConvertFromDevice<T>>
  >

  protected abstract readonly reportPlanParameters: ReportPlanParameters | null

  private get device(): DeviceFacade[T] | undefined {
    if (!this.#device) {
      this.#device = (this.homey.app as MELCloudApp).facadeManager.get(
        DeviceModel.getById((this.getData() as DeviceDetails<T>['data']).id) as
          | DeviceModel<T>
          | undefined,
      )
      if (!this.#device) {
        this.setWarningSync(this.homey.__('warnings.device.not_found'))
      }
    }
    return this.#device
  }

  public override async addCapability(capability: string): Promise<void> {
    this.log('Adding capability', capability)
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
      this.log('Capability', capability, 'added')
    }
  }

  public override getCapabilityOptions<
    K extends Extract<keyof CapabilitiesOptions[T], string>,
  >(capability: K): CapabilitiesOptions[T][K] {
    return super.getCapabilityOptions(capability) as CapabilitiesOptions[T][K]
  }

  public override getCapabilityValue<K extends keyof Capabilities[T]>(
    capability: K & string,
  ): Capabilities[T][K] {
    return super.getCapabilityValue(capability) as Capabilities[T][K]
  }

  public override getSetting<K extends Extract<keyof Settings, string>>(
    setting: K,
  ): NonNullable<Settings[K]> {
    return super.getSetting(setting) as NonNullable<Settings[K]>
  }

  public override getStoreValue<K extends Extract<keyof Store[T], string>>(
    key: K,
  ): Store[T][K] {
    return super.getStoreValue(key) as Store[T][K]
  }

  public override onDeleted(): void {
    this.homey.clearTimeout(this.#syncToDeviceTimeout)
    this.homey.clearTimeout(this.#reportTimeout.false)
    this.homey.clearTimeout(this.#reportTimeout.true)
    this.homey.clearInterval(this.#reportInterval.false)
    this.homey.clearInterval(this.#reportInterval.true)
  }

  public override async onInit(): Promise<void> {
    this.toDevice = {
      onoff: (onoff: boolean): boolean => this.getSetting('always_on') || onoff,
      ...this.toDevice,
    }
    await this.setWarning(null)
    await this.#handleStore()
    await this.#handleCapabilities()
    this.registerCapabilityListeners()
    await this.syncFromDevice()
    await this.#runEnergyReports()
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
    if (changedCapabilities.length) {
      await this.#handleOptionalCapabilities(newSettings, changedCapabilities)
      await this.setWarning(this.homey.__('warnings.dashboard'))
    }
    if (
      changedKeys.includes('always_on') &&
      newSettings.always_on === true &&
      this.getCapabilityValue('onoff')
    ) {
      await this.triggerCapabilityListener('onoff', true)
    } else if (
      changedKeys.some(
        (setting) =>
          setting !== 'always_on' &&
          !(setting in this.driver.energyCapabilityTagMapping),
      )
    ) {
      await this.syncFromDevice()
    }

    const changedEnergyKeys = changedCapabilities.filter((setting) =>
      this.#isEnergyCapability(setting),
    )
    if (changedEnergyKeys.length) {
      await Promise.all(
        [false, true].map(async (total) => {
          if (
            changedEnergyKeys.some(
              (setting) => isTotalEnergyKey(setting) === total,
            )
          ) {
            this.#setEnergyCapabilityTagEntries(total)
            await this.#runEnergyReport(total)
          }
        }),
      )
    }
  }

  public override async onUninit(): Promise<void> {
    this.onDeleted()
    return Promise.resolve()
  }

  public override async removeCapability(capability: string): Promise<void> {
    this.log('Removing capability', capability)
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
      this.log('Capability', capability, 'removed')
    }
  }

  public override async setCapabilityOptions<
    K extends Extract<keyof CapabilitiesOptions[T], string>,
  >(capability: K, options: CapabilitiesOptions[T][K] & object): Promise<void> {
    await super.setCapabilityOptions(capability, options)
  }

  public override async setCapabilityValue<
    K extends Extract<keyof Capabilities[T], string>,
  >(capability: K, value: Capabilities[T][K]): Promise<void> {
    this.log('Capability', capability, 'is', value)
    if (value !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, value)
    }
  }

  public override async setStoreValue<K extends keyof Store[T]>(
    key: Extract<K, string>,
    value: Store[T][K],
  ): Promise<void> {
    this.log('Store', key, 'is', value)
    if (value !== super.getStoreValue(key)) {
      await super.setStoreValue(key, value)
    }
  }

  public override async setWarning(error: unknown): Promise<void> {
    const warning = getErrorMessage(error)
    if (warning !== null) {
      await super.setWarning(warning)
    }
    await super.setWarning(null)
  }

  public setWarningSync(error: unknown): void {
    this.setWarning(error).catch((err: unknown) => {
      this.error(getErrorMessage(err))
    })
  }

  public async syncFromDevice(): Promise<void> {
    if (!this.#syncToDeviceTimeout) {
      await this.setCapabilities()
    }
  }

  protected applySyncToDevice(): void {
    this.#syncToDeviceTimeout = this.setTimeout(
      async (): Promise<void> => {
        await this.#set()
        await this.setCapabilities()
        this.#syncToDeviceTimeout = null
      },
      { seconds: 1 },
      { actionType: 'sync to device', units: ['seconds'] },
    )
  }

  protected clearSyncToDevice(): void {
    this.homey.clearTimeout(this.#syncToDeviceTimeout)
    this.#syncToDeviceTimeout = null
    this.log('Sync to device has been paused')
  }

  protected onCapability<K extends keyof SetCapabilities[T]>(
    capability: K,
    value: SetCapabilities[T][K],
  ): void {
    this.diff.set(capability, value)
  }

  protected registerCapabilityListeners(): void {
    Object.keys(this.#setCapabilityTagMapping).forEach((capability) => {
      this.registerCapabilityListener(
        capability,
        (value: SetCapabilities[T][keyof SetCapabilities[T]]) => {
          this.clearSyncToDevice()
          this.onCapability(capability as keyof SetCapabilities[T], value)
          this.applySyncToDevice()
        },
      )
    })
  }

  protected async setCapabilities(): Promise<void> {
    if (this.device) {
      const { data } = this.device
      await Promise.all(
        (
          Object.entries({
            ...this.#setCapabilityTagMapping,
            ...this.#getCapabilityTagMapping,
            ...this.#listCapabilityTagMapping,
          }) as OpCapabilityTagEntry<T>[]
        ).map(async ([capability, tag]) => {
          if (tag in data) {
            await this.setCapabilityValue(
              capability,
              this.#convertFromDevice(
                capability,
                (data as ListDevice[T]['Device'])[
                  tag as keyof ListDevice[T]['Device']
                ],
              ) as Capabilities[T][Extract<keyof OpCapabilities[T], string>],
            )
          }
        }),
      )
    }
  }

  #buildUpdateData(): UpdateDeviceData[T] {
    this.#setAlwaysOnWarning()
    this.log('Requested data:', Object.fromEntries(this.diff))
    const updateData = Object.fromEntries(
      [...this.diff].map(([capability, value]) => [
        this.#setCapabilityTagMapping[
          capability as keyof Partial<SetCapabilityTagMapping[T]>
        ],
        this.#convertToDevice(
          capability,
          value as UpdateDeviceData[T][keyof UpdateDeviceData[T]],
        ),
      ]),
    ) as UpdateDeviceData[T]
    this.diff.clear()
    return updateData
  }

  #calculateCopValue(
    data: EnergyData[T],
    capability: keyof EnergyCapabilities[T] & string,
  ): number {
    const producedTags = this.driver.producedTagMapping[
      capability
    ] as (keyof EnergyData[T])[]
    const consumedTags = this.driver.consumedTagMapping[
      capability
    ] as (keyof EnergyData[T])[]
    return (
      producedTags.reduce((acc, tag) => acc + (data[tag] as number), NUMBER_0) /
      (consumedTags.length ?
        consumedTags.reduce((acc, tag) => acc + (data[tag] as number), NUMBER_0)
      : NUMBER_1)
    )
  }

  #calculateEnergyValue(
    data: EnergyData[T],
    tags: (keyof EnergyData[T])[],
  ): number {
    return (
      tags.reduce((acc, tag) => acc + (data[tag] as number), NUMBER_0) /
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
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #cleanMapping<
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

  #clearEnergyReportPlan(total = false): void {
    const totalString = String(total) as `${boolean}`
    this.homey.clearTimeout(this.#reportTimeout[totalString])
    this.homey.clearInterval(this.#reportInterval[totalString])
    this.#reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
  }

  #convertFromDevice<K extends keyof OpCapabilities[T]>(
    capability: K,
    value: ListDevice[T]['Device'][keyof ListDevice[T]['Device']],
  ): OpCapabilities[T][K] {
    return (this.fromDevice[capability]?.(value) ??
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

  async #getEnergyReport(total = false): Promise<void> {
    if (this.reportPlanParameters && this.device) {
      try {
        const toDateTime = DateTime.now().minus(this.reportPlanParameters.minus)
        const to = toDateTime.toISODate()
        await this.#setEnergyCapabilities(
          (await this.device.getEnergyReport({
            from: total ? undefined : to,
            to,
          })) as EnergyData[T],
          toDateTime.hour,
          total,
        )
      } catch (error) {
        await this.setWarning(error)
      }
    }
  }

  async #handleCapabilities(): Promise<void> {
    const settings = this.getSettings() as Settings
    const capabilities = [
      ...(this.driver.getRequiredCapabilities as (store: Store[T]) => string[])(
        this.getStore() as Store[T],
      ),
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
    this.#setCapabilityTagMappings()
    this.#setEnergyCapabilityTagEntries()
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

  async #handleStore(): Promise<void> {
    if (this.device) {
      await Promise.all(
        Object.entries(
          this.driver.getStore(
            this.device.data as ListDevice['Ata']['Device'] &
              ListDevice['Atw']['Device'] &
              ListDevice['Erv']['Device'],
          ),
        ).map(async ([key, value]) => {
          await this.setStoreValue(
            key as Extract<keyof Store[T], string>,
            value as Store[T][keyof Store[T]],
          )
        }),
      )
    }
  }

  #isCapability(setting: string): boolean {
    return this.driver.capabilities.includes(setting)
  }

  #isEnergyCapability(setting: string): boolean {
    return setting in this.driver.energyCapabilityTagMapping
  }

  #planEnergyReport(total = false): void {
    if (this.reportPlanParameters) {
      const totalString = String(total) as `${boolean}`
      if (!this.#reportTimeout[totalString]) {
        const actionType = `${total ? 'total' : 'regular'} energy report`
        const { duration, interval, values } =
          total ?
            {
              duration: { days: 1 },
              interval: { days: 1 },
              values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
            }
          : this.reportPlanParameters
        this.#reportTimeout[totalString] = this.setTimeout(
          async () => {
            await this.#runEnergyReport(total)
            this.#reportInterval[totalString] = this.setInterval(
              async () => {
                await this.#runEnergyReport(total)
              },
              interval,
              { actionType, units: ['days', 'hours'] },
            )
          },
          DateTime.now().plus(duration).set(values).diffNow(),
          { actionType, units: ['hours', 'minutes'] },
        )
      }
    }
  }

  async #runEnergyReport(total = false): Promise<void> {
    if (this.reportPlanParameters) {
      if (
        !(this.#energyCapabilityTagEntries[String(total) as `${boolean}`] ?? [])
          .length
      ) {
        this.#clearEnergyReportPlan(total)
        return
      }
      await this.#getEnergyReport(total)
      this.#planEnergyReport(total)
    }
  }

  async #runEnergyReports(): Promise<void> {
    await this.#runEnergyReport()
    await this.#runEnergyReport(true)
  }

  async #set(): Promise<void> {
    if (this.device) {
      const updateData = this.#buildUpdateData()
      if (Object.keys(updateData).length) {
        try {
          ;(await this.device.set(updateData)) as SetDeviceData[T]
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'No data to set') {
            await this.setWarning(error)
          }
        }
      }
    }
  }

  #setAlwaysOnWarning(): void {
    if (this.getSetting('always_on') && !this.diff.get('onoff')) {
      this.setWarningSync(this.homey.__('warnings.always_on'))
    }
  }

  #setCapabilityTagMappings(): void {
    this.#setCapabilityTagMapping = this.#cleanMapping(
      this.driver.setCapabilityTagMapping as SetCapabilityTagMapping[T],
    )
    this.#getCapabilityTagMapping = this.#cleanMapping(
      this.driver.getCapabilityTagMapping as GetCapabilityTagMapping[T],
    )
    this.#setListCapabilityTagMappings()
  }

  async #setEnergyCapabilities(
    data: EnergyData[T],
    hour: number,
    total = false,
  ): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      this.#linkedDeviceCount =
        data.UsageDisclaimerPercentages.split(',').length
    }
    await Promise.all(
      (
        this.#energyCapabilityTagEntries[String(total) as `${boolean}`] ?? []
      ).map(
        async <
          K extends Extract<keyof EnergyCapabilities[T], string>,
          L extends keyof EnergyData[T],
        >([capability, tags]: [K, L[]]) => {
          switch (true) {
            case capability.includes('cop'):
              await this.setCapabilityValue(
                capability,
                this.#calculateCopValue(data, capability) as Capabilities[T][K],
              )
              break
            case capability.startsWith('measure_power'):
              await this.setCapabilityValue(
                capability,
                this.#calculatePowerValue(
                  data,
                  tags,
                  hour,
                ) as Capabilities[T][K],
              )
              break
            default:
              await this.setCapabilityValue(
                capability,
                this.#calculateEnergyValue(data, tags) as Capabilities[T][K],
              )
          }
        },
      ),
    )
  }

  #setEnergyCapabilityTagEntries(total?: boolean): void {
    const energyCapabilityTagEntries = Object.entries(
      this.#cleanMapping(
        this.driver.energyCapabilityTagMapping as EnergyCapabilityTagMapping[T],
      ),
    ) as EnergyCapabilityTagEntry<T>[]
    if (total !== undefined) {
      this.#energyCapabilityTagEntries[String(total) as `${boolean}`] =
        energyCapabilityTagEntries.filter(
          ([capability]) => isTotalEnergyKey(capability) === total,
        )
      return
    }
    this.#energyCapabilityTagEntries = Object.groupBy<
      `${boolean}`,
      EnergyCapabilityTagEntry<T>
    >(
      energyCapabilityTagEntries,
      ([capability]) => String(isTotalEnergyKey(capability)) as `${boolean}`,
    )
  }

  #setListCapabilityTagMappings(): void {
    this.#listCapabilityTagMapping = this.#cleanMapping(
      this.driver.listCapabilityTagMapping as ListCapabilityTagMapping[T],
    )
  }
}
