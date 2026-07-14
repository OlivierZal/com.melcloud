import * as Home from '@olivierzal/melcloud-api/home'

import {
  type HomeAtwDeviceProfile,
  type HomeCapabilitiesAtw,
  homeGetCapabilitiesOptionsAtw,
  homeTagMappingsAtw,
} from '../../types/home-atw.mts'
import { HomeMELCloudDriver } from '../home-driver.mts'

export default class HomeMELCloudDriverAtw extends HomeMELCloudDriver {
  public override readonly getCapabilitiesOptions: typeof homeGetCapabilitiesOptionsAtw =
    homeGetCapabilitiesOptionsAtw

  public override readonly tagMappings: typeof homeTagMappingsAtw =
    homeTagMappingsAtw

  public override readonly type: typeof Home.DeviceType.Atw =
    Home.DeviceType.Atw

  readonly #hotWaterControlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'hot_water_mode',
    'target_temperature.tank_water',
  ]

  readonly #hotWaterMeasureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature.tank_water',
    'operational_state.hot_water',
  ]

  readonly #measureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature',
    'operational_state',
    'operational_state.zone1',
  ]

  readonly #zone1ControlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'thermostat_mode',
    'target_temperature',
  ]

  // The power toggle is the one owner-only capability: the MELCloud Home
  // app gives guests every setpoint, the hot-water controls and the zone
  // thermostat modes (narrowed by `getCapabilitiesOptions` to the coarse
  // flow pair its heating/cooling switch writes — live-captured with
  // `/context` readback, 2026-07-14), but never the unit master on/off.
  readonly #zone1OwnerCapabilities: (keyof HomeCapabilitiesAtw)[] = ['onoff']

  readonly #zone2ControlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'thermostat_mode.zone2',
    'target_temperature.zone2',
  ]

  readonly #zone2MeasureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature.zone2',
    'operational_state.zone2',
  ]

  // Only `isOwner` narrows the ATW surface (ATA is never gated), and only
  // by the power toggle; the guest thermostat-mode narrowing happens in
  // the capabilities options, not here.
  public override getRequiredCapabilities(
    profile?: HomeAtwDeviceProfile,
  ): string[] {
    const { capabilities, isOwner = false } = profile ?? {}
    return [
      ...this.#measureCapabilities,
      ...(isOwner ? this.#zone1OwnerCapabilities : []),
      ...this.#zone1ControlCapabilities,
      ...(capabilities?.hasHotWater === true ?
        [
          ...this.#hotWaterMeasureCapabilities,
          ...this.#hotWaterControlCapabilities,
        ]
      : []),
      ...(capabilities?.hasZone2 === true ?
        [...this.#zone2MeasureCapabilities, ...this.#zone2ControlCapabilities]
      : []),
    ]
  }
}
