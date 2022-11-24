import 'source-map-support/register'

import MELCloudDeviceMixin from '../../mixins/device_mixin'
import MELCloudDriverAtw from './driver'
import { Diff, ReportData, ReportMapping } from '../../types'

const setCapabilityMappingAtw = {
  onoff: { tag: 'Power', effectiveFlag: BigInt(0x1) },
  'operation_mode_zone.zone1': { tag: 'OperationModeZone1', effectiveFlag: BigInt(0x8) },
  'operation_mode_zone_with_cool.zone1': { tag: 'OperationModeZone1', effectiveFlag: BigInt(0x8) },
  'operation_mode_zone.zone2': { tag: 'OperationModeZone2', effectiveFlag: BigInt(0x10) },
  'operation_mode_zone_with_cool.zone2': { tag: 'OperationModeZone2', effectiveFlag: BigInt(0x10) },
  'onoff.forced_hot_water': { tag: 'ForcedHotWaterMode', effectiveFlag: BigInt(0x10000) },
  target_temperature: { tag: 'SetTemperatureZone1', effectiveFlag: BigInt(0x200000080) },
  'target_temperature.zone2': { tag: 'SetTemperatureZone2', effectiveFlag: BigInt(0x800000200) },
  'target_temperature.zone1_flow_cool': { tag: 'SetCoolFlowTemperatureZone1', effectiveFlag: BigInt(0x1000000000000) },
  'target_temperature.zone1_flow_heat': { tag: 'SetHeatFlowTemperatureZone1', effectiveFlag: BigInt(0x1000000000000) },
  'target_temperature.zone2_flow_cool': { tag: 'SetCoolFlowTemperatureZone2', effectiveFlag: BigInt(0x1000000000000) },
  'target_temperature.zone2_flow_heat': { tag: 'SetHeatFlowTemperatureZone2', effectiveFlag: BigInt(0x1000000000000) },
  'target_temperature.tank_water': { tag: 'SetTankWaterTemperature', effectiveFlag: BigInt(0x1000000000020) }
} as const

const getCapabilityMappingAtw = {
  eco_hot_water: { tag: 'EcoHotWater' },
  measure_temperature: { tag: 'RoomTemperatureZone1' },
  'measure_temperature.zone2': { tag: 'RoomTemperatureZone2' },
  'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
  'measure_temperature.tank_water': { tag: 'TankWaterTemperature' },
  operation_mode_state: { tag: 'OperationMode' }
} as const

const listCapabilityMappingAtw = {
  'alarm_generic.booster_heater1': { tag: 'BoosterHeater1Status' },
  'alarm_generic.booster_heater2': { tag: 'BoosterHeater2Status' },
  'alarm_generic.booster_heater2_plus': { tag: 'BoosterHeater2PlusStatus' },
  'alarm_generic.defrost_mode': { tag: 'DefrostMode' },
  'alarm_generic.immersion_heater': { tag: 'ImmersionHeaterStatus' },
  'measure_power.heat_pump_frequency': { tag: 'HeatPumpFrequency' },
  'measure_power.wifi': { tag: 'WifiSignalStrength' },
  'measure_temperature.flow': { tag: 'FlowTemperature' },
  'measure_temperature.return': { tag: 'ReturnTemperature' }
} as const

const operationModeFromDevice = {
  0: 'idle',
  1: 'dhw',
  2: 'heating',
  3: 'cooling',
  4: 'defrost',
  5: 'standby',
  6: 'legionella'
} as const

export default class MELCloudDeviceAtw extends MELCloudDeviceMixin {
  driver!: MELCloudDriverAtw
  diff!: Diff<MELCloudDeviceAtw>

  async onInit (): Promise<void> {
    this.setCapabilityMapping = setCapabilityMappingAtw
    this.getCapabilityMapping = getCapabilityMappingAtw
    this.listCapabilityMapping = listCapabilityMappingAtw
    await super.onInit()
  }

  async handleCapabilities (): Promise<void> {
    const store = this.getStore()
    const currentCapabilities = this.getCapabilities()

    for (const capability of currentCapabilities) {
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

  async onCapability (capability: string, value: boolean | number | string): Promise<void> {
    this.homey.clearTimeout(this.syncTimeout)

    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true) {
          await this.setWarning('Setting `Always On` is activated')
          await this.setWarning(null)
        }
        this.diff[capability] = value as boolean
        break
      case 'onoff.forced_hot_water':
        this.diff[capability] = value as boolean
        break
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone2':
        this.diff[capability] = value as string
        break
      case 'target_temperature':
      case 'target_temperature.zone2':
      case 'target_temperature.zone1_flow_cool':
      case 'target_temperature.zone1_flow_heat':
      case 'target_temperature.zone2_flow_cool':
      case 'target_temperature.zone2_flow_heat':
      case 'target_temperature.tank_water':
        this.diff[capability] = value as number
        break
      default:
        this.error('Unknown capability', capability, '- with value', value)
    }

    this.syncTimeout = this.homey.setTimeout(async () => {
      await this.syncDataToDevice(this.diff)
    }, 1 * 1000)
  }

  getCapabilityValueToDevice (capability: string, value?: boolean | number | string): boolean | number {
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

  async setCapabilityValueFromDevice (capability: string, value: boolean | number): Promise<void> {
    let newValue: boolean | number | string = value
    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true && newValue === false) {
          await this.setSettings({ always_on: false })
        }
        break
      case 'operation_mode_state':
        newValue = operationModeFromDevice[newValue as keyof typeof operationModeFromDevice]
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
    const report: { daily: ReportData<MELCloudDeviceAtw> | {}, total: ReportData<MELCloudDeviceAtw> | {} } = {
      daily: await this.app.reportEnergyCost(this, true),
      total: await this.app.reportEnergyCost(this, false)
    }

    const reportMapping: ReportMapping<MELCloudDeviceAtw> = {
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
    Object.entries(report).forEach((entry: [string, ReportData<MELCloudDeviceAtw> | {}]) => {
      const [period, data]: [string, ReportData<MELCloudDeviceAtw> | {}] = entry
      if ('TotalHeatingConsumed' in data) {
        ['Consumed', 'Produced'].forEach((type: string) => {
          ['Cooling', 'Heating', 'HotWater'].forEach((mode: string) => {
            reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}` as keyof ReportMapping<MELCloudDeviceAtw>] = data[`Total${mode}${type}` as keyof ReportData<MELCloudDeviceAtw>]
            reportMapping[`meter_power.${period}_${type.toLowerCase()}` as keyof ReportMapping<MELCloudDeviceAtw>] += reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}` as keyof ReportMapping<MELCloudDeviceAtw>]
          })
        });
        ['Cooling', 'Heating', 'HotWater'].forEach((mode: string) => {
          reportMapping[`meter_power.${period}_cop_${mode.toLowerCase()}` as keyof ReportMapping<MELCloudDeviceAtw>] = data[`Total${mode}Produced` as keyof ReportData<MELCloudDeviceAtw>] / (data[`Total${mode}Consumed` as keyof ReportData<MELCloudDeviceAtw>])
        })
        reportMapping[`meter_power.${period}_cop` as keyof ReportMapping<MELCloudDeviceAtw>] = reportMapping[`meter_power.${period}_produced` as keyof ReportMapping<MELCloudDeviceAtw>] / reportMapping[`meter_power.${period}_consumed` as keyof ReportMapping<MELCloudDeviceAtw>]
      }
    })

    for (const capability in reportMapping) {
      await this.setCapabilityValueFromDevice(capability, reportMapping[capability as keyof ReportMapping<MELCloudDeviceAtw>])
    }
  }
}

module.exports = MELCloudDeviceAtw
