import * as Classic from '@olivierzal/melcloud-api/classic'

import { getCapabilitiesOptionsAtaErv } from '../../types/ata-erv.mts'
import { tagMappings } from '../../types/classic-erv.mts'
import { ClassicMELCloudDriver } from '../classic-driver.mts'

const measureCapabilities = new Set([
  'measure_co2',
  'measure_pm25',
  'measure_signal_strength',
])

type ErvType = typeof Classic.DeviceType.Erv

export default class ClassicMELCloudDriverErv extends ClassicMELCloudDriver<ErvType> {
  public readonly getCapabilitiesOptions: typeof getCapabilitiesOptionsAtaErv =
    getCapabilitiesOptionsAtaErv

  public override readonly tagMappings: typeof tagMappings = tagMappings

  public readonly type: ErvType = Classic.DeviceType.Erv

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
