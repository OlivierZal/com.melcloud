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

  // Everything the manifest declares — the energy capabilities
  // included — is mandatory; the base handles the signal-strength
  // opt-in.
  public override getRequiredCapabilities(): string[] {
    return [...this.manifest.capabilities]
  }
}
