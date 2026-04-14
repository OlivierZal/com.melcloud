import { type HomeAPI, HomeDeviceType } from '@olivierzal/melcloud-api'

import { getCapabilitiesOptionsHome } from '../../types/ata-erv.mts'
import { homeSetCapabilityTagMappingAta } from '../../types/index.mts'
import { BaseMELCloudDriver } from '../base-driver.mts'

export default class HomeMELCloudDriverAta extends BaseMELCloudDriver {
  public override readonly getCapabilitiesOptions = getCapabilitiesOptionsHome

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
