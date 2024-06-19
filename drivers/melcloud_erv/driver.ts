import {
  type Store,
  energyCapabilityTagMappingErv,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
  storeMappingErv,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'
import { DeviceType } from '@olivierzal/melcloud-api'

export = class extends BaseMELCloudDriver<'Erv'> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingErv

  public readonly getCapabilityTagMapping = getCapabilityTagMappingErv

  public readonly listCapabilityTagMapping = listCapabilityTagMappingErv

  public readonly setCapabilityTagMapping = setCapabilityTagMappingErv

  protected readonly deviceType = DeviceType.Erv

  protected readonly heatPumpType = 'Erv'

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
