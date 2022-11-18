import 'source-map-support/register'
import MELCloudDriverMixin from '../../mixins/driver_mixin'
import { DeviceInfo, ListDevices } from '../../types'

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

export default class MELCloudDriverAtw extends MELCloudDriverMixin {
  capabilitiesAtw!: string[]
  coolCapabilitiesAtw!: string[]
  notCoolCapabilitiesAtw!: string[]
  zone2CapabilitiesAtw!: string[]
  coolZone2CapabilitiesAtw!: string[]
  notCoolZone2CapabilitiesAtw!: string[]
  otherCapabilitiesAtw!: string[]

  async onInit (): Promise<void> {
    await super.onInit()

    this.deviceType = 1
    this.heatPumpType = 'Atw'

    this.setCapabilityMapping = setCapabilityMappingAtw
    this.getCapabilityMapping = getCapabilityMappingAtw
    this.listCapabilityMapping = listCapabilityMappingAtw

    this.capabilitiesAtw = [
      'measure_temperature',
      'measure_temperature.outdoor',
      'measure_temperature.flow',
      'measure_temperature.return',
      'onoff',
      'onoff.forced_hot_water',
      'operation_mode_state',
      'target_temperature',
      'target_temperature.zone1_flow_heat'
    ]
    this.coolCapabilitiesAtw = [
      'operation_mode_zone_with_cool.zone1',
      'target_temperature.zone1_flow_cool'
    ]
    this.notCoolCapabilitiesAtw = [
      'operation_mode_zone.zone1'
    ]
    this.zone2CapabilitiesAtw = [
      'measure_temperature.zone2',
      'target_temperature.zone2',
      'target_temperature.zone2_flow_heat'
    ]
    this.coolZone2CapabilitiesAtw = [
      'operation_mode_zone_with_cool.zone2',
      'target_temperature.zone2_flow_cool'
    ]
    this.notCoolZone2CapabilitiesAtw = [
      'operation_mode_zone.zone2'
    ]
    this.otherCapabilitiesAtw = [
      'measure_temperature.tank_water',
      'target_temperature.tank_water'
    ]

    // Condition flowcards
    this.homey.flow
      .getConditionCard('eco_hot_water_condition')
      .registerRunListener((args) => args.eco_hot_water === String(args.device.getCapabilityValue('eco_hot_water')))

    this.homey.flow
      .getConditionCard('onoff_forced_hot_water_condition')
      .registerRunListener((args) => args.onoff_forced_hot_water === String(args.device.getCapabilityValue('onoff.forced_hot_water')))

    this.homey.flow
      .getConditionCard('operation_mode_state_condition')
      .registerRunListener((args) => args.operation_mode_state === args.device.getCapabilityValue('operation_mode_state'))

    this.homey.flow
      .getConditionCard('operation_mode_zone1_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone1'))

    this.homey.flow
      .getConditionCard('operation_mode_zone1_with_cool_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone1'))

    this.homey.flow
      .getConditionCard('operation_mode_zone2_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone2'))

    this.homey.flow
      .getConditionCard('operation_mode_zone2_with_cool_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone2'))

    // Action flowcards
    this.homey.flow
      .getActionCard('onoff_forced_hot_water_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('onoff.forced_hot_water', args.onoff_forced_hot_water === 'true')
      })

    this.homey.flow
      .getActionCard('operation_mode_zone1_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('operation_mode.zone1', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('operation_mode_zone1_with_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('operation_mode_with_cool.zone1', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('operation_mode_zone2_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('operation_mode.zone2', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('operation_mode_zone2_with_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('operation_mode_with_cool.zone2', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('target_temperature_tank_water')
      .registerRunListener(async (args) => {
        await args.device.onCapability('target_temperature.tank_water', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone2')
      .registerRunListener(async (args) => {
        await args.device.onCapability('target_temperature.zone2', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone1_flow_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('target_temperature.zone1_flow_cool', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone1_flow_heat_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('target_temperature.zone1_flow_heat', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone2_flow_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('target_temperature.zone2_flow_cool', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone2_flow_heat_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('target_temperature.zone2_flow_heat', args.target_temperature)
      })
  }

  async discoverDevices (): Promise<DeviceInfo[]> {
    const devices: ListDevices = await this.app.listDevices(this)
    return Object.values(devices).map((device) => {
      const deviceInfo = {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID
        },
        store: {
          canCool: device.Device.CanCool,
          hasZone2: device.Device.HasZone2
        },
        capabilities: [] as string[]
      }
      this.capabilitiesAtw.forEach((capability) => {
        deviceInfo.capabilities.push(capability)
      })
      if (device.Device.CanCool) {
        this.coolCapabilitiesAtw.forEach((capability) => {
          deviceInfo.capabilities.push(capability)
        })
      } else {
        this.notCoolCapabilitiesAtw.forEach((capability) => {
          deviceInfo.capabilities.push(capability)
        })
      }
      if (device.Device.HasZone2) {
        this.zone2CapabilitiesAtw.forEach((capability) => {
          deviceInfo.capabilities.push(capability)
        })
        if (device.Device.CanCool) {
          this.coolZone2CapabilitiesAtw.forEach((capability) => {
            deviceInfo.capabilities.push(capability)
          })
        } else {
          this.notCoolZone2CapabilitiesAtw.forEach((capability) => {
            deviceInfo.capabilities.push(capability)
          })
        }
      }
      this.otherCapabilitiesAtw.forEach((capability) => {
        deviceInfo.capabilities.push(capability)
      })
      return deviceInfo
    })
  }
}

module.exports = MELCloudDriverAtw
