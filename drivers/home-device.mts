import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeDeviceFacade,
} from '../types/home.mts'
import { typedEntries } from '../lib/typed-object.mts'
import type { EnergyReportConfig } from './base-report.mts'
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

  // Both Home report wires resolve total-mode reads the same way; only the
  // regular cadence is type-specific (the ATW interval measures are
  // near-live, the ATA cumulative one is not).
  protected override readonly energyReportTotal: EnergyReportConfig = {
    duration: { hours: 1 },
    mode: 'total',
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  // An offline unit is one whose disconnection streak has passed the
  // stale window.
  protected override readonly unreachableWarning = 'errors.unitOffline'

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

  protected override async syncCapabilityValues(
    device: HomeDeviceFacade<T>,
  ): Promise<void> {
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
