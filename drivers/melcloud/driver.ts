import MELCloudDriverMixin from '../../mixins/driver_mixin'
import type MELCloudDeviceAta from './device'
import { getCapabilityMappingAta, setCapabilityMappingAta } from '../../types'
import type { FlowArgsAta, SetCapability } from '../../types'

const flowCapabilities: Array<SetCapability<MELCloudDeviceAta>> = [
  'operation_mode',
  'fan_power',
  'vertical',
  'horizontal',
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

    flowCapabilities.forEach(
      (capability: SetCapability<MELCloudDeviceAta>): void => {
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
    )
  }

  getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...setCapabilityMappingAta,
        ...getCapabilityMappingAta,
      }),
      'thermostat_mode',
      'fan_power_state',
    ]
  }
}

module.exports = MELCloudDriverAta
