import * as Classic from '@olivierzal/melcloud-api/classic'

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
  typeof Classic.DeviceType.Erv
> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMapping

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMapping

  public readonly listCapabilityTagMapping = listCapabilityTagMapping

  public readonly setCapabilityTagMapping = setCapabilityTagMapping

  public readonly type = Classic.DeviceType.Erv

  public override getRequiredCapabilities(
    data?: Readonly<Classic.ListDeviceData<typeof Classic.DeviceType.Erv>>,
  ): string[] {
    const { HasCO2Sensor: hasCO2Sensor, HasPM25Sensor: hasPM25Sensor } =
      data ?? {}
    return [
      ...this.manifest.capabilities.filter(
        (capability) => !measureCapabilities.has(capability),
      ),
      ...(hasCO2Sensor === true ? ['measure_co2'] : []),
      ...(hasPM25Sensor === true ? ['measure_pm25'] : []),
    ]
  }
}
