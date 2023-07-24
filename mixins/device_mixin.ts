// eslint-disable-next-line import/no-extraneous-dependencies
import { Device } from 'homey'
import axios from 'axios'
import { DateTime, Duration, type DurationLikeObject } from 'luxon'
import type MELCloudApp from '../app'
import type MELCloudDeviceAta from '../drivers/melcloud/device'
import type MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import type {
  NonReportCapability,
  Capability,
  CapabilityValue,
  ExtendedCapability,
  ExtendedSetCapability,
  GetCapability,
  GetCapabilityMapping,
  GetDeviceData,
  ListCapability,
  ListCapabilityMapping,
  ReportCapabilityMapping,
  ListDevice,
  ListDeviceData,
  MELCloudDevice,
  MELCloudDriver,
  PostData,
  ReportCapability,
  ReportData,
  ReportPostData,
  SetCapability,
  SetCapabilityMapping,
  SetDeviceData,
  Settings,
  SettingValue,
  SyncFromMode,
  SyncMode,
} from '../types'

export default class MELCloudDeviceMixin extends Device {
  app!: MELCloudApp

  declare driver: MELCloudDriver

  setCapabilityMapping!:
    | Record<
        SetCapability<MELCloudDeviceAta>,
        SetCapabilityMapping<MELCloudDeviceAta>
      >
    | Record<
        SetCapability<MELCloudDeviceAtw>,
        SetCapabilityMapping<MELCloudDeviceAtw>
      >

  getCapabilityMapping!:
    | Record<
        GetCapability<MELCloudDeviceAta>,
        GetCapabilityMapping<MELCloudDeviceAta>
      >
    | Record<
        GetCapability<MELCloudDeviceAtw>,
        GetCapabilityMapping<MELCloudDeviceAtw>
      >

  listCapabilityMapping!:
    | Record<
        ListCapability<MELCloudDeviceAta>,
        ListCapabilityMapping<MELCloudDeviceAta>
      >
    | Record<
        ListCapability<MELCloudDeviceAtw>,
        ListCapabilityMapping<MELCloudDeviceAtw>
      >

  reportCapabilityMapping!:
    | Record<
        ReportCapability<MELCloudDeviceAta>,
        ReportCapabilityMapping<MELCloudDeviceAta>
      >
    | Record<
        ReportCapability<MELCloudDeviceAtw>,
        ReportCapabilityMapping<MELCloudDeviceAtw>
      >

  id!: number

  buildingid!: number

  diff!: Map<
    SetCapability<MELCloudDeviceAta> | SetCapability<MELCloudDeviceAtw>,
    CapabilityValue
  >

  syncTimeout!: NodeJS.Timeout

  reportTimeout!: { false: NodeJS.Timeout | null; true: NodeJS.Timeout | null }

  reportInterval!: { false?: NodeJS.Timeout; true?: NodeJS.Timeout }

  reportPlanParameters!: {
    duration: object
    interval: object
    minus: object
    values: object
  }

  async onInit<T extends MELCloudDevice>(): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const { id, buildingid } = this.getData()
    this.id = id
    this.buildingid = buildingid
    this.diff = new Map<SetCapability<T>, CapabilityValue>()

    await this.handleCapabilities()
    this.registerCapabilityListeners()
    this.app.applySyncFromDevices()

    this.reportTimeout = { true: null, false: null }
    this.reportInterval = {}
    await this.runEnergyReports()
  }

  async setDeviceData<T extends MELCloudDevice>(
    updateData: SetDeviceData<T>
  ): Promise<GetDeviceData<T> | null> {
    try {
      const postData: PostData<T> = {
        DeviceID: this.id,
        HasPendingCommand: true,
        ...updateData,
      }
      this.log('Syncing with device...\n', postData)
      const { data } = await axios.post<GetDeviceData<T>>(
        `/Device/Set${this.driver.heatPumpType}`,
        postData
      )
      this.log('Syncing with device:\n', data)
      return data
    } catch (error: unknown) {
      this.error(
        'Syncing with device:',
        error instanceof Error ? error.message : error
      )
    }
    return null
  }

  async reportEnergyCost<T extends MELCloudDevice>(
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
      this.log('Reporting energy...\n', postData)
      const { data } = await axios.post<ReportData<T>>(
        '/EnergyCost/Report',
        postData
      )
      this.log('Reporting energy:\n', data)
      return data
    } catch (error: unknown) {
      this.error(
        'Reporting energy:',
        error instanceof Error ? error.message : error
      )
    }
    return null
  }

  isDiff(): boolean {
    return this.diff.size > 0
  }

  getDashboardCapabilities(settings: Settings = this.getSettings()): string[] {
    return Object.keys(settings).filter(
      (setting: string): boolean => settings[setting] === true
    )
  }

  getReportCapabilities<T extends MELCloudDevice>(
    total: boolean = false
  ): Record<ReportCapability<T>, ReportCapabilityMapping<T>> {
    return Object.entries(this.reportCapabilityMapping).reduce<any>(
      (
        reportCapabilities,
        [capability, tags]: [string, ReportCapabilityMapping<T>]
      ) => {
        const newReportCapabilities: Record<
          ReportCapability<T>,
          ReportCapabilityMapping<T>
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
    )
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

  registerCapabilityListeners<T extends MELCloudDevice>(): void {
    ;[...Object.keys(this.setCapabilityMapping), 'thermostat_mode'].forEach(
      (capability: string): void => {
        this.registerCapabilityListener(
          capability,
          async (value: CapabilityValue): Promise<void> => {
            await this.onCapability(
              capability as ExtendedSetCapability<T>,
              value
            )
          }
        )
      }
    )
  }

  async onCapability<T extends MELCloudDevice>(
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

  async specificOnCapability(
    _capability:
      | ExtendedSetCapability<MELCloudDeviceAta>
      | ExtendedSetCapability<MELCloudDeviceAtw>,
    _value: CapabilityValue
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

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

  async syncToDevice<T extends MELCloudDevice>(): Promise<void> {
    const updateData: SetDeviceData<T> = this.buildUpdateData()
    const data: GetDeviceData<T> | null = await this.setDeviceData(updateData)
    await this.endSync(data, 'syncTo')
  }

  buildUpdateData<T extends MELCloudDevice>(): SetDeviceData<T> {
    const updateData: SetDeviceData<T> = Object.entries(
      this.setCapabilityMapping
    ).reduce<any>(
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
        )
        if (this.diff.has(capability as SetCapability<T>)) {
          this.diff.delete(capability as SetCapability<T>)
          acc.EffectiveFlags = Number(
            BigInt(acc.EffectiveFlags) | effectiveFlag
          )
        }
        return acc
      },
      { EffectiveFlags: 0 }
    )
    return updateData
  }

  convertToDevice(
    capability:
      | SetCapability<MELCloudDeviceAta>
      | SetCapability<MELCloudDeviceAtw>,
    value: CapabilityValue = this.getCapabilityValue(capability)
  ): boolean | number {
    if (capability === 'onoff') {
      return this.getSetting('always_on') === true ? true : (value as boolean)
    }
    return value as boolean | number
  }

  async endSync<T extends MELCloudDevice>(
    data: Partial<ListDeviceData<T>> | null,
    syncMode?: SyncMode
  ): Promise<void> {
    await this.updateCapabilities(data, syncMode)
    await this.updateThermostatMode()
    if (syncMode === 'syncTo' && !this.isDiff()) {
      this.app.applySyncFromDevices(undefined, 'syncFrom')
    }
  }

  async updateCapabilities<T extends MELCloudDevice>(
    data: Partial<ListDeviceData<T>> | null,
    syncMode?: SyncMode
  ): Promise<void> {
    if (data === null || data.EffectiveFlags === undefined) {
      return
    }
    const effectiveFlags: bigint = BigInt(data.EffectiveFlags)
    const combinedCapabilities: typeof this.getCapabilityMapping = {
      ...this.setCapabilityMapping,
      ...this.getCapabilityMapping,
    }

    const capabilitiesToProcess = ():
      | typeof this.getCapabilityMapping
      | typeof this.listCapabilityMapping => {
      switch (syncMode) {
        case 'syncTo':
          return combinedCapabilities
        case 'syncFrom':
          return this.listCapabilityMapping
        default:
          return {
            ...combinedCapabilities,
            ...this.listCapabilityMapping,
          }
      }
    }

    const capabilities: Array<
      [NonReportCapability<T>, ListCapabilityMapping<T>]
    > = Object.entries(capabilitiesToProcess()) as Array<
      [NonReportCapability<T>, ListCapabilityMapping<T>]
    >
    const keysToProcessLast: string[] = [
      'operation_mode_state.zone1',
      'operation_mode_state.zone2',
    ]
    const [regularCapabilities, lastCapabilities]: Array<
      Array<[NonReportCapability<T>, ListCapabilityMapping<T>]>
    > = capabilities.reduce<
      Array<Array<[NonReportCapability<T>, ListCapabilityMapping<T>]>>
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
      capabilitiesArray: Array<
        [NonReportCapability<T>, ListCapabilityMapping<T>]
      >
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

  async convertFromDevice(
    _capability: Capability<MELCloudDeviceAta> | Capability<MELCloudDeviceAtw>,
    _value: boolean | number
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async updateThermostatMode(): Promise<void> {
    // Abstract method
  }

  async syncDeviceFromList<T extends MELCloudDevice>(
    syncMode?: SyncFromMode
  ): Promise<void> {
    const deviceFromList: ListDevice<T> | undefined =
      this.app.getDeviceFromList(this.id)
    const data: ListDeviceData<T> | null = deviceFromList?.Device ?? null
    this.log('Syncing from device list:', data)
    await this.updateStore(data)
    await this.endSync(data, syncMode)
  }

  async updateStore<T extends MELCloudDevice>(
    _data: ListDeviceData<T> | null
  ): Promise<void> {
    // Abstract method
  }

  async runEnergyReports(): Promise<void> {
    await this.runEnergyReport()
    await this.runEnergyReport(true)
  }

  async runEnergyReport<T extends MELCloudDevice>(
    total: boolean = false
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

  async updateReportCapability<T extends MELCloudDevice>(
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

  planEnergyReport(total: boolean = false): void {
    const totalString: 'true' | 'false' = total ? 'true' : 'false'
    if (this.reportTimeout[totalString] !== null) {
      return
    }
    const type: string = `${total ? 'total' : 'regular'} energy report`
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
          setting !== 'always_on' && !(setting in this.reportCapabilityMapping)
      )
    ) {
      this.app.applySyncFromDevices()
    }

    const changedEnergyKeys: string[] = changedKeys.filter(
      (setting: string): boolean => setting in this.reportCapabilityMapping
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
              !(setting in this.reportCapabilityMapping) || value === false
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

  clearEnergyReportPlan(total: boolean = false): void {
    const totalString: 'true' | 'false' = total ? 'true' : 'false'
    this.homey.clearTimeout(this.reportTimeout[totalString])
    this.homey.clearInterval(this.reportInterval[totalString])
    this.reportTimeout[totalString] = null
    this.log(total ? 'Total' : 'Regular', 'energy report has been stopped')
  }

  async onDeleted(): Promise<void> {
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
        .catch(this.error)
    }
  }

  async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super
        .removeCapability(capability)
        .then((): void => {
          this.log('Removing capability', capability)
        })
        .catch(this.error)
    }
  }

  async setCapabilityValue<T extends MELCloudDevice>(
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
        .catch(this.error)
    }
  }

  setInterval(
    type: string,
    callback: () => Promise<void>,
    interval: number | object,
    ...units: Array<keyof DurationLikeObject>
  ): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      'will run every',
      duration.shiftTo(...units).toHuman(),
      'starting',
      DateTime.now()
        .plus(duration)
        .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setInterval(callback, Number(duration))
  }

  setTimeout(
    type: string,
    callback: () => Promise<void>,
    interval: number | object,
    ...units: Array<keyof DurationLikeObject>
  ): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next',
      type,
      'will run in',
      duration.shiftTo(...units).toHuman(),
      'on',
      DateTime.now()
        .plus(duration)
        .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setTimeout(callback, Number(duration))
  }

  log(...args: unknown[]): void {
    super.log(this.getName(), '-', ...args)
  }

  error(...args: unknown[]): void {
    super.error(this.getName(), '-', ...args)
  }
}
