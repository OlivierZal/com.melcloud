import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingErv,
  listCapabilityMappingErv,
  setCapabilityMappingErv,
  type FlowArgs,
  type SetCapabilityErv,
  type Store,
} from '../../types'

const flowCapabilities: SetCapabilityErv[] = ['ventilation_mode', 'fan_power']

export = class MELCloudDriverErv extends BaseMELCloudDriver {
  public async onInit(): Promise<void> {
    this.deviceType = 3
    this.heatPumpType = 'Erv'

    this.setCapabilityMapping = setCapabilityMappingErv
    this.getCapabilityMapping = getCapabilityMappingErv
    this.listCapabilityMapping = listCapabilityMappingErv

    await super.onInit()
  }

  public getRequiredCapabilities({
    HasCO2Sensor,
    HasPM25Sensor,
  }: Store): string[] {
    return [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...(this.manifest.capabilities as string[]).filter(
        (capability: string) =>
          !['measure_co2', 'measure_pm25'].includes(capability),
      ),
      ...(HasCO2Sensor ? ['measure_co2'] : []),
      ...(HasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }

  protected registerFlowListeners(): void {
    const getCapabilityArg = (
      args: FlowArgs<MELCloudDriverErv>,
      capability: SetCapabilityErv,
    ): number | string => {
      if (capability === 'fan_power') {
        return Number(args[capability])
      }
      return args[capability]
    }

    flowCapabilities.forEach((capability: SetCapabilityErv): void => {
      this.homey.flow
        .getConditionCard(`${capability}_erv_condition`)
        .registerRunListener(
          (args: FlowArgs<MELCloudDriverErv>): boolean =>
            getCapabilityArg(args, capability) ===
            args.device.getCapabilityValue(capability),
        )
      this.homey.flow
        .getActionCard(`${capability}_erv_action`)
        .registerRunListener(
          async (args: FlowArgs<MELCloudDriverErv>): Promise<void> => {
            await args.device.onCapability(
              capability,
              getCapabilityArg(args, capability),
            )
          },
        )
    })
  }
}
