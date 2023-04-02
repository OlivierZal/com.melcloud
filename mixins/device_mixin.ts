import { DateTime, Duration, type DurationLikeObject } from 'luxon'
import { Device } from 'homey'
import type MELCloudApp from '../app'
import type MELCloudDeviceAta from '../drivers/melcloud/device'
import type MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import {
  type NonReportCapability,
  type Capability,
  type CapabilityValue,
  type Data,
  type ExtendedCapability,
  type ExtendedSetCapability,
  type GetCapability,
  type GetCapabilityMapping,
  type ListCapability,
  type ListCapabilityMapping,
  type ListDevice,
  type ListDeviceData,
  type MELCloudDevice,
  type MELCloudDriver,
  type SetCapabilities,
  type SetCapability,
  type SetCapabilityMapping,
  type Settings,
  type SyncMode,
  type ThermostatMode,
  type UpdateData
} from '../types'

export default class MELCloudDeviceMixin extends Device {
  app!: MELCloudApp
  declare driver: MELCloudDriver
  operationModeCapability!:
    | SetCapability<MELCloudDeviceAta>
    | SetCapability<MELCloudDeviceAtw>

  operationModeToThermostatMode!: Record<string, ThermostatMode>
  requiredCapabilities!: string[]

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

  id!: number
  buildingid!: number
  diff!: SetCapabilities<MELCloudDeviceAta> | SetCapabilities<MELCloudDeviceAtw>

  syncTimeout!: NodeJS.Timeout
  reportTimeout!: NodeJS.Timeout
  reportInterval!: NodeJS.Timeout | null
  reportPlanParameters!: {
    interval: object
    duration: object
    values: object
  }

  async onInit(): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const { id, buildingid } = this.getData()
    this.id = id
    this.buildingid = buildingid
    this.diff = {}

    const dashboardCapabilities: string[] = this.getDashboardCapabilities()
    await this.handleCapabilities(dashboardCapabilities)
    this.registerCapabilityListeners()
    this.app.applySyncFromDevices()

    this.reportInterval = null
    if (
      dashboardCapabilities.some((capability: string): boolean =>
        capability.startsWith('meter_power')
      )
    ) {
      await this.runEnergyReports()
    }
  }

  isDiff(): boolean {
    return Object.keys(this.diff).length > 0
  }

  getDashboardCapabilities(settings: Settings = this.getSettings()): string[] {
    return Object.keys(settings).filter(
      (setting: string): boolean => settings[setting] === true
    )
  }

  async handleCapabilities(
    dashboardCapabilities: string[] = this.getDashboardCapabilities()
  ): Promise<void> {
    const requiredCapabilities: string[] = [
      ...this.requiredCapabilities,
      ...dashboardCapabilities
    ]
    for (const capability of requiredCapabilities) {
      await this.addCapability(capability)
    }
    for (const capability of this.getCapabilities()) {
      if (!requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability)
      }
    }
  }

  registerCapabilityListeners<T extends MELCloudDevice>(): void {
    for (const capability of [
      ...Object.keys(this.setCapabilityMapping),
      'thermostat_mode'
    ]) {
      this.registerCapabilityListener(
        capability,
        async (value: CapabilityValue): Promise<void> => {
          await this.onCapability(capability as ExtendedSetCapability<T>, value)
        }
      )
    }
  }

  async onCapability<T extends MELCloudDevice>(
    capability: ExtendedSetCapability<T>,
    value: CapabilityValue
  ): Promise<void> {
    this.clearSync()
    switch (capability) {
      case 'onoff':
        this.diff.onoff = value as boolean
        await this.setAlwaysOnWarning()
        break
      case 'thermostat_mode':
        this.diff.onoff = String(value) !== 'off'
        await this.setAlwaysOnWarning()
        break
      case 'target_temperature':
        this.diff.target_temperature = value as number
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
        await this.syncToDevice(this.diff)
      },
      { seconds: 1 },
      'seconds'
    )
  }

  async syncToDevice<T extends MELCloudDevice>(
    diff: SetCapabilities<T>
  ): Promise<void> {
    this.diff = {}
    const updateData: UpdateData<T> = this.buildUpdateData(diff)
    const data: Data<T> | null = await this.app.setDeviceData(
      this as unknown as T,
      updateData
    )
    await this.endSync(data, 'syncTo')
  }

  buildUpdateData<T extends MELCloudDevice>(
    diff: SetCapabilities<T>
  ): UpdateData<T> {
    const updateData: any = {}
    let effectiveFlags: bigint = 0n
    for (const [capability, { effectiveFlag, tag }] of Object.entries(
      this.setCapabilityMapping
    )) {
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.convertToDevice(
            capability as SetCapability<T>,
            diff[capability as keyof SetCapabilities<T>] as CapabilityValue
          )
        } else {
          updateData[tag] = this.convertToDevice(capability as SetCapability<T>)
        }
      }
    }
    updateData.EffectiveFlags = Number(effectiveFlags)
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
    syncMode: SyncMode
  ): Promise<void> {
    await this.updateCapabilities(data, syncMode)
    await this.updateThermostatMode()
    if (syncMode === 'syncTo' && !this.isDiff()) {
      this.app.applySyncFromDevices(undefined, 'syncFrom')
    }
  }

  async updateCapabilities<T extends MELCloudDevice>(
    data: Partial<ListDeviceData<T>> | null,
    syncMode: SyncMode
  ): Promise<void> {
    if (data === null || data.EffectiveFlags === undefined) {
      return
    }
    const effectiveFlags: bigint = BigInt(data.EffectiveFlags)
    const combinedCapabilities: typeof this.getCapabilityMapping = {
      ...this.setCapabilityMapping,
      ...this.getCapabilityMapping
    }

    const capabilitiesToProcess: () =>
      | typeof this.getCapabilityMapping
      | typeof this.listCapabilityMapping = ():
      | typeof this.getCapabilityMapping
      | typeof this.listCapabilityMapping => {
      switch (syncMode) {
        case 'syncTo':
          return combinedCapabilities
        case 'syncFrom':
          return this.listCapabilityMapping
        case 'refresh':
        default:
          return {
            ...combinedCapabilities,
            ...this.listCapabilityMapping
          }
      }
    }

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
          return !Object.keys(combinedCapabilities).includes(capability)
        case 'refresh':
        default:
          return true
      }
    }

    for (const [capability, { effectiveFlag, tag }] of Object.entries(
      capabilitiesToProcess()
    )) {
      if (shouldProcess(capability as NonReportCapability<T>, effectiveFlag)) {
        await this.convertFromDevice(
          capability as NonReportCapability<T>,
          data[tag as ListCapabilityMapping<T>['tag']] as boolean | number
        )
      }
    }
  }

  async convertFromDevice(
    _capability: Capability<MELCloudDeviceAta> | Capability<MELCloudDeviceAtw>,
    _value: boolean | number
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async updateThermostatMode(): Promise<void> {
    if (
      !this.hasCapability('thermostat_mode') ||
      this.operationModeCapability === undefined ||
      this.operationModeToThermostatMode === undefined
    ) {
      return
    }
    const isOn: boolean = this.getCapabilityValue('onoff')
    const operationMode: string | number = this.getCapabilityValue(
      this.operationModeCapability
    )
    await this.setCapabilityValue(
      'thermostat_mode',
      isOn ? this.operationModeToThermostatMode[operationMode] : 'off'
    )
  }

  async syncDeviceFromList<T extends MELCloudDevice>(
    syncMode: Exclude<SyncMode, 'syncTo'>
  ): Promise<void> {
    const deviceFromList: ListDevice<T> | null = this.app.getDeviceFromList(
      this.id
    )
    if (deviceFromList === null) {
      return
    }
    const data: ListDeviceData<T> = deviceFromList.Device
    this.log('Syncing from device list:', data)
    await this.updateStore(data)
    await this.endSync(data, syncMode)
  }

  async updateStore<T extends MELCloudDevice>(
    data: ListDeviceData<T> | null
  ): Promise<void> {
    if (data === null) {
      return
    }
    const { canCool, hasZone2 } = this.getStore()
    const { CanCool, HasZone2 } = data
    let hasStoreChanged: boolean = false
    if (canCool !== CanCool) {
      await this.setStoreValue('canCool', CanCool)
      hasStoreChanged = true
    }
    if (hasZone2 !== HasZone2) {
      await this.setStoreValue('hasZone2', HasZone2)
      hasStoreChanged = true
    }
    if (hasStoreChanged) {
      await this.handleCapabilities()
    }
  }

  async runEnergyReports(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planEnergyReports(): void {
    if (this.reportInterval !== null) {
      return
    }
    const type = 'energy cost report'
    const { interval, duration, values } = this.reportPlanParameters
    this.reportTimeout = this.setTimeout(
      type,
      async (): Promise<void> => {
        await this.runEnergyReports()
        this.reportInterval = this.setInterval(
          type,
          async (): Promise<void> => {
            await this.runEnergyReports()
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
    changedKeys
  }: {
    newSettings: Settings
    changedKeys: string[]
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
          !setting.startsWith('meter_power') && setting !== 'always_on'
      )
    ) {
      this.app.applySyncFromDevices()
    }
    const changedEnergyKeys = changedKeys.filter((setting: string): boolean =>
      setting.startsWith('meter_power')
    )
    if (changedEnergyKeys.length !== 0) {
      if (
        changedEnergyKeys.some(
          (setting: string): boolean => newSettings[setting] === true
        )
      ) {
        await this.runEnergyReports()
      } else if (
        this.getDashboardCapabilities(newSettings).filter(
          (setting: string): boolean => setting.startsWith('meter_power')
        ).length === 0
      ) {
        this.clearEnergyReportsPlan()
      }
    }
  }

  async handleDashboardCapabilities(
    newSettings: Settings,
    changedCapabilities: string[]
  ): Promise<void> {
    for (const capability of changedCapabilities) {
      if (newSettings[capability] === true) {
        await this.addCapability(capability)
      } else {
        await this.removeCapability(capability)
      }
    }
  }

  clearEnergyReportsPlan(): void {
    this.homey.clearTimeout(this.reportTimeout)
    this.homey.clearInterval(this.reportInterval)
    this.reportInterval = null
    this.log('Energy cost reports have been paused')
  }

  async onDeleted(): Promise<void> {
    this.clearSync()
    this.clearEnergyReportsPlan()
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
      this.log('Removing capability', capability)
      await super.removeCapability(capability)
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

  log(...args: any[]): void {
    super.log(this.getName(), '-', ...args)
  }

  error(...args: any[]): void {
    super.error(this.getName(), '-', ...args)
  }
}
