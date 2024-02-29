import {
  type CapabilitiesOptions,
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
import {
  DeviceType,
  type ListDevice,
  effectiveFlagsAta,
} from '../../melcloud/types'
import BaseMELCloudDriver from '../../bases/driver'
import { NUMBER_1 } from '../../constants'

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
  public getStore({
    MaxTempAutomatic: maxTempAutomatic,
    MaxTempCoolDry: maxTempCoolDry,
    MaxTempHeat: maxTempHeat,
    MinTempAutomatic: minTempAutomatic,
    MinTempCoolDry: minTempCoolDry,
    MinTempHeat: minTempHeat,
  }: ListDevice['Ata']['Device']): Store['Ata'] {
    return {
      maxTempAutomatic,
      maxTempCoolDry,
      maxTempHeat,
      minTempAutomatic,
      minTempCoolDry,
      minTempHeat,
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected getCapabilitiesOptions(
    device: ListDevice['Ata']['Device'],
  ): CapabilitiesOptions['Ata'] {
    return {
      fan_power: {
        max: device.NumberOfFanSpeeds,
        min: Number(!device.HasAutomaticFanSpeed),
        step: NUMBER_1,
      },
    }
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
