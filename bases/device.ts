import type {
  BooleanString,
  Capabilities,
  DeviceDataFromList,
  DeviceDetails,
  GetCapabilityMapping,
  ListCapabilityMapping,
  ListDevice,
  MELCloudDriver,
  NonEffectiveFlagsValueOf,
  OpCapabilities,
  OpCapabilityData,
  ReportCapabilities,
  ReportCapabilityMapping,
  ReportPlanParameters,
  SetCapabilities,
  SetCapabilitiesWithThermostatMode,
  SetCapabilityData,
  SetCapabilityMapping,
  SetDeviceData,
  Settings,
  Store,
  TypedString,
} from '../types/types'
import {
  type DeviceData,
  FLAG_UNCHANGED,
  type ReportData,
} from '../types/MELCloudAPITypes'
import { DateTime } from 'luxon'
import { Device } from 'homey'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withTimers from '../mixins/withTimers'

export const NUMBER_0 = 0
const NUMBER_1 = 1
export const K_MULTIPLIER = 1000
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

  #getCapabilityMapping: Partial<NonNullable<GetCapabilityMapping<T>>> = {}

  #linkedDeviceCount = NUMBER_1

  #listCapabilityMapping: Partial<NonNullable<ListCapabilityMapping<T>>> = {}

  #listOnlyCapabilityEntries: [
    TypedString<keyof OpCapabilities<T>>,
    OpCapabilityData<T>,
  ][] = []

  #optionalCapabilities!: string[]

  #reportCapabilityEntries: {
    false: [
      TypedString<keyof ReportCapabilities<T>>,
      (keyof ReportData<T['heatPumpType']>)[],
    ][]
    true: [
      TypedString<keyof ReportCapabilities<T>>,
      (keyof ReportData<T['heatPumpType']>)[],
    ][]
  } = { false: [], true: [] }

  #setCapabilityMapping: Partial<NonNullable<SetCapabilityMapping<T>>> = {}

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
    await this.setWarning(null)
    this.#setOptionalCapabilities()
    await this.#handleCapabilities()
    this.#setReportCapabilityEntries()
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
          !(setting in this.driver.reportCapabilityMapping),
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
            this.#setReportCapabilityEntries(total)
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
      (this.#app.devicesPerId[this.#id] as ListDevice<T> | undefined)?.Device ??
      null
    this.log('Syncing from device list:', data)
    await this.updateStore(data)
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

  protected async updateStore(
    data: ListDevice<T>['Device'] | null,
  ): Promise<void> {
    if (!data) {
      return
    }
    const updates = await Promise.all(
      Object.entries(this.getStore() as Store)
        .filter(
          ([key, value]: [string, boolean]) =>
            key in data && value !== data[key as keyof ListDevice<T>['Device']],
        )
        .map(async ([key]: [string, boolean]): Promise<boolean> => {
          await this.setStoreValue(
            key,
            data[key as keyof ListDevice<T>['Device']],
          )
          return true
        }),
    )
    if (updates.some(Boolean)) {
      await this.#handleCapabilities()
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
    return Object.entries(this.#setCapabilityMapping).reduce<SetDeviceData<T>>(
      (
        acc,
        [capability, { tag, effectiveFlag }]: [string, SetCapabilityData<T>],
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
            BigInt(acc.EffectiveFlags) | effectiveFlag,
          )
        }
        return acc
      },
      { EffectiveFlags: FLAG_UNCHANGED },
    )
  }

  #calculateCopValue<K extends keyof ReportCapabilities<T>>(
    data: ReportData<T['heatPumpType']>,
    capability: TypedString<K>,
  ): number {
    const producedTags: (keyof ReportData<T['heatPumpType']>)[] = this.driver
      .producedTagMapping[capability] as TypedString<
      keyof ReportData<T['heatPumpType']>
    >[]
    const consumedTags: (keyof ReportData<T['heatPumpType']>)[] = this.driver
      .consumedTagMapping[capability] as TypedString<
      keyof ReportData<T['heatPumpType']>
    >[]
    return (
      producedTags.reduce<number>(
        (acc, tag: keyof ReportData<T['heatPumpType']>) =>
          acc + (data[tag] as number),
        NUMBER_0,
      ) /
      (consumedTags.length
        ? consumedTags.reduce<number>(
            (acc, tag: keyof ReportData<T['heatPumpType']>) =>
              acc + (data[tag] as number),
            NUMBER_0,
          )
        : NUMBER_1)
    )
  }

  #calculateEnergyValue(
    data: ReportData<T['heatPumpType']>,
    tags: (keyof ReportData<T['heatPumpType']>)[],
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: keyof ReportData<T['heatPumpType']>) =>
          acc + (data[tag] as number),
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #calculatePowerValue(
    data: ReportData<T['heatPumpType']>,
    tags: (keyof ReportData<T['heatPumpType']>)[],
    toDate: DateTime,
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: keyof ReportData<T['heatPumpType']>) =>
          acc + (data[tag] as number[])[toDate.hour] * K_MULTIPLIER,
        NUMBER_0,
      ) / this.#linkedDeviceCount
    )
  }

  #cleanMapping<
    M extends
      | GetCapabilityMapping<T>
      | ListCapabilityMapping<T>
      | ReportCapabilityMapping<T>
      | SetCapabilityMapping<T>,
  >(capabilityMapping: M): Partial<NonNullable<M>> {
    return Object.fromEntries(
      Object.entries(capabilityMapping).filter(([capability]) =>
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

  #getUpdateCapabilityEntries(
    effectiveFlags: bigint,
  ): [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][] {
    switch (true) {
      case Boolean(effectiveFlags):
        return [
          ...Object.entries(this.#setCapabilityMapping).filter(
            ([, { effectiveFlag }]: [string, SetCapabilityData<T>]) =>
              // eslint-disable-next-line no-bitwise
              effectiveFlag & effectiveFlags,
          ),
          ...Object.entries(this.#getCapabilityMapping),
        ] as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
      case Boolean(this.diff.size):
      case this.#syncToDeviceTimeout !== null:
        return this.#listOnlyCapabilityEntries
      default:
        return Object.entries({
          ...this.#setCapabilityMapping,
          ...this.#getCapabilityMapping,
          ...this.#listCapabilityMapping,
        }) as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
    }
  }

  async #handleCapabilities(): Promise<void> {
    const capabilities: string[] = [
      ...this.driver.getRequiredCapabilities(this.getStore() as Store),
      ...this.#optionalCapabilities,
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
    this.#setCapabilityMappings()
  }

  async #handleOptionalCapabilities(
    newSettings: Settings,
    changedCapabilities: string[],
  ): Promise<void> {
    this.#setOptionalCapabilities(newSettings)
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
      this.#setListCapabilityMappings()
    }
  }

  #isCapability(setting: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (this.driver.manifest.capabilities as string[]).includes(setting)
  }

  #isReportCapability(setting: string): boolean {
    return setting in this.driver.reportCapabilityMapping
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
      ...Object.keys(this.driver.setCapabilityMapping),
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
  ): Promise<ReportData<T['heatPumpType']> | null> {
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
    if (!this.#reportCapabilityEntries[String(total) as BooleanString].length) {
      this.#clearEnergyReportPlan(total)
      return
    }
    const toDate: DateTime = DateTime.now().minus(
      this.reportPlanParameters.minus,
    )
    const fromDate: DateTime = total ? DateTime.local(YEAR_1970) : toDate
    const data: ReportData<T['heatPumpType']> | null =
      await this.#reportEnergyCost(fromDate, toDate)
    await this.#updateReportCapabilities(data, toDate, total)
    this.#planEnergyReport(this.reportPlanParameters, total)
  }

  async #runEnergyReports(): Promise<void> {
    await this.#runEnergyReport()
    await this.#runEnergyReport(true)
  }

  #setCapabilityMappings(): void {
    this.#setCapabilityMapping = this.#cleanMapping(
      this.driver.setCapabilityMapping as SetCapabilityMapping<T>,
    )
    this.#getCapabilityMapping = this.#cleanMapping(
      this.driver.getCapabilityMapping as GetCapabilityMapping<T>,
    )
    this.#setListCapabilityMappings()
  }

  async #setCapabilityValues<
    K extends keyof OpCapabilities<T>,
    D extends DeviceData<T['heatPumpType']> | ListDevice<T>['Device'],
  >(capabilityEntries: [K, OpCapabilityData<T>][], data: D): Promise<void> {
    await Promise.all(
      capabilityEntries.map(
        async ([capability, { tag }]: [
          K,
          OpCapabilityData<T>,
        ]): Promise<void> => {
          if (tag in data) {
            const value: OpCapabilities<T>[K] = this.convertFromDevice(
              capability as TypedString<K>,
              data[tag as keyof D] as
                | NonEffectiveFlagsValueOf<DeviceData<T['heatPumpType']>>
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

  async #setDeviceData(): Promise<DeviceData<T['heatPumpType']> | null> {
    try {
      return (
        await this.#app.melcloudAPI.set(this.driver.heatPumpType, {
          DeviceID: this.id,
          HasPendingCommand: true,
          ...this.#buildUpdateData(),
        })
      ).data as DeviceData<T['heatPumpType']>
    } catch (error: unknown) {
      return null
    }
  }

  #setListCapabilityMappings(): void {
    this.#listCapabilityMapping = this.#cleanMapping(
      this.driver.listCapabilityMapping as ListCapabilityMapping<T>,
    )
    this.#listOnlyCapabilityEntries = (
      Object.entries(this.#listCapabilityMapping) as [
        TypedString<keyof OpCapabilities<T>>,
        OpCapabilityData<T>,
      ][]
    ).filter(
      ([capability]: [
        TypedString<keyof OpCapabilities<T>>,
        OpCapabilityData<T>,
      ]) =>
        !Object.keys({
          ...this.#setCapabilityMapping,
          ...this.#getCapabilityMapping,
        }).includes(capability),
    )
  }

  #setOptionalCapabilities(
    settings: Settings = this.getSettings() as Settings,
  ): void {
    this.#optionalCapabilities = Object.keys(settings).filter(
      (setting: string) =>
        this.#isCapability(setting) &&
        typeof settings[setting] === 'boolean' &&
        settings[setting],
    )
  }

  #setReportCapabilityEntries(
    totals: boolean[] | boolean = [false, true],
  ): void {
    ;(Array.isArray(totals) ? totals : [totals]).forEach((total: boolean) => {
      this.#reportCapabilityEntries[String(total) as BooleanString] =
        Object.entries(
          this.#cleanMapping(
            this.driver.reportCapabilityMapping as ReportCapabilityMapping<T>,
          ),
        ).filter(
          ([capability]: [string, keyof ReportData<T['heatPumpType']>]) =>
            filterEnergyKeys(capability, total),
        ) as [
          TypedString<keyof ReportCapabilities<T>>,
          (keyof ReportData<T['heatPumpType']>)[],
        ][]
    })
  }

  async #updateCapabilities(
    data: DeviceData<T['heatPumpType']> | ListDevice<T>['Device'] | null,
  ): Promise<void> {
    if (!data) {
      return
    }
    const updateCapabilityEntries: [
      TypedString<keyof OpCapabilities<T>>,
      OpCapabilityData<T>,
    ][] = this.#getUpdateCapabilityEntries(BigInt(data.EffectiveFlags))
    const keysToUpdateLast: string[] = [
      'operation_mode_state.zone1',
      'operation_mode_state.zone2',
    ]
    const [regularCapabilityEntries, lastCapabilityEntries]: [
      TypedString<keyof OpCapabilities<T>>,
      OpCapabilityData<T>,
    ][][] = updateCapabilityEntries.reduce<
      [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][][]
    >(
      (
        acc,
        [capability, capabilityData]: [
          TypedString<keyof OpCapabilities<T>>,
          OpCapabilityData<T>,
        ],
      ) => {
        const [regular, last]: [
          TypedString<keyof OpCapabilities<T>>,
          OpCapabilityData<T>,
        ][][] = acc
        if (keysToUpdateLast.includes(capability)) {
          last.push([capability, capabilityData])
        } else {
          regular.push([capability, capabilityData])
        }
        return acc
      },
      [[], []],
    )
    await this.#setCapabilityValues(regularCapabilityEntries, data)
    await this.#setCapabilityValues(lastCapabilityEntries, data)
    await this.updateThermostatMode()
  }

  async #updateReportCapabilities(
    data: ReportData<T['heatPumpType']> | null,
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
      this.#reportCapabilityEntries[String(total) as BooleanString].map(
        async <K extends keyof ReportCapabilities<T>>([capability, tags]: [
          TypedString<K>,
          (keyof ReportData<T['heatPumpType']>)[],
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
      | NonEffectiveFlagsValueOf<DeviceData<T['heatPumpType']>>
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
