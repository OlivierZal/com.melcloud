import type {
  BooleanString,
  Capabilities,
  CapabilityOptionsEntries,
  DeviceData,
  DeviceDataFromList,
  DeviceDetails,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  ListDevice,
  MELCloudDriver,
  NonEffectiveFlagsValueOf,
  OpCapabilities,
  OpDeviceData,
  ReportCapabilities,
  ReportCapabilityTagMapping,
  ReportData,
  ReportPlanParameters,
  SetCapabilities,
  SetCapabilitiesWithThermostatMode,
  SetCapabilityTagMapping,
  SetDeviceData,
  Settings,
  Store,
  TypedString,
} from '../types'
import { FLAG_UNCHANGED, type NonEffectiveFlagsKeyOf } from '../melcloud/types'
import { K_MULTIPLIER, NUMBER_0, NUMBER_1 } from '../constants'
import { DateTime } from 'luxon'
import { Device } from 'homey'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withTimers from '../mixins/withTimers'

const YEAR_1970 = 1970

const filterEnergyKeys = (key: string, total: boolean): boolean => {
  const condition: boolean =
    key.startsWith('measure_power') || key.includes('daily')
  return total ? !condition : condition
}

@addToLogs('getName()')
abstract class BaseMELCloudDevice<T extends MELCloudDriver> extends withTimers(
  Device,
) {
  public declare readonly driver: T

  protected readonly diff: Map<
    keyof SetCapabilities<T>,
    SetCapabilities<T>[keyof SetCapabilities<T>]
  > = new Map<
    keyof SetCapabilities<T>,
    SetCapabilities<T>[keyof SetCapabilities<T>]
  >()

  #effectiveFlags!: Record<NonEffectiveFlagsKeyOf<SetDeviceData<T>>, number>

  #getCapabilityTagMapping: Partial<NonNullable<GetCapabilityTagMapping<T>>> =
    {}

  #linkedDeviceCount = NUMBER_1

  #listCapabilityTagMapping: Partial<NonNullable<ListCapabilityTagMapping<T>>> =
    {}

  #listOnlyCapabilityTagEntries: [
    TypedString<keyof OpCapabilities<T>>,
    OpDeviceData<T>,
  ][] = []

  #reportCapabilityTagEntries: {
    false: [TypedString<keyof ReportCapabilities<T>>, (keyof ReportData<T>)[]][]
    true: [TypedString<keyof ReportCapabilities<T>>, (keyof ReportData<T>)[]][]
  } = { false: [], true: [] }

  #setCapabilityTagMapping: Partial<NonNullable<SetCapabilityTagMapping<T>>> =
    {}

  #syncToDeviceTimeout: NodeJS.Timeout | null = null

  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  readonly #data: DeviceDetails['data'] =
    this.getData() as DeviceDetails['data']

  readonly #id: number = this.#data.id

  readonly #reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } =
    {}

  readonly #reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { false: null, true: null }

  protected abstract readonly reportPlanParameters: ReportPlanParameters | null

  public get buildingid(): number {
    return this.#data.buildingid
  }

  public get id(): number {
    return this.#id
  }

  public async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
      this.log('Adding capability', capability)
    }
  }

  public getCapabilityOptions<K extends keyof CapabilityOptionsEntries>(
    capability: K,
  ): CapabilityOptionsEntries[K] {
    return super.getCapabilityOptions(capability) as CapabilityOptionsEntries[K]
  }

  public getCapabilityValue<K extends keyof Capabilities<T>>(
    capability: TypedString<K>,
  ): NonNullable<Capabilities<T>[K]> {
    return super.getCapabilityValue(capability) as NonNullable<
      Capabilities<T>[K]
    >
  }

  public getSetting<K extends keyof Settings>(
    setting: TypedString<K>,
  ): NonNullable<Settings[K]> {
    return super.getSetting(setting) as NonNullable<Settings[K]>
  }

  public async onCapability<
    K extends keyof SetCapabilitiesWithThermostatMode<T>,
  >(
    capability: K,
    value: SetCapabilitiesWithThermostatMode<T>[K],
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
      NonEffectiveFlagsKeyOf<SetDeviceData<T>>,
      number
    >
    await this.setWarning(null)
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

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onUninit(): Promise<void> {
    this.onDeleted()
  }

  public async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
      this.log('Removing capability', capability)
    }
  }

  public async setCapabilityOptions<K extends keyof CapabilityOptionsEntries>(
    capability: K,
    options: CapabilityOptionsEntries[K],
  ): Promise<void> {
    await super.setCapabilityOptions(capability, options)
  }

  public async setCapabilityValue<K extends keyof Capabilities<T>>(
    capability: TypedString<K>,
    value: Capabilities<T>[K],
  ): Promise<void> {
    if (value !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, value)
      this.log('Capability', capability, 'is', value)
    }
  }

  public async setWarning(warning: string | null): Promise<void> {
    if (warning !== null) {
      await super.setWarning(warning)
    }
    await super.setWarning(null)
  }

  public async syncFromDevice(): Promise<void> {
    const data: ListDevice<T>['Device'] | null =
      this.#app.devices[this.#id]?.Device ?? null
    this.log('Syncing from device list:', data)
    await this.#updateCapabilities(data)
  }

  protected getRequestedOrCurrentValue<K extends keyof SetCapabilities<T>>(
    capability: K,
  ): NonNullable<SetCapabilities<T>[K]> {
    return (this.diff.get(capability) ??
      this.getCapabilityValue(capability as TypedString<K>)) as NonNullable<
      SetCapabilities<T>[K]
    >
  }

  protected async setAlwaysOnWarning(): Promise<void> {
    if (this.getSetting('always_on')) {
      await this.setWarning(this.homey.__('warnings.always_on'))
    }
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

  #buildUpdateData(): SetDeviceData<T> {
    return Object.entries(this.#setCapabilityTagMapping).reduce<
      SetDeviceData<T>
    >(
      (
        acc,
        [capability, tag]: [string, NonEffectiveFlagsKeyOf<SetDeviceData<T>>],
      ) => {
        acc[tag] = this.convertToDevice(
          capability as keyof SetCapabilities<T>,
          this.getRequestedOrCurrentValue(
            capability as keyof SetCapabilities<T>,
          ),
        )
        if (this.diff.has(capability as keyof SetCapabilities<T>)) {
          this.diff.delete(capability as keyof SetCapabilities<T>)
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

  #calculateCopValue<K extends keyof ReportCapabilities<T>>(
    data: ReportData<T>,
    capability: TypedString<K>,
  ): number {
    const producedTags: (keyof ReportData<T>)[] = this.driver
      .producedTagMapping[capability] as TypedString<keyof ReportData<T>>[]
    const consumedTags: (keyof ReportData<T>)[] = this.driver
      .consumedTagMapping[capability] as TypedString<keyof ReportData<T>>[]
    return (
      producedTags.reduce<number>(
        (acc, tag: keyof ReportData<T>) => acc + (data[tag] as number),
        NUMBER_0,
      ) /
      (consumedTags.length
        ? consumedTags.reduce<number>(
            (acc, tag: keyof ReportData<T>) => acc + (data[tag] as number),
            NUMBER_0,
          )
        : NUMBER_1)
    )
  }

  #calculateEnergyValue(
    data: ReportData<T>,
    tags: (keyof ReportData<T>)[],
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: keyof ReportData<T>) => acc + (data[tag] as number),
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #calculatePowerValue(
    data: ReportData<T>,
    tags: (keyof ReportData<T>)[],
    toDate: DateTime,
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: keyof ReportData<T>) =>
          acc + (data[tag] as number[])[toDate.hour] * K_MULTIPLIER,
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #cleanMapping<
    M extends
      | GetCapabilityTagMapping<T>
      | ListCapabilityTagMapping<T>
      | ReportCapabilityTagMapping<T>
      | SetCapabilityTagMapping<T>,
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

  #getUpdateCapabilityTagEntries(
    effectiveFlags: number,
  ): [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>][] {
    switch (true) {
      case effectiveFlags !== FLAG_UNCHANGED:
        return [
          ...Object.entries(this.#setCapabilityTagMapping).filter(
            ([, tag]: [string, NonEffectiveFlagsKeyOf<SetDeviceData<T>>]) =>
              // eslint-disable-next-line no-bitwise
              BigInt(effectiveFlags) & BigInt(this.#effectiveFlags[tag]),
          ),
          ...Object.entries(this.#getCapabilityTagMapping),
        ] as [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>][]
      case this.diff.size > NUMBER_0:
      case this.#syncToDeviceTimeout !== null:
        return this.#listOnlyCapabilityTagEntries
      default:
        return Object.entries({
          ...this.#setCapabilityTagMapping,
          ...this.#getCapabilityTagMapping,
          ...this.#listCapabilityTagMapping,
        }) as [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>][]
    }
  }

  async #handleCapabilities(): Promise<void> {
    const settings: Settings = this.getSettings() as Settings
    const capabilities: string[] = [
      ...this.driver.getRequiredCapabilities(this.getStore() as Store),
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

  #registerCapabilityListeners<K extends keyof SetCapabilities<T>>(): void {
    ;[
      ...Object.keys(this.driver.setCapabilityTagMapping),
      'thermostat_mode',
    ].forEach((capability: string) => {
      this.registerCapabilityListener(
        capability,
        async (value: SetCapabilities<T>[K]): Promise<void> => {
          await this.onCapability(capability as K, value)
        },
      )
    })
  }

  async #reportEnergyCost(
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ReportData<T> | null> {
    try {
      return (
        await this.#app.melcloudAPI.report({
          DeviceID: this.#id,
          FromDate: fromDate.toISODate() ?? '',
          ToDate: toDate.toISODate() ?? '',
          UseCurrency: false,
        })
      ).data
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
    const data: ReportData<T> | null = await this.#reportEnergyCost(
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
      this.driver.setCapabilityTagMapping as SetCapabilityTagMapping<T>,
    )
    this.#getCapabilityTagMapping = this.#cleanMapping(
      this.driver.getCapabilityTagMapping as GetCapabilityTagMapping<T>,
    )
    this.#setListCapabilityTagMappings()
  }

  async #setCapabilityValues<
    K extends keyof OpCapabilities<T>,
    D extends DeviceData<T> | ListDevice<T>['Device'],
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
            const value: OpCapabilities<T>[K] = this.convertFromDevice(
              capability as TypedString<K>,
              data[tag as keyof D] as
                | NonEffectiveFlagsValueOf<DeviceData<T>>
                | NonEffectiveFlagsValueOf<DeviceDataFromList<T>>,
            )
            await this.setCapabilityValue(
              capability as TypedString<K>,
              value as Capabilities<T>[K],
            )
          }
        },
      ),
    )
  }

  async #setDeviceData(): Promise<DeviceData<T> | null> {
    try {
      return (
        await this.#app.melcloudAPI.set(this.driver.heatPumpType, {
          DeviceID: this.id,
          HasPendingCommand: true,
          ...this.#buildUpdateData(),
        })
      ).data as DeviceData<T>
    } catch (error: unknown) {
      return null
    }
  }

  #setListCapabilityTagMappings(): void {
    this.#listCapabilityTagMapping = this.#cleanMapping(
      this.driver.listCapabilityTagMapping as ListCapabilityTagMapping<T>,
    )
    this.#listOnlyCapabilityTagEntries = (
      Object.entries(this.#listCapabilityTagMapping) as [
        TypedString<keyof OpCapabilities<T>>,
        OpDeviceData<T>,
      ][]
    ).filter(
      ([capability]: [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>]) =>
        !Object.keys({
          ...this.#setCapabilityTagMapping,
          ...this.#getCapabilityTagMapping,
        }).includes(capability),
    )
  }

  #setReportCapabilityTagEntries(
    totals: boolean[] | boolean = [false, true],
  ): void {
    ;(Array.isArray(totals) ? totals : [totals]).forEach((total: boolean) => {
      this.#reportCapabilityTagEntries[String(total) as BooleanString] =
        Object.entries(
          this.#cleanMapping(
            this.driver
              .reportCapabilityTagMapping as ReportCapabilityTagMapping<T>,
          ),
        ).filter(([capability]: [string, keyof ReportData<T>]) =>
          filterEnergyKeys(capability, total),
        ) as [
          TypedString<keyof ReportCapabilities<T>>,
          (keyof ReportData<T>)[],
        ][]
    })
  }

  async #updateCapabilities(
    data: DeviceData<T> | ListDevice<T>['Device'] | null,
  ): Promise<void> {
    if (!data) {
      return
    }
    const updateCapabilityTagEntries: [
      TypedString<keyof OpCapabilities<T>>,
      OpDeviceData<T>,
    ][] = this.#getUpdateCapabilityTagEntries(data.EffectiveFlags)
    const keysToUpdateLast: string[] = [
      'operation_mode_state.zone1',
      'operation_mode_state.zone2',
    ]
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
    const capabilityTagEntries: {
      last?: [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>][]
      regular?: [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>][]
    } = Object.groupBy<
      'last' | 'regular',
      [TypedString<keyof OpCapabilities<T>>, OpDeviceData<T>]
    >(
      updateCapabilityTagEntries,
      ([capability]: [
        TypedString<keyof OpCapabilities<T>>,
        OpDeviceData<T>,
      ]) => (keysToUpdateLast.includes(capability) ? 'last' : 'regular'),
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
    await this.#setCapabilityValues(capabilityTagEntries.regular ?? null, data)
    await this.#setCapabilityValues(capabilityTagEntries.last ?? null, data)
    await this.updateThermostatMode()
  }

  async #updateReportCapabilities(
    data: ReportData<T> | null,
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
        async <K extends keyof ReportCapabilities<T>>([capability, tags]: [
          TypedString<K>,
          (keyof ReportData<T>)[],
        ]): Promise<void> => {
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

  protected abstract convertFromDevice<K extends keyof OpCapabilities<T>>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceData<T>>
      | NonEffectiveFlagsValueOf<DeviceDataFromList<T>>,
  ): OpCapabilities<T>[K]

  protected abstract convertToDevice<K extends keyof SetCapabilities<T>>(
    capability: K,
    value: NonNullable<SetCapabilities<T>[K]>,
  ): NonEffectiveFlagsValueOf<SetDeviceData<T>>

  protected abstract specificOnCapability<
    K extends keyof SetCapabilitiesWithThermostatMode<T>,
  >(capability: K, value: SetCapabilitiesWithThermostatMode<T>[K]): void

  protected abstract updateThermostatMode(): Promise<void>
}

export default BaseMELCloudDevice
