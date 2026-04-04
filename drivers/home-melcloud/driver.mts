import { HomeDeviceType } from '@olivierzal/melcloud-api'

import {
  getCapabilitiesOptionsHome,
  homeSetCapabilityTagMappingAta,
} from '../../types/index.mts'
import { HomeBaseMELCloudDriver } from '../home-base-driver.mts'

export default class HomeMELCloudDriverAta extends HomeBaseMELCloudDriver {
  public override readonly getCapabilitiesOptions = getCapabilitiesOptionsHome

  public override readonly setCapabilityTagMapping =
    homeSetCapabilityTagMappingAta

  public override readonly type = HomeDeviceType.Ata

  public override getRequiredCapabilities(): string[] {
    return super
      .getRequiredCapabilities()
      .filter((capability) => capability !== 'measure_signal_strength')
  }

  protected override getDeviceModels(): { id: string; name: string }[] {
    return this.homey.app.getHomeDevicesByType(this.type)
  }
}
