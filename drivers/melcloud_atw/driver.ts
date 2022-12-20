import MELCloudDeviceAtw from './device'
import MELCloudDriverMixin from '../../mixins/driver_mixin'
import { DeviceInfo, GetCapability, ListCapability, ListDevice, SetCapability } from '../../types'

export default class MELCloudDriverAtw extends MELCloudDriverMixin {
  capabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw> | GetCapability<MELCloudDeviceAtw> | ListCapability<MELCloudDeviceAtw>>
  coolCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  notCoolCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  zone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw> | GetCapability<MELCloudDeviceAtw>>
  coolZone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  notCoolZone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  otherCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw> | GetCapability<MELCloudDeviceAtw>>

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

    const operationModeZoneCapabilities: Array<SetCapability<MELCloudDeviceAtw>> = this.manifest.capabilities
      .filter((capability: SetCapability<MELCloudDeviceAtw>): boolean => capability.startsWith('operation_mode_zone'))
    for (const capability of operationModeZoneCapabilities) {
      let flowPrefix: string = `operation_mode_zone${capability[capability.length - 1]}`
      if (capability.includes('with_cool')) {
        flowPrefix += '_with_cool'
      }
      this.homey.flow
        .getConditionCard(`${flowPrefix}_condition`)
        .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): boolean => (
          args.operation_mode_zone === args.device.getCapabilityValue(capability)
        ))
      this.homey.flow
        .getActionCard(`${flowPrefix}_action`)
        .registerRunListener(async (args: { device: MELCloudDeviceAtw, operation_mode_zone: string }): Promise<void> => {
          await args.device.onCapability(capability, args.operation_mode_zone)
        })
    }

    const flowTemperatureCapabilities: Array<SetCapability<MELCloudDeviceAtw>> = this.manifest.capabilities
      .filter((capability: SetCapability<MELCloudDeviceAtw>): boolean => capability.startsWith('target_temperature') && capability !== 'target_temperature')
    for (const capability of flowTemperatureCapabilities) {
      this.homey.flow
        .getActionCard(`${capability.replace('.', '_')}_action`)
        .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
          await args.device.onCapability(capability, args.target_temperature)
        })
    }

    this.homey.flow
      .getConditionCard('eco_hot_water_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, eco_hot_water: 'true' | 'false' }): boolean => (
        args.eco_hot_water === String(args.device.getCapabilityValue('eco_hot_water'))
      ))

    this.homey.flow
      .getConditionCard('operation_mode_state_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, operation_mode_state: string }): boolean => (
        args.operation_mode_state === args.device.getCapabilityValue('operation_mode_state')
      ))

    this.homey.flow
      .getConditionCard('onoff_forced_hot_water_condition')
      .registerRunListener((args: { device: MELCloudDeviceAtw, onoff_forced_hot_water: 'true' | 'false' }): boolean => (
        args.onoff_forced_hot_water === String(args.device.getCapabilityValue('onoff.forced_hot_water'))
      ))
    this.homey.flow
      .getActionCard('onoff_forced_hot_water_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, onoff_forced_hot_water: 'true' | 'false' }): Promise<void> => {
        await args.device.onCapability('onoff.forced_hot_water', args.onoff_forced_hot_water === 'true')
      })

    // Deprecated
    this.homey.flow
      .getActionCard('target_temperature_tank_water')
      .registerRunListener(async (args: { device: MELCloudDeviceAtw, target_temperature: number }): Promise<void> => {
        await args.device.onCapability('target_temperature.tank_water', args.target_temperature)
      })
  }

  async discoverDevices (): Promise<Array<DeviceInfo<MELCloudDeviceAtw>>> {
    const devices: Array<ListDevice<MELCloudDeviceAtw>> = await this.app.listDevices(this)
    return devices.map((device: ListDevice<MELCloudDeviceAtw>): DeviceInfo<MELCloudDeviceAtw> => (
      {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID
        },
        store: {
          canCool: device.Device.CanCool,
          hasZone2: device.Device.HasZone2
        },
        capabilities: this.getRequiredCapabilities(device.Device.CanCool, device.Device.HasZone2)
      }
    ))
  }

  getRequiredCapabilities (canCool: boolean, hasZone2: boolean): DeviceInfo<MELCloudDeviceAtw>['capabilities'] {
    return [
      ...this.capabilitiesAtw,
      ...canCool ? this.coolCapabilitiesAtw : this.notCoolCapabilitiesAtw,
      ...hasZone2 ? [...this.zone2CapabilitiesAtw, ...canCool ? this.coolZone2CapabilitiesAtw : this.notCoolZone2CapabilitiesAtw] : [],
      ...this.otherCapabilitiesAtw
    ]
  }
}

module.exports = MELCloudDriverAtw
