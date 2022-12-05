import 'source-map-support/register'

import MELCloudDeviceAta from './device'
import MELCloudDriverMixin from '../../mixins/driver_mixin'
import { DeviceInfo, ListDevice, ListDevices } from '../../types'

export default class MELCloudDriverAta extends MELCloudDriverMixin {
  async onInit (): Promise<void> {
    await super.onInit()
    this.deviceType = 0
    this.heatPumpType = 'Ata'

    // Condition flowcards
    this.homey.flow
      .getConditionCard('operation_mode_condition')
      .registerRunListener((args: { device: MELCloudDeviceAta, operation_mode: string }): boolean => (
        args.operation_mode === args.device.getCapabilityValue('operation_mode')
      ))

    this.homey.flow
      .getConditionCard('vertical_condition')
      .registerRunListener((args: { device: MELCloudDeviceAta, vertical: string }): boolean => (
        args.vertical === args.device.getCapabilityValue('vertical')
      ))

    this.homey.flow
      .getConditionCard('horizontal_condition')
      .registerRunListener((args: { device: MELCloudDeviceAta, horizontal: string }): boolean => (
        args.horizontal === args.device.getCapabilityValue('horizontal')
      ))

    // Action flowcards
    this.homey.flow
      .getActionCard('operation_mode_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAta, operation_mode: string }): Promise<void> => {
        await args.device.onCapability('operation_mode', args.operation_mode)
      })

    this.homey.flow
      .getActionCard('vertical_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAta, vertical: string }): Promise<void> => {
        await args.device.onCapability('vertical', args.vertical)
      })

    this.homey.flow
      .getActionCard('horizontal_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAta, horizontal: string }): Promise<void> => {
        await args.device.onCapability('horizontal', args.horizontal)
      })

    // Deprecated
    this.homey.flow
      .getConditionCard('fan_power_condition')
      .registerRunListener((args: { device: MELCloudDeviceAta, fan_power: string }): boolean => (
        Number(args.fan_power) / 5 === args.device.getCapabilityValue('dim')
      ))

    this.homey.flow
      .getActionCard('fan_power_action')
      .registerRunListener(async (args: { device: MELCloudDeviceAta, fan_power: string }): Promise<void> => {
        await args.device.onCapability('dim', Number(args.fan_power) / 5)
      })
  }

  async discoverDevices (): Promise<Array<DeviceInfo<MELCloudDeviceAta>>> {
    const devices: ListDevices<MELCloudDriverAta> = await this.app.listDevices(this)
    return Object.values(devices).map((device: ListDevice<MELCloudDriverAta>): DeviceInfo<MELCloudDeviceAta> => (
      {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID
        }
      }
    ))
  }
}

module.exports = MELCloudDriverAta
