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

  // Owner-only: the MELCloud Home app gives guests every setpoint but keeps
  // the power toggle and the precise zone thermostat modes (room/flow/curve)
  // for owners — a guest only gets a coarse heating/cooling switch the app
  // drives through a separate, uncaptured path.
  readonly #zone1OwnerCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'onoff',
    'thermostat_mode',
  ]

  readonly #zone1SetpointCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'target_temperature',
  ]

  readonly #zone2MeasureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature.zone2',
    'operational_state.zone2',
  ]

  readonly #zone2OwnerCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'thermostat_mode.zone2',
  ]

  readonly #zone2SetpointCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'target_temperature.zone2',
  ]

  // Only `isOwner` narrows the ATW surface (ATA is never gated): guests get
  // the measures, both zones' setpoints and the hot-water controls; owners
  // additionally get the power toggle and the precise zone thermostat modes.
  public override getRequiredCapabilities(
    profile?: HomeAtwDeviceProfile,
  ): string[] {
    const { capabilities, isOwner = false } = profile ?? {}
    return [
      ...this.#measureCapabilities,
      ...(isOwner ? this.#zone1OwnerCapabilities : []),
      ...this.#zone1SetpointCapabilities,
      ...(capabilities?.hasHotWater === true ?
        [
          ...this.#hotWaterMeasureCapabilities,
          ...this.#hotWaterControlCapabilities,
        ]
      : []),
      ...(capabilities?.hasZone2 === true ?
        [
          ...this.#zone2MeasureCapabilities,
          ...(isOwner ? this.#zone2OwnerCapabilities : []),
          ...this.#zone2SetpointCapabilities,
        ]
      : []),
    ]
  }
}
