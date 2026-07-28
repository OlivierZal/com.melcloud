import type * as Home from '@olivierzal/melcloud-api/home'
import { EntityNotFoundError } from '@olivierzal/melcloud-api'

import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeDeviceFacade,
} from '../types/home.mts'
import { typedEntries } from '../lib/typed-object.mts'
import type { HomeMELCloudDriver } from './home-driver.mts'
import { BaseMELCloudDevice } from './base-device.mts'

export abstract class HomeMELCloudDevice<
  T extends Home.DeviceType,
> extends BaseMELCloudDevice<HomeDeviceFacade<T>, string> {
  declare public readonly driver: HomeMELCloudDriver & { readonly type: T }

  declare public readonly getStoreValue: (key: string) => unknown

  declare public readonly setStoreValue: (
    key: string,
    value: unknown,
  ) => Promise<void>

  protected abstract override readonly capabilityToDevice: Partial<
    Record<string, HomeConvertToDevice<T>>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<string, HomeConvertFromDevice<T>>
  >

  public override async syncFromDevice(): Promise<void> {
    const device = await this.ensureDevice()
    if (device === null) {
      return
    }
    try {
      await this.syncAvailability(
        device.isAvailable,
        this.homey.__('errors.unitOffline'),
      )
      await this.#setCapabilityValues(device)
    } catch (error) {
      if (!(error instanceof EntityNotFoundError)) {
        throw error
      }
      // Mirrors the Classic contract: a cached facade over a pruned id
      // (the registry rebuilds on logout) warns and keeps the last known
      // availability; the next sync after re-login resolves the fresh
      // model transparently.
      await this.setWarning(this.homey.__('errors.deviceNotFound'))
    }
  }

  protected override getCapabilitiesOptions(): Partial<
    Record<string, unknown>
  > {
    const facade = this.cachedFacade
    return facade === undefined
      ? {}
      : this.driver.getCapabilitiesOptions(facade)
  }

  protected override getFacade(): HomeDeviceFacade<T> {
    return this.homey.app.getHomeFacade(this.id, this.driver.type)
  }

  protected override getRequiredCapabilities(): string[] {
    const facade = this.cachedFacade
    return facade === undefined
      ? []
      : this.driver.getRequiredCapabilities(facade)
  }

  async #setCapabilityValues(device: HomeDeviceFacade<T>): Promise<void> {
    await Promise.all(
      typedEntries(this.deviceToCapability).map(
        async ([capability, convert]) => {
          if (this.hasCapability(capability)) {
            await this.setCapabilityValue(capability, convert(device))
          }
        },
      ),
    )
  }
}
