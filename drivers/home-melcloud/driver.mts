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

  protected override getDeviceModels(): { id: string; name: string }[] {
    return this.homey.app.getHomeDevicesByType(this.type)
  }
}
