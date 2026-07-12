import type * as Home from '@olivierzal/melcloud-api/home'

import type { HomeDeviceProfile, HomeMELCloudDevice } from '../types/home.mts'
import { BaseMELCloudDriver } from './base-driver.mts'

export abstract class HomeMELCloudDriver extends BaseMELCloudDriver {
  declare public readonly getDevices: () => HomeMELCloudDevice[]

  public abstract override readonly type: Home.DeviceType

  protected override get api(): Home.API {
    return this.homey.app.homeApi
  }

  public override getRequiredCapabilities(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match overrides that use this parameter
    _profile?: HomeDeviceProfile,
  ): string[] {
    return super
      .getRequiredCapabilities()
      .filter((capability) => capability !== 'measure_signal_strength')
  }

  protected override getDeviceModels(): { id: string; name: string }[] {
    return this.homey.app.getHomeDevicesByType(this.type)
  }
}
