import {
  type FlowArgs,
  type GetCapabilityTagMappingAta,
  type ListCapabilityTagMappingAta,
  type ReportCapabilityTagMappingAta,
  type SetCapabilities,
  type SetCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  reportCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types/types'
import { HeatPumpType, effectiveFlagsAta } from '../../types/MELCloudAPITypes'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtaDriver extends BaseMELCloudDriver<'Ata'> {
  public readonly effectiveFlags: typeof effectiveFlagsAta = effectiveFlagsAta

  public readonly getCapabilityTagMapping: GetCapabilityTagMappingAta =
    getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping: ListCapabilityTagMappingAta =
    listCapabilityTagMappingAta

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMappingAta =
    reportCapabilityTagMappingAta

  public readonly setCapabilityTagMapping: SetCapabilityTagMappingAta =
    setCapabilityTagMappingAta

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
        ...this.setCapabilityTagMapping,
        ...this.getCapabilityTagMapping,
        ...this.listCapabilityTagMapping,
      }).filter((capability: string) => capability !== 'measure_power.wifi'),
      'thermostat_mode',
    ]
  }

  protected registerRunListeners(): void {
    this.#flowCapabilities.forEach(
      (capability: keyof SetCapabilities<AtaDriver>) => {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener(
            (args: FlowArgs<AtaDriver>): boolean =>
              args[capability] === args.device.getCapabilityValue(capability),
          )
        this.homey.flow
          .getActionCard(`${capability}_action`)
          .registerRunListener(
            async (args: FlowArgs<AtaDriver>): Promise<void> => {
              await args.device.onCapability(capability, args[capability])
            },
          )
      },
    )
  }
}
