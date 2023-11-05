import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  setCapabilityMappingAta,
  reportCapabilityMappingAta,
  type FlowArgs,
  type SetCapabilityAta,
} from '../../types'

const flowCapabilities: SetCapabilityAta[] = [
  'operation_mode',
  'fan_power',
  'vertical',
  'horizontal',
]

export = class MELCloudDriverAta extends BaseMELCloudDriver {
  public async onInit(): Promise<void> {
    this.deviceType = 0
    this.heatPumpType = 'Ata'

    this.setCapabilityMapping = setCapabilityMappingAta
    this.getCapabilityMapping = getCapabilityMappingAta
    this.listCapabilityMapping = listCapabilityMappingAta
    this.reportCapabilityMapping = reportCapabilityMappingAta

    await super.onInit()
  }

  public getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityMapping,
        ...this.getCapabilityMapping,
      }),
      'thermostat_mode',
      'fan_power_state',
      'measure_power.wifi',
    ]
  }

  protected registerFlowListeners(): void {
    const getCapabilityArg = (
      args: FlowArgs<MELCloudDriverAta>,
      capability: SetCapabilityAta,
    ): number | string => {
      if (capability === 'fan_power') {
        return Number(args[capability])
      }
      return args[capability]
    }

    flowCapabilities.forEach((capability: SetCapabilityAta): void => {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener(
          (args: FlowArgs<MELCloudDriverAta>): boolean =>
            getCapabilityArg(args, capability) ===
            args.device.getCapabilityValue(capability),
        )
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(
          async (args: FlowArgs<MELCloudDriverAta>): Promise<void> => {
            await args.device.triggerCapabilityListener(
              capability,
              getCapabilityArg(args, capability),
            )
          },
        )
    })
  }
}
