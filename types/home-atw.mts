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
  getThermostatModeValuesAtw,
  thermostatModeZone2TitleAtw,
} from './atw.mts'

interface HomeGetCapabilitiesAtw extends BaseGetCapabilities {
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operational_state: keyof typeof Classic.OperationModeState
}

type HomeListCapabilitiesAtw = BaseListCapabilities

type ThermostatModeAtw = keyof typeof Classic.OperationModeZone

export type HomeCapabilitiesAtw = HomeGetCapabilitiesAtw &
  HomeListCapabilitiesAtw &
  HomeSetCapabilitiesAtw

export interface HomeSetCapabilitiesAtw extends BaseSetCapabilities {
  readonly target_temperature: number
  readonly 'target_temperature.tank_water': number
  readonly 'target_temperature.zone2': number
  readonly thermostat_mode: ThermostatModeAtw
  readonly 'thermostat_mode.zone2': ThermostatModeAtw
}

export const homeSetCapabilityTagMappingAtw: Record<
  keyof HomeSetCapabilitiesAtw,
  keyof Home.AtwValues
> = {
  onoff: 'power',
  target_temperature: 'setTemperatureZone1',
  'target_temperature.tank_water': 'setTankWaterTemperature',
  'target_temperature.zone2': 'setTemperatureZone2',
  thermostat_mode: 'operationModeZone1',
  'thermostat_mode.zone2': 'operationModeZone2',
}

// The FTC thermostat modes (external room thermostat) have no Classic
// equivalent; they regulate on room temperature, so they read as the room
// modes.
const operationModeZoneFromHome: Record<
  Home.AtwOperationModeZone,
  ThermostatModeAtw
> = {
  CoolFlowTemperature: 'flow_cool',
  CoolRoomTemperature: 'room_cool',
  CoolThermostat: 'room_cool',
  HeatCurve: 'curve',
  HeatFlowTemperature: 'flow',
  HeatRoomTemperature: 'room',
  HeatThermostat: 'room',
}

export const operationModeZoneToHome: Record<
  ThermostatModeAtw,
  Home.AtwOperationModeZone
> = {
  curve: 'HeatCurve',
  flow: 'HeatFlowTemperature',
  flow_cool: 'CoolFlowTemperature',
  room: 'HeatRoomTemperature',
  room_cool: 'CoolRoomTemperature',
}

const isHomeOperationModeZone = (
  mode: string,
): mode is Home.AtwOperationModeZone =>
  Object.hasOwn(operationModeZoneFromHome, mode)

// The facade types the top-level operation mode as a plain string for
// firmware headroom: strings outside the Home.AtwOperationMode vocabulary
// resolve to null (the Homey value is cleared) and are logged device-side.
const operationalStateFromHome: Record<
  Home.AtwOperationMode,
  keyof typeof Classic.OperationModeState
> = {
  Cooling: 'cooling',
  Defrost: 'defrost',
  Heating: 'heating',
  HotWater: 'dhw',
  Idle: 'idle',
  Legionella: 'legionella',
  Stop: 'idle',
}

const isHomeAtwOperationMode = (mode: string): mode is Home.AtwOperationMode =>
  Object.hasOwn(operationalStateFromHome, mode)

export const toOperationalStateAtw = (
  mode: string,
): keyof typeof Classic.OperationModeState | null =>
  isHomeAtwOperationMode(mode) ? operationalStateFromHome[mode] : null

// The facade types zone modes as plain strings because the FTC exposes
// firmware-specific variants beyond the canonical set; those (and the
// single-zone `null`) degrade to the neutral room mode instead of crashing
// the sync.
export const toThermostatModeAtw = (mode: string | null): ThermostatModeAtw =>
  mode !== null && isHomeOperationModeZone(mode) ?
    operationModeZoneFromHome[mode]
  : 'room'

/**
 * Structural slice of {@link Home.DeviceAtwFacade} driving which capabilities
 * a Home ATW device gets and their options. Satisfied by the facade itself;
 * only owners get the control capabilities (the MELCloud Home app hides the
 * ATW control surface from guests).
 */
export type HomeAtwDeviceProfile = Pick<
  Home.DeviceAtwFacade,
  'capabilities' | 'hasCoolingMode' | 'isOwner'
>

export interface HomeCapabilitiesOptionsAtw {
  readonly thermostat_mode: {
    readonly values: readonly CapabilitiesOptionsValues<ThermostatModeAtw>[]
  }
  readonly 'thermostat_mode.zone2': {
    readonly title: LocalizedStrings
    readonly values: readonly CapabilitiesOptionsValues<ThermostatModeAtw>[]
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
