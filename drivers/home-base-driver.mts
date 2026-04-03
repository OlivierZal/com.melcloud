import { SharedBaseMELCloudDriver } from './shared-base-driver.mts'

export abstract class HomeBaseMELCloudDriver extends SharedBaseMELCloudDriver {
  protected override get api(): typeof this.homey.app.homeApi {
    return this.homey.app.homeApi
  }
}
