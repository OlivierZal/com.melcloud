import { Device } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import { DateTime } from 'luxon'
import type MELCloudApp from '../app'
import WithAPI from '../mixins/api'
import WithTimers from '../mixins/timers'
import type {
  CapabilityValue,
  DeviceDetails,
  DeviceValue,
  ExtendedCapability,
  ExtendedSetCapability,
  GetDeviceData,
  ListCapabilityMapping,
  ListDevice,
  ListDeviceAny,
  ListDeviceData,
  MELCloudDriver,
  NonReportCapability,
  PostData,
  ReportCapability,
  ReportCapabilityMapping,
  ReportData,
  ReportPostData,
  SetCapability,
  SetCapabilityMapping,
  SetDeviceData,
  SetDeviceValue,
  Settings,
  SettingValue,
  Store,
  SyncFromMode,
  SyncMode,
  UpdateDeviceData,
} from '../types'

export default abstract class BaseMELCloudDevice extends WithAPI(
  WithTimers(Device)
) {
  app!: MELCloudApp

  declare driver: MELCloudDriver

  id!: number

  buildingid!: number

  diff!: Map<SetCapability<MELCloudDriver>, CapabilityValue>

  syncTimeout!: NodeJS.Timeout

  reportTimeout: {
    false: NodeJS.Timeout | null
    true: NodeJS.Timeout | null
  } = { true: null, false: null }

  reportInterval: { false?: NodeJS.Timeout; true?: NodeJS.Timeout } = {}

  reportPlanParameters!: {
    duration: object
    interval: object
    minus: object
    values: object
  }

  async onInit<T extends MELCloudDriver>(): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const { id, buildingid } = this.getData() as DeviceDetails['data']
    this.id = id
    this.buildingid = buildingid
    this.diff = new Map<SetCapability<T>, CapabilityValue>()

    await this.handleCapabilities()
    this.registerCapabilityListeners()
    this.app.applySyncFromDevices()

    await this.runEnergyReports()
  }

  async setDeviceData<T extends MELCloudDriver>(
  ): Promise<GetDeviceData<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: this.id,
        HasPendingCommand: true,
        ...this.buildUpdateData(),
      }
      const { data } = await this.api.post<GetDeviceData<T>>(
        `/Device/Set${this.driver.heatPumpType}`,
        postData
      )
      return data
    } catch (error: unknown) {
      return null
    }
  }

  async reportEnergyCost<T extends MELCloudDriver>(
    fromDate: DateTime,
    toDate: DateTime
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
        postData
      )
      return data
    } catch (error: unknown) {
      return null
    }
  }

  isDiff(): boolean {
    return !!this.diff.size
  }

  getDashboardCapabilities(
    settings: Settings = this.getSettings() as Settings
  ): string[] {
    return Object.keys(settings).filter(
      (setting: string) => this.isCapability(setting) && settings[setting]
    )
  }

  getReportCapabilities<T extends MELCloudDriver>(
    total = false
  ): Record<ReportCapability<T>, ReportCapabilityMapping<T>> {
    return Object.fromEntries(
      Object.entries(this.driver.reportCapabilityMapping)
        .filter(
          ([capability]: [string, ReportCapabilityMapping<T>]) =>
            this.hasCapability(capability) &&
            capability.includes('total') === total
        )
        .map(([capability, tags]: [string, ReportCapabilityMapping<T>]) => [
          capability as ReportCapability<T>,
          tags,
        ])
    ) as Record<ReportCapability<T>, ReportCapabilityMapping<T>>
  }

  async handleCapabilities(): Promise<void> {
    const requiredCapabilities: string[] = [
      ...this.driver.getRequiredCapabilities(this.getStore() as Store),
      ...this.getDashboardCapabilities(),
    ]
    await requiredCapabilities.reduce<Promise<void>>(
      async (acc, capability: string) => {
        await acc
        return this.addCapability(capability)
      },
      Promise.resolve()
    )
    await this.getCapabilities()
      .filter(
        (capability: string) => !requiredCapabilities.includes(capability)
      )
      .reduce<Promise<void>>(async (acc, capability: string) => {
        await acc
        await this.removeCapability(capability)
      }, Promise.resolve())
  }

  registerCapabilityListeners<T extends MELCloudDriver>(): void {
    ;[
      ...Object.keys(this.driver.setCapabilityMapping),
      'thermostat_mode',
    ].forEach((capability: string): void => {
      this.registerCapabilityListener(
        capability,
        async (value: CapabilityValue): Promise<void> => {
          await this.onCapability(capability as ExtendedSetCapability<T>, value)
        }
      )
    })
  }

  async onCapability<T extends MELCloudDriver>(
    capability: ExtendedSetCapability<T>,
    value: CapabilityValue
  ): Promise<void> {
    this.clearSync()
    if (capability === 'onoff') {
      await this.setAlwaysOnWarning()
    }
    await this.specificOnCapability(capability, value)
    this.applySyncToDevice()
  }

  abstract specificOnCapability(
    capability: ExtendedSetCapability<MELCloudDriver>,
    value: CapabilityValue
  ): Promise<void>

  clearSync(): void {
    this.app.clearListDevicesRefresh()
    this.homey.clearTimeout(this.syncTimeout)
    this.log('Sync with device has been paused')
  }

  async setAlwaysOnWarning(): Promise<void> {
    if (this.getSetting('always_on')) {
      await this.setWarning(this.homey.__('warnings.always_on'))
      await this.setWarning(null)
    }
  }

  async setDisplayErrorWarning(): Promise<void> {
    await this.setWarning(this.homey.__('warnings.display_error'))
    await this.setWarning(null)
  }

  applySyncToDevice(): void {
    this.syncTimeout = this.setTimeout(
      'sync with device',
      async (): Promise<void> => {
        await this.syncToDevice()
      },
      { seconds: 1 },
      'seconds'
    )
  }

  async syncToDevice<T extends MELCloudDriver>(): Promise<void> {
    const data: GetDeviceData<T> | null = await this.setDeviceData()
    await this.endSync(data, 'syncTo')
  }

  buildUpdateData<T extends MELCloudDriver>(): SetDeviceData<T> {
    return Object.entries(this.driver.setCapabilityMapping).reduce<
      UpdateDeviceData<T>
    >(
      (
        acc,
        [capability, { tag, effectiveFlag }]: [string, SetCapabilityMapping<T>]
      ) => {
        if (this.hasCapability(capability)) {
          acc[tag] = this.convertToDevice(
            capability as SetCapability<T>,
            this.diff.get(capability as SetCapability<T>)
          ) as SetDeviceData<T>[Exclude<
            keyof SetDeviceData<T>,
            'EffectiveFlags'
          >]
          if (this.diff.has(capability as SetCapability<T>)) {
            this.diff.delete(capability as SetCapability<T>)
            acc.EffectiveFlags = Number(
              BigInt(acc.EffectiveFlags) | effectiveFlag
            )
          }
        }
        return acc
      },
      { EffectiveFlags: 0 }
    ) as SetDeviceData<T>
  }

  abstract convertToDevice(
    capability: SetCapability<MELCloudDriver>,
    value?: CapabilityValue
  ): SetDeviceValue

  async endSync<T extends MELCloudDriver>(
    data: Partial<ListDeviceData<T>> | null,
    syncMode?: SyncMode
  ): Promise<void> {
    await this.updateCapabilities(data, syncMode)
    await this.updateThermostatMode()
    if (syncMode === 'syncTo' && !this.isDiff()) {
      this.app.applySyncFromDevices(undefined, 'syncFrom')
    }
  }

  async updateCapabilities<T extends MELCloudDriver>(
    data: Partial<ListDeviceData<T>> | null,
    syncMode?: SyncMode
  ): Promise<void> {
    if (data?.EffectiveFlags === undefined) {
      return
    }
    const effectiveFlags = BigInt(data.EffectiveFlags)
    const combinedCapabilities = {
      ...this.driver.setCapabilityMapping,
      ...this.driver.getCapabilityMapping,
    }

    const capabilitiesToProcess = () => {
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

    const capabilities: [NonReportCapability<T>, ListCapabilityMapping<T>][] =
      Object.entries(capabilitiesToProcess()) as [
        NonReportCapability<T>,
        ListCapabilityMapping<T>
      ][]
    const keysToProcessLast: string[] = [
      'operation_mode_state.zone1',
      'operation_mode_state.zone2',
    ]
    const [regularCapabilities, lastCapabilities]: [
      NonReportCapability<T>,
      ListCapabilityMapping<T>
    ][][] = capabilities.reduce<
      [NonReportCapability<T>, ListCapabilityMapping<T>][][]
    >(
      (
        acc,
        [capability, capabilityData]: [
          NonReportCapability<T>,
          ListCapabilityMapping<T>
        ]
      ) => {
        if (keysToProcessLast.includes(capability)) {
          acc[1].push([capability, capabilityData])
        } else {
          acc[0].push([capability, capabilityData])
        }
        return acc
      },
      [[], []]
    )

    const shouldProcess = (
      capability: NonReportCapability<T>,
      effectiveFlag?: bigint
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
      ListCapabilityMapping<T>
    ]): Promise<void> => {
      if (shouldProcess(capability, effectiveFlag)) {
        await this.setCapabilityValue(capability, data[tag] as DeviceValue)
      }
    }

    const processCapabilities = async (
      capabilitiesArray: [NonReportCapability<T>, ListCapabilityMapping<T>][]
    ): Promise<void> => {
      await Promise.all(capabilitiesArray.map(processCapability))
    }

    await processCapabilities(regularCapabilities)
    await processCapabilities(lastCapabilities)
  }

  abstract convertFromDevice(
    capability: ExtendedCapability<MELCloudDriver>,
    value: DeviceValue
  ): CapabilityValue

  abstract updateThermostatMode(): Promise<void>

  async syncDeviceFromList<T extends MELCloudDriver>(
    syncMode?: SyncFromMode
  ): Promise<void> {
    const deviceFromList: ListDevice<T> | undefined = this.getDeviceFromList()
    const data: ListDeviceData<T> | null = deviceFromList?.Device ?? null
    this.log('Syncing from device list:', data)
    await this.updateStore(data)
    await this.endSync(data, syncMode)
  }

  getDeviceFromList<T extends MELCloudDriver>(): ListDevice<T> | undefined {
    return this.app.deviceList.find(
      (device: ListDeviceAny) => device.DeviceID === this.id
    ) as ListDevice<T> | undefined
  }

  async updateStore<T extends MELCloudDriver>(
    data: ListDeviceData<T> | null
  ): Promise<void> {
    if (!data) {
      return
    }
    const { CanCool, HasZone2 } = this.getStore() as Store
    const updates = await Promise.all(
      Object.entries({ CanCool, HasZone2 })
        .filter(
          ([key, value]: [string, boolean]) =>
            value !== data[key as keyof Store]
        )
        .map(async ([key]: [string, boolean]): Promise<boolean> => {
          await this.setStoreValue(key, data[key as keyof Store])
          return true
        })
    )
    if (updates.some(Boolean)) {
      await this.handleCapabilities()
    }
  }

  async runEnergyReports(): Promise<void> {
    await this.runEnergyReport()
    await this.runEnergyReport(true)
  }

  async runEnergyReport<T extends MELCloudDriver>(
    total = false
  ): Promise<void> {
    const reportCapabilities: Record<
      ReportCapability<T>,
      ReportCapabilityMapping<T>
    > = this.getReportCapabilities(total)
    if (!Object.keys(reportCapabilities).length) {
      return
    }
    const toDate: DateTime = DateTime.now().minus(
      this.reportPlanParameters.minus
    )
    const fromDate: DateTime = total ? DateTime.local(1970) : toDate
    const data: ReportData<T> | null = await this.reportEnergyCost(
      fromDate,
      toDate
    )
    await this.updateReportCapabilities(data, toDate, reportCapabilities)
    this.planEnergyReport(total)
  }

  async updateReportCapabilities<T extends MELCloudDriver>(
    data: ReportData<T> | null,
    toDate: DateTime,
    reportCapabilities: Record<ReportCapability<T>, ReportCapabilityMapping<T>>
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
      ReportCapabilityMapping<T>
    ]): Promise<void> => {
      const reportValue = (): number => {
        if (capability.includes('cop')) {
          return (
            (data[tags[0]] as number) /
            (tags.length > 1 ? (data[tags[1]] as number) : 1)
          )
        }
        return (
          tags.reduce<number>(
            (acc, tag: keyof ReportData<T>) =>
              acc +
              (capability.includes('measure_power')
                ? (data[tag] as number[])[toDate.hour] * 1000
                : (data[tag] as number)),
            0
          ) / deviceCount
        )
      }
      await this.setCapabilityValue(capability, reportValue())
    }

    await Promise.all(
      (
        Object.entries(reportCapabilities) as [
          ReportCapability<T>,
          ReportCapabilityMapping<T>
        ][]
      ).map(updateReportCapability)
    )
  }

  planEnergyReport(total = false): void {
    const totalString: 'true' | 'false' = total ? 'true' : 'false'
    if (this.reportTimeout[totalString]) {
      return
    }
    const type = `${total ? 'total' : 'regular'} energy report`
    const { interval, duration, values } = total
      ? {
          interval: { days: 1 },
          duration: { days: 1 },
          values: { hour: 1, minute: 5, second: 0, millisecond: 0 },
        }
      : this.reportPlanParameters
    this.reportTimeout[totalString] = this.setTimeout(
      type,
      async (): Promise<void> => {
        await this.runEnergyReport(total)
        this.reportInterval[totalString] = this.setInterval(
          type,
          async (): Promise<void> => {
            await this.runEnergyReport(total)
          },
          interval,
          'days',
          'hours'
        )
      },
      DateTime.now().plus(duration).set(values).diffNow(),
      'hours',
      'minutes'
    )
  }

  async onSettings({
    newSettings,
    changedKeys,
  }: {
    newSettings: Settings
    changedKeys: string[]
  }): Promise<void> {
    const changedCapabilities: string[] = changedKeys.filter(
      (setting: string) => this.isCapability(setting)
    )
    if (changedCapabilities.length) {
      await this.handleDashboardCapabilities(newSettings, changedCapabilities)
      await this.setWarning(this.homey.__('warnings.dashboard'))
      await this.setWarning(null)
    }

    if (changedKeys.includes('always_on') && newSettings.always_on) {
      await this.onCapability('onoff', true)
    } else if (
      changedKeys.some(
        (setting: string) =>
          setting !== 'always_on' &&
          !(setting in this.driver.reportCapabilityMapping)
      )
    ) {
      this.app.applySyncFromDevices()
    }

    const changedEnergyKeys: string[] = changedKeys.filter(
      (setting: string) => setting in this.driver.reportCapabilityMapping
    )
    if (!changedEnergyKeys.length) {
      return
    }
    await Promise.all(
      [false, true].map(async (total: boolean): Promise<void> => {
        const changed: string[] = changedEnergyKeys.filter(
          (setting: string) => setting.includes('total') === total
        )
        if (!changed.length) {
          return
        }
        if (changed.some((setting: string) => newSettings[setting])) {
          await this.runEnergyReport(total)
        } else if (
          Object.entries(newSettings).every(
            ([setting, value]: [string, SettingValue]) =>
              !(setting in this.driver.reportCapabilityMapping) || !value
          )
        ) {
          this.clearEnergyReportPlan(total)
        }
      })
    )
  }

  async handleDashboardCapabilities(
    newSettings: Settings,
    changedCapabilities: string[]
  ): Promise<void> {
    await changedCapabilities.reduce<Promise<void>>(
      async (acc, capability: string) => {
        await acc
        if (newSettings[capability]) {
          await this.addCapability(capability)
        } else {
          await this.removeCapability(capability)
        }
      },
      Promise.resolve()
    )
  }

  clearEnergyReportPlans(): void {
    this.clearEnergyReportPlan()
    this.clearEnergyReportPlan(true)
  }

  clearEnergyReportPlan(total = false): void {
    const totalString: 'true' | 'false' = total ? 'true' : 'false'
    this.homey.clearTimeout(this.reportTimeout[totalString])
    this.homey.clearInterval(this.reportInterval[totalString])
    this.reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
  }

  onDeleted(): void {
    this.clearSync()
    this.clearEnergyReportPlans()
  }

  async addCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      return
    }
    try {
      await super.addCapability(capability)
      this.log('Adding capability', capability)
    } catch (error: unknown) {
      this.error(error instanceof Error ? error.message : error)
    }
  }

  async removeCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      return
    }
    try {
      await super.removeCapability(capability)
      this.log('Removing capability', capability)
    } catch (error: unknown) {
      this.error(error instanceof Error ? error.message : error)
    }
  }

  async setCapabilityValue<T extends MELCloudDriver>(
    capability: ExtendedCapability<T>,
    value: CapabilityValue
  ): Promise<void> {
    if (
      this.hasCapability(capability) &&
      value !== this.getCapabilityValue(capability)
    ) {
      try {
        await super.setCapabilityValue(
          capability,
          this.convertFromDevice(capability, value)
        )
        this.log('Capability', capability, 'is', value)
      } catch (error: unknown) {
        this.error(error instanceof Error ? error.message : error)
      }
    }
  }

  isCapability(setting: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return this.driver.manifest.capabilities.includes(setting)
  }

  /* eslint-disable @typescript-eslint/no-unsafe-argument */
  error(...args: any[]): void {
    this.customLog('error', ...args)
  }

  log(...args: any[]): void {
    this.customLog('log', ...args)
  }

  customLog(method: 'log' | 'error', ...args: any[]): void {
    super[method](this.getName(), '-', ...args)
  }
  /* eslint-enable @typescript-eslint/no-unsafe-argument */
}
