import { DateTime, Duration } from 'luxon'
import { Device } from 'homey'
import type MELCloudApp from '../app'
import type MELCloudDeviceAta from '../drivers/melcloud/device'
import type MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import {
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
  type MELCloudDevice,
  type MELCloudDriver,
  type SetCapabilities,
  type SetCapability,
  type SetCapabilityMapping,
  type Settings,
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
    await this.syncFromDevice()

    this.reportInterval = null
    if (
      dashboardCapabilities.some((capability: string): boolean =>
        capability.startsWith('meter_power')
      )
    ) {
      await this.runEnergyReports()
    }
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
    this.clearSyncPlan()
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

  clearSyncPlan(): void {
    this.homey.clearTimeout(this.syncTimeout)
    this.log('Sync has been paused')
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
      'sync to device',
      async (): Promise<void> => {
        await this.syncToDevice(this.diff)
      },
      { seconds: 1 }
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
    await this.sync(data)
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

  async syncFromDevice<T extends MELCloudDevice>(): Promise<void> {
    const data: Data<T> | null = await this.app.getDeviceData(
      this as unknown as T
    )
    await this.sync(data)
  }

  async sync<T extends MELCloudDevice>(data: Data<T> | null): Promise<void> {
    await this.updateCapabilities(data)
    await this.updateThermostatMode()
    this.planSyncFromDevice({ minutes: this.getSetting('interval') })
  }

  async updateCapabilities<T extends MELCloudDevice>(
    data: Data<T> | null
  ): Promise<void> {
    if (data === null) {
      return
    }
    if (data.EffectiveFlags !== undefined) {
      for (const [capability, { effectiveFlag, tag }] of Object.entries(
        this.setCapabilityMapping
      )) {
        const effectiveFlags: bigint = BigInt(data.EffectiveFlags)
        if (effectiveFlags === 0n || Boolean(effectiveFlags & effectiveFlag)) {
          await this.convertFromDevice(
            capability as SetCapability<T>,
            data[tag as SetCapabilityMapping<T>['tag']] as boolean | number
          )
        }
      }
    }
    for (const [capability, { tag }] of Object.entries(
      this.getCapabilityMapping
    )) {
      await this.convertFromDevice(
        capability as GetCapability<T>,
        data[tag as GetCapabilityMapping<T>['tag']] as boolean | number
      )
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

  planSyncFromDevice(object: object): void {
    this.clearSyncPlan()
    this.syncTimeout = this.setTimeout(
      'sync from device',
      async (): Promise<void> => {
        await this.syncFromDevice()
      },
      object
    )
  }

  async handleDeviceFromList<T extends MELCloudDevice>(): Promise<void> {
    const deviceFromList: ListDevice<T> | undefined =
      this.app.getDeviceFromList(this.id)
    await this.updateListCapabilities(deviceFromList)
    await this.updateStore(deviceFromList)
  }

  async updateListCapabilities<T extends MELCloudDevice>(
    deviceFromList: ListDevice<T> | undefined
  ): Promise<void> {
    if (deviceFromList === undefined) {
      return
    }
    this.log('Syncing from device list:', deviceFromList.Device)
    for (const [capability, { tag }] of Object.entries(
      this.listCapabilityMapping
    )) {
      await this.convertFromDevice(
        capability as ListCapability<T>,
        deviceFromList.Device[tag as ListCapabilityMapping<T>['tag']] as
          | boolean
          | number
      )
    }
  }

  async updateStore<T extends MELCloudDevice>(
    deviceFromList: ListDevice<T> | undefined
  ): Promise<void> {
    if (deviceFromList === undefined) {
      return
    }
    const { canCool, hasZone2 } = this.getStore()
    const { CanCool, HasZone2 } = deviceFromList.Device
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
          interval
        )
      },
      DateTime.now().plus(duration).set(values).diffNow()
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
        (setting: string): boolean =>
          !['always_on', 'interval'].includes(setting)
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
      this.planSyncFromDevice({ seconds: 1 })
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
        this.clearReportPlan()
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

  clearReportPlan(): void {
    this.homey.clearTimeout(this.reportTimeout)
    this.homey.clearInterval(this.reportInterval)
    this.reportInterval = null
    this.log('Energy cost reports have been stopped')
  }

  async onDeleted(): Promise<void> {
    this.clearSyncPlan()
    this.clearReportPlan()
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
    interval: number | object
  ): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      `${type.charAt(0).toUpperCase()}${type.slice(1)}`,
      'will run every',
      duration.shiftTo('days', 'hours').toHuman(),
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
    interval: number | object
  ): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next',
      type,
      'will run in',
      duration.shiftTo('hours', 'minutes', 'seconds').toHuman(),
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
