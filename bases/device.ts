import { Device } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import { DateTime } from 'luxon'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withAPI from '../mixins/withAPI'
import withTimers from '../mixins/withTimers'
import type {
  BooleanString,
  Capabilities,
  DeviceDetails,
  GetCapabilityMapping,
  GetDeviceData,
  ListCapabilityData,
  ListCapabilityMapping,
  ListDevice,
  ListDeviceData,
  MELCloudDriver,
  OpCapabilities,
  OpCapabilityData,
  PostData,
  ReportCapabilities,
  ReportCapabilityMapping,
  ReportData,
  ReportPlanParameters,
  ReportPostData,
  SetCapabilities,
  SetCapabilityData,
  SetCapabilityMapping,
  SetDeviceData,
  Settings,
  Store,
  SyncFromMode,
  SyncMode,
  TypedString,
  UpdateDeviceData,
  ValueOf,
} from '../types'

const DATETIME_1970: DateTime = DateTime.local(1970)
export const K_MULTIPLIER = 1000

const filterEnergyKeys = (key: string, total: boolean): boolean => {
  const condition: boolean =
    key.startsWith('measure_power') || key.includes('daily')
  return total ? !condition : condition
}

@addToLogs('getName()')
abstract class BaseMELCloudDevice<T extends MELCloudDriver> extends withAPI(
  withTimers(Device),
) {
  public declare driver: T

  public readonly data: DeviceDetails['data'] =
    this.getData() as DeviceDetails['data']

  public readonly id: number = this.data.id

  public readonly buildingid: number = this.data.buildingid

  protected app: MELCloudApp = this.homey.app as MELCloudApp

  protected diff: Map<
    keyof SetCapabilities<T>,
    SetCapabilities<T>[keyof SetCapabilities<T>]
  > = new Map<
    keyof SetCapabilities<T>,
    SetCapabilities<T>[keyof SetCapabilities<T>]
  >()

  readonly #reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { true: null, false: null }

  readonly #reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } =
    {}

  #syncTimeout!: NodeJS.Timeout

  #optionalCapabilities!: string[]

  #setCapabilityMapping!: Partial<NonNullable<SetCapabilityMapping<T>>>

  #getCapabilityMapping!: Partial<NonNullable<GetCapabilityMapping<T>>>

  #listCapabilityMapping: Partial<
    NonNullable<ListCapabilityMapping<T>>
  > | null = null

  #setAndGetCapabilityMapping!: Partial<NonNullable<GetCapabilityMapping<T>>> &
    Partial<NonNullable<SetCapabilityMapping<T>>>

  #syncFromCapabilityEntries!: [
    TypedString<keyof OpCapabilities<T>>,
    OpCapabilityData<T>,
  ][]

  #opCapabilityEntries!: [
    TypedString<keyof OpCapabilities<T>>,
    OpCapabilityData<T>,
  ][]

  #reportCapabilityEntries: {
    false: [
      TypedString<keyof ReportCapabilities<T>>,
      TypedString<keyof ReportData<T>>[],
    ][]
    true: [
      TypedString<keyof ReportCapabilities<T>>,
      TypedString<keyof ReportData<T>>[],
    ][]
  } = { false: [], true: [] }

  protected abstract readonly reportPlanParameters: ReportPlanParameters | null

  public async onInit(): Promise<void> {
    await this.setWarning(null)
    this.setOptionalCapabilities()
    await this.handleCapabilities()
    this.setReportCapabilityEntries()
    this.registerCapabilityListeners()
    this.app.applySyncFromDevices()
    await this.runEnergyReports()
  }

  public isDiff(): boolean {
    return !!this.diff.size
  }

  public async syncDeviceFromList(syncMode?: SyncFromMode): Promise<void> {
    const deviceFromList: ListDevice<T> | undefined = this.getDeviceFromList()
    const data: ListDevice<T>['Device'] | null = deviceFromList?.Device ?? null
    this.log('Syncing from device list:', data)
    await this.updateStore(data)
    await this.endSync(data, syncMode)
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
        this.isCapability(setting) && typeof newSettings[setting] === 'boolean',
    )
    if (changedCapabilities.length) {
      await this.handleOptionalCapabilities(newSettings, changedCapabilities)
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
          !(setting in (this.driver.reportCapabilityMapping ?? {})),
      )
    ) {
      this.app.applySyncFromDevices()
    }

    const changedEnergyKeys: string[] = changedCapabilities.filter(
      (setting: string) => this.isReportCapability(setting),
    )
    if (!changedEnergyKeys.length) {
      return
    }
    await Promise.all(
      [false, true].map(async (total: boolean): Promise<void> => {
        if (
          changedEnergyKeys.some((setting: string) =>
            filterEnergyKeys(setting, total),
          )
        ) {
          this.setReportCapabilityEntries(total)
          await this.runEnergyReport(total)
        }
      }),
    )
  }

  public onDeleted(): void {
    this.clearSync()
    this.clearEnergyReportPlans()
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
    this.clearSync()
    if (capability === 'onoff') {
      await this.setAlwaysOnWarning()
    }
    await this.specificOnCapability(capability, value)
    this.applySyncToDevice()
  }

  protected async setAlwaysOnWarning(): Promise<void> {
    if (this.getSetting('always_on')) {
      await this.setWarning(this.homey.__('warnings.always_on'))
    }
  }

  protected async setDisplayErrorWarning(): Promise<void> {
    await this.setWarning(this.homey.__('warnings.display_error'))
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
      await this.handleCapabilities()
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

  private async setDeviceData(): Promise<GetDeviceData<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: this.id,
        HasPendingCommand: true,
        ...this.buildUpdateData(),
      }
      const { data } = await this.api.post<GetDeviceData<T>>(
        `/Device/Set${this.driver.heatPumpType}`,
        postData,
      )
      return data
    } catch (error: unknown) {
      return null
    }
  }

  private async reportEnergyCost(
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ReportData<T> | null> {
    try {
      const postData: ReportPostData = {
        DeviceID: this.id,
        FromDate: fromDate.toISODate() ?? '',
        ToDate: toDate.toISODate() ?? '',
        UseCurrency: false,
      }
      const { data } = await this.api.post<ReportData<T>>(
        '/EnergyCost/Report',
        postData,
      )
      return data
    } catch (error: unknown) {
      return null
    }
  }

  private registerCapabilityListeners<
    K extends keyof SetCapabilities<T>,
  >(): void {
    ;[
      ...Object.keys(this.driver.setCapabilityMapping),
      'thermostat_mode',
    ].forEach((capability: string): void => {
      this.registerCapabilityListener(
        capability,
        async (value: SetCapabilities<T>[K]): Promise<void> => {
          await this.onCapability(capability as K, value)
        },
      )
    })
  }

  private clearSync(): void {
    this.app.clearListDevicesRefresh()
    this.homey.clearTimeout(this.#syncTimeout)
    this.log('Sync with device has been paused')
  }

  private async endSync(
    data: GetDeviceData<T> | ListDevice<T>['Device'] | null,
    syncMode?: SyncMode,
  ): Promise<void> {
    await this.updateCapabilities(data, syncMode)
    await this.updateThermostatMode(!!data)
    if (syncMode === 'syncTo' && !this.isDiff()) {
      this.app.applySyncFromDevices({ syncMode: 'syncFrom' })
    }
  }

  private async updateCapabilities<
    D extends GetDeviceData<T> | ListDevice<T>['Device'],
  >(data: D | null, syncMode?: SyncMode): Promise<void> {
    if (data?.EffectiveFlags === undefined) {
      return
    }
    const updateCapabilityEntries: [
      TypedString<keyof OpCapabilities<T>>,
      OpCapabilityData<T>,
    ][] = this.getUpdateCapabilityEntries(syncMode, BigInt(data.EffectiveFlags))
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
        if (keysToUpdateLast.includes(capability)) {
          acc[1].push([capability, capabilityData])
        } else {
          acc[0].push([capability, capabilityData])
        }
        return acc
      },
      [[], []],
    )
    await this.setCapabilityValues(regularCapabilityEntries, data)
    await this.setCapabilityValues(lastCapabilityEntries, data)
  }

  private getUpdateCapabilityEntries(
    syncMode: SyncMode | undefined,
    effectiveFlags: bigint,
  ): [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][] {
    switch (syncMode) {
      case 'syncTo':
        return [
          ...Object.entries(this.#setCapabilityMapping).filter(
            ([, { effectiveFlag }]: [string, SetCapabilityData<T>]) =>
              !!(effectiveFlag & effectiveFlags),
          ),
          ...Object.entries(this.#getCapabilityMapping),
        ] as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
      case 'syncFrom':
        return this.#syncFromCapabilityEntries
      default:
        return this.#opCapabilityEntries
    }
  }

  private async setCapabilityValues<
    D extends GetDeviceData<T> | ListDevice<T>['Device'],
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
                GetDeviceData<T> & ListDeviceData<T>
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

  private applySyncToDevice(): void {
    this.#syncTimeout = this.setTimeout(
      async (): Promise<void> => {
        await this.syncToDevice()
      },
      { seconds: 1 },
      { actionType: 'sync with device', units: ['seconds'] },
    )
  }

  private async syncToDevice(): Promise<void> {
    const data: GetDeviceData<T> | null = await this.setDeviceData()
    await this.endSync(data, 'syncTo')
  }

  private buildUpdateData(): SetDeviceData<T> {
    return Object.entries(this.#setCapabilityMapping).reduce<
      UpdateDeviceData<T>
    >(
      (
        acc,
        [capability, { tag, effectiveFlag }]: [string, SetCapabilityData<T>],
      ) => {
        acc[tag] = this.convertToDevice(
          capability as keyof SetCapabilities<T>,
          this.getRequestedOrCurrentValue(
            capability as keyof SetCapabilities<T>,
          ),
        ) as SetDeviceData<T>[Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>]
        if (this.diff.has(capability as keyof SetCapabilities<T>)) {
          this.diff.delete(capability as keyof SetCapabilities<T>)
          acc.EffectiveFlags = Number(
            BigInt(acc.EffectiveFlags) | effectiveFlag,
          )
        }
        return acc
      },
      { EffectiveFlags: 0 },
    ) as SetDeviceData<T>
  }

  private getDeviceFromList(): ListDevice<T> | undefined {
    return this.app.deviceList.find(
      (device: ListDevice<MELCloudDriver>): device is ListDevice<T> =>
        device.DeviceID === this.id,
    )
  }

  private async runEnergyReports(): Promise<void> {
    await this.runEnergyReport()
    await this.runEnergyReport(true)
  }

  private async runEnergyReport(total = false): Promise<void> {
    if (!this.reportPlanParameters) {
      return
    }
    const reportCapabilityEntries: [
      TypedString<keyof ReportCapabilities<T>>,
      TypedString<keyof ReportData<T>>[],
    ][] = this.#reportCapabilityEntries[String(total) as BooleanString]
    if (!reportCapabilityEntries.length) {
      this.clearEnergyReportPlan(total)
      return
    }
    const toDate: DateTime = DateTime.now().minus(
      this.reportPlanParameters.minus,
    )
    const fromDate: DateTime = total ? DATETIME_1970 : toDate
    const data: ReportData<T> | null = await this.reportEnergyCost(
      fromDate,
      toDate,
    )
    await this.updateReportCapabilities(data, toDate, total)
    this.planEnergyReport(this.reportPlanParameters, total)
  }

  private async updateReportCapabilities(
    data: ReportData<T> | null,
    toDate: DateTime,
    total = false,
  ): Promise<void> {
    if (!data) {
      return
    }
    const deviceCount: number =
      'UsageDisclaimerPercentages' in data
        ? data.UsageDisclaimerPercentages.split(',').length
        : 1
    await Promise.all(
      this.#reportCapabilityEntries[String(total) as BooleanString].map(
        async <K extends keyof ReportCapabilities<T>>([capability, tags]: [
          TypedString<K>,
          TypedString<keyof ReportData<T>>[],
        ]): Promise<void> => {
          const { producedTags, consumedTags } = tags.reduce<{
            producedTags: TypedString<keyof ReportData<T>>[]
            consumedTags: TypedString<keyof ReportData<T>>[]
          }>(
            (acc, tag: TypedString<keyof ReportData<T>>) => {
              if (tag.endsWith('Consumed')) {
                acc.consumedTags.push(tag)
              } else {
                acc.producedTags.push(tag)
              }
              return acc
            },
            { producedTags: [], consumedTags: [] },
          )
          let value = 0
          switch (true) {
            case capability.includes('cop'):
              value =
                producedTags.reduce<number>(
                  (acc, tag: keyof ReportData<T>) =>
                    acc + (data[tag] as number),
                  0,
                ) /
                (consumedTags.length
                  ? consumedTags.reduce<number>(
                      (acc, tag: keyof ReportData<T>) =>
                        acc + (data[tag] as number),
                      0,
                    )
                  : 1)
              break
            case capability.startsWith('measure_power'):
              value =
                tags.reduce<number>(
                  (acc, tag: keyof ReportData<T>) =>
                    acc + (data[tag] as number[])[toDate.hour] * K_MULTIPLIER,
                  0,
                ) / deviceCount
              break
            default:
              value =
                tags.reduce<number>(
                  (acc, tag: keyof ReportData<T>) =>
                    acc + (data[tag] as number),
                  0,
                ) / deviceCount
          }
          await this.setCapabilityValue(capability, value as Capabilities<T>[K])
        },
      ),
    )
  }

  private planEnergyReport(
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
          interval: { days: 1 },
          duration: { days: 1 },
          values: { hour: 1, minute: 5, second: 0, millisecond: 0 },
        }
      : reportPlanParameters
    this.#reportTimeout[totalString] = this.setTimeout(
      async (): Promise<void> => {
        await this.runEnergyReport(total)
        this.#reportInterval[totalString] = this.setInterval(
          async (): Promise<void> => {
            await this.runEnergyReport(total)
          },
          interval,
          { actionType, units: ['days', 'hours'] },
        )
      },
      DateTime.now().plus(duration).set(values).diffNow(),
      { actionType, units: ['hours', 'minutes'] },
    )
  }

  private async handleCapabilities(): Promise<void> {
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
    this.setSetAndGetCapabilityMappings()
  }

  private async handleOptionalCapabilities(
    newSettings: Settings,
    changedCapabilities: string[],
  ): Promise<void> {
    this.setOptionalCapabilities(newSettings)
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
        (capability: string) => !this.isReportCapability(capability),
      )
    ) {
      this.setListCapabilityMapping()
    }
  }

  private clearEnergyReportPlans(): void {
    this.clearEnergyReportPlan()
    this.clearEnergyReportPlan(true)
  }

  private clearEnergyReportPlan(total = false): void {
    const totalString: BooleanString = String(total) as BooleanString
    this.homey.clearTimeout(this.#reportTimeout[totalString])
    this.homey.clearInterval(this.#reportInterval[totalString])
    this.#reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
  }

  private setOptionalCapabilities(
    settings: Settings = this.getSettings() as Settings,
  ): void {
    this.#optionalCapabilities = Object.keys(settings).filter(
      (setting: string) =>
        this.isCapability(setting) &&
        typeof settings[setting] === 'boolean' &&
        settings[setting],
    )
  }

  private setSetAndGetCapabilityMappings(): void {
    this.#setCapabilityMapping = this.cleanMapping(
      this.driver.setCapabilityMapping as SetCapabilityMapping<T>,
    )
    this.#getCapabilityMapping = this.cleanMapping(
      this.driver.getCapabilityMapping as GetCapabilityMapping<T>,
    )
    this.#setAndGetCapabilityMapping = {
      ...this.#setCapabilityMapping,
      ...this.#getCapabilityMapping,
    }
    this.setListAndOpCapabilityEntries()
  }

  private setListCapabilityMapping(): void {
    this.#listCapabilityMapping = this.cleanMapping(
      this.driver.listCapabilityMapping as ListCapabilityMapping<T>,
    )
    this.setListAndOpCapabilityEntries()
  }

  private setListAndOpCapabilityEntries(): void {
    if (!this.#listCapabilityMapping) {
      this.setListCapabilityMapping()
    }
    this.#syncFromCapabilityEntries = Object.entries(
      this.#listCapabilityMapping as ListCapabilityMapping<T>,
    ).filter(
      ([capability]: [string, ListCapabilityData<T>]) =>
        !(capability in this.#setAndGetCapabilityMapping),
    ) as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
    this.#opCapabilityEntries = Object.entries({
      ...this.#setAndGetCapabilityMapping,
      ...this.#listCapabilityMapping,
    }) as [TypedString<keyof OpCapabilities<T>>, OpCapabilityData<T>][]
  }

  private setReportCapabilityEntries(
    totals: boolean[] | boolean = [false, true],
  ): void {
    ;(Array.isArray(totals) ? totals : [totals]).forEach(
      (total: boolean): void => {
        this.#reportCapabilityEntries[String(total) as BooleanString] =
          Object.entries(
            this.cleanMapping(
              this.driver.reportCapabilityMapping as ReportCapabilityMapping<T>,
            ),
          ).filter(([capability]: [string, keyof ReportData<T>]) =>
            filterEnergyKeys(capability, total),
          ) as [
            TypedString<keyof ReportCapabilities<T>>,
            TypedString<keyof ReportData<T>>[],
          ][]
      },
    )
  }

  private cleanMapping<
    M extends
      | GetCapabilityMapping<T>
      | ListCapabilityMapping<T>
      | ReportCapabilityMapping<T>
      | SetCapabilityMapping<T>,
  >(capabilityMapping: M): Partial<NonNullable<M>> {
    return Object.fromEntries(
      Object.entries(capabilityMapping ?? {}).filter(([capability]) =>
        this.hasCapability(capability),
      ),
    ) as Partial<NonNullable<M>>
  }

  private isCapability(setting: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (this.driver.manifest.capabilities as string[]).includes(setting)
  }

  private isReportCapability(setting: string): boolean {
    return setting in (this.driver.reportCapabilityMapping ?? {})
  }

  protected abstract specificOnCapability<K extends keyof SetCapabilities<T>>(
    capability: K,
    value: SetCapabilities<T>[K],
  ): Promise<void>

  protected abstract convertToDevice<K extends keyof SetCapabilities<T>>(
    capability: K,
    value: NonNullable<SetCapabilities<T>[K]>,
  ): ValueOf<SetDeviceData<T>>

  protected abstract convertFromDevice<K extends keyof OpCapabilities<T>>(
    capability: K,
    value: ValueOf<ListDeviceData<T>>,
  ): OpCapabilities<T>[K]

  protected abstract updateThermostatMode(success: boolean): Promise<void>
}

export default BaseMELCloudDevice
