import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
  CapabilitiesOptionsValues,
  LocalizedStrings,
} from './bases.mts'
import type { HomeEnergyMeasureName } from './device.mts'
import {
  type HotWaterMode,
  getThermostatModeValuesAtw,
  thermostatModeZone2TitleAtw,
} from './atw.mts'

interface HomeGetCapabilitiesAtw extends BaseGetCapabilities {
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operational_state: Home.AtwOperationalState | null
  readonly 'operational_state.hot_water': Classic.OperationModeStateHotWater
  readonly 'operational_state.zone1': Classic.OperationModeStateZone
  readonly 'operational_state.zone2': Classic.OperationModeStateZone | null
}

type HomeListCapabilitiesAtw = BaseListCapabilities

export type HomeCapabilitiesAtw = HomeGetCapabilitiesAtw &
  HomeListCapabilitiesAtw &
  HomeSetCapabilitiesAtw

export interface HomeSetCapabilitiesAtw extends BaseSetCapabilities {
  readonly hot_water_mode: keyof typeof HotWaterMode
  readonly target_temperature: number
  readonly 'target_temperature.tank_water': number
  readonly 'target_temperature.zone2': number
  readonly thermostat_mode: Home.AtwZoneMode
  readonly 'thermostat_mode.zone2': Home.AtwZoneMode
}

const homeSetCapabilityTagMappingAtw: Record<
  keyof HomeSetCapabilitiesAtw,
  keyof Home.AtwValues
> = {
  hot_water_mode: 'forcedHotWaterMode',
  onoff: 'power',
  target_temperature: 'setTemperatureZone1',
  'target_temperature.tank_water': 'setTankWaterTemperature',
  'target_temperature.zone2': 'setTemperatureZone2',
  thermostat_mode: 'operationModeZone1',
  'thermostat_mode.zone2': 'operationModeZone2',
}

export const homeTagMappingsAtw: {
  readonly energy: Readonly<Record<string, readonly HomeEnergyMeasureName[]>>
  readonly get: Readonly<Record<string, string>>
  readonly list: Readonly<Record<string, string>>
  readonly set: typeof homeSetCapabilityTagMappingAtw
} = {
  // Values name the telemetry measure(s) each capability reads; behavior is
  // keyed on the capability name (measure_power*/*daily*/cop) like Classic.
  // No per-usage split (cooling/heating/hot water): the Home API only
  // serves whole-unit consumed and produced measures.
  energy: {
    measure_power: ['consumed'],
    'measure_power.produced': ['produced'],
    meter_power: ['consumed'],
    'meter_power.cop': ['consumed', 'produced'],
    'meter_power.cop_daily': ['consumed', 'produced'],
    'meter_power.daily': ['consumed'],
    'meter_power.produced': ['produced'],
    'meter_power.produced_daily': ['produced'],
  },
  get: {},
  list: {},
  set: homeSetCapabilityTagMappingAtw,
}

/**
 * Structural slice of {@link Home.DeviceAtwFacade} driving which capabilities
 * a Home ATW device gets and their options. Satisfied by the facade itself;
 * guests get the exact owner surface — the app's guest UI hides the power
 * toggle and the precise modes, but the BFF enforces nothing (guest `curve`
 * write and a full power round-trip both `/context`-readback-verified,
 * 2026-07-14), so nothing is gated on ownership.
 */
export type HomeAtwDeviceProfile = Pick<
  Home.DeviceAtwFacade,
  'capabilities' | 'hasCoolingMode'
>

export interface HomeCapabilitiesOptionsAtw {
  readonly thermostat_mode: {
    readonly values: readonly CapabilitiesOptionsValues<Home.AtwZoneMode>[]
  }
  readonly 'thermostat_mode.zone2': {
    readonly title: LocalizedStrings
    readonly values: readonly CapabilitiesOptionsValues<Home.AtwZoneMode>[]
  }
}

// Only complete option objects, and only for capabilities the device will
// actually have: device-level options shadow the manifest's per capability
// (temperature ranges/steps/titles stay in the compose manifest — the facade
// clamps setpoints device-side anyway), and setting options on an absent
// capability fails.
export const homeGetCapabilitiesOptionsAtw = ({
  capabilities: { hasZone2 },
  hasCoolingMode,
}: HomeAtwDeviceProfile): Partial<HomeCapabilitiesOptionsAtw> => {
  const values = getThermostatModeValuesAtw(hasCoolingMode)
  return {
    thermostat_mode: { values },
    ...(hasZone2 && {
      'thermostat_mode.zone2': { title: thermostatModeZone2TitleAtw, values },
    }),
  }
}
