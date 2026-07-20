import * as Home from '@olivierzal/melcloud-api/home'

import {
  type HomeAtwDeviceProfile,
  type HomeCapabilitiesAtw,
  homeGetCapabilitiesOptionsAtw,
  homeTagMappingsAtw,
} from '../../types/home-atw.mts'
import { HomeMELCloudDriver } from '../home-driver.mts'

// Energy (like Classic ATW's always-present energy surface) is not a
// user toggle: each capability appears when the unit can report its
// direction. Consumed power/meters need a consumption estimate or
// meter; produced ones a production one; COP needs both.
const hasEnergyDirection = (
  capabilities: HomeAtwDeviceProfile['capabilities'] | undefined,
  flags: readonly (keyof NonNullable<HomeAtwDeviceProfile['capabilities']>)[],
): boolean => flags.some((flag) => capabilities?.[flag] === true)

const energyCapabilities = (
  capabilities: HomeAtwDeviceProfile['capabilities'] | undefined,
): string[] => {
  const hasConsumed = hasEnergyDirection(capabilities, [
    'hasEstimatedEnergyConsumption',
    'hasMeasuredEnergyConsumption',
  ])
  const hasProduced = hasEnergyDirection(capabilities, [
    'hasEstimatedEnergyProduction',
    'hasMeasuredEnergyProduction',
  ])
  return [
    ...(hasConsumed ?
      ['measure_power', 'meter_power', 'meter_power.daily']
    : []),
    ...(hasProduced ?
      [
        'measure_power.produced',
        'meter_power.produced',
        'meter_power.produced_daily',
      ]
    : []),
    ...(hasConsumed && hasProduced ?
      ['meter_power.cop', 'meter_power.cop_daily']
    : []),
  ]
}

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
    'onoff',
    'thermostat_mode',
    'target_temperature',
  ]

  readonly #zone2ControlCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'thermostat_mode.zone2',
    'target_temperature.zone2',
  ]

  readonly #zone2MeasureCapabilities: (keyof HomeCapabilitiesAtw)[] = [
    'measure_temperature.zone2',
    'operational_state.zone2',
  ]

  // Ownership gates NOTHING: the app's guest UI hides the power toggle and
  // the precise modes, but the BFF enforces no owner/guest distinction —
  // guest `curve` write and a full power round-trip both readback-verified
  // (2026-07-14) — so guests get the exact owner surface.
  public override getRequiredCapabilities(
    profile?: HomeAtwDeviceProfile,
  ): string[] {
    const { capabilities } = profile ?? {}
    return [
      ...this.#measureCapabilities,
      ...energyCapabilities(capabilities),
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
