import 'source-map-support/register'
import { DateTime } from 'luxon'

import MELCloudDeviceMixin from '../../mixins/device_mixin'
import MELCloudDriverAta from './driver'
import { Capability, getCapabilityMappingAta, listCapabilityMappingAta, ReportCapabilities, ReportCapability, ReportData, SetCapabilities, SetCapability, setCapabilityMappingAta } from '../../types'

function reverse (mapping: any): any {
  const reversedMapping: any = {}
  Object.entries(mapping).forEach(([key, value]: [any, any]): void => {
    reversedMapping[value] = key
  })
  return reversedMapping
}

const operationModeFromDevice: { [key: number]: keyof typeof operationModeToDevice } = {
  1: 'heat',
  2: 'dry',
  3: 'cool',
  7: 'fan',
  8: 'auto'
} as const

const operationModeToDevice: { [key: string]: keyof typeof operationModeFromDevice } = reverse(operationModeFromDevice)

const verticalFromDevice: { [key: number]: keyof typeof verticalToDevice } = {
  0: 'auto',
  1: 'top',
  2: 'middletop',
  3: 'middle',
  4: 'middlebottom',
  5: 'bottom',
  7: 'swing'
} as const

const verticalToDevice: { [key: string]: keyof typeof verticalFromDevice } = reverse(verticalFromDevice)

const horizontalFromDevice: { [key: number]: keyof typeof horizontalToDevice } = {
  0: 'auto',
  1: 'left',
  2: 'middleleft',
  3: 'middle',
  4: 'middleright',
  5: 'right',
  8: 'split',
  12: 'swing'
} as const

const horizontalToDevice: { [key: string]: keyof typeof horizontalFromDevice } = reverse(horizontalFromDevice)

export default class MELCloudDeviceAta extends MELCloudDeviceMixin {
  setCapabilityMapping!: typeof setCapabilityMappingAta
  getCapabilityMapping!: typeof getCapabilityMappingAta
  listCapabilityMapping!: typeof listCapabilityMappingAta

  driver!: MELCloudDriverAta
  diff!: SetCapabilities<MELCloudDeviceAta>

  async onInit (): Promise<void> {
    this.setCapabilityMapping = setCapabilityMappingAta
    this.getCapabilityMapping = getCapabilityMappingAta
    this.listCapabilityMapping = listCapabilityMappingAta
    await super.onInit()
  }

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
    super.registerCapabilityListeners()
    this.registerCapabilityListener('thermostat_mode', async (value: 'auto' | 'cool' | 'heat' | 'off'): Promise<void> => {
      await this.onCapability('thermostat_mode', value)
    })
  }

  async onCapability (capability: SetCapability<MELCloudDeviceAta> | 'thermostat_mode', value: boolean | number | string): Promise<void> {
    this.homey.clearTimeout(this.syncTimeout)

    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true) {
          await this.setWarning('Setting `Always On` is activated')
          await this.setWarning(null)
        }
        this.diff.onoff = value as boolean
        break
      case 'thermostat_mode':
        this.diff.onoff = value !== 'off'
        if (value !== 'off') {
          this.diff.operation_mode = value as string
        }
        break
      case 'operation_mode':
        if (['dry', 'fan'].includes(value as string) && this.getCapabilityValue('thermostat_mode') !== 'off') {
          await this.setWarning(`\`${value as string}\` has been saved (even if \`heat\` is displayed)`)
          await this.setWarning(null)
        }
        this.diff.operation_mode = value as string
        break
      case 'target_temperature':
        this.diff.target_temperature = value as number
        break
      case 'dim':
        this.diff.dim = value as number
        break
      case 'vertical':
        this.diff.vertical = value as string
        break
      case 'horizontal':
        this.diff.horizontal = value as string
        break
      default:
        this.error('Unknown capability', capability, '- with value', value)
    }

    this.syncTimeout = this.homey.setTimeout(async (): Promise<void> => {
      await this.syncDataToDevice(this.diff)
    }, 1 * 1000)
  }

  getCapabilityValueToDevice (capability: SetCapability<MELCloudDeviceAta>, value?: boolean | number | string): boolean | number {
    const newValue: boolean | number | string = value ?? this.getCapabilityValue(capability)
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true ? true : newValue as boolean
      case 'dim':
        return newValue as number * 5
      case 'operation_mode':
        return operationModeToDevice[newValue as keyof typeof operationModeToDevice]
      case 'vertical':
        return verticalToDevice[newValue as keyof typeof verticalToDevice]
      case 'horizontal':
        return horizontalToDevice[newValue as keyof typeof horizontalToDevice]
      default:
        return newValue as number
    }
  }

  async setCapabilityValueFromDevice (capability: Capability<MELCloudDeviceAta>, value: boolean | number): Promise<void> {
    let newValue: boolean | number | string = value
    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true && newValue === false) {
          await this.setSettings({ always_on: false })
        }
        break
      case 'dim':
        newValue = newValue as number / 5
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

  async customUpdate (): Promise<void> {
    const isOn: boolean = this.getCapabilityValue('onoff')
    let operationMode: string = this.getCapabilityValue('operation_mode')
    if (!isOn || ['dry', 'fan'].includes(operationMode)) {
      operationMode = 'off'
    }
    await this.setOrNotCapabilityValue('thermostat_mode', operationMode)
  }

  async runEnergyReports (): Promise<void> {
    const reportMapping: ReportCapabilities<MELCloudDeviceAta> = {
      'meter_power.hourly_consumed': 0,
      'meter_power.hourly_consumed_auto': 0,
      'meter_power.hourly_consumed_cooling': 0,
      'meter_power.hourly_consumed_dry': 0,
      'meter_power.hourly_consumed_fan': 0,
      'meter_power.hourly_consumed_heating': 0,
      'meter_power.hourly_consumed_other': 0,
      'meter_power.daily_consumed': 0,
      'meter_power.daily_consumed_auto': 0,
      'meter_power.daily_consumed_cooling': 0,
      'meter_power.daily_consumed_dry': 0,
      'meter_power.daily_consumed_fan': 0,
      'meter_power.daily_consumed_heating': 0,
      'meter_power.daily_consumed_other': 0,
      'meter_power.total_consumed': 0,
      'meter_power.total_consumed_auto': 0,
      'meter_power.total_consumed_cooling': 0,
      'meter_power.total_consumed_dry': 0,
      'meter_power.total_consumed_fan': 0,
      'meter_power.total_consumed_heating': 0,
      'meter_power.total_consumed_other': 0
    }
    const toDate: DateTime = DateTime.now().minus({ hours: 1 })
    const periods: { [period: string]: { fromDate: DateTime, toDate: DateTime } } = {
      hourly: { fromDate: toDate, toDate },
      daily: { fromDate: toDate, toDate },
      total: { fromDate: DateTime.local(1970), toDate }
    }
    for (const period in periods) {
      const { fromDate, toDate } = periods[period]
      const data: ReportData<MELCloudDeviceAta> | {} = await this.app.reportEnergyCost(this, fromDate, toDate)
      if ('UsageDisclaimerPercentages' in data) {
        const deviceCount: number = typeof data.UsageDisclaimerPercentages === 'string'
          ? data.UsageDisclaimerPercentages.split(', ').length
          : 1;
        ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'].forEach((mode: string): void => {
          let modeData: number
          if (period === 'hourly') {
            modeData = (data[mode as keyof ReportData<MELCloudDeviceAta>] as number[])[toDate.hour]
          } else {
            modeData = data[`Total${mode}Consumed` as keyof ReportData<MELCloudDeviceAta>] as number
          }
          reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAta>] = modeData / deviceCount
          reportMapping[`meter_power.${period}_consumed` as ReportCapability<MELCloudDeviceAta>] +=
            reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAta>]
        })
      }
    }

    for (const capability in reportMapping) {
      await this.setCapabilityValueFromDevice(capability as Capability<MELCloudDeviceAta>, reportMapping[capability as ReportCapability<MELCloudDeviceAta>])
    }
  }

  planEnergyReports (): void {
    const date: DateTime = DateTime.now().plus({ hours: 1 }).set({ minute: 0, second: 0, millisecond: 0 })
    this.reportTimeout = this.homey.setTimeout(async (): Promise<void> => {
      await this.runEnergyReports()
      this.reportInterval = this.homey.setInterval(async (): Promise<void> => {
        await this.runEnergyReports()
      }, 60 * 60 * 1000)
    }, Number(date.diffNow()))
  }
}

module.exports = MELCloudDeviceAta
