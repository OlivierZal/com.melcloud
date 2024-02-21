import {
  type FlowArgs,
  type GetCapabilityMappingAta,
  type ListCapabilityMappingAta,
  type ReportCapabilityMappingAta,
  type SetCapabilities,
  type SetCapabilityMappingAta,
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  reportCapabilityMappingAta,
  setCapabilityMappingAta,
} from '../../types/types'
import BaseMELCloudDriver from '../../bases/driver'
import { HeatPumpType } from '../../types/MELCloudAPITypes'

export = class AtaDriver extends BaseMELCloudDriver<'Ata'> {
  public readonly getCapabilityMapping: GetCapabilityMappingAta =
    getCapabilityMappingAta

  public readonly listCapabilityMapping: ListCapabilityMappingAta =
    listCapabilityMappingAta

  public readonly reportCapabilityMapping: ReportCapabilityMappingAta =
    reportCapabilityMappingAta

  public readonly setCapabilityMapping: SetCapabilityMappingAta =
    setCapabilityMappingAta

  protected readonly deviceType: HeatPumpType = HeatPumpType.Ata

  readonly #flowCapabilities: (keyof SetCapabilities<AtaDriver>)[] = [
    'operation_mode',
    'fan_power',
    'vertical',
    'horizontal',
  ]

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

  protected registerRunListeners(): void {
    const getCapabilityArg = <K extends keyof SetCapabilities<AtaDriver>>(
      args: FlowArgs<AtaDriver>,
      capability: K,
    ): SetCapabilities<AtaDriver>[K] =>
      (capability === 'fan_power'
        ? Number(args[capability])
        : args[capability]) as SetCapabilities<AtaDriver>[K]

    this.#flowCapabilities.forEach(
      (capability: keyof SetCapabilities<AtaDriver>) => {
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
      },
    )
  }
}
