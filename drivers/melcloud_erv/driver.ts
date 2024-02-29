import {
  type Capabilities,
  type CapabilitiesOptions,
  type FlowArgsErv,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type ReportCapabilityTagMapping,
  type SetCapabilities,
  type SetCapabilityTagMapping,
  type Store,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  reportCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
} from '../../types'
import {
  DeviceType,
  type ListDevice,
  effectiveFlagsErv,
} from '../../melcloud/types'
import BaseMELCloudDriver from '../../bases/driver'
import { NUMBER_1 } from '../../constants'

export = class ErvDriver extends BaseMELCloudDriver<'Erv'> {
  public readonly effectiveFlags: typeof effectiveFlagsErv = effectiveFlagsErv

  public readonly getCapabilityTagMapping: GetCapabilityTagMapping['Erv'] =
    getCapabilityTagMappingErv

  public readonly listCapabilityTagMapping: ListCapabilityTagMapping['Erv'] =
    listCapabilityTagMappingErv

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMapping['Erv'] =
    reportCapabilityTagMappingErv

  public readonly setCapabilityTagMapping: SetCapabilityTagMapping['Erv'] =
    setCapabilityTagMappingErv

  protected readonly deviceType: DeviceType = DeviceType.Erv

  readonly #flowCapabilities: (keyof SetCapabilities['Erv'])[] = [
    'ventilation_mode',
    'fan_power',
  ]

  public getCapabilities({
    hasCO2Sensor,
    hasPM25Sensor,
  }: Store['Erv']): string[] {
    return [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...(this.manifest.capabilities as (keyof Capabilities<'Erv'>)[]).filter(
        (capability: keyof Capabilities<'Erv'>) =>
          !['measure_co2', 'measure_pm25', 'measure_power.wifi'].includes(
            capability,
          ),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getStore({
    HasCO2Sensor: hasCO2Sensor,
    HasPM25Sensor: hasPM25Sensor,
  }: ListDevice['Erv']['Device']): Store['Erv'] {
    return { hasCO2Sensor, hasPM25Sensor }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected getCapabilitiesOptions(
    device: ListDevice['Erv']['Device'],
  ): CapabilitiesOptions['Erv'] {
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
      (capability: keyof SetCapabilities['Erv']) => {
        if (capability !== 'fan_power') {
          this.homey.flow
            .getConditionCard(`${capability}_condition`)
            .registerRunListener(
              (args: FlowArgsErv): boolean =>
                args[capability] === args.device.getCapabilityValue(capability),
            )
        }
        this.homey.flow
          .getActionCard(`${capability}_action`)
          .registerRunListener(async (args: FlowArgsErv): Promise<void> => {
            await args.device.onCapability(capability, args[capability])
          })
      },
    )
  }
}
