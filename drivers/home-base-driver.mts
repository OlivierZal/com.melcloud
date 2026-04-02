import { DeviceType } from '@olivierzal/melcloud-api'

import { SharedBaseMELCloudDriver } from './shared-base-driver.mts'

export class HomeBaseMELCloudDriver extends SharedBaseMELCloudDriver {
  protected override get api(): typeof this.homey.app.homeApi {
    return this.homey.app.homeApi
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- Satisfies async abstract; Home device listing is synchronous
  protected override async discoverDevices(): Promise<
    { data: { id: string }; name: string }[]
  > {
    return this.homey.app
      .getHomeDevicesByType(DeviceType.Ata)
      .map(({ id, name }) => ({ data: { id }, name }))
  }
}
