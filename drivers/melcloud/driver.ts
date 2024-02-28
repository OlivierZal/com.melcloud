import { DeviceType, effectiveFlagsAta } from '../../melcloud/types'
import {
  type FlowArgsAta,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type ReportCapabilityTagMapping,
  type SetCapabilities,
  type SetCapabilityTagMapping,
  type Store,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  reportCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtaDriver extends BaseMELCloudDriver<'Ata'> {
  public readonly effectiveFlags: typeof effectiveFlagsAta = effectiveFlagsAta

  public readonly getCapabilityTagMapping: GetCapabilityTagMapping['Ata'] =
    getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping: ListCapabilityTagMapping['Ata'] =
    listCapabilityTagMappingAta

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMapping['Ata'] =
    reportCapabilityTagMappingAta

  public readonly setCapabilityTagMapping: SetCapabilityTagMapping['Ata'] =
    setCapabilityTagMappingAta

  protected readonly deviceType: DeviceType = DeviceType.Ata

  readonly #flowCapabilities: (keyof SetCapabilities['Ata'])[] = [
    'operation_mode',
    'fan_power',
    'vertical',
    'horizontal',
  ]

  public getCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityTagMapping,
        ...this.getCapabilityTagMapping,
        ...this.listCapabilityTagMapping,
      }).filter((capability: string) => capability !== 'measure_power.wifi'),
      'thermostat_mode',
    ]
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected getStore(): Store['Ata'] {
    return {}
  }

  protected registerRunListeners(): void {
    this.#flowCapabilities.forEach(
      (capability: keyof SetCapabilities['Ata']) => {
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
      },
    )
  }
}
