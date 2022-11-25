import 'source-map-support/register'

import Homey from 'homey'
import MELCloudApp from '../app'
import { Diff, GetData, ListDevice, ListDevices, MELCloudDevice, MELCloudDriver, Settings, UpdateData } from '../types'

export default class MELCloudDeviceMixin extends Homey.Device {
  setCapabilityMapping!: {
    readonly [capability: string]: {
      readonly tag: string
      readonly effectiveFlag: bigint
    }
  }

  getCapabilityMapping!: {
    readonly [capability: string]: {
      readonly tag: string
    }
  }

  listCapabilityMapping!: {
    readonly [capability: string]: {
      readonly tag: string
    }
  }

  readonly driver!: MELCloudDriver
  app!: MELCloudApp

  id!: number
  buildingid!: number
  deviceFromList!: ListDevice | null
  diff!: Diff<MELCloudDevice>

  requiredCapabilities!: string[]

  reportInterval: NodeJS.Timeout | undefined
  reportTimeout: NodeJS.Timeout | undefined
  syncTimeout: NodeJS.Timeout | undefined

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const data = this.getData()
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
      .filter((capability) => this.requiredCapabilities.includes(capability))
      .filter((capability) => Object.keys(newSettings).includes(capability))
    for (const capability of newCapabilities) {
      if (newSettings[capability] === true && !this.hasCapability(capability)) {
        await this.addCapability(capability)
      } else if (newSettings[capability] === false && this.hasCapability(capability)) {
        await this.removeCapability(capability)
      }
    }
  }

  registerCapabilityListeners (): void {
    Object.keys(this.setCapabilityMapping).forEach((capability: string) => {
      this.registerCapabilityListener(capability, async (value: boolean | number | string) => {
        await this.onCapability(capability, value)
      })
    })
  }

  async onCapability (_capability: string, _value: boolean | number | string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async syncDataToDevice (diff: Diff<MELCloudDevice>): Promise<void> {
    this.diff = {}
    const updateData: UpdateData<MELCloudDevice> = this.buildUpdateData(diff)
    const resultData: GetData<MELCloudDevice> | {} = await this.app.setDevice(this as MELCloudDevice, updateData)
    await this.syncData(resultData)
  }

  buildUpdateData (diff: Diff<MELCloudDevice>): UpdateData<MELCloudDevice> {
    const updateData: any = {}
    let effectiveFlags: bigint = BigInt(0)
    Object.entries(this.setCapabilityMapping).forEach((entry: [string, { tag: string, effectiveFlag: bigint }]) => {
      const [capability, { tag, effectiveFlag }]: [string, { tag: string, effectiveFlag: bigint }] = entry
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.getCapabilityValueToDevice(capability, diff[capability as keyof Diff<MELCloudDevice>])
        } else {
          updateData[tag] = this.getCapabilityValueToDevice(capability)
        }
      }
    })
    updateData.EffectiveFlags = Number(effectiveFlags)
    return updateData
  }

  getCapabilityValueToDevice (_capability: string, _value?: boolean | number | string): boolean | number {
    throw new Error('Method not implemented.')
  }

  async syncDataFromDevice (): Promise<void> {
    const resultData: GetData<MELCloudDevice> | {} = await this.app.getDevice(this as MELCloudDevice)
    await this.syncData(resultData)
  }

  async syncData (resultData: GetData<MELCloudDevice> | {}): Promise<void> {
    this.deviceFromList = await this.getDeviceFromList()
    await this.updateCapabilities(resultData)
    await this.updateListCapabilities()
    await this.customUpdate()

    this.planNextSyncFromDevice()
  }

  async getDeviceFromList (): Promise<ListDevice | null> {
    const devices: ListDevices = await this.app.listDevices(this.driver)
    const device: ListDevice = devices[this.id]
    if (device === undefined) {
      this.error('Not found while searching from device list')
      return null
    }
    return device
  }

  async updateCapabilities (resultData: GetData<MELCloudDevice> | {}): Promise<void> {
    if ('EffectiveFlags' in resultData && resultData.EffectiveFlags != null) {
      for (const capability in this.setCapabilityMapping) {
        const effectiveFlags: bigint = BigInt(resultData.EffectiveFlags)
        const { effectiveFlag, tag } = this.setCapabilityMapping[capability]
        if (effectiveFlags === BigInt(0) || Boolean(effectiveFlags & effectiveFlag)) {
          await this.setCapabilityValueFromDevice(capability, resultData[tag as keyof GetData<MELCloudDevice>])
        }
      }
      for (const capability in this.getCapabilityMapping) {
        const { tag } = this.getCapabilityMapping[capability]
        await this.setCapabilityValueFromDevice(capability, resultData[tag as keyof GetData<MELCloudDevice>])
      }
    }
  }

  async updateListCapabilities (): Promise<void> {
    if (this.deviceFromList !== null) {
      for (const capability in this.listCapabilityMapping) {
        const { tag } = this.listCapabilityMapping[capability]
        await this.setCapabilityValueFromDevice(capability, this.deviceFromList.Device[tag])
      }
    }
  }

  async setCapabilityValueFromDevice (_capability: string, _value: boolean | number): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async setOrNotCapabilityValue (capability: string, value: boolean | number | string): Promise<void> {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(() => this.log(capability, 'is', value))
        .catch((error: unknown) => this.error(error instanceof Error ? error.message : error))
    }
  }

  async customUpdate (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planNextSyncFromDevice (interval?: number): void {
    const newInterval: number = interval ?? this.getSetting('interval')
    this.homey.clearTimeout(this.syncTimeout)
    this.syncTimeout = this.homey
      .setTimeout(async () => {
        await this.syncDataFromDevice()
      }, newInterval * 60 * 1000)
    this.log('Next sync from device in', newInterval, 'minutes')
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  planEnergyReports (): void {
    this.reportTimeout = this.homey.setTimeout(async () => {
      await this.runEnergyReports()
      this.reportInterval = this.homey.setInterval(async () => {
        await this.runEnergyReports()
      }, 24 * 60 * 60 * 1000)
    }, new Date().setHours(24, 0, 0, 0) - new Date().getTime())
  }

  async onSettings (event: { newSettings: Settings, changedKeys: string[] }): Promise<void> {
    await this.handleDashboardCapabilities(event.newSettings, event.changedKeys)

    let hasReported: boolean = false
    let hasSynced: boolean = false
    let needsSync: boolean = false
    for (const setting of event.changedKeys) {
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
        if (setting === 'always_on' && event.newSettings.always_on === true) {
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

  log (...message: any[]): void {
    super.log(this.getName(), '-', ...message)
  }

  error (...message: any[]): void {
    super.error(this.getName(), '-', ...message)
  }
}
