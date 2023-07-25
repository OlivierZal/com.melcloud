import MELCloudDriverMixin from '../../mixins/driver_mixin'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  setCapabilityMappingAta,
  reportCapabilityMappingAta,
} from '../../types'
import type { FlowArgs, SetCapability } from '../../types'

const flowCapabilities: SetCapability<MELCloudDriverAta>[] = [
  'operation_mode',
  'fan_power',
  'vertical',
  'horizontal',
]

function getCapabilityArg(
  args: FlowArgs<MELCloudDriverAta>,
  capability: SetCapability<MELCloudDriverAta>
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

    this.setCapabilityMapping = setCapabilityMappingAta
    this.getCapabilityMapping = getCapabilityMappingAta
    this.listCapabilityMapping = listCapabilityMappingAta
    this.reportCapabilityMapping = reportCapabilityMappingAta

    flowCapabilities.forEach(
      (capability: SetCapability<MELCloudDriverAta>): void => {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener(
            (args: FlowArgs<MELCloudDriverAta>): boolean =>
              getCapabilityArg(args, capability) ===
              args.device.getCapabilityValue(capability)
          )
        this.homey.flow
          .getActionCard(`${capability}_action`)
          .registerRunListener(
            async (args: FlowArgs<MELCloudDriverAta>): Promise<void> => {
              await args.device.onCapability(
                capability,
                getCapabilityArg(args, capability)
              )
            }
          )
      }
    )
  }

  getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityMapping,
        ...this.getCapabilityMapping,
      }),
      'thermostat_mode',
      'fan_power_state',
    ]
  }
}

module.exports = MELCloudDriverAta
