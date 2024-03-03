import type {
  BooleanString,
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  DeviceDetails,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  MELCloudDriver,
  OpCapabilities,
  OpDeviceData,
  ReportCapabilities,
  ReportCapabilityTagMapping,
  ReportPlanParameters,
  SetCapabilities,
  SetCapabilitiesWithThermostatMode,
  SetCapabilityTagMapping,
  Settings,
  Store,
} from '../types'
import {
  type DeviceData,
  type DeviceType,
  FLAG_UNCHANGED,
  type ListDevice,
  type NonEffectiveFlagsKeyOf,
  type NonEffectiveFlagsValueOf,
  type ReportData,
  type SetDeviceData,
} from '../melcloud/types'
import { K_MULTIPLIER, NUMBER_1 } from '../constants'
import { DateTime } from 'luxon'
import { Device } from 'homey'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withTimers from '../mixins/withTimers'

const NUMBER_0 = 0
const YEAR_1970 = 1970

const filterEnergyKeys = (key: string, total: boolean): boolean => {
  const condition: boolean =
    key.startsWith('measure_power') || key.includes('daily')
  return total ? !condition : condition
}

@addToLogs('getName()')
abstract class BaseMELCloudDevice<
  T extends keyof typeof DeviceType,
> extends withTimers(Device) {
  public declare readonly driver: MELCloudDriver[T]

  protected readonly diff: Map<
    keyof SetCapabilities[T],
    SetCapabilities[T][keyof SetCapabilities[T]]
  > = new Map<
    keyof SetCapabilities[T],
    SetCapabilities[T][keyof SetCapabilities[T]]
  >()

  #effectiveFlags!: Record<NonEffectiveFlagsKeyOf<SetDeviceData[T]>, number>

  #getCapabilityTagMapping: Partial<NonNullable<GetCapabilityTagMapping[T]>> =
    {}

  #linkedDeviceCount = NUMBER_1

  #listCapabilityTagMapping: Partial<NonNullable<ListCapabilityTagMapping[T]>> =
    {}

  #listOnlyCapabilityTagEntries: [
    Extract<keyof OpCapabilities[T], string>,
    OpDeviceData<T>,
  ][] = []

  #reportCapabilityTagEntries: {
    false: [
      Extract<keyof ReportCapabilities[T], string>,
      (keyof ReportData[T])[],
    ][]
    true: [
      Extract<keyof ReportCapabilities[T], string>,
      (keyof ReportData[T])[],
    ][]
  } = { false: [], true: [] }

  #setCapabilityTagMapping: Partial<NonNullable<SetCapabilityTagMapping[T]>> =
    {}

  #syncToDeviceTimeout: NodeJS.Timeout | null = null

  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  readonly #data: DeviceDetails<T>['data'] =
    this.getData() as DeviceDetails<T>['data']

  readonly #id: number = this.#data.id

  readonly #reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } =
    {}

  readonly #reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { false: null, true: null }

  protected abstract readonly fromDevice: Partial<
    Record<keyof OpCapabilities[T], ConvertFromDevice<T>>
  >

  protected abstract readonly reportPlanParameters: ReportPlanParameters | null

  protected abstract readonly toDevice: Partial<
    Record<keyof SetCapabilities[T], ConvertToDevice<T>>
  >

  public get buildingid(): number {
    return this.#data.buildingid
  }

  public get id(): number {
    return this.#id
  }

  public async addCapability(capability: string): Promise<void> {
    this.log('Adding capability', capability)
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
      this.log('Capability', capability, 'added')
    }
  }

  public getCapabilityOptions<
    K extends Extract<keyof CapabilitiesOptions[T], string>,
  >(capability: K): CapabilitiesOptions[T][K] {
    return super.getCapabilityOptions(capability) as CapabilitiesOptions[T][K]
  }

  public getCapabilityValue<K extends keyof Capabilities<T>>(
    capability: K & string,
  ): NonNullable<Capabilities<T>[K]> {
    return super.getCapabilityValue(capability) as NonNullable<
      Capabilities<T>[K]
    >
  }

  public getSetting<K extends Extract<keyof Settings, string>>(
    setting: K,
  ): NonNullable<Settings[K]> {
    return super.getSetting(setting) as NonNullable<Settings[K]>
  }

  public getStoreValue<K extends Extract<keyof Store[T], string>>(
    key: K,
  ): Store[T][K] {
    return super.getStoreValue(key) as Store[T][K]
  }

  public async onCapability<
    K extends keyof SetCapabilitiesWithThermostatMode[T],
  >(
    capability: K,
    value: SetCapabilitiesWithThermostatMode[T][K],
  ): Promise<void> {
    this.#clearSyncToDevice()
    if (capability === 'onoff') {
      await this.setAlwaysOnWarning()
    }
    if (capability !== 'thermostat_mode') {
      this.diff.set(capability, value)
    }
    this.specificOnCapability(capability, value)
    this.#applySyncToDevice()
  }

  public onDeleted(): void {
    this.homey.clearTimeout(this.#syncToDeviceTimeout)
    this.homey.clearTimeout(this.#reportTimeout.false)
    this.homey.clearTimeout(this.#reportTimeout.true)
    this.homey.clearInterval(this.#reportInterval.false)
    this.homey.clearInterval(this.#reportInterval.true)
  }

  public async onInit(): Promise<void> {
    this.#effectiveFlags = this.driver.effectiveFlags as Record<
      NonEffectiveFlagsKeyOf<SetDeviceData[T]>,
      number
    >
    await this.setWarning(null)
    await this.#handleStore()
    await this.#handleCapabilities()
    this.#setReportCapabilityTagEntries()
    this.#registerCapabilityListeners()
    await this.syncFromDevice()
    await this.#runEnergyReports()
  }

  public async onSettings({
    changedKeys,
    newSettings,
  }: {
    changedKeys: string[]
    newSettings: Settings
  }): Promise<void> {
    const changedCapabilities: string[] = changedKeys.filter(
      (setting: string) =>
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
      !this.getCapabilityValue('onoff')
    ) {
      await this.onCapability('onoff', true)
    } else if (
      changedKeys.some(
        (setting: string) =>
          setting !== 'always_on' &&
          !(setting in this.driver.reportCapabilityTagMapping),
      )
    ) {
      await this.syncFromDevice()
    }

    const changedEnergyKeys: string[] = changedCapabilities.filter(
      (setting: string) => this.#isReportCapability(setting),
    )
    if (changedEnergyKeys.length) {
      await Promise.all(
        [false, true].map(async (total: boolean): Promise<void> => {
          if (
            changedEnergyKeys.some((setting: string) =>
              filterEnergyKeys(setting, total),
            )
          ) {
            this.#setReportCapabilityTagEntries(total)
            await this.#runEnergyReport(total)
          }
        }),
      )
    }
  }

  public async onUninit(): Promise<void> {
    this.onDeleted()
    return Promise.resolve()
  }

  public async removeCapability(capability: string): Promise<void> {
    this.log('Removing capability', capability)
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
      this.log('Capability', capability, 'removed')
    }
  }

  public async setCapabilityOptions<
    K extends Extract<keyof CapabilitiesOptions[T], string>,
  >(capability: K, options: CapabilitiesOptions[T][K] & object): Promise<void> {
    await super.setCapabilityOptions(capability, options)
  }

  public async setCapabilityValue<
    K extends Extract<keyof Capabilities<T>, string>,
  >(capability: K, value: Capabilities<T>[K]): Promise<void> {
    this.log('Capability', capability, 'is', value)
    if (value !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, value)
    }
  }

  public async setStoreValue<K extends keyof Store[T]>(
    key: Extract<K, string>,
    value: Store[T][K],
  ): Promise<void> {
    this.log('Store', key, 'is', value)
    if (value !== super.getStoreValue(key)) {
      await super.setStoreValue(key, value)
    }
  }

  public async setWarning(warning: string | null): Promise<void> {
    if (warning !== null) {
      await super.setWarning(warning)
    }
    await super.setWarning(null)
  }

  public async syncFromDevice(): Promise<void> {
    const data: ListDevice[T]['Device'] | null =
      this.#app.devices[this.#id]?.Device ?? null
    this.log('Syncing from device list:', data)
    await this.#updateCapabilities(data)
  }

  protected getRequestedOrCurrentValue<
    K extends Extract<keyof SetCapabilities[T], string>,
  >(capability: K): NonNullable<SetCapabilities[T][K]> {
    return (this.diff.get(capability) ??
      this.getCapabilityValue(capability)) as NonNullable<SetCapabilities[T][K]>
  }

  protected async setAlwaysOnWarning(): Promise<void> {
    if (this.getSetting('always_on')) {
      await this.setWarning(this.homey.__('warnings.always_on'))
    }
  }

  protected async updateThermostatMode(): Promise<void> {
    this.log('thermostat_mode is not implemented')
    return Promise.resolve()
  }

  #applySyncToDevice(): void {
    this.#syncToDeviceTimeout = this.setTimeout(
      async (): Promise<void> => {
        await this.#updateCapabilities(await this.#setDeviceData())
        this.#syncToDeviceTimeout = null
      },
      { seconds: 1 },
      { actionType: 'sync to device', units: ['seconds'] },
    )
  }

  #buildUpdateData<
    K extends Extract<keyof SetCapabilities[T], string>,
  >(): SetDeviceData[T] {
    return Object.entries(this.#setCapabilityTagMapping).reduce<
      SetDeviceData[T]
    >(
      (
        acc,
        [capability, tag]: [string, NonEffectiveFlagsKeyOf<SetDeviceData[T]>],
      ) => {
        acc[tag] = this.#convertToDevice(
          capability as K,
          this.getRequestedOrCurrentValue(capability as K),
        )
        if (this.diff.has(capability as K)) {
          this.diff.delete(capability as K)
          acc.EffectiveFlags = Number(
            // eslint-disable-next-line no-bitwise
            BigInt(acc.EffectiveFlags) | BigInt(this.#effectiveFlags[tag]),
          )
        }
        return acc
      },
      { EffectiveFlags: FLAG_UNCHANGED },
    )
  }

  #calculateCopValue<
    K extends keyof ReportData[T],
    L extends keyof ReportCapabilities[T],
  >(data: ReportData[T], capability: L & string): number {
    const producedTags: K[] = this.driver.producedTagMapping[capability] as K[]
    const consumedTags: K[] = this.driver.consumedTagMapping[capability] as K[]
    return (
      producedTags.reduce<number>(
        (acc, tag: K) => acc + (data[tag] as number),
        NUMBER_0,
      ) /
      (consumedTags.length
        ? consumedTags.reduce<number>(
            (acc, tag: K) => acc + (data[tag] as number),
            NUMBER_0,
          )
        : NUMBER_1)
    )
  }

  #calculateEnergyValue<K extends keyof ReportData[T]>(
    data: ReportData[T],
    tags: K[],
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: K) => acc + (data[tag] as number),
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #calculatePowerValue<K extends keyof ReportData[T]>(
    data: ReportData[T],
    tags: K[],
    toDate: DateTime,
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: K) =>
          acc + (data[tag] as number[])[toDate.hour] * K_MULTIPLIER,
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #cleanMapping<
    M extends
      | GetCapabilityTagMapping[T]
      | ListCapabilityTagMapping[T]
      | ReportCapabilityTagMapping[T]
      | SetCapabilityTagMapping[T],
  >(capabilityTagMapping: M): Partial<NonNullable<M>> {
    return Object.fromEntries(
      Object.entries(capabilityTagMapping).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<NonNullable<M>>
  }

  #clearEnergyReportPlan(total = false): void {
    const totalString: BooleanString = String(total) as BooleanString
    this.homey.clearTimeout(this.#reportTimeout[totalString])
    this.homey.clearInterval(this.#reportInterval[totalString])
    this.#reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
  }

  #clearSyncToDevice(): void {
    this.homey.clearTimeout(this.#syncToDeviceTimeout)
    this.#syncToDeviceTimeout = null
    this.log('Sync to device has been paused')
  }

  #convertFromDevice<K extends keyof OpCapabilities[T]>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceData[T]>
      | NonEffectiveFlagsValueOf<ListDevice[T]['Device']>,
  ): OpCapabilities[T][K] {
    return (
      capability in this.fromDevice
        ? this.fromDevice[capability]?.(value)
        : value
    ) as OpCapabilities[T][K]
  }

  #convertToDevice<K extends keyof SetCapabilities[T]>(
    capability: K,
    value: SetCapabilities[T][K],
  ): NonEffectiveFlagsValueOf<SetDeviceData[T]> {
    const newToDevice: Partial<Record<K, ConvertToDevice<T>>> = {
      onoff: (onoff: SetCapabilities[T]['onoff']) =>
        this.getSetting('always_on') || onoff,
      ...this.toDevice,
    }
    return (
      capability in newToDevice ? newToDevice[capability]?.(value) : value
    ) as NonEffectiveFlagsValueOf<SetDeviceData[T]>
  }

  #getUpdateCapabilityTagEntries(
    effectiveFlags: number,
  ): [Extract<keyof OpCapabilities[T], string>, OpDeviceData<T>][] {
    switch (true) {
      case effectiveFlags !== FLAG_UNCHANGED:
        return [
          ...Object.entries(this.#setCapabilityTagMapping).filter(
            ([, tag]: [string, NonEffectiveFlagsKeyOf<SetDeviceData[T]>]) =>
              // eslint-disable-next-line no-bitwise
              BigInt(effectiveFlags) & BigInt(this.#effectiveFlags[tag]),
          ),
          ...Object.entries(this.#getCapabilityTagMapping),
        ] as [Extract<keyof OpCapabilities[T], string>, OpDeviceData<T>][]
      case Boolean(this.diff.size):
      case this.#syncToDeviceTimeout !== null:
        return this.#listOnlyCapabilityTagEntries
      default:
        return Object.entries({
          ...this.#setCapabilityTagMapping,
          ...this.#getCapabilityTagMapping,
          ...this.#listCapabilityTagMapping,
        }) as [Extract<keyof OpCapabilities[T], string>, OpDeviceData<T>][]
    }
  }

  async #handleCapabilities(): Promise<void> {
    const settings: Settings = this.getSettings() as Settings
    const capabilities: string[] = [
      ...this.driver.getCapabilities(
        this.getStore() as Store['Ata'] & Store['Atw'] & Store['Erv'],
      ),
      ...Object.keys(settings).filter(
        (setting: string) =>
          this.#isCapability(setting) &&
          typeof settings[setting] === 'boolean' &&
          settings[setting],
      ),
    ]
    await capabilities.reduce<Promise<void>>(
      async (acc, capability: string) => {
        await acc
        return this.addCapability(capability)
      },
      Promise.resolve(),
    )
    await this.getCapabilities()
      .filter((capability: string) => !capabilities.includes(capability))
      .reduce<Promise<void>>(async (acc, capability: string) => {
        await acc
        await this.removeCapability(capability)
      }, Promise.resolve())
    this.#setCapabilityTagMappings()
  }

  async #handleOptionalCapabilities(
    newSettings: Settings,
    changedCapabilities: string[],
  ): Promise<void> {
    await changedCapabilities.reduce<Promise<void>>(
      async (acc, capability: string) => {
        await acc
        if (newSettings[capability] as boolean) {
          await this.addCapability(capability)
        } else {
          await this.removeCapability(capability)
        }
      },
      Promise.resolve(),
    )
    if (
      changedCapabilities.some(
        (capability: string) => !this.#isReportCapability(capability),
      )
    ) {
      this.#setListCapabilityTagMappings()
    }
  }

  async #handleStore<
    K extends Extract<keyof Store[T], string>,
  >(): Promise<void> {
    const data: ListDevice[T]['Device'] | null =
      this.#app.devices[this.#id]?.Device ?? null
    if (!data) {
      return
    }
    await Promise.all(
      Object.entries(
        this.driver.getStore(
          data as ListDevice['Ata']['Device'] &
            ListDevice['Atw']['Device'] &
            ListDevice['Erv']['Device'],
        ),
      ).map(async ([key, value]): Promise<void> => {
        await this.setStoreValue(key as K, value as Store[T][keyof Store[T]])
      }),
    )
  }

  #isCapability(setting: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (this.driver.manifest.capabilities as string[]).includes(setting)
  }

  #isReportCapability(setting: string): boolean {
    return setting in this.driver.reportCapabilityTagMapping
  }

  #planEnergyReport(
    reportPlanParameters: ReportPlanParameters,
    total = false,
  ): void {
    const totalString: BooleanString = String(total) as BooleanString
    if (this.#reportTimeout[totalString]) {
      return
    }
    const actionType = `${total ? 'total' : 'regular'} energy report`
    const { interval, duration, values } = total
      ? {
          duration: { days: 1 },
          interval: { days: 1 },
          values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
        }
      : reportPlanParameters
    this.#reportTimeout[totalString] = this.setTimeout(
      async (): Promise<void> => {
        await this.#runEnergyReport(total)
        this.#reportInterval[totalString] = this.setInterval(
          async (): Promise<void> => {
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

  #registerCapabilityListeners<
    K extends Extract<keyof SetCapabilities[T], string>,
  >(): void {
    ;(
      [
        ...Object.keys(this.driver.setCapabilityTagMapping),
        'thermostat_mode',
      ] as K[]
    ).forEach((capability: K) => {
      this.registerCapabilityListener(
        capability,
        async (value: SetCapabilities[T][K]): Promise<void> => {
          await this.onCapability(capability, value)
        },
      )
    })
  }

  async #reportEnergyCost(
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ReportData[T] | null> {
    try {
      return (
        await this.#app.melcloudAPI.report({
          DeviceID: this.#id,
          FromDate: fromDate.toISODate() ?? '',
          ToDate: toDate.toISODate() ?? '',
          UseCurrency: false,
        })
      ).data as ReportData[T]
    } catch (error: unknown) {
      return null
    }
  }

  async #runEnergyReport(total = false): Promise<void> {
    if (!this.reportPlanParameters) {
      return
    }
    if (
      !this.#reportCapabilityTagEntries[String(total) as BooleanString].length
    ) {
      this.#clearEnergyReportPlan(total)
      return
    }
    const toDate: DateTime = DateTime.now().minus(
      this.reportPlanParameters.minus,
    )
    const fromDate: DateTime = total ? DateTime.local(YEAR_1970) : toDate
    const data: ReportData[T] | null = await this.#reportEnergyCost(
      fromDate,
      toDate,
    )
    await this.#updateReportCapabilities(data, toDate, total)
    this.#planEnergyReport(this.reportPlanParameters, total)
  }

  async #runEnergyReports(): Promise<void> {
    await this.#runEnergyReport()
    await this.#runEnergyReport(true)
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

  async #setCapabilityValues<
    K extends Extract<keyof OpCapabilities[T], string>,
    D extends DeviceData[T] | ListDevice[T]['Device'],
  >(
    capabilityTagEntries: [K, OpDeviceData<T>][] | null,
    data: D,
  ): Promise<void> {
    if (!capabilityTagEntries) {
      return
    }
    await Promise.all(
      capabilityTagEntries.map(
        async ([capability, tag]: [K, OpDeviceData<T>]): Promise<void> => {
          if (tag in data) {
            const value: OpCapabilities[T][K] = this.#convertFromDevice(
              capability,
              data[tag as keyof D] as
                | NonEffectiveFlagsValueOf<DeviceData[T]>
                | NonEffectiveFlagsValueOf<ListDevice[T]['Device']>,
            )
            await this.setCapabilityValue(
              capability,
              value as Capabilities<T>[K],
            )
          }
        },
      ),
    )
  }

  async #setDeviceData(): Promise<DeviceData[T] | null> {
    try {
      return (
        await this.#app.melcloudAPI.set(this.driver.heatPumpType, {
          DeviceID: this.id,
          HasPendingCommand: true,
          ...this.#buildUpdateData(),
        })
      ).data as DeviceData[T]
    } catch (error: unknown) {
      return null
    }
  }

  #setListCapabilityTagMappings<
    K extends Extract<keyof OpCapabilities[T], string>,
  >(): void {
    this.#listCapabilityTagMapping = this.#cleanMapping(
      this.driver.listCapabilityTagMapping as ListCapabilityTagMapping[T],
    )
    this.#listOnlyCapabilityTagEntries = (
      Object.entries(this.#listCapabilityTagMapping) as [K, OpDeviceData<T>][]
    ).filter(
      ([capability]: [K, OpDeviceData<T>]) =>
        !Object.keys({
          ...this.#setCapabilityTagMapping,
          ...this.#getCapabilityTagMapping,
        }).includes(capability),
    )
  }

  #setReportCapabilityTagEntries<
    K extends Extract<keyof ReportCapabilities[T], string>,
    L extends keyof ReportData[T],
  >(totals: boolean[] | boolean = [false, true]): void {
    ;(Array.isArray(totals) ? totals : [totals]).forEach((total: boolean) => {
      this.#reportCapabilityTagEntries[String(total) as BooleanString] =
        Object.entries(
          this.#cleanMapping(
            this.driver
              .reportCapabilityTagMapping as ReportCapabilityTagMapping[T],
          ),
        ).filter(([capability]: [string, L]) =>
          filterEnergyKeys(capability, total),
        ) as [K, L[]][]
    })
  }

  async #updateCapabilities(
    data: DeviceData[T] | ListDevice[T]['Device'] | null,
  ): Promise<void> {
    if (!data) {
      return
    }
    const updateCapabilityTagEntries: [
      Extract<keyof OpCapabilities[T], string>,
      OpDeviceData<T>,
    ][] = this.#getUpdateCapabilityTagEntries(data.EffectiveFlags)
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
    const {
      0: firstCapabilitiesToUpdate,
      1: lastCapabilitiesToUpdate,
    }: Partial<
      Record<
        typeof NUMBER_0 | typeof NUMBER_1,
        [Extract<keyof OpCapabilities[T], string>, OpDeviceData<T>][]
      >
    > = Object.groupBy<
      number,
      [Extract<keyof OpCapabilities[T], string>, OpDeviceData<T>]
    >(updateCapabilityTagEntries, ([capability]) =>
      Number(
        (this.driver.lastCapabilitiesToUpdate as string[]).includes(
          capability as string,
        ),
      ),
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
    await this.#setCapabilityValues(firstCapabilitiesToUpdate ?? null, data)
    await this.#setCapabilityValues(lastCapabilitiesToUpdate ?? null, data)
    await this.updateThermostatMode()
  }

  async #updateReportCapabilities(
    data: ReportData[T] | null,
    toDate: DateTime,
    total = false,
  ): Promise<void> {
    if (!data) {
      return
    }
    if ('UsageDisclaimerPercentages' in data) {
      this.#linkedDeviceCount =
        data.UsageDisclaimerPercentages.split(',').length
    }
    await Promise.all(
      this.#reportCapabilityTagEntries[String(total) as BooleanString].map(
        async <
          K extends Extract<keyof ReportCapabilities[T], string>,
          L extends keyof ReportData[T],
        >([capability, tags]: [K, L[]]): Promise<void> => {
          switch (true) {
            case capability.includes('cop'):
              await this.setCapabilityValue(
                capability,
                this.#calculateCopValue(data, capability) as Capabilities<T>[K],
              )
              break
            case capability.startsWith('measure_power'):
              await this.setCapabilityValue(
                capability,
                this.#calculatePowerValue(
                  data,
                  tags,
                  toDate,
                ) as Capabilities<T>[K],
              )
              break
            default:
              await this.setCapabilityValue(
                capability,
                this.#calculateEnergyValue(data, tags) as Capabilities<T>[K],
              )
          }
        },
      ),
    )
  }

  protected abstract specificOnCapability<
    K extends keyof SetCapabilitiesWithThermostatMode[T],
  >(capability: K, value: SetCapabilitiesWithThermostatMode[T][K]): void
}

export default BaseMELCloudDevice
