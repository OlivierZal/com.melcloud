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

  // Signal strength stays manifest-declared but opt-in through the
  // shared options settings group; everything else — the energy
  // capabilities included — is mandatory.
  public override getRequiredCapabilities(): string[] {
    return this.manifest.capabilities.filter(
      (capability) => capability !== 'measure_signal_strength',
    )
  }
}
