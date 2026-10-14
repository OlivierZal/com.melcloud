import * as Classic from '@olivierzal/melcloud-api/classic'

import { getCapabilitiesOptionsAtaErv } from '../../types/ata-erv.mts'
import { tagMappings } from '../../types/classic-erv.mts'
import { ClassicMELCloudDriver } from '../classic-driver.mts'

// The sensor-gated measures: re-added below exactly when the unit
// reports the matching sensor.
const measureCapabilities = new Set(['measure_co2', 'measure_pm25'])

type ErvType = typeof Classic.DeviceType.Erv

export default class ClassicMELCloudDriverErv extends ClassicMELCloudDriver<ErvType> {
  public readonly getCapabilitiesOptions: typeof getCapabilitiesOptionsAtaErv =
    getCapabilitiesOptionsAtaErv

  public override readonly tagMappings: typeof tagMappings = tagMappings

  public readonly type: ErvType = Classic.DeviceType.Erv

  public override getRequiredCapabilities({
    HasCO2Sensor: hasCO2Sensor,
    HasPM25Sensor: hasPM25Sensor,
  }: Readonly<
    Classic.ListDeviceData<typeof Classic.DeviceType.Erv>
  >): string[] {
    return [
      ...this.manifest.capabilities.filter(
        (capability) => !measureCapabilities.has(capability),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }
}
