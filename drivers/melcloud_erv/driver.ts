import { DeviceType, effectiveFlagsErv } from '../../melcloud/types'
import {
  type Store,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  reportCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
  storeMappingErv,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class ErvDriver extends BaseMELCloudDriver<'Erv'> {
  public readonly effectiveFlags = effectiveFlagsErv

  public readonly getCapabilityTagMapping = getCapabilityTagMappingErv

  public readonly listCapabilityTagMapping = listCapabilityTagMappingErv

  public readonly reportCapabilityTagMapping = reportCapabilityTagMappingErv

  public readonly setCapabilityTagMapping = setCapabilityTagMappingErv

  protected readonly deviceType = DeviceType.Erv

  protected readonly storeMapping = storeMappingErv

  public getRequiredCapabilities({
    hasCO2Sensor,
    hasPM25Sensor,
  }: Store['Erv']): string[] {
    return [
      ...this.capabilities.filter(
        (capability) =>
          !['measure_co2', 'measure_pm25', 'measure_power.wifi'].includes(
            capability,
          ),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }
}
