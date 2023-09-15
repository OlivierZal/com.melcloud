import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  setCapabilityMappingAta,
  reportCapabilityMappingAta,
  type FlowArgsAta,
  type SetCapabilityAta,
} from '../../types'

const flowCapabilities: SetCapabilityAta[] = [
  'operation_mode',
  'fan_power',
  'vertical',
  'horizontal',
]

function getCapabilityArg(
  args: FlowArgsAta,
  capability: SetCapabilityAta,
): number | string {
  if (capability === 'fan_power') {
    return Number(args[capability])
  }
  return args[capability]
}

export = class MELCloudDriverAta extends BaseMELCloudDriver {
  async onInit(): Promise<void> {
    await super.onInit()
    this.deviceType = 0
    this.heatPumpType = 'Ata'

    this.setCapabilityMapping = setCapabilityMappingAta
    this.getCapabilityMapping = getCapabilityMappingAta
    this.listCapabilityMapping = listCapabilityMappingAta
    this.reportCapabilityMapping = reportCapabilityMappingAta

    flowCapabilities.forEach((capability: SetCapabilityAta): void => {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener(
          (args: FlowArgsAta): boolean =>
            getCapabilityArg(args, capability) ===
            args.device.getCapabilityValue(capability),
        )
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgsAta): Promise<void> => {
          await args.device.onCapability(
            capability,
            getCapabilityArg(args, capability),
          )
        })
    })
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
