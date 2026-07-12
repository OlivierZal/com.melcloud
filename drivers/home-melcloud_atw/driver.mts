import * as Home from '@olivierzal/melcloud-api/home'

import type { HomeMELCloudDevice } from '../../types/home.mts'
import {
  type HomeAtwDeviceProfile,
  type HomeCapabilitiesAtw,
  type HomeDeviceDetailsAtw,
  homeGetCapabilitiesOptionsAtw,
  homeSetCapabilityTagMappingAtw,
} from '../../types/home-atw.mts'
import { BaseMELCloudDriver } from '../base-driver.mts'

export default class HomeMELCloudDriverAtw extends BaseMELCloudDriver {
  declare public readonly getDevices: () => HomeMELCloudDevice[]

  public override readonly getCapabilitiesOptions: typeof homeGetCapabilitiesOptionsAtw =
    homeGetCapabilitiesOptionsAtw

  public override readonly setCapabilityTagMapping: typeof homeSetCapabilityTagMappingAtw =
    homeSetCapabilityTagMappingAtw

  public override readonly type: typeof Home.DeviceType.Atw =
    Home.DeviceType.Atw

  protected override get api(): Home.API {
    return this.homey.app.homeApi
  }

  readonly #controlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'onoff',
    'target_temperature',
    'thermostat_mode',
  ]

  readonly #hotWaterControlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'target_temperature.tank_water',
  ]

  readonly #hotWaterMeasureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature.tank_water',
  ]

  readonly #measureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature',
  ]

  readonly #zone2ControlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'target_temperature.zone2',
    'thermostat_mode.zone2',
  ]

  readonly #zone2MeasureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature.zone2',
  ]

  // Guests only get the read-only measures: the MELCloud Home app does not
  // expose the ATW control surface to guest accounts.
  public override getRequiredCapabilities(
    profile?: HomeAtwDeviceProfile,
  ): string[] {
    /* v8 ignore next -- profile is always provided by callers */
    const { capabilities, isOwner = false } = profile ?? {}
    return [
      ...this.#measureCapabilities,
      ...(isOwner ? this.#controlCapabilities : []),
      ...(capabilities?.hasHotWater === true ?
        [
          ...this.#hotWaterMeasureCapabilities,
          ...(isOwner ? this.#hotWaterControlCapabilities : []),
        ]
      : []),
      ...(capabilities?.hasZone2 === true ?
        [
          ...this.#zone2MeasureCapabilities,
          ...(isOwner ? this.#zone2ControlCapabilities : []),
        ]
      : []),
    ]
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
  }): HomeDeviceDetailsAtw {
    const facade = this.homey.app.getHomeFacade(id, this.type)
    return {
      capabilities: this.getRequiredCapabilities(facade),
      capabilitiesOptions: this.getCapabilitiesOptions(facade),
      data: { id },
      name,
    }
  }
}
