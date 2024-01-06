import { Device } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import { DateTime } from 'luxon'
import type MELCloudApp from '../app'
import addToLogs from '../decorators/addToLogs'
import withAPI from '../mixins/withAPI'
import withTimers from '../mixins/withTimers'
import type {
  Capability,
  CapabilityValue,
  DeviceDetails,
  DeviceValue,
  GetCapabilityData,
  GetCapabilityMappingAny,
  GetDeviceData,
  ListCapabilityData,
  ListCapabilityMappingAny,
  ListDevice,
  MELCloudDriver,
  NonReportCapability,
  PostData,
  ReportCapability,
  ReportData,
  ReportPlanParameters,
  ReportPostData,
  SetCapability,
  SetCapabilityMappingAny,
  SetCapabilityData,
  SetDeviceData,
  SetDeviceValue,
  SettingKey,
  Settings,
  Store,
  SyncFromMode,
  SyncMode,
  UpdateDeviceData,
} from '../types'

type CombinedCapabilities =
  | ListCapabilityMappingAny
  | (GetCapabilityMappingAny &
      ListCapabilityMappingAny &
      SetCapabilityMappingAny)
  | (GetCapabilityMappingAny & SetCapabilityMappingAny)
type CombinedCapabilityData<T> =
  | ListCapabilityData<T>
  | (GetCapabilityData<T> & ListCapabilityData<T> & SetCapabilityData<T>)
  | (GetCapabilityData<T> & SetCapabilityData<T>)

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

  public data: DeviceDetails['data'] = this.getData() as DeviceDetails['data']

  public id: number = this.data.id

  public buildingid: number = this.data.buildingid

  protected app: MELCloudApp = this.homey.app as MELCloudApp

  protected diff: Map<SetCapability<T>, CapabilityValue> = new Map<
    SetCapability<T>,
    CapabilityValue
  >()

  protected readonly reportPlanParameters: ReportPlanParameters | null = null

  #syncTimeout!: NodeJS.Timeout

  readonly #reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { true: null, false: null }

  readonly #reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } =
    {}

  public async onInit(): Promise<void> {
    await this.setWarning(null)
    await this.handleCapabilities()
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
      (setting: string) => this.isCapability(setting),
    )
    if (changedCapabilities.length) {
      await this.handleDashboardCapabilities(newSettings, changedCapabilities)
      await this.setWarning(this.homey.__('warnings.dashboard'))
    }

    if (
      changedKeys.includes('always_on') &&
      newSettings.always_on === true &&
      !(this.getCapabilityValue('onoff') as boolean)
    ) {
      await this.triggerCapabilityListener('onoff', true)
    } else if (
      changedKeys.some(
        (setting: string) =>
          setting !== 'always_on' &&
          !(setting in (this.driver.reportCapabilityMapping ?? {})),
      )
    ) {
      this.app.applySyncFromDevices()
    }

    const settingsEnergyKeys: string[] = Object.keys(newSettings).filter(
      (setting: string) =>
        typeof newSettings[setting] === 'boolean' &&
        setting in (this.driver.reportCapabilityMapping ?? {}),
    )
    const changedEnergyKeys: string[] = changedKeys.filter((setting: string) =>
      settingsEnergyKeys.includes(setting),
    )
    if (!changedEnergyKeys.length) {
      return
    }
    await Promise.all(
      [false, true].map(async (total: boolean): Promise<void> => {
        const changed: string[] = changedEnergyKeys.filter((setting: string) =>
          filterEnergyKeys(setting, total),
        )
        if (!changed.length) {
          return
        }
        if (changed.some((setting: string) => newSettings[setting])) {
          await this.runEnergyReport(total)
        } else if (
          settingsEnergyKeys.every(
            (setting: string) => !(newSettings[setting] as boolean),
          )
        ) {
          this.clearEnergyReportPlan(total)
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

  public async setCapabilityValue(
    capability: Capability<T> | 'thermostat_mode',
    value: CapabilityValue,
  ): Promise<void> {
    if (!this.hasCapability(capability)) {
      return
    }
    const newValue: CapabilityValue = this.convertFromDevice(capability, value)
    if (newValue !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, newValue)
      this.log('Capability', capability, 'is', newValue)
    }
  }

  public getSetting<K extends SettingKey>(setting: K): Settings[K] {
    return super.getSetting(setting as string) as Settings[K]
  }

  public async setWarning(warning: string | null): Promise<void> {
    if (warning !== null) {
      await super.setWarning(warning)
    }
    await super.setWarning(null)
  }

  protected async setAlwaysOnWarning(): Promise<void> {
    if (this.getSetting('always_on') === true) {
      await this.setWarning(this.homey.__('warnings.always_on'))
    }
  }

  protected async setDisplayErrorWarning(): Promise<void> {
    await this.setWarning(this.homey.__('warnings.display_error'))
  }

  protected async handleCapabilities(): Promise<void> {
    const capabilities: string[] = [
      ...this.driver.getRequiredCapabilities(this.getStore() as Store),
      ...this.getDashboardCapabilities(),
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

  protected getRequestedOrCurrentValue(
    capability: SetCapability<T>,
  ): CapabilityValue {
    return (this.diff.get(capability) ??
      this.getCapabilityValue(capability)) as CapabilityValue
  }

  private async onCapability(
    capability: SetCapability<T> | 'thermostat_mode',
    value: CapabilityValue,
  ): Promise<void> {
    this.clearSync()
    if (capability === 'onoff') {
      await this.setAlwaysOnWarning()
    }
    await this.specificOnCapability(capability, value)
    this.applySyncToDevice()
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

  private getDashboardCapabilities(
    settings: Settings = this.getSettings() as Settings,
  ): string[] {
    return Object.keys(settings).filter(
      (setting: string) => this.isCapability(setting) && settings[setting],
    )
  }

  private getReportCapabilities(
    total = false,
  ): Record<ReportCapability<T>, keyof ReportData<T>> {
    return Object.fromEntries(
      Object.entries(this.driver.reportCapabilityMapping ?? {})
        .filter(
          ([capability]: [string, keyof ReportData<T>]) =>
            this.hasCapability(capability) &&
            filterEnergyKeys(capability, total),
        )
        .map(([capability, tags]: [string, keyof ReportData<T>]) => [
          capability as ReportCapability<T>,
          tags,
        ]),
    ) as Record<ReportCapability<T>, keyof ReportData<T>>
  }

  private registerCapabilityListeners(): void {
    ;[
      ...Object.keys(this.driver.setCapabilityMapping),
      'thermostat_mode',
    ].forEach((capability: string): void => {
      this.registerCapabilityListener(
        capability,
        async (value: CapabilityValue): Promise<void> => {
          await this.onCapability(
            capability as SetCapability<T> | 'thermostat_mode',
            value,
          )
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

  private async updateCapabilities(
    data: GetDeviceData<T> | ListDevice<T>['Device'] | null,
    syncMode?: SyncMode,
  ): Promise<void> {
    if (data?.EffectiveFlags === undefined) {
      return
    }
    const effectiveFlags = BigInt(data.EffectiveFlags)
    const combinedCapabilities = {
      ...this.driver.setCapabilityMapping,
      ...this.driver.getCapabilityMapping,
    }

    const capabilitiesToProcess = (): CombinedCapabilities => {
      switch (syncMode) {
        case 'syncTo':
          return combinedCapabilities
        case 'syncFrom':
          return this.driver.listCapabilityMapping
        default:
          return {
            ...combinedCapabilities,
            ...this.driver.listCapabilityMapping,
          }
      }
    }

    const capabilities: [NonReportCapability<T>, CombinedCapabilityData<T>][] =
      Object.entries(capabilitiesToProcess()) as [
        NonReportCapability<T>,
        CombinedCapabilityData<T>,
      ][]
    const keysToProcessLast: string[] = [
      'operation_mode_state.zone1',
      'operation_mode_state.zone2',
    ]
    const [regularCapabilities, lastCapabilities]: [
      NonReportCapability<T>,
      CombinedCapabilityData<T>,
    ][][] = capabilities.reduce<
      [NonReportCapability<T>, CombinedCapabilityData<T>][][]
    >(
      (
        acc,
        [capability, capabilityData]: [
          NonReportCapability<T>,
          CombinedCapabilityData<T>,
        ],
      ) => {
        if (keysToProcessLast.includes(capability)) {
          acc[1].push([capability, capabilityData])
        } else {
          acc[0].push([capability, capabilityData])
        }
        return acc
      },
      [[], []],
    )

    const shouldProcess = (
      capability: NonReportCapability<T>,
      effectiveFlag?: bigint,
    ): boolean => {
      switch (syncMode) {
        case 'syncTo':
          return (
            effectiveFlag === undefined || !!(effectiveFlag & effectiveFlags)
          )
        case 'syncFrom':
          return !(capability in combinedCapabilities)
        default:
          return true
      }
    }

    const processCapability = async ([capability, { tag, effectiveFlag }]: [
      NonReportCapability<T>,
      CombinedCapabilityData<T>,
    ]): Promise<void> => {
      if (tag in data && shouldProcess(capability, effectiveFlag)) {
        await this.setCapabilityValue(
          capability,
          data[tag as keyof typeof data] as CapabilityValue,
        )
      }
    }

    const processCapabilities = async (
      capabilitiesArray: [NonReportCapability<T>, CombinedCapabilityData<T>][],
    ): Promise<void> => {
      await Promise.all(capabilitiesArray.map(processCapability))
    }

    await processCapabilities(regularCapabilities)
    await processCapabilities(lastCapabilities)
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
    return Object.entries(this.driver.setCapabilityMapping).reduce<
      UpdateDeviceData<T>
    >(
      (
        acc,
        [capability, { tag, effectiveFlag }]: [string, SetCapabilityData<T>],
      ) => {
        if (this.hasCapability(capability)) {
          acc[tag] = this.convertToDevice(
            capability as SetCapability<T>,
            this.getRequestedOrCurrentValue(capability as SetCapability<T>),
          ) as SetDeviceData<T>[Exclude<
            keyof SetDeviceData<T>,
            'EffectiveFlags'
          >]
          if (this.diff.has(capability as SetCapability<T>)) {
            this.diff.delete(capability as SetCapability<T>)
            acc.EffectiveFlags = Number(
              BigInt(acc.EffectiveFlags) | effectiveFlag,
            )
          }
        }
        return acc
      },
      { EffectiveFlags: 0 },
    ) as SetDeviceData<T>
  }

  private getDeviceFromList(): ListDevice<T> | undefined {
    return this.app.deviceList.find(
      (device: ListDevice<MELCloudDriver>) => device.DeviceID === this.id,
    ) as ListDevice<T> | undefined
  }

  private async runEnergyReports(): Promise<void> {
    await this.runEnergyReport()
    await this.runEnergyReport(true)
  }

  private async runEnergyReport(total = false): Promise<void> {
    const reportCapabilities: Record<
      ReportCapability<T>,
      keyof ReportData<T>
    > = this.getReportCapabilities(total)
    if (!this.reportPlanParameters || !Object.keys(reportCapabilities).length) {
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
    await this.updateReportCapabilities(data, toDate, reportCapabilities)
    this.planEnergyReport(total)
  }

  private async updateReportCapabilities(
    data: ReportData<T> | null,
    toDate: DateTime,
    reportCapabilities: Record<ReportCapability<T>, keyof ReportData<T>>,
  ): Promise<void> {
    if (!data) {
      return
    }
    const deviceCount: number =
      'UsageDisclaimerPercentages' in data
        ? data.UsageDisclaimerPercentages.split(',').length
        : 1

    const updateReportCapability = async ([capability, tags]: [
      ReportCapability<T>,
      (keyof ReportData<T>)[],
    ]): Promise<void> => {
      const reportValue = (): number => {
        const consumedTags: (keyof ReportData<T>)[] = tags.filter(
          (tag: keyof ReportData<T>) => (tag as string).endsWith('Consumed'),
        )
        switch (true) {
          case capability.includes('cop'):
            return (
              tags
                .filter(
                  (tag: keyof ReportData<T>) =>
                    !(tag as string).endsWith('Consumed'),
                )
                .reduce<number>(
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
            )
          case capability.startsWith('measure_power'):
            return (
              tags.reduce<number>(
                (acc, tag: keyof ReportData<T>) =>
                  acc + (data[tag] as number[])[toDate.hour] * K_MULTIPLIER,
                0,
              ) / deviceCount
            )
          default:
            return (
              tags.reduce<number>(
                (acc, tag: keyof ReportData<T>) => acc + (data[tag] as number),
                0,
              ) / deviceCount
            )
        }
      }
      await this.setCapabilityValue(
        capability as Capability<T> & ReportCapability<T>,
        reportValue(),
      )
    }

    await Promise.all(
      (
        Object.entries(reportCapabilities) as [
          ReportCapability<T>,
          (keyof ReportData<T>)[],
        ][]
      ).map(updateReportCapability),
    )
  }

  private planEnergyReport(total = false): void {
    const totalString: 'false' | 'true' = total ? 'true' : 'false'
    if (!this.reportPlanParameters || this.#reportTimeout[totalString]) {
      return
    }
    const actionType = `${total ? 'total' : 'regular'} energy report`
    const { interval, duration, values } = total
      ? {
          interval: { days: 1 },
          duration: { days: 1 },
          values: { hour: 1, minute: 5, second: 0, millisecond: 0 },
        }
      : this.reportPlanParameters
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

  private async handleDashboardCapabilities(
    newSettings: Settings,
    changedCapabilities: string[],
  ): Promise<void> {
    await changedCapabilities
      .filter(
        (capability: string) => typeof newSettings[capability] === 'boolean',
      )
      .reduce<Promise<void>>(async (acc, capability: string) => {
        await acc
        if (newSettings[capability] as boolean) {
          await this.addCapability(capability)
        } else {
          await this.removeCapability(capability)
        }
      }, Promise.resolve())
  }

  private clearEnergyReportPlans(): void {
    this.clearEnergyReportPlan()
    this.clearEnergyReportPlan(true)
  }

  private clearEnergyReportPlan(total = false): void {
    const totalString: 'false' | 'true' = total ? 'true' : 'false'
    this.homey.clearTimeout(this.#reportTimeout[totalString])
    this.homey.clearInterval(this.#reportInterval[totalString])
    this.#reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
  }

  private isCapability(setting: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (this.driver.manifest.capabilities as string[]).includes(setting)
  }

  protected abstract specificOnCapability(
    capability: SetCapability<MELCloudDriver> | 'thermostat_mode',
    value: CapabilityValue,
  ): Promise<void>

  protected abstract convertToDevice(
    capability: SetCapability<MELCloudDriver>,
    value: CapabilityValue,
  ): SetDeviceValue

  protected abstract convertFromDevice(
    capability: Capability<T> | 'thermostat_mode',
    value: DeviceValue,
  ): CapabilityValue

  protected abstract updateThermostatMode(success: boolean): Promise<void>
}

export default BaseMELCloudDevice
