import { DateTime } from 'luxon'
import MELCloudDeviceMixin from '../../mixins/device_mixin'
import type MELCloudDriverAta from './driver'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  setCapabilityMappingAta,
  type Capability,
  type CapabilityValue,
  type ExtendedSetCapability,
  type ReportCapabilities,
  type ReportCapability,
  type ReportData,
  type SetCapabilities,
  type SetCapability,
  type ThermostatMode
} from '../../types'

function reverse(mapping: Record<string, string>): Record<string, string> {
  const reversedMapping: Record<string, string> = {}
  for (const [capabilityValue, deviceValue] of Object.entries(mapping)) {
    reversedMapping[deviceValue] = capabilityValue
  }
  return reversedMapping
}

const operationModeFromDevice: Record<string, string> = {
  1: 'heat',
  2: 'dry',
  3: 'cool',
  7: 'fan',
  8: 'auto'
} as const

const operationModeToDevice: Record<string, string> = reverse(
  operationModeFromDevice
)

const verticalFromDevice: Record<string, string> = {
  0: 'auto',
  1: 'top',
  2: 'middletop',
  3: 'middle',
  4: 'middlebottom',
  5: 'bottom',
  7: 'swing'
} as const

const verticalToDevice: Record<string, string> = reverse(verticalFromDevice)

const horizontalFromDevice: Record<string, string> = {
  0: 'auto',
  1: 'left',
  2: 'middleleft',
  3: 'middle',
  4: 'middleright',
  5: 'right',
  8: 'split',
  12: 'swing'
} as const

const horizontalToDevice: Record<string, string> = reverse(horizontalFromDevice)

export default class MELCloudDeviceAta extends MELCloudDeviceMixin {
  declare driver: MELCloudDriverAta
  declare operationModeCapability: SetCapability<MELCloudDeviceAta>
  declare diff: SetCapabilities<MELCloudDeviceAta>

  async onInit(): Promise<void> {
    this.operationModeCapability = 'operation_mode'
    this.operationModeToThermostatMode = {
      auto: 'auto',
      heat: 'heat',
      cool: 'cool',
      dry: 'off',
      fan: 'off'
    } as const
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

  async specificOnCapability(
    capability: ExtendedSetCapability<MELCloudDeviceAta>,
    value: CapabilityValue
  ): Promise<void> {
    switch (capability) {
      case 'thermostat_mode':
        if (value !== 'off') {
          this.diff.operation_mode = reverse(
            this.operationModeToThermostatMode
          )[value as ThermostatMode]
        }
        break
      case 'operation_mode':
        if (
          ['dry', 'fan'].includes(value as string) &&
          this.getCapabilityValue('thermostat_mode') !== 'off'
        ) {
          await this.setWarning(
            this.homey.__('warnings.operation_mode.message', {
              value: this.homey.__(
                `warnings.operation_mode.values.${value as string}`
              )
            })
          )
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
      case 'fan_power':
        this.diff.fan_power = value as number
    }
  }

  convertToDevice(
    capability: SetCapability<MELCloudDeviceAta>,
    value: CapabilityValue = this.getCapabilityValue(capability)
  ): boolean | number {
    switch (capability) {
      case 'operation_mode':
        return Number(operationModeToDevice[value as string])
      case 'vertical':
        return Number(verticalToDevice[value as string])
      case 'horizontal':
        return Number(horizontalToDevice[value as string])
      default:
        return super.convertToDevice(capability, value)
    }
  }

  async convertFromDevice(
    capability: Capability<MELCloudDeviceAta>,
    value: boolean | number
  ): Promise<void> {
    let newValue: CapabilityValue = value
    switch (capability) {
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

  async runEnergyReports(): Promise<void> {
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
    const periods: {
      [period in 'hourly' | 'daily' | 'total']: {
        fromDate: DateTime
        toDate: DateTime
      }
    } = {
      hourly: { fromDate: toDate, toDate },
      daily: { fromDate: toDate, toDate },
      total: { fromDate: DateTime.local(1970), toDate }
    }
    for (const [period, { fromDate, toDate }] of Object.entries(periods)) {
      const data: ReportData<MELCloudDeviceAta> | null =
        await this.app.reportEnergyCost(this, fromDate, toDate)
      if (data !== null) {
        for (const mode of [
          'Auto',
          'Cooling',
          'Dry',
          'Fan',
          'Heating',
          'Other'
        ]) {
          const modeData: number =
            period === 'hourly'
              ? (data[mode as keyof ReportData<MELCloudDeviceAta>] as number[])[
                  toDate.hour
                ]
              : (data[
                  `Total${mode}Consumed` as keyof ReportData<MELCloudDeviceAta>
                ] as number)
          reportMapping[
            `meter_power.${period}_consumed_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAta>
          ] = modeData / data.UsageDisclaimerPercentages.split(', ').length
          reportMapping[
            `meter_power.${period}_consumed` as ReportCapability<MELCloudDeviceAta>
          ] +=
            reportMapping[
              `meter_power.${period}_consumed_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAta>
            ]
        }
      }
    }
    for (const [capability, value] of Object.entries(reportMapping)) {
      await this.convertFromDevice(
        capability as ReportCapability<MELCloudDeviceAta>,
        value
      )
    }
    this.planEnergyReports()
  }
}

module.exports = MELCloudDeviceAta
