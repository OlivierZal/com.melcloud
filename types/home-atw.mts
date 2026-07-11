import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
  CapabilitiesOptionsValues,
  LocalizedStrings,
  RangeOptions,
} from './bases.mts'
import {
  type HotWaterMode,
  getThermostatModeValuesAtw,
  thermostatModeZone2TitleAtw,
} from './atw.mts'

interface HomeGetCapabilitiesAtw extends BaseGetCapabilities {
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
}

type HomeListCapabilitiesAtw = BaseListCapabilities

type ThermostatModeAtw = keyof typeof Classic.OperationModeZone

export type HomeCapabilitiesAtw = HomeGetCapabilitiesAtw &
  HomeListCapabilitiesAtw &
  HomeSetCapabilitiesAtw

/**
 * Converter from a Home ATW device facade to the corresponding Homey
 * capability value. `null` clears the Homey value — used when the facade
 * reports no reading (e.g. zone-2 fields on a single-zone unit).
 */
export type HomeConvertFromDevice = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow the return to a specific capability type
  bivariant(
    facade: Home.DeviceAtwFacade,
  ): HomeCapabilitiesAtw[keyof HomeCapabilitiesAtw] | null
}['bivariant']

/**
 * Converter from a Homey capability value to the corresponding Home ATW
 * device value.
 */
export type HomeConvertToDevice = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow `value` to a specific member of the HomeSetCapabilitiesAtw value union
  bivariant(
    value: HomeSetCapabilitiesAtw[keyof HomeSetCapabilitiesAtw],
  ): Home.AtwValues[keyof Home.AtwValues]
}['bivariant']

export interface HomeSetCapabilitiesAtw extends BaseSetCapabilities {
  readonly hot_water_mode: keyof typeof HotWaterMode
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
  hot_water_mode: 'forcedHotWaterMode',
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
  Curve: 'curve',
  HeatFlowTemperature: 'flow',
  HeatRoomTemperature: 'room',
  HeatThermostat: 'room',
}

export const operationModeZoneToHome: Record<
  ThermostatModeAtw,
  Home.AtwOperationModeZone
> = {
  curve: 'Curve',
  flow: 'HeatFlowTemperature',
  flow_cool: 'CoolFlowTemperature',
  room: 'HeatRoomTemperature',
  room_cool: 'CoolRoomTemperature',
}

const isHomeOperationModeZone = (
  mode: string,
): mode is Home.AtwOperationModeZone =>
  Object.hasOwn(operationModeZoneFromHome, mode)

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
  readonly target_temperature: RangeOptions
  readonly 'target_temperature.tank_water': RangeOptions
  readonly 'target_temperature.zone2': RangeOptions
  readonly thermostat_mode: {
    readonly values: readonly CapabilitiesOptionsValues<ThermostatModeAtw>[]
  }
  readonly 'thermostat_mode.zone2': {
    readonly title: LocalizedStrings
    readonly values: readonly CapabilitiesOptionsValues<ThermostatModeAtw>[]
  }
}

export interface HomeDeviceDetailsAtw {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<HomeCapabilitiesOptionsAtw>
  readonly data: { readonly id: string }
  readonly name: string
}

export const homeGetCapabilitiesOptionsAtw = ({
  capabilities: {
    hasHotWater,
    hasZone2,
    maxSetTankTemperature,
    maxSetTemperature,
    minSetTankTemperature,
    minSetTemperature,
  },
  hasCoolingMode,
}: HomeAtwDeviceProfile): Partial<HomeCapabilitiesOptionsAtw> => {
  const values = getThermostatModeValuesAtw(hasCoolingMode)
  const zoneRange = { max: maxSetTemperature, min: minSetTemperature }
  return {
    target_temperature: zoneRange,
    thermostat_mode: { values },
    ...(hasHotWater && {
      'target_temperature.tank_water': {
        max: maxSetTankTemperature,
        min: minSetTankTemperature,
      },
    }),
    ...(hasZone2 && {
      'target_temperature.zone2': zoneRange,
      'thermostat_mode.zone2': { title: thermostatModeZone2TitleAtw, values },
    }),
  }
}
