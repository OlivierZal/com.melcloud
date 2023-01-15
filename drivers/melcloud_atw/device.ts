import { DateTime } from 'luxon'
import MELCloudDriverAtw from './driver'
import MELCloudDeviceMixin from '../../mixins/device_mixin'
import {
  Capability,
  CapabilityValue,
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  ReportCapabilities,
  ReportCapability,
  ReportData,
  SetCapabilities,
  SetCapability,
  setCapabilityMappingAtw
} from '../../types'

const operationModeFromDevice: string[] = [
  'idle',
  'dhw',
  'heating',
  'cooling',
  'defrost',
  'standby',
  'legionella'
]

export default class MELCloudDeviceAtw extends MELCloudDeviceMixin {
  declare driver: MELCloudDriverAtw
  declare diff: SetCapabilities<MELCloudDeviceAtw>

  async onInit (): Promise<void> {
    const { canCool, hasZone2 } = this.getStore()
    this.requiredCapabilities = this.driver.getRequiredCapabilities(canCool, hasZone2)
    this.setCapabilityMapping = setCapabilityMappingAtw
    this.getCapabilityMapping = getCapabilityMappingAtw
    this.listCapabilityMapping = listCapabilityMappingAtw
    this.reportPlanParameters = {
      interval: { days: 1 },
      duration: { days: 1 },
      values: { hour: 0, minute: 10, second: 0, millisecond: 0 }
    }
    await super.onInit()
  }

  async onCapability (capability: SetCapability<MELCloudDeviceAtw>, value: CapabilityValue): Promise<void> {
    await super.onCapability(capability, value)
    switch (capability) {
      case 'onoff.forced_hot_water':
        this.diff['onoff.forced_hot_water'] = value as boolean
        break
      case 'operation_mode_zone.zone1':
        this.diff['operation_mode_zone.zone1'] = value as string
        break
      case 'operation_mode_zone_with_cool.zone1':
        this.diff['operation_mode_zone_with_cool.zone1'] = value as string
        break
      case 'operation_mode_zone.zone2':
        this.diff['operation_mode_zone.zone2'] = value as string
        break
      case 'operation_mode_zone_with_cool.zone2':
        this.diff['operation_mode_zone_with_cool.zone2'] = value as string
        break
      case 'target_temperature':
        this.diff.target_temperature = value as number
        break
      case 'target_temperature.zone2':
        this.diff['target_temperature.zone2'] = value as number
        break
      case 'target_temperature.zone1_flow_cool':
        this.diff['target_temperature.zone1_flow_cool'] = value as number
        break
      case 'target_temperature.zone1_flow_heat':
        this.diff['target_temperature.zone1_flow_heat'] = value as number
        break
      case 'target_temperature.zone2_flow_cool':
        this.diff['target_temperature.zone2_flow_cool'] = value as number
        break
      case 'target_temperature.zone2_flow_heat':
        this.diff['target_temperature.zone2_flow_heat'] = value as number
        break
      case 'target_temperature.tank_water':
        this.diff['target_temperature.tank_water'] = value as number
    }
    this.applySyncToDevice()
  }

  convertToDevice (capability: SetCapability<MELCloudDeviceAtw>, value: CapabilityValue = this.getCapabilityValue(capability)): boolean | number {
    switch (capability) {
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return Number(value)
      default:
        return super.convertToDevice(capability, value)
    }
  }

  async convertFromDevice (capability: Capability<MELCloudDeviceAtw>, value: boolean | number): Promise<void> {
    let newValue: CapabilityValue = value
    switch (capability) {
      case 'operation_mode_state':
        newValue = operationModeFromDevice[newValue as number]
        break
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        newValue = String(newValue)
        break
      case 'alarm_generic.defrost_mode':
        newValue = Boolean(newValue)
    }
    await this.setCapabilityValue(capability, newValue)
  }

  async updateThermostatMode (): Promise<void> {
    // 'Method not implemented.'
  }

  async runEnergyReports (): Promise<void> {
    const reportMapping: ReportCapabilities<MELCloudDeviceAtw> = {
      'meter_power.daily_cop': 0,
      'meter_power.daily_cop_cooling': 0,
      'meter_power.daily_cop_heating': 0,
      'meter_power.daily_cop_hotwater': 0,
      'meter_power.daily_consumed': 0,
      'meter_power.daily_consumed_cooling': 0,
      'meter_power.daily_consumed_heating': 0,
      'meter_power.daily_consumed_hotwater': 0,
      'meter_power.daily_produced': 0,
      'meter_power.daily_produced_cooling': 0,
      'meter_power.daily_produced_heating': 0,
      'meter_power.daily_produced_hotwater': 0,
      'meter_power.total_cop': 0,
      'meter_power.total_cop_cooling': 0,
      'meter_power.total_cop_heating': 0,
      'meter_power.total_cop_hotwater': 0,
      'meter_power.total_consumed': 0,
      'meter_power.total_consumed_cooling': 0,
      'meter_power.total_consumed_heating': 0,
      'meter_power.total_consumed_hotwater': 0,
      'meter_power.total_produced': 0,
      'meter_power.total_produced_cooling': 0,
      'meter_power.total_produced_heating': 0,
      'meter_power.total_produced_hotwater': 0
    }
    const toDate: DateTime = DateTime.now().minus({ days: 1 })
    const periods: { [period in 'daily' | 'total']: { fromDate: DateTime, toDate: DateTime } } = {
      daily: { fromDate: toDate, toDate },
      total: { fromDate: DateTime.local(1970), toDate }
    }
    for (const [period, { fromDate, toDate }] of Object.entries(periods)) {
      const data: ReportData<MELCloudDeviceAtw> | null = await this.app.reportEnergyCost(this, fromDate, toDate)
      if (data !== null) {
        for (const mode of ['Cooling', 'Heating', 'HotWater']) {
          for (const type of ['Consumed', 'Produced']) {
            reportMapping[
              `meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>
            ] = data[`Total${mode}${type}` as keyof ReportData<MELCloudDeviceAtw>]
            reportMapping[
              `meter_power.${period}_${type.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>
            ] += reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>]
          }
          reportMapping[
            `meter_power.${period}_cop_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>
          ] = data[`Total${mode}Produced` as keyof ReportData<MELCloudDeviceAtw>] /
            data[`Total${mode}Consumed` as keyof ReportData<MELCloudDeviceAtw>]
        }
        reportMapping[
          `meter_power.${period}_cop` as ReportCapability<MELCloudDeviceAtw>
        ] = reportMapping[`meter_power.${period}_produced` as ReportCapability<MELCloudDeviceAtw>] /
          reportMapping[`meter_power.${period}_consumed` as ReportCapability<MELCloudDeviceAtw>]
      }
    }
    for (const [capability, value] of Object.entries(reportMapping)) {
      await this.convertFromDevice(capability as ReportCapability<MELCloudDeviceAtw>, value)
    }
    this.planEnergyReports()
  }
}

module.exports = MELCloudDeviceAtw
