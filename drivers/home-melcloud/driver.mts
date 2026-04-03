import { HomeDeviceType } from '@olivierzal/melcloud-api'

import { HomeBaseMELCloudDriver } from '../home-base-driver.mts'

export default class HomeMELCloudDriverAta extends HomeBaseMELCloudDriver {
  public override readonly type = HomeDeviceType.Ata

  protected override getDeviceModels(): { id: string; name: string }[] {
    return this.homey.app.getHomeDevicesByType(this.type)
  }
}
