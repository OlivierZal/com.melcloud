import {
  type Capabilities,
  type FlowArgs,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type ReportCapabilityTagMapping,
  type SetCapabilities,
  type SetCapabilityTagMapping,
  type Store,
  type StoreMapping,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  reportCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
  storeMappingErv,
} from '../../types'
import {
  DeviceType,
  effectiveFlagsErv,
} from '../../melcloud/types'
import BaseMELCloudDriver from '../../bases/driver'

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

  protected readonly storeMapping: StoreMapping['Erv'] = storeMappingErv

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

  protected registerRunListeners(): void {
    this.#flowCapabilities.forEach(
      (capability: keyof SetCapabilities['Erv']) => {
        if (capability !== 'fan_power') {
          this.homey.flow
            .getConditionCard(`${capability}_condition`)
            .registerRunListener(
              (args: FlowArgs['Erv']): boolean =>
                args[capability] === args.device.getCapabilityValue(capability),
            )
        }
        this.homey.flow
          .getActionCard(`${capability}_action`)
          .registerRunListener(async (args: FlowArgs['Erv']): Promise<void> => {
            await args.device.triggerCapabilityListener(
              capability,
              args[capability],
            )
          })
      },
    )
  }
}
