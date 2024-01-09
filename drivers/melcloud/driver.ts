import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  reportCapabilityMappingAta,
  setCapabilityMappingAta,
  type FlowArgs,
  type GetCapabilityMappingAta,
  type ListCapabilityMappingAta,
  type ReportCapabilityMappingAta,
  type SetCapability,
  type SetCapabilityMappingAta,
} from '../../types'

export = class AtaDriver extends BaseMELCloudDriver<AtaDriver> {
  public readonly heatPumpType: string = 'Ata'

  public readonly setCapabilityMapping: SetCapabilityMappingAta =
    setCapabilityMappingAta

  public readonly getCapabilityMapping: GetCapabilityMappingAta =
    getCapabilityMappingAta

  public readonly listCapabilityMapping: ListCapabilityMappingAta =
    listCapabilityMappingAta

  public readonly reportCapabilityMapping: ReportCapabilityMappingAta =
    reportCapabilityMappingAta

  protected readonly deviceType = 0

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
    const flowCapabilities: SetCapability<AtaDriver>[] = [
      'operation_mode',
      'fan_power',
      'vertical',
      'horizontal',
    ]

    const getCapabilityArg = (
      args: FlowArgs<AtaDriver>,
      capability: SetCapability<AtaDriver>,
    ): number | string =>
      capability === 'fan_power'
        ? Number(args[capability])
        : (args[capability] as string)

    flowCapabilities.forEach((capability: SetCapability<AtaDriver>): void => {
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
              getCapabilityArg(args, capability),
            )
          },
        )
    })
  }
}
