import * as Home from '@olivierzal/melcloud-api/home'

import {
  type HomeAtwDeviceProfile,
  type HomeCapabilitiesAtw,
  homeGetCapabilitiesOptionsAtw,
  homeSetCapabilityTagMappingAtw,
} from '../../types/home-atw.mts'
import { HomeMELCloudDriver } from '../home-driver.mts'

export default class HomeMELCloudDriverAtw extends HomeMELCloudDriver {
  public override readonly getCapabilitiesOptions: typeof homeGetCapabilitiesOptionsAtw =
    homeGetCapabilitiesOptionsAtw

  public override readonly setCapabilityTagMapping: typeof homeSetCapabilityTagMappingAtw =
    homeSetCapabilityTagMappingAtw

  public override readonly type: typeof Home.DeviceType.Atw =
    Home.DeviceType.Atw

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
    'operational_state.hot_water',
  ]

  readonly #measureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature',
    'operational_state',
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
}
