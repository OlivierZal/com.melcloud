import * as Home from '@olivierzal/melcloud-api/home'

import { homeGetCapabilitiesOptions } from '../../types/ata-erv.mts'
import { homeTagMappingsAta } from '../../types/home-ata.mts'
import { HomeMELCloudDriver } from '../home-driver.mts'

export default class HomeMELCloudDriverAta extends HomeMELCloudDriver {
  public override readonly getCapabilitiesOptions: typeof homeGetCapabilitiesOptions =
    homeGetCapabilitiesOptions

  public override readonly tagMappings: typeof homeTagMappingsAta =
    homeTagMappingsAta

  public override readonly type: typeof Home.DeviceType.Ata =
    Home.DeviceType.Ata

  // Signal strength and the energy capabilities stay manifest-declared but
  // opt-in through their settings groups, so they are filtered out of the
  // defaults the manifest otherwise provides.
  public override getRequiredCapabilities(): string[] {
    return this.manifest.capabilities.filter(
      (capability) =>
        capability !== 'measure_signal_strength' &&
        !Object.hasOwn(this.tagMappings.energy, capability),
    )
  }
}
