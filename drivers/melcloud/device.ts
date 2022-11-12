import MELCloudDeviceMixin from '../../mixins/device_mixin'
import MELCloudDriverAta from './driver'
import { Data, ReportMapping, Value } from '../../types'

function reverse (mapping: any): any {
  const reversedMapping: any = {}
  Object.keys(mapping).forEach((key) => {
    reversedMapping[mapping[key]] = key
  })
  return reversedMapping
}

const operationModeFromDevice: { [key: number]: string } = {
  1: 'heat',
  2: 'dry',
  3: 'cool',
  7: 'fan',
  8: 'auto'
} as const

const operationModeToDevice = reverse(operationModeFromDevice)

const verticalFromDevice: { [key: number]: string } = {
  0: 'auto',
  1: 'top',
  2: 'middletop',
  3: 'middle',
  4: 'middlebottom',
  5: 'bottom',
  7: 'swing'
} as const

const verticalToDevice = reverse(verticalFromDevice)

const horizontalFromDevice: { [key: number]: string } = {
  0: 'auto',
  1: 'left',
  2: 'middleleft',
  3: 'middle',
  4: 'middleright',
  5: 'right',
  8: 'split',
  12: 'swing'
} as const

const horizontalToDevice = reverse(horizontalFromDevice)

class MELCloudDeviceAta extends MELCloudDeviceMixin {
  driver!: MELCloudDriverAta

  async handleCapabilities (): Promise<void> {
    const currentCapabilities = this.getCapabilities()
    for (const capability of currentCapabilities) {
      if (!this.requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability)
      }
    }
    for (const capability of this.requiredCapabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability)
      }
    }
  }

  registerCapabilityListeners (): void {
    this.registerCapabilityListener('onoff', async (value: boolean) => {
      await this.onCapability('onoff', value)
    })
    this.registerCapabilityListener('target_temperature', async (value: number) => {
      await this.onCapability('target_temperature', value)
    })
    this.registerCapabilityListener('thermostat_mode', async (value: string) => {
      await this.onCapability('thermostat_mode', value)
    })
    this.registerCapabilityListener('operation_mode', async (value: string) => {
      await this.onCapability('operation_mode', value)
    })
    this.registerCapabilityListener('fan_power', async (value: number) => {
      await this.onCapability('fan_power', value)
    })
    this.registerCapabilityListener('vertical', async (value: string) => {
      await this.onCapability('vertical', value)
    })
    this.registerCapabilityListener('horizontal', async (value: string) => {
      await this.onCapability('horizontal', value)
    })
  }

  async runEnergyReports (): Promise<void> {
    const report: { daily: Data, total: Data } = {
      daily: await this.app.reportEnergyCost(this, true),
      total: await this.app.reportEnergyCost(this, false)
    }

    const reportMapping: ReportMapping = {}
    Object.entries(report).forEach((entry) => {
      const [period, data]: [string, Data] = entry
      if (Object.keys(data).length > 0) {
        const deviceCount: number = typeof data.UsageDisclaimerPercentages === 'string'
          ? data.UsageDisclaimerPercentages.split(', ').length
          : 1
        reportMapping[`meter_power.${period}_consumed`] = 0;
        ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'].forEach((mode) => {
          reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}`] = data[`Total${mode}Consumed`] as number / deviceCount
          reportMapping[`meter_power.${period}_consumed`] += reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}`]
        })
      }
    })

    for (const capability in reportMapping) {
      await this.setCapabilityValueFromDevice(capability, reportMapping[capability])
    }
  }

  async customSyncData (): Promise<void> {
    await this.updateThermostatMode(this.getCapabilityValue('onoff'), this.getCapabilityValue('operation_mode'))
  }

  async updateThermostatMode (isOn: boolean, operationMode: string): Promise<void> {
    let value: string = operationMode
    if (!isOn || ['dry', 'fan'].includes(operationMode)) {
      value = 'off'
    }
    await this.setOrNotCapabilityValue('thermostat_mode', value)
  }

  async onCapability (capability: string, value: Value): Promise<void> {
    this.homey.clearTimeout(this.syncTimeout)

    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true) {
          await this.setWarning('Setting `Always On` is activated')
          await this.setWarning(null)
        }
        this.newData[capability] = this.getCapabilityValueToDevice(capability, value)
        break
      case 'thermostat_mode':
        this.newData.onoff = this.getCapabilityValueToDevice('onoff', value !== 'off')
        if (value !== 'off') {
          this.newData.operation_mode = this.getCapabilityValueToDevice('operation_mode', value)
        }
        break
      case 'operation_mode':
        if (['dry', 'fan'].includes(value as string) && this.getCapabilityValue('thermostat_mode') !== 'off') {
          await this.setWarning(`\`${String(value)}\` has been saved (even if \`heat\` is displayed)`)
          await this.setWarning(null)
        }
        this.newData[capability] = this.getCapabilityValueToDevice(capability, value)
        break
      default:
        this.newData[capability] = this.getCapabilityValueToDevice(capability, value)
    }

    this.syncTimeout = this.homey.setTimeout(async () => {
      await this.syncDataToDevice(this.newData)
    }, 1 * 1000)
  }

  getCapabilityValueToDevice (capability: string, value?: Value): Value {
    const newValue: Value = value ?? this.getCapabilityValue(capability)
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true ? true : newValue
      case 'operation_mode':
        return operationModeToDevice[newValue as keyof typeof operationModeToDevice]
      case 'vertical':
        return verticalToDevice[newValue as keyof typeof verticalToDevice]
      case 'horizontal':
        return horizontalToDevice[newValue as keyof typeof horizontalToDevice]
      default:
        return newValue
    }
  }

  async setCapabilityValueFromDevice (capability: string, value: Value): Promise<void> {
    let newValue: Value = value
    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true && newValue === false) {
          await this.setSettings({ always_on: false })
        }
        break
      case 'operation_mode':
        newValue = operationModeFromDevice[newValue as keyof typeof operationModeFromDevice]
        break
      case 'vertical':
        newValue = verticalFromDevice[newValue as keyof typeof verticalFromDevice]
        break
      case 'horizontal':
        newValue = horizontalFromDevice[newValue as keyof typeof horizontalFromDevice]
        break
      default:
    }
    await this.setOrNotCapabilityValue(capability, newValue)
  }
}

module.exports = MELCloudDeviceAta
