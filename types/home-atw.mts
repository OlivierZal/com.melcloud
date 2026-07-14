import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
  CapabilitiesOptionsValues,
  LocalizedStrings,
} from './bases.mts'
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
  readonly energy: Readonly<Record<string, readonly string[]>>
  readonly get: Readonly<Record<string, string>>
  readonly list: Readonly<Record<string, string>>
  readonly set: typeof homeSetCapabilityTagMappingAtw
} = { energy: {}, get: {}, list: {}, set: homeSetCapabilityTagMappingAtw }

/**
 * Structural slice of {@link Home.DeviceAtwFacade} driving which capabilities
 * a Home ATW device gets and their options. Satisfied by the facade itself;
 * guests get the measures, setpoints and hot-water controls, while owners
 * additionally get the power toggle and the precise zone thermostat modes
 * (the MELCloud Home app reserves those two for owners).
 */
export type HomeAtwDeviceProfile = Pick<
  Home.DeviceAtwFacade,
  'capabilities' | 'hasCoolingMode' | 'isOwner'
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
// capability fails, so guests get none.
export const homeGetCapabilitiesOptionsAtw = ({
  capabilities: { hasZone2 },
  hasCoolingMode,
  isOwner,
}: HomeAtwDeviceProfile): Partial<HomeCapabilitiesOptionsAtw> => {
  if (!isOwner) {
    return {}
  }
  const values = getThermostatModeValuesAtw(hasCoolingMode)
  return {
    thermostat_mode: { values },
    ...(hasZone2 && {
      'thermostat_mode.zone2': { title: thermostatModeZone2TitleAtw, values },
    }),
  }
}
