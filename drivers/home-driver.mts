import type * as Home from '@olivierzal/melcloud-api/home'

import type { HomeEnergyMeasureName } from '../types/device.mts'
import type { HomeDeviceDetails, HomeMELCloudDevice } from '../types/home.mts'
import { BaseMELCloudDriver } from './base-driver.mts'

export abstract class HomeMELCloudDriver extends BaseMELCloudDriver {
  declare public readonly getDevices: () => HomeMELCloudDevice[]

  // Home energy mappings carry measure names (consumed/produced), not wire
  // tags: redeclared so consumers see the narrowed value type.
  public abstract override readonly tagMappings: {
    readonly energy: Readonly<Record<string, readonly HomeEnergyMeasureName[]>>
    readonly get: Readonly<Record<string, string>>
    readonly list: Readonly<Record<string, string>>
    readonly set: Readonly<Record<string, string>>
  }

  public abstract override readonly type: Home.DeviceType

  protected override get api(): Home.API {
    return this.homey.app.homeApi
  }

  // The facade parameter is typed `unknown` so the concrete drivers can
  // narrow it (methods are bivariant) to their own facade or profile slice.
  public abstract getCapabilitiesOptions(
    facade: unknown,
  ): Partial<Record<string, unknown>>

  public abstract getRequiredCapabilities(facade: unknown): string[]

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
