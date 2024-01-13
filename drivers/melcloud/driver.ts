import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  reportCapabilityMappingAta,
  setCapabilityMappingAta,
  HeatPumpType,
  type SetCapabilities,
  type Capabilities,
  type FlowArgs,
  type GetCapabilityMappingAta,
  type ListCapabilityMappingAta,
  type ReportCapabilityMappingAta,
  type SetCapabilityMappingAta,
} from '../../types'

export = class AtaDriver extends BaseMELCloudDriver<AtaDriver> {
  public readonly setCapabilityMapping: SetCapabilityMappingAta =
    setCapabilityMappingAta

  public readonly getCapabilityMapping: GetCapabilityMappingAta =
    getCapabilityMappingAta

  public readonly listCapabilityMapping: ListCapabilityMappingAta =
    listCapabilityMappingAta

  public readonly reportCapabilityMapping: ReportCapabilityMappingAta =
    reportCapabilityMappingAta

  protected readonly deviceType: HeatPumpType = HeatPumpType.Ata

  public getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityMapping,
        ...this.getCapabilityMapping,
        ...this.listCapabilityMapping,
      }).filter((capability: string) => capability !== 'measure_power.wifi'),
      'thermostat_mode',
    ]
  }

  protected registerFlowListeners(): void {
    const flowCapabilities: (keyof SetCapabilities<AtaDriver>)[] = [
      'operation_mode',
      'fan_power',
      'vertical',
      'horizontal',
    ]

    const getCapabilityArg = <K extends keyof SetCapabilities<AtaDriver>>(
      args: FlowArgs<AtaDriver>,
      capability: K,
    ): SetCapabilities<AtaDriver>[K] =>
      (capability === 'fan_power'
        ? Number(args[capability as keyof FlowArgs<AtaDriver>])
        : args[
            capability as keyof FlowArgs<AtaDriver>
          ]) as SetCapabilities<AtaDriver>[K]

    flowCapabilities.forEach(
      (capability: keyof SetCapabilities<AtaDriver>): void => {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener(
            (args: FlowArgs<AtaDriver>): boolean =>
              getCapabilityArg(args, capability) ===
              args.device.getCapabilityValue(capability),
          )
        this.homey.flow
          .getActionCard(`${capability}_action`)
          .registerRunListener(
            async (args: FlowArgs<AtaDriver>): Promise<void> => {
              await args.device.onCapability(
                capability,
                getCapabilityArg(
                  args,
                  capability,
                ) as Capabilities<AtaDriver>[typeof capability],
              )
            },
          )
      },
    )
  }
}
