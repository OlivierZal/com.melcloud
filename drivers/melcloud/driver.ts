import {
  type FlowArgsAta,
  type GetCapabilityTagMappingAta,
  type ListCapabilityTagMappingAta,
  type ReportCapabilityTagMappingAta,
  type SetCapabilitiesAta,
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

  readonly #flowCapabilities: (keyof SetCapabilitiesAta)[] = [
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
    this.#flowCapabilities.forEach((capability: keyof SetCapabilitiesAta) => {
      if (capability !== 'fan_power') {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener(
            (args: FlowArgsAta): boolean =>
              args[capability] === args.device.getCapabilityValue(capability),
          )
      }
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgsAta): Promise<void> => {
          await args.device.onCapability(capability, args[capability])
        })
    })
  }
}
