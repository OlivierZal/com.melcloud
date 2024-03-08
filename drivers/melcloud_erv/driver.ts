import {
  type Capabilities,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type ReportCapabilityTagMapping,
  type SetCapabilityTagMapping,
  type Store,
  type StoreMapping,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  reportCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
  storeMappingErv,
} from '../../types'
import { DeviceType, effectiveFlagsErv } from '../../melcloud/types'
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

  public getCapabilities({
    hasCO2Sensor,
    hasPM25Sensor,
  }: Store['Erv']): string[] {
    return [
      ...this.capabilities.filter(
        (capability: keyof Capabilities<'Erv'>) =>
          !['measure_co2', 'measure_pm25', 'measure_power.wifi'].includes(
            capability,
          ),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }
}
