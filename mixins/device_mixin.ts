import { DateTime, Duration } from 'luxon'
import { Device } from 'homey'
import MELCloudApp from '../app'
import MELCloudDeviceAta from '../drivers/melcloud/device'
import MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import {
  Capability,
  CapabilityValue,
  Data,
  ExtendedSetCapability,
  GetCapability,
  GetCapabilityMapping,
  ListCapability,
  ListCapabilityMapping,
  ListDevice,
  MELCloudDevice,
  MELCloudDriver,
  SetCapabilities,
  SetCapability,
  SetCapabilityMapping,
  Settings,
  UpdateData
} from '../types'

export default class MELCloudDeviceMixin extends Device {
  app!: MELCloudApp
  declare driver: MELCloudDriver
  requiredCapabilities!: string[]

  setCapabilityMapping!: Record<SetCapability<MELCloudDeviceAta>, SetCapabilityMapping<MELCloudDeviceAta>>
  | Record<SetCapability<MELCloudDeviceAtw>, SetCapabilityMapping<MELCloudDeviceAtw>>

  getCapabilityMapping!: Record<GetCapability<MELCloudDeviceAta>, GetCapabilityMapping<MELCloudDeviceAta>>
  | Record<GetCapability<MELCloudDeviceAtw>, GetCapabilityMapping<MELCloudDeviceAtw>>

  listCapabilityMapping!: Record<ListCapability<MELCloudDeviceAta>, ListCapabilityMapping<MELCloudDeviceAta>>
  | Record<ListCapability<MELCloudDeviceAtw>, ListCapabilityMapping<MELCloudDeviceAtw>>

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

  async onInit (): Promise<void> {
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
    if (dashboardCapabilities.some((capability: string): boolean => capability.startsWith('meter_power'))) {
      await this.runEnergyReports()
    }
  }

  getDashboardCapabilities (settings: Settings = this.getSettings()): string[] {
    return Object.keys(settings).filter((setting: string): boolean => (
      this.driver.manifest.capabilities.includes(setting) === true && settings[setting] === true
    ))
  }

  async handleCapabilities (dashboardCapabilities: string[] = this.getDashboardCapabilities()): Promise<void> {
    const requiredCapabilities = [...this.requiredCapabilities, ...dashboardCapabilities]
    for (const capability of requiredCapabilities) {
      await this.addCapability(capability)
    }
    for (const capability of this.getCapabilities()) {
      if (!requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability)
      }
    }
  }

  registerCapabilityListeners <T extends MELCloudDevice> (): void {
    for (const capability of Object.keys(this.setCapabilityMapping)) {
      this.registerCapabilityListener(capability, async (value: CapabilityValue): Promise<void> => {
        await this.onCapability(capability as SetCapability<T>, value)
      })
    }
  }

  async onCapability (
    _capability: ExtendedSetCapability<MELCloudDeviceAta> | ExtendedSetCapability<MELCloudDeviceAtw>,
    _value: CapabilityValue
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async setAlwaysOnWarning (): Promise<void> {
    if (this.getSetting('always_on') === true) {
      await this.setWarning('"Power Off" is disabled.')
      await this.setWarning(null)
    }
  }

  clearSyncPlan (): void {
    this.homey.clearTimeout(this.syncTimeout)
    this.log('Sync has been paused')
  }

  applySyncToDevice (): void {
    this.syncTimeout = this.setTimeout('sync to device', async (): Promise<void> => {
      await this.syncToDevice(this.diff)
    }, { seconds: 1 })
  }

  async syncToDevice <T extends MELCloudDevice> (diff: SetCapabilities<T>): Promise<void> {
    this.diff = {}
    const updateData: UpdateData<T> = this.buildUpdateData(diff)
    const data: Data<T> | null = await this.app.setDevice(this as unknown as T, updateData)
    await this.sync(data)
  }

  buildUpdateData <T extends MELCloudDevice> (diff: SetCapabilities<T>): UpdateData<T> {
    const updateData: any = {}
    let effectiveFlags: bigint = 0n
    for (const [capability, { tag, effectiveFlag }] of Object.entries(this.setCapabilityMapping)) {
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.convertToDevice(capability as SetCapability<T>, diff[capability as keyof SetCapabilities<T>] as CapabilityValue)
        } else {
          updateData[tag] = this.convertToDevice(capability as SetCapability<T>)
        }
      }
    }
    updateData.EffectiveFlags = Number(effectiveFlags)
    return updateData
  }

  convertToDevice (
    _capability: SetCapability<MELCloudDeviceAta> | SetCapability<MELCloudDeviceAtw>,
    _value: CapabilityValue = this.getCapabilityValue(_capability)
  ): boolean | number {
    throw new Error('Method not implemented.')
  }

  async syncFromDevice <T extends MELCloudDevice> (): Promise<void> {
    const data: Data<T> | null = await this.app.getDevice(this as unknown as T)
    await this.sync(data)
  }

  async sync <T extends MELCloudDevice> (data: Data<T> | null): Promise<void> {
    await this.updateCapabilities(data)

    const deviceFromList: ListDevice<T> | null = await this.getDeviceFromList()
    await this.updateListCapabilities(deviceFromList)
    await this.customUpdate(deviceFromList)
    this.planSyncFromDevice({ minutes: this.getSetting('interval') })
  }

  async getDeviceFromList <T extends MELCloudDevice> (): Promise<ListDevice<T> | null> {
    const listDevices: Array<ListDevice<T>> = await this.app.listDevices(this.driver)
    const devices: Array<ListDevice<T>> = listDevices.filter((device: ListDevice<T>): boolean => device.DeviceID === this.id)
    if (devices.length === 1) {
      return devices[0]
    }
    return null
  }

  async updateCapabilities <T extends MELCloudDevice> (data: Data<T> | null): Promise<void> {
    if (data === null) {
      return
    }
    if (data.EffectiveFlags !== undefined) {
      for (const [capability, { tag, effectiveFlag }] of Object.entries(this.setCapabilityMapping)) {
        const effectiveFlags: bigint = BigInt(data.EffectiveFlags)
        if (effectiveFlags === 0n || Boolean(effectiveFlags & effectiveFlag)) {
          await this.convertFromDevice(capability as SetCapability<T>, data[tag as SetCapabilityMapping<T>['tag']] as boolean | number)
        }
      }
    }
    for (const [capability, { tag }] of Object.entries(this.getCapabilityMapping)) {
      await this.convertFromDevice(capability as GetCapability<T>, data[tag as GetCapabilityMapping<T>['tag']] as boolean | number)
    }
  }

  async convertFromDevice (_capability: Capability<MELCloudDeviceAta> | Capability<MELCloudDeviceAtw>, _value: boolean | number): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async updateListCapabilities <T extends MELCloudDevice> (deviceFromList: ListDevice<T> | null): Promise<void> {
    if (deviceFromList === null) {
      return
    }
    this.log('Syncing from device list:', deviceFromList.Device)
    for (const [capability, { tag }] of Object.entries(this.listCapabilityMapping)) {
      await this.convertFromDevice(capability as ListCapability<T>, deviceFromList.Device[tag as ListCapabilityMapping<T>['tag']] as boolean | number)
    }
  }

  async customUpdate (_deviceFromList?: ListDevice<MELCloudDeviceAta> | ListDevice<MELCloudDeviceAtw> | null): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planSyncFromDevice (object: object): void {
    this.clearSyncPlan()
    this.syncTimeout = this.setTimeout('sync from device', async (): Promise<void> => {
      await this.syncFromDevice()
    }, object)
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planEnergyReports (): void {
    if (this.reportInterval !== null) {
      return
    }
    const type = 'energy cost report'
    const { interval, duration, values } = this.reportPlanParameters
    this.reportTimeout = this.setTimeout(type, async (): Promise<void> => {
      await this.runEnergyReports()
      this.reportInterval = this.setInterval(type, async (): Promise<void> => {
        await this.runEnergyReports()
      }, interval)
    }, DateTime.now().plus(duration).set(values).diffNow())
  }

  async onSettings ({ newSettings, changedKeys }: { newSettings: Settings, changedKeys: string[] }): Promise<void> {
    if (changedKeys.some((setting: string): boolean => !['always_on', 'interval'].includes(setting))) {
      await this.handleDashboardCapabilities(newSettings, changedKeys)
      await this.setWarning('Exit device and return to refresh your dashboard.')
      await this.setWarning(null)
    }
    if (changedKeys.includes('always_on') && newSettings.always_on === true) {
      await this.onCapability('onoff', true)
    }
    if (changedKeys.some((setting: string): boolean => !setting.startsWith('meter_power') && setting !== 'always_on')) {
      this.planSyncFromDevice({ seconds: 1 })
    }
    const changedEnergyKeys = changedKeys.filter((setting: string): boolean => setting.startsWith('meter_power'))
    if (changedEnergyKeys.length !== 0) {
      if (changedEnergyKeys.some((setting: string): boolean => newSettings[setting] === true)) {
        await this.runEnergyReports()
      } else if (this.getDashboardCapabilities(newSettings).filter((setting: string): boolean => setting.startsWith('meter_power')).length === 0) {
        this.clearReportPlan()
      }
    }
  }

  async handleDashboardCapabilities (newSettings: Settings, changedCapabilities: string[]): Promise<void> {
    for (const capability of changedCapabilities) {
      if (newSettings[capability] === true) {
        await this.addCapability(capability)
      } else {
        await this.removeCapability(capability)
      }
    }
  }

  clearReportPlan (): void {
    this.homey.clearTimeout(this.reportTimeout)
    this.homey.clearInterval(this.reportInterval)
    this.reportInterval = null
    this.log('Energy cost reports have been stopped')
  }

  async onDeleted (): Promise<void> {
    this.clearSyncPlan()
    this.clearReportPlan()
  }

  async addCapability (capability: string): Promise<void> {
    if (this.driver.manifest.capabilities.includes(capability) === true && !this.hasCapability(capability)) {
      await super.addCapability(capability)
      this.log('Capability', capability, 'added')
    }
  }

  async removeCapability (capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
      this.log('Capability', capability, 'removed')
    }
  }

  async setCapabilityValue <T extends MELCloudDevice> (capability: Capability<T> | 'thermostat_mode', value: CapabilityValue): Promise<void> {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, value).then((): void => {
        this.log('Capability', capability, 'is', value)
      }).catch(this.error)
    }
  }

  setInterval (type: string, callback: Function, interval: number | object): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      `${type.charAt(0).toUpperCase()}${type.slice(1)}`, 'will run every', duration.shiftTo('days', 'hours').toHuman(),
      'starting', DateTime.now().plus(duration).toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setInterval(callback, Number(duration))
  }

  setTimeout (type: string, callback: Function, interval: number | object): NodeJS.Timeout {
    const duration: Duration = Duration.fromDurationLike(interval)
    this.log(
      'Next', type, 'will run in', duration.shiftTo('hours', 'minutes', 'seconds').toHuman(),
      'on', DateTime.now().plus(duration).toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
    )
    return this.homey.setTimeout(callback, Number(duration))
  }

  log (...args: any[]): void {
    super.log(this.getName(), '-', ...args)
  }

  error (...args: any[]): void {
    super.error(this.getName(), '-', ...args)
  }
}
