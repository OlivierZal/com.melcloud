import { DateTime, Duration } from 'luxon'
import { Device } from 'homey'

import MELCloudApp from '../app'
import MELCloudDeviceAta from '../drivers/melcloud/device'
import MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import {
  Capability,
  Data,
  ExtendedSetCapability,
  GetCapability,
  GetCapabilityMapping,
  ListCapability,
  ListCapabilityMapping,
  ListDevice,
  ListDevices,
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
  deviceFromList!: ListDevice<MELCloudDeviceAta> | ListDevice<MELCloudDeviceAtw> | null
  diff!: SetCapabilities<MELCloudDeviceAta> | SetCapabilities<MELCloudDeviceAtw>

  syncTimeout: NodeJS.Timeout | undefined
  reportInterval: NodeJS.Timeout | undefined
  reportTimeout: NodeJS.Timeout | undefined
  reportPlanningParameters!: {
    frequency: object
    plus: object
    set: object
  }

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const { id, buildingid } = this.getData()
    this.id = id
    this.buildingid = buildingid
    this.deviceFromList = null
    this.diff = {}

    await this.handleCapabilities()
    this.registerCapabilityListeners()
    await this.syncDataFromDevice()
    if (this.getCapabilities().some((capability: string): boolean => capability.startsWith('meter_power'))) {
      await this.runEnergyReports()
    }
  }

  async handleCapabilities (): Promise<void> {
    const requiredCapabilities = [...this.requiredCapabilities, ...this.getDashboardCapabilities()]
    for (const capability of requiredCapabilities) {
      await this.addCapability(capability)
    }
    for (const capability of this.getCapabilities()) {
      if (!requiredCapabilities.includes(capability)) await this.removeCapability(capability)
    }
  }

  getDashboardCapabilities (settings?: Settings): string[] {
    const newSettings: Settings = settings ?? this.getSettings()
    return Object.keys(newSettings)
      .filter((setting: string): boolean => this.driver.manifest.capabilities.includes(setting) === true && newSettings[setting] === true)
  }

  registerCapabilityListeners <T extends MELCloudDevice> (): void {
    for (const capability of Object.keys(this.setCapabilityMapping)) {
      this.registerCapabilityListener(capability, async (value: boolean | number | string): Promise<void> => {
        await this.onCapability(capability as SetCapability<T>, value)
      })
    }
  }

  async onCapability (_capability: ExtendedSetCapability<MELCloudDeviceAta> | ExtendedSetCapability<MELCloudDeviceAtw>, _value: boolean | number | string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  clearSyncTimeout (): void {
    this.homey.clearTimeout(this.syncTimeout)
  }

  applySyncDataToDevice (): void {
    this.syncTimeout = this.setTimeout('sync to device', async (): Promise<void> => await this.syncDataToDevice(this.diff), { seconds: 1 })
  }

  async syncDataToDevice <T extends MELCloudDevice> (diff: SetCapabilities<T>): Promise<void> {
    this.diff = {}
    const updateData: UpdateData<T> = this.buildUpdateData(diff)
    const data: Data<T> | {} = await this.app.setDevice(this as MELCloudDevice, updateData)
    await this.syncData(data)
  }

  buildUpdateData <T extends MELCloudDevice> (diff: SetCapabilities<T>): UpdateData<T> {
    const updateData: any = {}
    let effectiveFlags: bigint = 0n
    for (const [capability, { tag, effectiveFlag }] of Object.entries(this.setCapabilityMapping)) {
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.convertToDevice(capability as SetCapability<T>, diff[capability as keyof SetCapabilities<T>] as boolean | number | string)
        } else {
          updateData[tag] = this.convertToDevice(capability as SetCapability<T>)
        }
      }
    }
    updateData.EffectiveFlags = Number(effectiveFlags)
    return updateData
  }

  convertToDevice (_capability: SetCapability<MELCloudDeviceAta> | SetCapability<MELCloudDeviceAtw>, _value?: boolean | number | string): boolean | number {
    throw new Error('Method not implemented.')
  }

  async syncDataFromDevice <T extends MELCloudDevice> (): Promise<void> {
    const data: Data<T> | {} = await this.app.getDevice(this as MELCloudDevice)
    await this.syncData(data)
  }

  async syncData <T extends MELCloudDevice> (data: Data<T> | {}): Promise<void> {
    this.deviceFromList = await this.getDeviceFromList()
    await this.updateCapabilities(data)
    await this.updateListCapabilities()
    await this.customUpdate()
    this.planNextSyncFromDevice({ minutes: this.getSetting('interval') })
  }

  async getDeviceFromList <T extends MELCloudDevice> (): Promise<ListDevice<T> | null> {
    const devices: ListDevices<T> = await this.app.listDevices(this.driver)
    const device: ListDevice<T> = devices[this.id]
    if (device !== undefined) return device
    this.error('Not found while searching from device list')
    return null
  }

  async updateCapabilities <T extends MELCloudDevice> (data: Data<T> | {}): Promise<void> {
    if (!('EffectiveFlags' in data && data.EffectiveFlags != null)) return
    for (const [capability, { tag, effectiveFlag }] of Object.entries(this.setCapabilityMapping)) {
      const effectiveFlags: bigint = BigInt(data.EffectiveFlags)
      if (effectiveFlags === 0n || Boolean(effectiveFlags & effectiveFlag)) {
        await this.convertFromDevice(capability as SetCapability<T>, data[tag as SetCapabilityMapping<T>['tag']] as boolean | number)
      }
    }
    for (const [capability, { tag }] of Object.entries(this.getCapabilityMapping)) {
      await this.convertFromDevice(capability as GetCapability<T>, data[tag as keyof Data<T>] as boolean | number)
    }
  }

  async convertFromDevice (_capability: Capability<MELCloudDeviceAta> | Capability<MELCloudDeviceAtw>, _value: boolean | number): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async updateListCapabilities <T extends MELCloudDevice> (): Promise<void> {
    if (this.deviceFromList === null) return
    for (const [capability, { tag }] of Object.entries(this.listCapabilityMapping)) {
      await this.convertFromDevice(capability as ListCapability<T>, this.deviceFromList.Device[tag as keyof typeof this.deviceFromList.Device])
    }
  }

  async customUpdate (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planNextSyncFromDevice (object: object): void {
    this.clearSyncTimeout()
    this.syncTimeout = this.setTimeout('sync from device', async (): Promise<void> => await this.syncDataFromDevice(), object)
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planEnergyReports (): void {
    if (this.reportInterval !== undefined) return
    const type = 'energy cost report'
    const { plus, set, frequency } = this.reportPlanningParameters
    this.reportTimeout = this.setTimeout(type, async (): Promise<void> => {
      this.reportInterval = this.setInterval(type, async (): Promise<void> => await this.runEnergyReports(), frequency)
    }, DateTime.now().plus(plus).set(set).diffNow().toObject())
  }

  async onSettings ({ newSettings, changedKeys }: { newSettings: Settings, changedKeys: string[] }): Promise<void> {
    if (changedKeys.some((setting: string): boolean => !['always_on', 'interval'].includes(setting))) {
      await this.handleDashboardCapabilities(newSettings, changedKeys)
      await this.setWarning('Exit device and return to refresh your dashboard')
      await this.setWarning(null)
    }
    if (changedKeys.includes('always_on') && newSettings.always_on === true) await this.onCapability('onoff', true)
    if (changedKeys.some((setting: string): boolean => !setting.startsWith('meter_power') && setting !== 'always_on')) this.planNextSyncFromDevice({ seconds: 1 })

    const changedEnergyKeys = changedKeys.filter((setting: string): boolean => setting.startsWith('meter_power'))
    if (changedEnergyKeys.length !== 0) {
      if (changedEnergyKeys.some((setting: string): boolean => newSettings[setting] === true)) {
        await this.runEnergyReports()
      } else if (this.getDashboardCapabilities(newSettings).filter((setting: string): boolean => setting.startsWith('meter_power')).length === 0) {
        this.homey.clearTimeout(this.reportTimeout)
        this.homey.clearInterval(this.reportInterval)
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

  onDeleted (): void {
    this.clearSyncTimeout()
    this.homey.clearTimeout(this.reportTimeout)
    this.homey.clearInterval(this.reportInterval)
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

  async setCapabilityValue <T extends MELCloudDevice> (capability: Capability<T> | 'thermostat_mode', value: boolean | number | string): Promise<void> {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await super.setCapabilityValue(capability, value).then((): void => this.log(capability, 'is', value)).catch(this.error)
    }
  }

  setInterval (type: string, callback: Function, object: object): NodeJS.Timeout {
    const duration: Duration = Duration.fromObject(object)
    this.log(
      type.charAt(0).toUpperCase() + type.slice(1), 'will run every', duration.shiftTo('days', 'hours').toHuman(),
      'starting', DateTime.now().toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
    )
    return this.homey.setInterval(callback, Number(duration))
  }

  setTimeout (type: string, callback: Function, object: object): NodeJS.Timeout {
    const duration: Duration = Duration.fromObject(object)
    this.log('Next', type, 'will run in', duration.shiftTo('hours', 'minutes', 'seconds').toHuman())
    return this.homey.setTimeout(callback, Number(duration))
  }

  log (...args: any[]): void {
    super.log(this.getName(), '-', ...args)
  }

  error (...args: any[]): void {
    super.error(this.getName(), '-', ...args)
  }
}
