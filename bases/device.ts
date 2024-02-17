import type {
  BooleanString,
  Capabilities,
  DeviceData,
  DeviceDataFromList,
  DeviceDetails,
  GetCapabilityMapping,
  ListCapabilityMapping,
  ListDevice,
  MELCloudDriver,
  OpCapabilities,
  OpCapabilityData,
  ReportCapabilities,
  ReportCapabilityMapping,
  ReportData,
  ReportPlanParameters,
  SetCapabilities,
  SetCapabilityData,
  SetCapabilityMapping,
  SetDeviceData,
  Settings,
  Store,
  TypedString,
  ValueOf,
} from '../types/types'
import { DateTime } from 'luxon'
import { Device } from 'homey'
import { FLAG_UNCHANGED } from '../types/MELCloudAPITypes'
import MELCloudAPI from '../lib/MELCloudAPI'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withTimers from '../mixins/withTimers'

const DEFAULT_0 = 0
const DEFAULT_1 = 1
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

  public readonly data: DeviceDetails['data'] =
    this.getData() as DeviceDetails['data']

  public readonly id: number = this.data.id

  public readonly buildingid: number = this.data.buildingid

  protected readonly app: MELCloudApp = this.homey.app as MELCloudApp

  protected readonly diff: Map<
    keyof SetCapabilities<T>,
    SetCapabilities<T>[keyof SetCapabilities<T>]
  > = new Map<
    keyof SetCapabilities<T>,
    SetCapabilities<T>[keyof SetCapabilities<T>]
  >()

  #firstRun = true

  #syncFromDeviceTimeout: NodeJS.Timeout | null = null

  #syncToDeviceTimeout!: NodeJS.Timeout

  #optionalCapabilities!: string[]

  #setCapabilityMapping: Partial<NonNullable<SetCapabilityMapping<T>>> = {}

  #getCapabilityMapping: Partial<NonNullable<GetCapabilityMapping<T>>> = {}

  #listCapabilityMapping: Partial<NonNullable<ListCapabilityMapping<T>>> = {}

  #reportCapabilityEntries: {
    false: [TypedString<keyof ReportCapabilities<T>>, (keyof ReportData<T>)[]][]
    true: [TypedString<keyof ReportCapabilities<T>>, (keyof ReportData<T>)[]][]
  } = { false: [], true: [] }

  #linkedDeviceCount = DEFAULT_1

  readonly #melcloudAPI: MELCloudAPI = MELCloudAPI.getInstance(
    this.homey.settings,
  )

  readonly #reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { false: null, true: null }

  readonly #reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } =
    {}

  protected abstract readonly reportPlanParameters: ReportPlanParameters | null

  public async onInit(): Promise<void> {
    await this.setWarning(null)
    this.#setOptionalCapabilities()
    await this.#handleCapabilities()
    this.#setReportCapabilityEntries()
    this.#registerCapabilityListeners()
    await this.#syncFromDevice()
    this.#firstRun = false
    await this.#runEnergyReports()
  }

  public async onSettings({
    newSettings,
    changedKeys,
  }: {
    newSettings: Settings
    changedKeys: string[]
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
      await this.#syncFromDevice()
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

  public onDeleted(): void {
    this.#clearSyncWithDevice()
    this.#clearEnergyReportPlans()
  }

  public async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
      this.log('Adding capability', capability)
    }
  }

  public async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
      this.log('Removing capability', capability)
    }
  }

  public getCapabilityValue<K extends keyof Capabilities<T>>(
    capability: TypedString<K>,
  ): NonNullable<Capabilities<T>[K]> {
    return super.getCapabilityValue(capability) as NonNullable<
      Capabilities<T>[K]
    >
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

  public getSetting<K extends keyof Settings>(
    setting: TypedString<K>,
  ): NonNullable<Settings[K]> {
    return super.getSetting(setting) as NonNullable<Settings[K]>
  }

  public async setWarning(warning: string | null): Promise<void> {
    if (warning !== null) {
      await super.setWarning(warning)
    }
    await super.setWarning(null)
  }

  public async onCapability<K extends keyof SetCapabilities<T>>(
    capability: K,
    value: SetCapabilities<T>[K],
  ): Promise<void> {
    this.#clearSyncWithDevice()
    if (capability === 'onoff') {
      await this.setAlwaysOnWarning()
    }
    await this.specificOnCapability(capability, value)
    this.#applySyncToDevice()
  }

  protected async setAlwaysOnWarning(): Promise<void> {
    if (this.getSetting('always_on')) {
      await this.setWarning(this.homey.__('warnings.always_on'))
    }
  }

  protected async setDisplayErrorWarning(): Promise<void> {
    await this.setWarning(this.homey.__('warnings.display_error'))
  }

  protected async updateStore(data: ListDevice<T>['Device']): Promise<void> {
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

  protected getRequestedOrCurrentValue<K extends keyof SetCapabilities<T>>(
    capability: K,
  ): NonNullable<SetCapabilities<T>[K]> {
    return (this.diff.get(capability as keyof SetCapabilities<T>) ??
      this.getCapabilityValue(capability as TypedString<K>)) as NonNullable<
      SetCapabilities<T>[K]
    >
  }

  async #reportEnergyCost(
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ReportData<T> | null> {
    try {
      return (
        await this.#melcloudAPI.report({
          DeviceID: this.id,
          FromDate: fromDate.toISODate() ?? '',
          ToDate: toDate.toISODate() ?? '',
          UseCurrency: false,
        })
      ).data as ReportData<T>
    } catch (error: unknown) {
      return null
    }
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

  #clearSyncWithDevice(): void {
    this.homey.clearTimeout(this.#syncToDeviceTimeout)
    this.homey.clearTimeout(this.#syncFromDeviceTimeout)
    this.#syncFromDeviceTimeout = null
    this.log('Sync with device has been paused')
  }

  async #updateCapabilities(
    data: DeviceData<T> | ListDevice<T>['Device'] | null,
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

  #getUpdateCapabilityEntries(
    effectiveFlags: bigint,
  ): [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][] {
    switch (true) {
      case Boolean(effectiveFlags):
        return [
          ...Object.entries(this.#setCapabilityMapping).filter(
            ([, { effectiveFlag }]: [string, SetCapabilityData<T>]) =>
              // eslint-disable-next-line no-bitwise
              Boolean(effectiveFlag & effectiveFlags),
          ),
          ...Object.entries(this.#getCapabilityMapping),
        ] as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
      case this.#firstRun:
      case Boolean(this.#syncFromDeviceTimeout):
        return Object.entries({
          ...this.#setCapabilityMapping,
          ...this.#getCapabilityMapping,
          ...this.#listCapabilityMapping,
        }) as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
      default:
        return Object.entries(this.#listCapabilityMapping) as [
          TypedString<keyof OpCapabilities<T>>,
          OpCapabilityData<T>,
        ][]
    }
  }

  async #setCapabilityValues<
    D extends DeviceData<T> | ListDevice<T>['Device'],
    K extends keyof OpCapabilities<T>,
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
              data[tag as keyof D] as ValueOf<
                DeviceData<T> & DeviceDataFromList<T>
              >,
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

  #planSyncFromDevice(): void {
    this.#syncFromDeviceTimeout = this.setTimeout(
      async (): Promise<void> => {
        await this.#syncFromDevice()
        this.#syncFromDeviceTimeout = null
      },
      { minutes: 1 },
      { actionType: 'sync from device', units: ['minutes'] },
    )
  }

  async #syncFromDevice(): Promise<void> {
    const data: ListDevice<T>['Device'] = this.app.devicesPerId[this.id].Device
    this.log('Syncing from device list:', data)
    await this.updateStore(data)
    await this.#updateCapabilities(data)
    this.#planSyncFromDevice()
  }

  #applySyncToDevice(): void {
    this.#syncToDeviceTimeout = this.setTimeout(
      async (): Promise<void> => {
        await this.#syncToDevice()
      },
      { seconds: 1 },
      { actionType: 'sync to device', units: ['seconds'] },
    )
  }

  async #syncToDevice(): Promise<void> {
    await this.#updateCapabilities(await this.#setDeviceData())
    this.#planSyncFromDevice()
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

  async #setDeviceData(): Promise<DeviceData<T> | null> {
    try {
      return (
        await this.#melcloudAPI.set(this.driver.heatPumpType, {
          DeviceID: this.id,
          HasPendingCommand: true,
          ...this.#buildUpdateData(),
        })
      ).data as DeviceData<T>
    } catch (error: unknown) {
      return null
    }
  }

  async #runEnergyReports(): Promise<void> {
    await this.#runEnergyReport()
    await this.#runEnergyReport(true)
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
    const data: ReportData<T> | null = await this.#reportEnergyCost(
      fromDate,
      toDate,
    )
    await this.#updateReportCapabilities(data, toDate, total)
    this.#planEnergyReport(this.reportPlanParameters, total)
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
      this.#reportCapabilityEntries[String(total) as BooleanString].map(
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
        DEFAULT_0,
      ) /
      (consumedTags.length
        ? consumedTags.reduce<number>(
            (acc, tag: keyof ReportData<T>) => acc + (data[tag] as number),
            DEFAULT_0,
          )
        : DEFAULT_1)
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
        DEFAULT_0,
      ) / this.#linkedDeviceCount
    )
  }

  #calculateEnergyValue(
    data: ReportData<T>,
    tags: (keyof ReportData<T>)[],
  ): number {
    return (
      tags.reduce<number>(
        (acc, tag: keyof ReportData<T>) => acc + (data[tag] as number),
        DEFAULT_0,
      ) / this.#linkedDeviceCount
    )
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
    this.#setSetAndGetCapabilityMappings()
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
      this.#setListCapabilityMapping()
    }
  }

  #clearEnergyReportPlans(): void {
    this.#clearEnergyReportPlan()
    this.#clearEnergyReportPlan(true)
  }

  #clearEnergyReportPlan(total = false): void {
    const totalString: BooleanString = String(total) as BooleanString
    this.homey.clearTimeout(this.#reportTimeout[totalString])
    this.homey.clearInterval(this.#reportInterval[totalString])
    this.#reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
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

  #setSetAndGetCapabilityMappings(): void {
    this.#setCapabilityMapping = this.#cleanMapping(
      this.driver.setCapabilityMapping as SetCapabilityMapping<T>,
    )
    this.#getCapabilityMapping = this.#cleanMapping(
      this.driver.getCapabilityMapping as GetCapabilityMapping<T>,
    )
  }

  #setListCapabilityMapping(): void {
    this.#listCapabilityMapping = this.#cleanMapping(
      this.driver.listCapabilityMapping as ListCapabilityMapping<T>,
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
        ).filter(([capability]: [string, keyof ReportData<T>]) =>
          filterEnergyKeys(capability, total),
        ) as [
          TypedString<keyof ReportCapabilities<T>>,
          (keyof ReportData<T>)[],
        ][]
    })
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

  #isCapability(setting: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (this.driver.manifest.capabilities as string[]).includes(setting)
  }

  #isReportCapability(setting: string): boolean {
    return setting in this.driver.reportCapabilityMapping
  }

  protected abstract specificOnCapability<K extends keyof SetCapabilities<T>>(
    capability: K,
    value: SetCapabilities<T>[K],
  ): Promise<void>

  protected abstract convertToDevice<K extends keyof SetCapabilities<T>>(
    capability: K,
    value: NonNullable<SetCapabilities<T>[K]>,
  ): SetDeviceData<T>[Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>]

  protected abstract convertFromDevice<K extends keyof OpCapabilities<T>>(
    capability: K,
    value: ValueOf<DeviceDataFromList<T>>,
  ): OpCapabilities<T>[K]

  protected abstract updateThermostatMode(): Promise<void>
}

export default BaseMELCloudDevice
