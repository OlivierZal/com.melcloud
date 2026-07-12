import * as Classic from '@olivierzal/melcloud-api/classic'

import { getCapabilitiesOptionsAtaErv } from '../../types/ata-erv.mts'
import { tagMappings } from '../../types/classic-ata.mts'
import { ClassicMELCloudDriver } from '../classic-driver.mts'

type AtaType = typeof Classic.DeviceType.Ata

export default class ClassicMELCloudDriverAta extends ClassicMELCloudDriver<AtaType> {
  public readonly getCapabilitiesOptions: typeof getCapabilitiesOptionsAtaErv =
    getCapabilitiesOptionsAtaErv

  public override readonly tagMappings: typeof tagMappings = tagMappings

  public readonly type: AtaType = Classic.DeviceType.Ata

  public override getRequiredCapabilities(): string[] {
    return Object.keys({
      ...this.tagMappings.set,
      ...this.tagMappings.get,
      ...this.tagMappings.list,
    }).filter((capability) => capability !== 'measure_signal_strength')
  }
}
