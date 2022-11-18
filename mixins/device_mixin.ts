import 'source-map-support/register'
import Homey from 'homey'
import MELCloudApp from '../app'
import MELCloudDriverMixin from './driver_mixin'
import { Data, ListDevice, ListDevices, Settings, Value } from '../types'

export default class MELCloudDeviceMixin extends Homey.Device {
  app!: MELCloudApp
  driver!: MELCloudDriverMixin

  id!: number
  buildingid!: number
  requiredCapabilities!: string[]
  newData!: Data

  reportInterval: NodeJS.Timeout | undefined
  reportTimeout: NodeJS.Timeout | undefined
  syncTimeout: NodeJS.Timeout | undefined

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp

    const data = this.getData()
    this.id = data.id
    this.buildingid = data.buildingid
    this.requiredCapabilities = this.driver.manifest.capabilities
    this.newData = {}

    await this.handleCapabilities()
    await this.handleDashboardCapabilities()

    this.registerCapabilityListeners()
    await this.syncDataFromDevice()

    await this.runEnergyReports()
    this.planEnergyReports()
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
    const resultData: Data = await this.app.getDevice(this)
    await this.syncData(resultData)
  }

  async syncDataToDevice (newData: { [capability: string]: Value }): Promise<void> {
    this.newData = {}

    const updateData: Data = {}
    let effectiveFlags: bigint = BigInt(0)
    Object.entries(this.driver.setCapabilityMapping).forEach((entry) => {
      const [capability, values] = entry
      if (this.hasCapability(capability)) {
        const { tag, effectiveFlag } = values
        if (capability in newData) {
          effectiveFlags |= effectiveFlag
          updateData[tag] = newData[capability]
        } else {
          updateData[tag] = this.getCapabilityValueToDevice(capability)
        }
      }
    })
    updateData.EffectiveFlags = Number(effectiveFlags)

    const resultData: Data = await this.app.setDevice(this, updateData)
    await this.syncData(resultData)
  }

  async syncData (resultData: Data): Promise<void> {
    await this.updateCapabilities(resultData)

    const deviceFromList: ListDevice | null = await this.getDeviceFromList()
    await this.updateListCapabilities(deviceFromList)

    await this.customSyncData(deviceFromList)

    const interval: number = this.getSetting('interval')
    this.syncTimeout = this.homey
      .setTimeout(async () => {
        await this.syncDataFromDevice()
      }, interval * 60 * 1000)
    this.instanceLog('Next sync from device in', interval, 'minutes')
  }

  async updateCapabilities (resultData: Data): Promise<void> {
    if (Object.keys(resultData).length > 0) {
      for (const capability in this.driver.setCapabilityMapping) {
        const effectiveFlags: bigint = BigInt(resultData.EffectiveFlags)
        const { effectiveFlag } = this.driver.setCapabilityMapping[capability]
        if (effectiveFlags === BigInt(0) || Boolean((effectiveFlags ?? BigInt(0)) & effectiveFlag)) {
          const { tag } = this.driver.setCapabilityMapping[capability]
          await this.setCapabilityValueFromDevice(capability, resultData[tag])
        }
      }
      for (const capability in this.driver.getCapabilityMapping) {
        const { tag } = this.driver.getCapabilityMapping[capability]
        await this.setCapabilityValueFromDevice(capability, resultData[tag])
      }
    }
  }

  async updateListCapabilities (deviceFromList: ListDevice | null): Promise<void> {
    if (deviceFromList !== null) {
      for (const capability in this.driver.listCapabilityMapping) {
        const { tag } = this.driver.listCapabilityMapping[capability]
        await this.setCapabilityValueFromDevice(capability, deviceFromList.Device[tag])
      }
    }
  }

  async setOrNotCapabilityValue (capability: string, value: Value): Promise<void> {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(() => this.instanceLog(capability, 'is', value))
        .catch((error) => this.instanceError(error.message))
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

  registerCapabilityListeners (): void {
    throw new Error('Method not implemented.')
  }

  async onCapability (_capability: string, _value?: Value): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async runEnergyReports (): Promise<void> {
    throw new Error('Method not implemented.')
  }

  getCapabilityValueToDevice (_capability: string): Value {
    throw new Error('Method not implemented.')
  }

  async setCapabilityValueFromDevice (_capability: string, _value: Value): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async customSyncData (_deviceFromList?: ListDevice | null): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
