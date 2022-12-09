import MELCloudDeviceAta from './device'
import MELCloudDriverMixin from '../../mixins/driver_mixin'
import { DeviceInfo, FlowArgsAta, ListDevice, ListDevices, SetCapability } from '../../types'

const flowCapabilities: Array<SetCapability<MELCloudDeviceAta>> = ['operation_mode', 'fan_power', 'vertical', 'horizontal']
function getCapabilityArg (args: FlowArgsAta, capability: SetCapability<MELCloudDeviceAta>): number | string {
  switch (capability) {
    case 'fan_power':
      return Number(args[capability])
    default:
      return args[capability]
  }
}

export default class MELCloudDriverAta extends MELCloudDriverMixin {
  async onInit (): Promise<void> {
    await super.onInit()
    this.deviceType = 0
    this.heatPumpType = 'Ata'

    flowCapabilities.forEach((capability: SetCapability<MELCloudDeviceAta>): void => {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgsAta): boolean => (
          getCapabilityArg(args, capability) === args.device.getCapabilityValue(capability)
        ))
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgsAta): Promise<void> => {
          await args.device.onCapability(capability, getCapabilityArg(args, capability))
        })
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
