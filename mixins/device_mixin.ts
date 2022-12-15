import { Device } from 'homey'

import MELCloudApp from '../app'
import MELCloudDeviceAta from '../drivers/melcloud/device'
import MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import {
  Capability,
  ExtendedSetCapability,
  GetCapability,
  GetCapabilityMapping,
  GetData,
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
  setCapabilityMapping!: Record<SetCapability<MELCloudDeviceAta>, SetCapabilityMapping<MELCloudDeviceAta>>
  | Record<SetCapability<MELCloudDeviceAtw>, SetCapabilityMapping<MELCloudDeviceAtw>>

  getCapabilityMapping!: Record<GetCapability<MELCloudDeviceAta>, GetCapabilityMapping<MELCloudDeviceAta>>
  | Record<GetCapability<MELCloudDeviceAtw>, GetCapabilityMapping<MELCloudDeviceAtw>>

  listCapabilityMapping!: Record<ListCapability<MELCloudDeviceAta>, ListCapabilityMapping<MELCloudDeviceAta>>
  | Record<ListCapability<MELCloudDeviceAtw>, ListCapabilityMapping<MELCloudDeviceAtw>>

  declare driver: MELCloudDriver
  app!: MELCloudApp

  id!: number
  buildingid!: number
  deviceFromList!: ListDevice<MELCloudDeviceAta> | ListDevice<MELCloudDeviceAtw> | null
  diff!: SetCapabilities<MELCloudDeviceAta> | SetCapabilities<MELCloudDeviceAtw>

  requiredCapabilities!: string[]

  reportInterval: NodeJS.Timeout | undefined
  reportTimeout: NodeJS.Timeout | undefined
  syncTimeout: NodeJS.Timeout | undefined

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const { id, buildingid } = this.getData()
    this.id = id
    this.buildingid = buildingid
    this.deviceFromList = null
    this.diff = {}

    await this.handleCapabilities()
    await this.handleDashboardCapabilities()

    this.registerCapabilityListeners()
    await this.syncDataFromDevice()

    await this.runEnergyReports()
    this.planEnergyReports()
  }

  async handleCapabilities (): Promise<void> {
    for (const capability of this.requiredCapabilities) {
      if (!this.hasCapability(capability)) await this.addCapability(capability)
    }
    for (const capability of this.getCapabilities()) {
      if (!this.requiredCapabilities.includes(capability)) await this.removeCapability(capability)
    }
  }

  async handleDashboardCapabilities (settings?: Settings, capabilities?: string[]): Promise<void> {
    const newSettings: Settings = settings ?? this.getSettings()
    let newCapabilities: string[] = capabilities ?? Object.keys(newSettings)
    newCapabilities = newCapabilities
      .filter((capability: string): boolean => this.driver.manifest.capabilities.includes(capability) === true && Object.keys(newSettings).includes(capability))
    for (const capability of newCapabilities) {
      if (newSettings[capability] === true && !this.hasCapability(capability)) {
        await this.addCapability(capability)
      } else if (newSettings[capability] === false && this.hasCapability(capability)) {
        await this.removeCapability(capability)
      }
    }
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

  async syncDataToDevice <T extends MELCloudDevice> (diff: SetCapabilities<T>): Promise<void> {
    this.diff = {}

    const updateData: UpdateData<T> = this.buildUpdateData(diff)
    const resultData: GetData<T> | {} = await this.app.setDevice(this as MELCloudDevice, updateData)
    await this.syncData(resultData)
  }

  buildUpdateData <T extends MELCloudDevice> (diff: SetCapabilities<T>): UpdateData<T> {
    const updateData: any = {}

    let effectiveFlags: bigint = 0n
    for (const [capability, { tag, effectiveFlag }] of Object.entries(this.setCapabilityMapping)) {
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.getCapabilityValueToDevice(capability as SetCapability<T>, diff[capability as keyof SetCapabilities<T>] as boolean | number | string)
        } else {
          updateData[tag] = this.getCapabilityValueToDevice(capability as SetCapability<T>)
        }
      }
    }
    updateData.EffectiveFlags = Number(effectiveFlags)
    return updateData
  }

  getCapabilityValueToDevice (_capability: SetCapability<MELCloudDeviceAta> | SetCapability<MELCloudDeviceAtw>, _value?: boolean | number | string): boolean | number {
    throw new Error('Method not implemented.')
  }

  async syncDataFromDevice <T extends MELCloudDevice> (): Promise<void> {
    const resultData: GetData<T> | {} = await this.app.getDevice(this as MELCloudDevice)
    await this.syncData(resultData)
  }

  async syncData <T extends MELCloudDevice> (resultData: GetData<T> | {}): Promise<void> {
    this.deviceFromList = await this.getDeviceFromList()
    await this.updateCapabilities(resultData)
    await this.updateListCapabilities()
    await this.customUpdate()

    this.planNextSyncFromDevice()
  }

  async getDeviceFromList <T extends MELCloudDevice> (): Promise<ListDevice<T> | null> {
    const devices: ListDevices<T> = await this.app.listDevices(this.driver)
    const device: ListDevice<T> = devices[this.id]
    if (device === undefined) {
      this.error('Not found while searching from device list')
      return null
    }
    return device
  }

  async updateCapabilities <T extends MELCloudDevice> (resultData: GetData<T> | {}): Promise<void> {
    if ('EffectiveFlags' in resultData && resultData.EffectiveFlags != null) {
      for (const [capability, { tag, effectiveFlag }] of Object.entries(this.setCapabilityMapping)) {
        const effectiveFlags: bigint = BigInt(resultData.EffectiveFlags)
        if (effectiveFlags === 0n || Boolean(effectiveFlags & effectiveFlag)) {
          await this.setCapabilityValueFromDevice(capability as SetCapability<T>, resultData[tag as SetCapabilityMapping<T>['tag']] as boolean | number)
        }
      }
      for (const [capability, { tag }] of Object.entries(this.getCapabilityMapping)) {
        await this.setCapabilityValueFromDevice(capability as GetCapability<T>, resultData[tag as keyof GetData<T>] as boolean | number)
      }
    }
  }

  async setCapabilityValueFromDevice (_capability: Capability<MELCloudDeviceAta> | Capability<MELCloudDeviceAtw>, _value: boolean | number): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async updateListCapabilities <T extends MELCloudDevice> (): Promise<void> {
    if (this.deviceFromList !== null) {
      for (const [capability, { tag }] of Object.entries(this.listCapabilityMapping)) {
        await this.setCapabilityValueFromDevice(capability as ListCapability<T>, this.deviceFromList.Device[tag as keyof typeof this.deviceFromList.Device])
      }
    }
  }

  async setOrNotCapabilityValue <T extends MELCloudDevice> (capability: Capability<T> | 'thermostat_mode', value: boolean | number | string): Promise<void> {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value).then((): void => this.log(capability, 'is', value)).catch(this.error)
    }
  }

  async customUpdate (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planNextSyncFromDevice (interval?: number): void {
    const newInterval: number = interval ?? this.getSetting('interval') * 60
    this.homey.clearTimeout(this.syncTimeout)
    this.syncTimeout = this.homey.setTimeout(async (): Promise<void> => await this.syncDataFromDevice(), newInterval * 1000)
    this.log('Next sync from device in', newInterval, 'second(s)')
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planEnergyReports (): void {
    throw new Error('Method not implemented.')
  }

  async onSettings ({ newSettings, changedKeys }: { newSettings: Settings, changedKeys: string[] }): Promise<void> {
    if (changedKeys.some((setting: string): boolean => !['always_on', 'interval'].includes(setting))) {
      await this.handleDashboardCapabilities(newSettings, changedKeys)
      await this.setWarning('Exit device and return to refresh your dashboard')
      await this.setWarning(null)
    }
    if (changedKeys.includes('always_on') && newSettings.always_on === true) await this.onCapability('onoff', true)
    if (changedKeys.some((setting: string): boolean => !setting.startsWith('meter_power') && setting !== 'always_on')) this.planNextSyncFromDevice(1)
    if (changedKeys.some((setting: string): boolean => setting.startsWith('meter_power'))) await this.runEnergyReports()
  }

  onDeleted (): void {
    this.homey.clearInterval(this.reportInterval)
    this.homey.clearTimeout(this.reportTimeout)
    this.homey.clearTimeout(this.syncTimeout)
  }

  log (...args: any[]): void {
    super.log(this.getName(), '-', ...args)
  }

  error (...args: any[]): void {
    super.error(this.getName(), '-', ...args)
  }
}
