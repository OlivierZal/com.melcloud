import 'source-map-support/register'

import Homey from 'homey'
import MELCloudApp from '../app'
import MELCloudDeviceAta from '../drivers/melcloud/device'
import MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import MELCloudDriverAta from '../drivers/melcloud/driver'
import MELCloudDriverAtw from '../drivers/melcloud_atw/driver'
import { Diff, GetData, ListDevice, ListDevices, Settings, UpdateData } from '../types'

export default class MELCloudDeviceMixin extends Homey.Device {
  app!: MELCloudApp
  driver!: MELCloudDriverAta | MELCloudDriverAtw
  diff!: Diff<MELCloudDeviceAta | MELCloudDeviceAtw>

  setCapabilityMapping!: {
    [capability: string]: {
      tag: string
      effectiveFlag: bigint
    }
  }

  getCapabilityMapping!: {
    [capability: string]: {
      tag: string
    }
  }

  listCapabilityMapping!: {
    [capability: string]: {
      tag: string
    }
  }

  id!: number
  buildingid!: number
  deviceFromList!: ListDevice | null
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
    this.requiredCapabilities = this.driver.manifest.capabilities
    this.diff = {}

    await this.handleCapabilities()
    await this.handleDashboardCapabilities()

    this.registerCapabilityListeners()
    await this.syncDataFromDevice()

    await this.runEnergyReports()
    this.planEnergyReports()
  }

  registerCapabilityListeners (): void {
    Object.keys(this.setCapabilityMapping).forEach((capability: string) => {
      this.registerCapabilityListener(capability, async (value: boolean | number | string) => {
        await this.onCapability(capability, value)
      })
    })
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
      this.homey.clearTimeout(this.syncTimeout)
      this.syncTimeout = this.homey
        .setTimeout(async () => {
          await this.syncDataFromDevice()
        }, 1 * 1000)
    }
  }

  onDeleted (): void {
    this.homey.clearInterval(this.reportInterval)
    this.homey.clearTimeout(this.reportTimeout)
    this.homey.clearTimeout(this.syncTimeout)
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

  async getDeviceFromList (): Promise<ListDevice | null> {
    const devices: ListDevices = await this.app.listDevices(this.driver)
    const device: ListDevice = devices[this.id]
    if (device === undefined) {
      this.instanceError('Not found while searching from device list')
      return null
    }
    return device
  }

  async syncDataFromDevice (): Promise<void> {
    const resultData: GetData<MELCloudDeviceAta | MELCloudDeviceAtw> | {} = await this.app.getDevice(this as MELCloudDeviceAta | MELCloudDeviceAtw)
    await this.syncData(resultData)
  }

  async syncDataToDevice (diff: Diff<MELCloudDeviceAta | MELCloudDeviceAtw>): Promise<void> {
    this.diff = {}
    const updateData: UpdateData<MELCloudDeviceAta | MELCloudDeviceAtw> = this.buildUpdateData(diff)
    const resultData: GetData<MELCloudDeviceAta | MELCloudDeviceAtw> | {} = await this.app.setDevice(this as MELCloudDeviceAta | MELCloudDeviceAtw, updateData)
    await this.syncData(resultData)
  }

  buildUpdateData (diff: Diff<MELCloudDeviceAta | MELCloudDeviceAtw>): UpdateData<MELCloudDeviceAta | MELCloudDeviceAtw> {
    const updateData: any = {}
    let effectiveFlags: bigint = BigInt(0)
    Object.entries(this.setCapabilityMapping).forEach((entry: [string, { tag: string, effectiveFlag: bigint }]) => {
      const [capability, { tag, effectiveFlag }]: [string, { tag: string, effectiveFlag: bigint }] = entry
      if (this.hasCapability(capability)) {
        if (capability in diff) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = this.getCapabilityValueToDevice(capability, diff[capability as keyof typeof diff])
        } else {
          updateData[tag] = this.getCapabilityValueToDevice(capability)
        }
      }
    })
    updateData.EffectiveFlags = Number(effectiveFlags)
    return updateData
  }

  async syncData (resultData: GetData<MELCloudDeviceAta | MELCloudDeviceAtw> | {}): Promise<void> {
    this.deviceFromList = await this.getDeviceFromList()
    await this.updateCapabilities(resultData)
    await this.updateListCapabilities()
    await this.customUpdate()

    const interval: number = this.getSetting('interval')
    this.syncTimeout = this.homey
      .setTimeout(async () => {
        await this.syncDataFromDevice()
      }, interval * 60 * 1000)
    this.instanceLog('Next sync from device in', interval, 'minutes')
  }

  async updateCapabilities (resultData: GetData<MELCloudDeviceAta | MELCloudDeviceAtw> | {}): Promise<void> {
    if ('EffectiveFlags' in resultData && resultData.EffectiveFlags != null) {
      for (const capability in this.setCapabilityMapping) {
        const effectiveFlags: bigint = BigInt(resultData.EffectiveFlags)
        const { effectiveFlag, tag } = this.setCapabilityMapping[capability]
        if (effectiveFlags === BigInt(0) || Boolean(effectiveFlags & effectiveFlag)) {
          await this.setCapabilityValueFromDevice(capability, resultData[tag as keyof typeof resultData])
        }
      }
      for (const capability in this.getCapabilityMapping) {
        const { tag } = this.getCapabilityMapping[capability]
        await this.setCapabilityValueFromDevice(capability, resultData[tag as keyof typeof resultData])
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

  async setOrNotCapabilityValue (capability: string, value: boolean | number | string): Promise<void> {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(() => this.instanceLog(capability, 'is', value))
        .catch((error: unknown) => this.instanceError(error instanceof Error ? error.message : error))
    }
  }

  instanceLog (...message: any[]): void {
    this.log(this.getName(), '-', ...message)
  }

  instanceError (...message: any[]): void {
    this.error(this.getName(), '-', ...message)
  }

  async handleCapabilities (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async onCapability (_capability: string, _value: boolean | number | string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  getCapabilityValueToDevice (_capability: string, _value?: boolean | number | string): boolean | number {
    throw new Error('Method not implemented.')
  }

  async setCapabilityValueFromDevice (_capability: string, _value: boolean | number): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async customUpdate (): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
