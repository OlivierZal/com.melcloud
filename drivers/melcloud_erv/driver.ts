import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingErv,
  listCapabilityMappingErv,
  setCapabilityMappingErv,
  HeatPumpType,
  type SetCapabilities,
  type Capabilities,
  type FlowArgs,
  type GetCapabilityMappingErv,
  type ListCapabilityMappingErv,
  type SetCapabilityMappingErv,
  type Store,
} from '../../types'

export = class ErvDriver extends BaseMELCloudDriver<ErvDriver> {
  public readonly setCapabilityMapping: SetCapabilityMappingErv =
    setCapabilityMappingErv

  public readonly getCapabilityMapping: GetCapabilityMappingErv =
    getCapabilityMappingErv

  public readonly listCapabilityMapping: ListCapabilityMappingErv =
    listCapabilityMappingErv

  public readonly reportCapabilityMapping: null = null

  protected readonly deviceType: HeatPumpType = HeatPumpType.Erv

  public getRequiredCapabilities({
    hasCO2Sensor,
    hasPM25Sensor,
  }: Store): string[] {
    return [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...(this.manifest.capabilities as string[]).filter(
        (capability: string) =>
          !['measure_co2', 'measure_pm25', 'measure_power.wifi'].includes(
            capability,
          ),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }

  protected registerFlowListeners(): void {
    const flowCapabilities: (keyof SetCapabilities<ErvDriver>)[] = [
      'ventilation_mode',
      'fan_power',
    ]

    const getCapabilityArg = <K extends keyof SetCapabilities<ErvDriver>>(
      args: FlowArgs<ErvDriver>,
      capability: K,
    ): SetCapabilities<ErvDriver>[K] =>
      (capability === 'fan_power'
        ? Number(args[capability as keyof FlowArgs<ErvDriver>])
        : args[
            capability as keyof FlowArgs<ErvDriver>
          ]) as SetCapabilities<ErvDriver>[K]

    flowCapabilities.forEach(
      (capability: keyof SetCapabilities<ErvDriver>): void => {
        this.homey.flow
          .getConditionCard(`${capability}_erv_condition`)
          .registerRunListener(
            (args: FlowArgs<ErvDriver>): boolean =>
              getCapabilityArg(args, capability) ===
              args.device.getCapabilityValue(capability),
          )
        this.homey.flow
          .getActionCard(`${capability}_erv_action`)
          .registerRunListener(
            async (args: FlowArgs<ErvDriver>): Promise<void> => {
              await args.device.onCapability(
                capability,
                getCapabilityArg(
                  args,
                  capability,
                ) as Capabilities<ErvDriver>[typeof capability],
              )
            },
          )
      },
    )
  }
}
