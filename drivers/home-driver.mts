import type * as Home from '@olivierzal/melcloud-api/home'

import type { HomeDeviceDetails, HomeMELCloudDevice } from '../types/home.mts'
import { BaseMELCloudDriver } from './base-driver.mts'

export abstract class HomeMELCloudDriver extends BaseMELCloudDriver {
  declare public readonly getDevices: () => HomeMELCloudDevice[]

  public abstract override readonly type: Home.DeviceType

  protected override get api(): Home.API {
    return this.homey.app.homeApi
  }

  protected override getDeviceModels(): { id: string; name: string }[] {
    return this.homey.app.getHomeDevicesByType(this.type)
  }

  protected override toDeviceDetails({
    id,
    name,
  }: {
    id: string
    name: string
  }): HomeDeviceDetails {
    const facade = this.homey.app.getHomeFacade(id, this.type)
    return {
      capabilities: this.getRequiredCapabilities(facade),
      capabilitiesOptions: this.getCapabilitiesOptions(facade),
      data: { id },
      name,
    }
  }
}
