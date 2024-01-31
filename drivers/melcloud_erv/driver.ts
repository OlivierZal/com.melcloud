import {
  type FlowArgs,
  type GetCapabilityMappingErv,
  HeatPumpType,
  type ListCapabilityMappingErv,
  type ReportCapabilityMappingErv,
  type SetCapabilities,
  type SetCapabilityMappingErv,
  type Store,
  getCapabilityMappingErv,
  listCapabilityMappingErv,
  reportCapabilityMappingErv,
  setCapabilityMappingErv,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class ErvDriver extends BaseMELCloudDriver<ErvDriver> {
  public readonly setCapabilityMapping: SetCapabilityMappingErv =
    setCapabilityMappingErv

  public readonly getCapabilityMapping: GetCapabilityMappingErv =
    getCapabilityMappingErv

  public readonly listCapabilityMapping: ListCapabilityMappingErv =
    listCapabilityMappingErv

  public readonly reportCapabilityMapping: ReportCapabilityMappingErv =
    reportCapabilityMappingErv

  protected readonly deviceType: HeatPumpType = HeatPumpType.Erv

  readonly #flowCapabilities: (keyof SetCapabilities<ErvDriver>)[] = [
    'ventilation_mode',
    'fan_power',
  ]

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

  protected registerRunListeners(): void {
    const getCapabilityArg = <K extends keyof SetCapabilities<ErvDriver>>(
      args: FlowArgs<ErvDriver>,
      capability: K,
    ): SetCapabilities<ErvDriver>[K] =>
      (capability === 'fan_power'
        ? Number(args[capability])
        : args[capability]) as SetCapabilities<ErvDriver>[K]

    this.#flowCapabilities.forEach(
      (capability: keyof SetCapabilities<ErvDriver>) => {
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
                getCapabilityArg(args, capability),
              )
            },
          )
      },
    )
  }
}
