import { type ListDeviceData, DeviceType } from '@olivierzal/melcloud-api'

import { getCapabilitiesOptionsAtaErv } from '../../types/ata-erv.mts'
import {
  energyCapabilityTagMapping,
  getCapabilityTagMapping,
  listCapabilityTagMapping,
  setCapabilityTagMapping,
} from '../../types/classic-erv.mts'
import { ClassicMELCloudDriver } from '../classic-driver.mts'

const measureCapabilities = new Set([
  'measure_co2',
  'measure_pm25',
  'measure_signal_strength',
])

export default class ClassicMELCloudDriverErv extends ClassicMELCloudDriver<
  typeof DeviceType.Erv
> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMapping

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMapping

  public readonly listCapabilityTagMapping = listCapabilityTagMapping

  public readonly setCapabilityTagMapping = setCapabilityTagMapping

  public readonly type = DeviceType.Erv

  public getRequiredCapabilities({
    HasCO2Sensor: hasCO2Sensor,
    HasPM25Sensor: hasPM25Sensor,
  }: ListDeviceData<typeof DeviceType.Erv>): string[] {
    return [
      ...this.manifest.capabilities.filter(
        (capability) => !measureCapabilities.has(capability),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }
}
