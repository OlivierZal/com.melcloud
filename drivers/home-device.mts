import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeDeviceFacade,
} from '../types/home.mts'
import type { HomeMELCloudDriver } from './home-driver.mts'
import { BaseMELCloudDevice } from './base-device.mts'

export abstract class HomeMELCloudDevice<
  T extends Home.DeviceType,
> extends BaseMELCloudDevice<HomeDeviceFacade<T>> {
  declare public readonly driver: HomeMELCloudDriver & { readonly type: T }

  declare public readonly getData: () => { id: string }

  protected abstract override capabilityToDevice: Partial<
    Record<string, HomeConvertToDevice<T>>
  >

  protected abstract override readonly deviceToCapability: Partial<
    Record<string, HomeConvertFromDevice<T>>
  >

  public override get id(): string {
    return this.getData().id
  }

  public override async syncFromDevice(): Promise<void> {
    const device = await this.ensureDevice()
    if (device === null) {
      return
    }
    await this.#setCapabilityValues(device)
  }

  protected override getFacade(): HomeDeviceFacade<T> {
    return this.homey.app.getHomeFacade(this.id, this.driver.type)
  }

  async #setCapabilityValues(device: HomeDeviceFacade<T>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing the Partial abstract to typed entries; concrete converter maps are total
    const entries = Object.entries(this.deviceToCapability) as [
      string,
      HomeConvertFromDevice<T>,
    ][]
    await Promise.all(
      entries.map(async ([capability, convert]) => {
        if (this.hasCapability(capability)) {
          await this.setCapabilityValue(capability, convert(device))
        }
      }),
    )
  }
}
