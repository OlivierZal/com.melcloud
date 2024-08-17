import type { ListDeviceDataErv } from '@olivierzal/melcloud-api'

import BaseMELCloudDriver from '../../bases/driver'
import {
  ENERGY_CAPABILITY_TAG_MAPPING_ERV,
  GET_CAPABILITY_TAGS_MAPPING_ERV,
  LIST_CAPABILITY_TAGS_MAPPING_ERV,
  SET_CAPABILITY_TAGS_MAPPING_ERV,
} from '../../types'

export = class extends BaseMELCloudDriver<'Erv'> {
  public readonly energyCapabilityTagMapping = ENERGY_CAPABILITY_TAG_MAPPING_ERV

  public readonly getCapabilityTagMapping = GET_CAPABILITY_TAGS_MAPPING_ERV

  public readonly listCapabilityTagMapping = LIST_CAPABILITY_TAGS_MAPPING_ERV

  public readonly setCapabilityTagMapping = SET_CAPABILITY_TAGS_MAPPING_ERV

  public readonly type = 'Erv'

  public getRequiredCapabilities({
    HasCO2Sensor: hasCO2Sensor,
    HasPM25Sensor: hasPM25Sensor,
  }: ListDeviceDataErv): string[] {
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
