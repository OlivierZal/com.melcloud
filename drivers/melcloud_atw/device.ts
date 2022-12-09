import { DateTime } from 'luxon'

import MELCloudDriverAtw from './driver'
import MELCloudDeviceMixin from '../../mixins/device_mixin'
import {
  Capability,
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
  setCapabilityMapping!: typeof setCapabilityMappingAtw
  getCapabilityMapping!: typeof getCapabilityMappingAtw
  listCapabilityMapping!: typeof listCapabilityMappingAtw

  driver!: MELCloudDriverAtw
  diff!: SetCapabilities<MELCloudDeviceAtw>

  async onInit (): Promise<void> {
    this.setCapabilityMapping = setCapabilityMappingAtw
    this.getCapabilityMapping = getCapabilityMappingAtw
    this.listCapabilityMapping = listCapabilityMappingAtw
    await super.onInit()
  }

  async handleCapabilities (): Promise<void> {
    const store = this.getStore()

    for (const capability of this.getCapabilities()) {
      if (!this.requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability)
      }
    }

    for (const capability of this.driver.capabilitiesAtw) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability)
      }
    }

    if (store.canCool === true) {
      for (const capability of this.driver.notCoolCapabilitiesAtw) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.coolCapabilitiesAtw) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability)
        }
      }
    } else {
      for (const capability of this.driver.coolCapabilitiesAtw) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.notCoolCapabilitiesAtw) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability)
        }
      }
    }

    if (store.hasZone2 === true) {
      for (const capability of this.driver.zone2CapabilitiesAtw) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability)
        }
      }
      if (store.canCool === true) {
        for (const capability of this.driver.notCoolZone2CapabilitiesAtw) {
          if (this.hasCapability(capability)) {
            await this.removeCapability(capability)
          }
        }
        for (const capability of this.driver.coolZone2CapabilitiesAtw) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability)
          }
        }
      } else {
        for (const capability of this.driver.coolZone2CapabilitiesAtw) {
          if (this.hasCapability(capability)) {
            await this.removeCapability(capability)
          }
        }
        for (const capability of this.driver.notCoolZone2CapabilitiesAtw) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability)
          }
        }
      }
    } else {
      for (const capability of this.driver.zone2CapabilitiesAtw) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.coolZone2CapabilitiesAtw) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.notCoolZone2CapabilitiesAtw) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
    }

    for (const capability of this.driver.otherCapabilitiesAtw) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability)
      }
    }
  }

  async onCapability (capability: SetCapability<MELCloudDeviceAtw>, value: boolean | number | string): Promise<void> {
    this.homey.clearTimeout(this.syncTimeout)

    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true) {
          await this.setWarning('Setting `Always On` is activated')
          await this.setWarning(null)
        }
        this.diff.onoff = value as boolean
        break
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
        break
      default:
        this.error('Unknown capability', capability, '- with value', value)
    }

    this.syncTimeout = this.homey.setTimeout(async (): Promise<void> => await this.syncDataToDevice(this.diff), 1 * 1000)
  }

  getCapabilityValueToDevice (capability: SetCapability<MELCloudDeviceAtw>, value?: boolean | number | string): boolean | number {
    const newValue: boolean | number | string = value ?? this.getCapabilityValue(capability)
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true ? true : newValue as boolean
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return Number(newValue)
      default:
        return newValue as boolean | number
    }
  }

  async setCapabilityValueFromDevice (capability: Capability<MELCloudDeviceAtw>, value: boolean | number): Promise<void> {
    let newValue: boolean | number | string = value
    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true && newValue === false) {
          await this.setSettings({ always_on: false })
        }
        break
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
        break
      default:
    }
    await this.setOrNotCapabilityValue(capability, newValue)
  }

  async customUpdate (): Promise<void> {
    if (this.deviceFromList !== null) {
      const store = this.getStore()

      let hasStoreChanged = false
      if (this.deviceFromList.Device.CanCool !== store.canCool) {
        await this.setStoreValue('canCool', this.deviceFromList.Device.CanCool)
        hasStoreChanged = true
      }
      if (this.deviceFromList.Device.HasZone2 !== store.hasZone2) {
        await this.setStoreValue('hasZone2', this.deviceFromList.Device.HasZone2)
        hasStoreChanged = true
      }

      if (hasStoreChanged) {
        await this.handleCapabilities()
      }
    }
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
    const periods: { [period: string]: { fromDate: DateTime, toDate: DateTime } } = {
      daily: { fromDate: toDate, toDate },
      total: { fromDate: DateTime.local(1970), toDate }
    }
    for (const period in periods) {
      const { fromDate, toDate } = periods[period]
      const data: ReportData<MELCloudDeviceAtw> | {} = await this.app.reportEnergyCost(this, fromDate, toDate)
      if ('TotalHeatingConsumed' in data) {
        ['Cooling', 'Heating', 'HotWater'].forEach((mode: string): void => {
          ['Consumed', 'Produced'].forEach((type: string): void => {
            reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>] =
              data[`Total${mode}${type}` as keyof ReportData<MELCloudDeviceAtw>]
            reportMapping[`meter_power.${period}_${type.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>] +=
              reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>]
          })
          reportMapping[`meter_power.${period}_cop_${mode.toLowerCase()}` as ReportCapability<MELCloudDeviceAtw>] =
            data[`Total${mode}Produced` as keyof ReportData<MELCloudDeviceAtw>] / data[`Total${mode}Consumed` as keyof ReportData<MELCloudDeviceAtw>]
        })
        reportMapping[`meter_power.${period}_cop` as ReportCapability<MELCloudDeviceAtw>] =
          reportMapping[`meter_power.${period}_produced` as ReportCapability<MELCloudDeviceAtw>] /
          reportMapping[`meter_power.${period}_consumed` as ReportCapability<MELCloudDeviceAtw>]
      }
    }

    for (const capability in reportMapping) {
      await this.setCapabilityValueFromDevice(capability as Capability<MELCloudDeviceAtw>, reportMapping[capability as ReportCapability<MELCloudDeviceAtw>])
    }
  }

  planEnergyReports (): void {
    const date: DateTime = DateTime.now().plus({ days: 1 }).set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
    this.reportTimeout = this.homey.setTimeout(async (): Promise<void> => {
      await this.runEnergyReports()
      this.reportInterval = this.homey.setInterval(async (): Promise<void> => await this.runEnergyReports(), 24 * 60 * 60 * 1000)
    }, Number(date.diffNow()))
  }
}

module.exports = MELCloudDeviceAtw
