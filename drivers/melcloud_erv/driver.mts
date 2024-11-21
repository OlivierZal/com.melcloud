import { DeviceType, type ListDeviceData } from '@olivierzal/melcloud-api'

import {
  energyCapabilityTagMappingErv,
  getCapabilitiesOptionsAtaErv,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
} from '../../types/index.mts'
import { BaseMELCloudDriver } from '../base-driver.mts'

export default class MELCloudDriverErv extends BaseMELCloudDriver<DeviceType.Erv> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingErv

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMappingErv

  public readonly listCapabilityTagMapping = listCapabilityTagMappingErv

  public readonly setCapabilityTagMapping = setCapabilityTagMappingErv

  public readonly type = DeviceType.Erv

  public getRequiredCapabilities({
    HasCO2Sensor: hasCO2Sensor,
    HasPM25Sensor: hasPM25Sensor,
  }: ListDeviceData<DeviceType.Erv>): string[] {
    return [
      ...(this.capabilities ?? []).filter(
        (capability) =>
          !['measure_co2', 'measure_pm25', 'measure_signal_strength'].includes(
            capability,
          ),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }
}
