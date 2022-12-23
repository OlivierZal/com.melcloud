import { DateTime } from 'luxon'

import MELCloudDriverAta from './driver'
import MELCloudDeviceMixin from '../../mixins/device_mixin'
import {
  Capability,
  ExtendedSetCapability,
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  ReportCapabilities,
  ReportCapability,
  ReportData,
  SetCapabilities,
  SetCapability,
  setCapabilityMappingAta
} from '../../types'

function reverse (mapping: Record<number, string>): Record<string, number> {
  const reversedMapping: Record<string, number> = {}
  for (const [capabilityValue, deviceValue] of Object.entries(mapping)) {
    reversedMapping[deviceValue] = Number(capabilityValue)
  }
  return reversedMapping
}

const operationModeFromDevice: Record<number, string> = {
  1: 'heat',
  2: 'dry',
  3: 'cool',
  7: 'fan',
  8: 'auto'
} as const

const operationModeToDevice: Record<string, number> = reverse(operationModeFromDevice)

const verticalFromDevice: Record<number, string> = {
  0: 'auto',
  1: 'top',
  2: 'middletop',
  3: 'middle',
  4: 'middlebottom',
  5: 'bottom',
  7: 'swing'
} as const

const verticalToDevice: Record<string, number> = reverse(verticalFromDevice)

const horizontalFromDevice: Record<number, string> = {
  0: 'auto',
  1: 'left',
  2: 'middleleft',
  3: 'middle',
  4: 'middleright',
  5: 'right',
  8: 'split',
  12: 'swing'
} as const

const horizontalToDevice: Record<string, number> = reverse(horizontalFromDevice)

export default class MELCloudDeviceAta extends MELCloudDeviceMixin {
  declare driver: MELCloudDriverAta
  declare diff: SetCapabilities<MELCloudDeviceAta>

  async onInit (): Promise<void> {
    this.requiredCapabilities = [
      ...Object.keys(setCapabilityMappingAta),
      ...Object.keys(getCapabilityMappingAta),
      'thermostat_mode'
    ]
    this.setCapabilityMapping = setCapabilityMappingAta
    this.getCapabilityMapping = getCapabilityMappingAta
    this.listCapabilityMapping = listCapabilityMappingAta
    this.reportPlanParameters = {
      interval: { hours: 1 },
      duration: { hours: 1 },
      values: { minute: 10, second: 0, millisecond: 0 }
    }
    await super.onInit()
  }

  registerCapabilityListeners (): void {
    super.registerCapabilityListeners()
    this.registerCapabilityListener('thermostat_mode', async (value: 'auto' | 'cool' | 'heat' | 'off'): Promise<void> => {
      await this.onCapability('thermostat_mode', value)
    })
  }

  async onCapability (capability: ExtendedSetCapability<MELCloudDeviceAta>, value: boolean | number | string): Promise<void> {
    this.clearSyncPlan()
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
      case 'vertical':
        this.diff.vertical = value as string
        break
      case 'horizontal':
        this.diff.horizontal = value as string
        break
      case 'target_temperature':
        this.diff.target_temperature = value as number
        break
      case 'fan_power':
        this.diff.fan_power = value as number
    }
    this.applySyncToDevice()
  }

  convertToDevice (capability: SetCapability<MELCloudDeviceAta>, value?: boolean | number | string): boolean | number {
    const newValue: boolean | number | string = value ?? this.getCapabilityValue(capability)
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true ? true : newValue as boolean
      case 'operation_mode':
        return operationModeToDevice[newValue as string]
      case 'vertical':
        return verticalToDevice[newValue as string]
      case 'horizontal':
        return horizontalToDevice[newValue as string]
      default:
        return newValue as number
    }
  }

  async convertFromDevice (capability: Capability<MELCloudDeviceAta>, value: boolean | number): Promise<void> {
    let newValue: boolean | number | string = value
    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true && newValue === false) {
          await this.setSettings({ always_on: false })
        }
        break
      case 'operation_mode':
        newValue = operationModeFromDevice[newValue as number]
        break
      case 'vertical':
        newValue = verticalFromDevice[newValue as number]
        break
      case 'horizontal':
        newValue = horizontalFromDevice[newValue as number]
    }
    await this.setCapabilityValue(capability, newValue)
  }

  async customUpdate (): Promise<void> {
    let operationMode: string = this.getCapabilityValue('operation_mode')
    if (this.getCapabilityValue('onoff') === false || ['dry', 'fan'].includes(operationMode)) {
      operationMode = 'off'
    }
    await this.setCapabilityValue('thermostat_mode', operationMode)
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
    const periods: { [period in 'hourly' | 'daily' | 'total']: { fromDate: DateTime, toDate: DateTime } } = {
      hourly: { fromDate: toDate, toDate },
      daily: { fromDate: toDate, toDate },
      total: { fromDate: DateTime.local(1970), toDate }
    }
    for (const [period, { fromDate, toDate }] of Object.entries(periods)) {
      const data: ReportData<MELCloudDeviceAta> | null = await this.app.reportEnergyCost(this, fromDate, toDate)
      if (data !== null) {
        const deviceCount: number = typeof data.UsageDisclaimerPercentages === 'string'
          ? data.UsageDisclaimerPercentages.split(', ').length
          : 1
        for (const mode of ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other']) {
          const modeData: number = period === 'hourly'
            ? (data[mode as keyof ReportData<MELCloudDeviceAta>] as number[])[toDate.hour]
            : data[`Total${mode}Consumed` as keyof ReportData<MELCloudDeviceAta>] as number
          reportMapping[
            `meter_power.${period}_consumed_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAta>
          ] = modeData / deviceCount
          reportMapping[
            `meter_power.${period}_consumed` as ReportCapability<MELCloudDeviceAta>
          ] += reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAta>]
        }
      }
    }
    for (const [capability, value] of Object.entries(reportMapping)) {
      await this.convertFromDevice(capability as ReportCapability<MELCloudDeviceAta>, value)
    }
    this.planEnergyReports()
  }
}

module.exports = MELCloudDeviceAta
