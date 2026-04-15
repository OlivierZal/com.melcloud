import { type HomeAPI, HomeDeviceType } from '@olivierzal/melcloud-api'

import type { HomeMELCloudDevice } from '../../types/home.mts'
import { homeGetCapabilitiesOptions } from '../../types/ata-erv.mts'
import { homeSetCapabilityTagMappingAta } from '../../types/home-ata.mts'
import { BaseMELCloudDriver } from '../base-driver.mts'

export default class HomeMELCloudDriverAta extends BaseMELCloudDriver {
  declare public readonly getDevices: () => HomeMELCloudDevice[]

  public override readonly getCapabilitiesOptions = homeGetCapabilitiesOptions

  public override readonly setCapabilityTagMapping =
    homeSetCapabilityTagMappingAta

  public override readonly type = HomeDeviceType.Ata

  protected override get api(): HomeAPI {
    return this.homey.app.homeApi
  }

  public override getRequiredCapabilities(): string[] {
    return super
      .getRequiredCapabilities()
      .filter((capability) => capability !== 'measure_signal_strength')
  }

  protected override getDeviceModels(): { id: string; name: string }[] {
    return this.homey.app.getHomeDevicesByType(this.type)
  }
}
