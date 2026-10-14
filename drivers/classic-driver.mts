import type * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  CapabilitiesOptions,
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../types/classic-capabilities.mts'
import type { ClassicMELCloudDevice } from '../types/classic.mts'
import type { DeviceDetails } from '../types/device.mts'
import { withoutOptInCapabilities } from '../lib/opt-in-capabilities.mts'
import { BaseMELCloudDriver } from './base-driver.mts'

export abstract class ClassicMELCloudDriver<
  T extends Classic.DeviceType,
> extends BaseMELCloudDriver {
  declare public readonly getDevices: () => ClassicMELCloudDevice[]

  public abstract readonly getCapabilitiesOptions: (
    data: Readonly<Classic.ListDeviceData<T>>,
  ) => Partial<CapabilitiesOptions<T>>

  public abstract override readonly tagMappings: {
    readonly energy: EnergyCapabilityTagMapping<T>
    readonly get: GetCapabilityTagMapping<T>
    readonly list: ListCapabilityTagMapping<T>
    readonly set: SetCapabilityTagMapping<T>
  }

  public abstract override readonly type: T

  protected override get api(): Classic.API {
    return this.homey.app.classicApi
  }

  public abstract getRequiredCapabilities(
    data?: Readonly<Classic.ListDeviceData<T>>,
  ): string[]

  protected override getDeviceModels(): {
    data: Readonly<Classic.ListDeviceData<T>>
    id: number
    name: string
  }[] {
    return this.homey.app.getDevicesByType(this.type)
  }

  protected override toDeviceDetails({
    data,
    id,
    name,
  }: {
    data: Readonly<Classic.ListDeviceData<T>>
    id: number
    name: string
  }): DeviceDetails<T> {
    return {
      capabilities: withoutOptInCapabilities(
        this.getRequiredCapabilities(data),
      ),
      capabilitiesOptions: this.getCapabilitiesOptions(data),
      data: { id },
      name,
    }
  }
}
