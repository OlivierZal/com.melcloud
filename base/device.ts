// eslint-disable-next-line import/no-extraneous-dependencies
import { Device } from 'homey'
import { DateTime } from 'luxon'
import type MELCloudApp from '../app'
import WithCustomLogging from '../mixin'
import type {
  Capability,
  CapabilityValue,
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
  Settings,
  SettingValue,
  SyncFromMode,
  SyncMode,
  UpdateDeviceData,
} from '../types'

export default abstract class BaseMELCloudDevice extends WithCustomLogging(
  Device
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

    const { id, buildingid } = this.getData()
    this.id = id
    this.buildingid = buildingid
    this.diff = new Map<SetCapability<T>, CapabilityValue>()

    await this.handleCapabilities()
    this.registerCapabilityListeners()
    this.app.applySyncFromDevices()

    await this.runEnergyReports()
  }

  async setDeviceData<T extends MELCloudDriver>(
    updateData: SetDeviceData<T>
  ): Promise<GetDeviceData<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: this.id,
        HasPendingCommand: true,
        ...updateData,
      }
      const { data } = await this.axios.post<GetDeviceData<T>>(
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
      const { data } = await this.axios.post<ReportData<T>>(
        '/EnergyCost/Report',
        postData
      )
      return data
    } catch (error: unknown) {
      return null
    }
  }

  isDiff(): boolean {
    return this.diff.size > 0
  }

  getDashboardCapabilities(settings: Settings = this.getSettings()): string[] {
    return Object.keys(settings).filter(
      (setting: string): boolean => settings[setting] === true
    )
  }

  getReportCapabilities<T extends MELCloudDriver>(
    total = false
  ): Record<ReportCapability<T>, ReportCapabilityMapping<T>> {
    return Object.entries(this.driver.reportCapabilityMapping).reduce<
      Partial<Record<ReportCapability<T>, ReportCapabilityMapping<T>>>
    >(
      (
        reportCapabilities,
        [capability, tags]: [string, ReportCapabilityMapping<T>]
      ) => {
        const newReportCapabilities: Partial<
          Record<ReportCapability<T>, ReportCapabilityMapping<T>>
        > = { ...reportCapabilities }
        if (
          this.hasCapability(capability) &&
          capability.includes('total') === total
        ) {
          newReportCapabilities[capability as ReportCapability<T>] = tags
        }
        return newReportCapabilities
      },
      {}
    ) as Record<ReportCapability<T>, ReportCapabilityMapping<T>>
  }

  async handleCapabilities(): Promise<void> {
    const requiredCapabilities: string[] = [
      ...this.driver.getRequiredCapabilities(this.getStore()),
      ...this.getDashboardCapabilities(),
    ]
    await Promise.all(
      requiredCapabilities.map(async (capability: string): Promise<void> => {
        await this.addCapability(capability)
      })
    )
    await Promise.all(
      this.getCapabilities().map(async (capability: string): Promise<void> => {
        if (!requiredCapabilities.includes(capability)) {
          await this.removeCapability(capability)
        }
      })
    )
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
    if (this.getSetting('always_on') === true) {
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
    const updateData: SetDeviceData<T> = this.buildUpdateData()
    const data: GetDeviceData<T> | null = await this.setDeviceData(updateData)
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
        if (!this.hasCapability(capability)) {
          return acc
        }
        acc[tag] = this.convertToDevice(
          capability as SetCapability<T>,
          this.diff.get(capability as SetCapability<T>)
        ) as SetDeviceData<T>[Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>]
        if (this.diff.has(capability as SetCapability<T>)) {
          this.diff.delete(capability as SetCapability<T>)
          acc.EffectiveFlags = Number(
            BigInt(acc.EffectiveFlags) | effectiveFlag
          )
        }
        return acc
      },
      { EffectiveFlags: 0 }
    ) as SetDeviceData<T>
  }

  convertToDevice(
    capability: SetCapability<MELCloudDriver>,
    value: CapabilityValue = this.getCapabilityValue(capability)
  ): boolean | number {
    if (capability === 'onoff') {
      return this.getSetting('always_on') === true ? true : (value as boolean)
    }
    return value as boolean | number
  }

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
            effectiveFlag === undefined ||
            Boolean(effectiveFlag & effectiveFlags)
          )
        case 'syncFrom':
          return !(capability in combinedCapabilities)
        default:
          return true
      }
    }

    const processCapability = async (
      capability: NonReportCapability<T>,
      tag: Exclude<keyof ListDeviceData<T>, 'EffectiveFlags'>,
      effectiveFlag?: bigint
    ): Promise<void> => {
      if (shouldProcess(capability, effectiveFlag)) {
        await this.convertFromDevice(capability, data[tag] as boolean | number)
      }
    }

    const processCapabilities = async (
      capabilitiesArray: [NonReportCapability<T>, ListCapabilityMapping<T>][]
    ): Promise<void> => {
      await Promise.all(
        capabilitiesArray.map(
          async ([capability, { tag, effectiveFlag }]: [
            NonReportCapability<T>,
            ListCapabilityMapping<T>
          ]): Promise<void> => {
            await processCapability(capability, tag, effectiveFlag)
          }
        )
      )
    }

    await processCapabilities(regularCapabilities)
    await processCapabilities(lastCapabilities)
  }

  abstract convertFromDevice(
    capability: Capability<MELCloudDriver>,
    value: boolean | number
  ): Promise<void>

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
      (device: ListDeviceAny): boolean => device.DeviceID === this.id
    ) as ListDevice<T> | undefined
  }

  abstract updateStore<T extends MELCloudDriver>(
    data: ListDeviceData<T> | null
  ): Promise<void>

  async runEnergyReports(): Promise<void> {
    await this.runEnergyReport()
    await this.runEnergyReport(true)
  }

  async runEnergyReport<T extends MELCloudDriver>(
    total = false
  ): Promise<void> {
    const reportCapabilities: Record<
      string,
      ReportCapabilityMapping<T>
    > = this.getReportCapabilities(total)
    if (Object.keys(reportCapabilities).length === 0) {
      return
    }
    const toDate = DateTime.now().minus(this.reportPlanParameters.minus)
    const fromDate: DateTime = total ? DateTime.local(1970) : toDate
    const data: ReportData<T> | null = await this.reportEnergyCost(
      fromDate,
      toDate
    )
    if (data !== null) {
      const deviceCount: number =
        'UsageDisclaimerPercentages' in data
          ? data.UsageDisclaimerPercentages.split(',').length
          : 1
      await Promise.all(
        Object.entries(reportCapabilities).map(
          async ([capability, tags]: [
            string,
            ReportCapabilityMapping<T>
          ]): Promise<void> => {
            await this.updateReportCapability(
              data,
              capability as ReportCapability<T>,
              tags,
              deviceCount,
              toDate
            )
          }
        )
      )
    }
    this.planEnergyReport(total)
  }

  async updateReportCapability<T extends MELCloudDriver>(
    data: ReportData<T>,
    capability: ReportCapability<T>,
    tags: ReportCapabilityMapping<T>,
    deviceCount: number,
    toDate: DateTime
  ): Promise<void> {
    const reportValue = (): number => {
      if (capability.includes('cop')) {
        return (
          (data[tags[0]] as number) /
          (tags.length > 1 ? (data[tags[1]] as number) : 1)
        )
      }
      return (
        tags.reduce<number>(
          (sum, tag: keyof ReportData<T>) =>
            sum +
            (capability.includes('measure_power')
              ? (data[tag] as number[])[toDate.hour] * 1000
              : (data[tag] as number)),
          0
        ) / deviceCount
      )
    }
    await this.setCapabilityValue(capability, reportValue())
  }

  planEnergyReport(total = false): void {
    const totalString: 'true' | 'false' = total ? 'true' : 'false'
    if (this.reportTimeout[totalString] !== null) {
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
    changedKeys: string[]
    newSettings: Settings
  }): Promise<void> {
    if (
      changedKeys.some(
        (setting: string): boolean => !['always_on'].includes(setting)
      )
    ) {
      await this.handleDashboardCapabilities(newSettings, changedKeys)
      await this.setWarning(this.homey.__('warnings.dashboard'))
      await this.setWarning(null)
    }

    if (changedKeys.includes('always_on') && newSettings.always_on === true) {
      await this.onCapability('onoff', true)
    } else if (
      changedKeys.some(
        (setting: string): boolean =>
          setting !== 'always_on' &&
          !(setting in this.driver.reportCapabilityMapping)
      )
    ) {
      this.app.applySyncFromDevices()
    }

    const changedEnergyKeys: string[] = changedKeys.filter(
      (setting: string): boolean =>
        setting in this.driver.reportCapabilityMapping
    )
    if (changedEnergyKeys.length === 0) {
      return
    }
    await Promise.all(
      [false, true].map(async (total: boolean): Promise<void> => {
        const changed: string[] = changedEnergyKeys.filter(
          (setting: string): boolean => setting.includes('total') === total
        )
        if (changed.length === 0) {
          return
        }
        if (
          changed.some(
            (setting: string): boolean => newSettings[setting] === true
          )
        ) {
          await this.runEnergyReport(total)
        } else if (
          Object.entries(newSettings).every(
            ([setting, value]: [string, SettingValue]): boolean =>
              !(setting in this.driver.reportCapabilityMapping) ||
              value === false
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
    await Promise.all(
      changedCapabilities.map(async (capability: string): Promise<void> => {
        if (newSettings[capability] === true) {
          await this.addCapability(capability)
          return
        }
        await this.removeCapability(capability)
      })
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
    if (!this.hasCapability(capability)) {
      await super
        .addCapability(capability)
        .then((): void => {
          this.log('Adding capability', capability)
        })
        .catch((error: Error): void => {
          this.error(error.message)
        })
    }
  }

  async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super
        .removeCapability(capability)
        .then((): void => {
          this.log('Removing capability', capability)
        })
        .catch((error: Error): void => {
          this.error(error.message)
        })
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
      await super
        .setCapabilityValue(capability, value)
        .then((): void => {
          this.log('Capability', capability, 'is', value)
        })
        .catch((error: Error): void => {
          this.error(error.message)
        })
    }
  }
}
