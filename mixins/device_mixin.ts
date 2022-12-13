import { Device } from 'homey'

import MELCloudApp from '../app'
import {
  Capability,
  DeviceInfo,
  GetCapability,
  getCapabilityMappingAta,
  getCapabilityMappingAtw,
  GetData,
  ListCapability,
  listCapabilityMappingAta,
  listCapabilityMappingAtw,
  ListDevice,
  ListDevices,
  MELCloudDevice,
  MELCloudDriver,
  SetCapabilities,
  SetCapability,
  setCapabilityMappingAta,
  setCapabilityMappingAtw,
  Settings,
  UpdateData
} from '../types'

export default class MELCloudDeviceMixin extends Device {
  setCapabilityMapping!: typeof setCapabilityMappingAta | typeof setCapabilityMappingAtw
  getCapabilityMapping!: typeof getCapabilityMappingAta | typeof getCapabilityMappingAtw
  listCapabilityMapping!: typeof listCapabilityMappingAta | typeof listCapabilityMappingAtw

  readonly driver!: MELCloudDriver
  app!: MELCloudApp

  id!: number
  buildingid!: number
  deviceFromList!: ListDevice<MELCloudDriver> | null
  diff!: SetCapabilities<MELCloudDevice>

  requiredCapabilities!: string[]

  reportInterval: NodeJS.Timeout | undefined
  reportTimeout: NodeJS.Timeout | undefined
  syncTimeout: NodeJS.Timeout | undefined

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const data: DeviceInfo<MELCloudDevice>['data'] = this.getData()
    this.id = data.id
    this.buildingid = data.buildingid
    this.deviceFromList = null
    this.diff = {}

    this.requiredCapabilities = this.driver.manifest.capabilities
    await this.handleCapabilities()
    await this.handleDashboardCapabilities()

    this.registerCapabilityListeners()
    await this.syncDataFromDevice()

    await this.runEnergyReports()
    this.planEnergyReports()
  }

  async handleCapabilities (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async handleDashboardCapabilities (settings?: Settings, capabilities?: string[]): Promise<void> {
    const newSettings: Settings = settings ?? this.getSettings()
    let newCapabilities: string[] = capabilities ?? Object.keys(newSettings)
    newCapabilities = newCapabilities
      .filter((capability: string): boolean => this.requiredCapabilities.includes(capability) && Object.keys(newSettings).includes(capability))
    for (const capability of newCapabilities) {
      if (newSettings[capability] === true && !this.hasCapability(capability)) {
        await this.addCapability(capability)
      } else if (newSettings[capability] === false && this.hasCapability(capability)) {
        await this.removeCapability(capability)
      }
    }
  }

  registerCapabilityListeners <T extends MELCloudDevice> (): void {
    Object.keys(this.setCapabilityMapping).forEach((capability): void => {
      this.registerCapabilityListener(capability, async (value: boolean | number | string): Promise<void> => {
        await this.onCapability(capability as SetCapability<T>, value)
      })
    })
  }

  async onCapability (_capability: SetCapability<MELCloudDevice> | 'thermostat_mode', _value: boolean | number | string): Promise<void> {
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

    let effectiveFlags: bigint = BigInt(0)
    Object.entries(this.setCapabilityMapping).forEach(([capability, { tag, effectiveFlag }]: [string, { tag: string, effectiveFlag: bigint }]): void => {
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.getCapabilityValueToDevice(capability as SetCapability<T>, diff[capability as keyof SetCapabilities<T>] as boolean | number | string)
        } else {
          updateData[tag] = this.getCapabilityValueToDevice(capability as SetCapability<T>)
        }
      }
    })
    updateData.EffectiveFlags = Number(effectiveFlags)
    return updateData
  }

  getCapabilityValueToDevice (_capability: SetCapability<MELCloudDevice>, _value?: boolean | number | string): boolean | number {
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

  async getDeviceFromList <T extends MELCloudDriver> (): Promise<ListDevice<T> | null> {
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
      for (const [capability, { effectiveFlag, tag }] of Object.entries(this.setCapabilityMapping)) {
        const effectiveFlags: bigint = BigInt(resultData.EffectiveFlags)
        if (effectiveFlags === BigInt(0) || Boolean(effectiveFlags & effectiveFlag)) {
          await this.setCapabilityValueFromDevice(capability as SetCapability<T>, resultData[tag as keyof GetData<T>] as boolean | number)
        }
      }
      for (const [capability, { tag }] of Object.entries(this.getCapabilityMapping)) {
        await this.setCapabilityValueFromDevice(capability as GetCapability<T>, resultData[tag as keyof GetData<T>] as boolean | number)
      }
    }
  }

  async setCapabilityValueFromDevice (_capability: Capability<MELCloudDevice>, _value: boolean | number): Promise<void> {
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
    const newInterval: number = interval ?? this.getSetting('interval')
    this.homey.clearTimeout(this.syncTimeout)
    this.syncTimeout = this.homey.setTimeout(async (): Promise<void> => await this.syncDataFromDevice(), newInterval * 60 * 1000)
    this.log('Next sync from device in', newInterval, 'minutes')
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planEnergyReports (): void {
    throw new Error('Method not implemented.')
  }

  async onSettings ({ newSettings, changedKeys }: { newSettings: Settings, changedKeys: string[] }): Promise<void> {
    await this.handleDashboardCapabilities(newSettings, changedKeys)

    let hasReported: boolean = false
    let hasSynced: boolean = false
    let needsSync: boolean = false
    for (const setting of changedKeys) {
      if (!['always_on', 'interval'].includes(setting)) {
        await this.setWarning('Exit device and return to refresh your dashboard')
      }
      if (setting.startsWith('meter_power')) {
        if (!hasReported) {
          await this.runEnergyReports()
          hasReported = true
        }
      } else if (!hasSynced) {
        if (!needsSync) {
          needsSync = true
        }
        if (setting === 'always_on' && newSettings.always_on === true) {
          await this.onCapability('onoff', true)
          hasSynced = true
          needsSync = false
        }
      }
    }
    await this.setWarning(null)

    if (needsSync) {
      this.planNextSyncFromDevice(1 * 1000)
    }
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
