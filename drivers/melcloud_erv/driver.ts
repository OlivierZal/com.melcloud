import {
  ENERGY_CAPABILITY_TAG_MAPPING_ERV,
  GET_CAPABILITY_TAGS_MAPPING_ERV,
  LIST_CAPABILITY_TAGS_MAPPING_ERV,
  SET_CAPABILITY_TAGS_MAPPING_ERV,
  STORE_MAPPING_ERV,
  type StoreErv,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class extends BaseMELCloudDriver<'Erv'> {
  public readonly energyCapabilityTagMapping = ENERGY_CAPABILITY_TAG_MAPPING_ERV

  public readonly getCapabilityTagMapping = GET_CAPABILITY_TAGS_MAPPING_ERV

  public readonly listCapabilityTagMapping = LIST_CAPABILITY_TAGS_MAPPING_ERV

  public readonly setCapabilityTagMapping = SET_CAPABILITY_TAGS_MAPPING_ERV

  protected readonly storeMapping = STORE_MAPPING_ERV

  protected readonly type = 'Erv'

  public getRequiredCapabilities({
    hasCO2Sensor,
    hasPM25Sensor,
  }: StoreErv): string[] {
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
