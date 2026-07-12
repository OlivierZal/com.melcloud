import * as Home from '@olivierzal/melcloud-api/home'

import { homeGetCapabilitiesOptions } from '../../types/ata-erv.mts'
import { homeSetCapabilityTagMappingAta } from '../../types/home-ata.mts'
import { HomeMELCloudDriver } from '../home-driver.mts'

export default class HomeMELCloudDriverAta extends HomeMELCloudDriver {
  public override readonly getCapabilitiesOptions: typeof homeGetCapabilitiesOptions =
    homeGetCapabilitiesOptions

  public override readonly setCapabilityTagMapping: typeof homeSetCapabilityTagMappingAta =
    homeSetCapabilityTagMappingAta

  public override readonly type: typeof Home.DeviceType.Ata =
    Home.DeviceType.Ata

  // Signal strength is never a default capability (it is opt-in through
  // the options settings group), so the manifest default excludes it.
  public override getRequiredCapabilities(): string[] {
    return this.manifest.capabilities.filter(
      (capability) => capability !== 'measure_signal_strength',
    )
  }
}
