import MELCloudDriverMixin from '../../mixins/driver_mixin'
import type MELCloudDeviceAta from './device'
import { type FlowArgsAta, type SetCapability } from '../../types'

const flowCapabilities: Array<SetCapability<MELCloudDeviceAta>> = [
  'operation_mode',
  'fan_power',
  'vertical',
  'horizontal'
]

function getCapabilityArg(
  args: FlowArgsAta,
  capability: SetCapability<MELCloudDeviceAta>
): number | string {
  if (capability === 'fan_power') {
    return Number(args[capability])
  }
  return args[capability]
}

export default class MELCloudDriverAta extends MELCloudDriverMixin {
  async onInit(): Promise<void> {
    await super.onInit()
    this.deviceType = 0
    this.heatPumpType = 'Ata'

    for (const capability of flowCapabilities) {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener(
          (args: FlowArgsAta): boolean =>
            getCapabilityArg(args, capability) ===
            args.device.getCapabilityValue(capability)
        )
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgsAta): Promise<void> => {
          await args.device.onCapability(
            capability,
            getCapabilityArg(args, capability)
          )
        })
    }
  }
}

module.exports = MELCloudDriverAta
