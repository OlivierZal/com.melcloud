import 'source-map-support/register'

import MELCloudDeviceAtw from './device'
import MELCloudDriverMixin from '../../mixins/driver_mixin'
import { Capability, DeviceInfo, ListDevice, ListDevices, SetCapability } from '../../types'

export default class MELCloudDriverAtw extends MELCloudDriverMixin {
  capabilitiesAtw!: Array<Capability<MELCloudDeviceAtw>>
  coolCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  notCoolCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  zone2CapabilitiesAtw!: Array<Capability<MELCloudDeviceAtw>>
  coolZone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  notCoolZone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  otherCapabilitiesAtw!: Array<Capability<MELCloudDeviceAtw>>

  async onInit (): Promise<void> {
    await super.onInit()
    this.deviceType = 1
    this.heatPumpType = 'Atw'

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
      .registerRunListener((args: { device: MELCloudDeviceAtw, eco_hot_water: 'true' | 'false' }): boolean => (
        args.eco_hot_water === String(args.device.getCapabilityValue('eco_hot_water'))
      ))

    this.homey.flow
      .getConditionCard('onoff_forced_hot_water_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, onoff_forced_hot_water: 'true' | 'false' }): boolean => (
        args.onoff_forced_hot_water === String(args.device.getCapabilityValue('onoff.forced_hot_water'))
      ))

    this.homey.flow
      .getConditionCard('operation_mode_state_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_state: string }): boolean => (
        args.operation_mode_state === args.device.getCapabilityValue('operation_mode_state')
      ))

    this.homey.flow
      .getConditionCard('operation_mode_zone1_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): boolean => (
        args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone1')
      ))

    this.homey.flow
      .getConditionCard('operation_mode_zone1_with_cool_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): boolean => (
        args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone1')
      ))

    this.homey.flow
      .getConditionCard('operation_mode_zone2_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): boolean => (
        args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone2')
      ))

    this.homey.flow
      .getConditionCard('operation_mode_zone2_with_cool_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): boolean => (
        args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone2')
      ))

    // Action flowcards
    this.homey.flow
      .getActionCard('onoff_forced_hot_water_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, onoff_forced_hot_water: 'true' | 'false' }): Promise<void> => {
        await args.device.onCapability('onoff.forced_hot_water', args.onoff_forced_hot_water === 'true')
      })

    this.homey.flow
      .getActionCard('operation_mode_zone1_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): Promise<void> => {
        await args.device.onCapability('operation_mode_zone.zone1', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('operation_mode_zone1_with_cool_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): Promise<void> => {
        await args.device.onCapability('operation_mode_zone_with_cool.zone1', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('operation_mode_zone2_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): Promise<void> => {
        await args.device.onCapability('operation_mode_zone.zone2', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('operation_mode_zone2_with_cool_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): Promise<void> => {
        await args.device.onCapability('operation_mode_zone_with_cool.zone2', args.operation_mode_zone)
      })

    this.homey.flow
      .getActionCard('target_temperature_tank_water')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.tank_water', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone2')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.zone2', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone1_flow_cool_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.zone1_flow_cool', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone1_flow_heat_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.zone1_flow_heat', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone2_flow_cool_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.zone2_flow_cool', args.target_temperature)
      })

    this.homey.flow
      .getActionCard('target_temperature_zone2_flow_heat_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.zone2_flow_heat', args.target_temperature)
      })
  }

  async discoverDevices (): Promise<Array<DeviceInfo<MELCloudDeviceAtw>>> {
    const devices: ListDevices = await this.app.listDevices(this)
    return Object.values(devices).map((device: ListDevice): DeviceInfo<MELCloudDeviceAtw> => {
      const deviceInfo: any = {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID
        },
        store: {
          canCool: device.Device.CanCool,
          hasZone2: device.Device.HasZone2
        },
        capabilities: [] as Array<Capability<MELCloudDeviceAtw>>
      }
      this.capabilitiesAtw.forEach((capability: string) => {
        deviceInfo.capabilities.push(capability)
      })
      if (device.Device.CanCool) {
        this.coolCapabilitiesAtw.forEach((capability: string) => {
          deviceInfo.capabilities.push(capability)
        })
      } else {
        this.notCoolCapabilitiesAtw.forEach((capability: string) => {
          deviceInfo.capabilities.push(capability)
        })
      }
      if (device.Device.HasZone2) {
        this.zone2CapabilitiesAtw.forEach((capability: string) => {
          deviceInfo.capabilities.push(capability)
        })
        if (device.Device.CanCool) {
          this.coolZone2CapabilitiesAtw.forEach((capability: string) => {
            deviceInfo.capabilities.push(capability)
          })
        } else {
          this.notCoolZone2CapabilitiesAtw.forEach((capability: string) => {
            deviceInfo.capabilities.push(capability)
          })
        }
      }
      this.otherCapabilitiesAtw.forEach((capability: string) => {
        deviceInfo.capabilities.push(capability)
      })
      return deviceInfo
    })
  }
}

module.exports = MELCloudDriverAtw
