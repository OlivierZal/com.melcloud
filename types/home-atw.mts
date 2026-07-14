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

// The abstract heat/cool sides the guest thermostat toggles between.
export type HomeGuestAtwThermostatMode = 'cool' | 'heat'

export interface HomeSetCapabilitiesAtw extends BaseSetCapabilities {
  readonly hot_water_mode: keyof typeof HotWaterMode
  readonly target_temperature: number
  readonly 'target_temperature.tank_water': number
  readonly 'target_temperature.zone2': number
  readonly thermostat_mode: Home.AtwZoneMode | HomeGuestAtwThermostatMode
  readonly 'thermostat_mode.zone2':
    Home.AtwZoneMode | HomeGuestAtwThermostatMode
}

const GUEST_THERMOSTAT_MODES: ReadonlySet<
  Home.AtwZoneMode | HomeGuestAtwThermostatMode
> = new Set(['cool', 'heat'])

export const isHomeGuestThermostatMode = (
  value: Home.AtwZoneMode | HomeGuestAtwThermostatMode,
): value is HomeGuestAtwThermostatMode => GUEST_THERMOSTAT_MODES.has(value)

// The side a precise zone mode sits on: the cool variants read as cool,
// everything else (room, flow, curve) as heat.
export const toHomeGuestThermostatMode = (
  mode: Home.AtwZoneMode,
): HomeGuestAtwThermostatMode => (mode.endsWith('cool') ? 'cool' : 'heat')

// Family-preserving projection of a guest side onto the precise modes,
// live-verified for both families (guest captures with readback:
// room ↔ room_cool and flow ↔ flow_cool); curve is heat-only, so its
// cool side lands on flow_cool (the nearest variant — unobserved,
// documented choice), and an unknown current mode defaults to flow.
export const fromHomeGuestThermostatMode = (
  side: HomeGuestAtwThermostatMode,
  family: Home.AtwZoneMode = 'flow',
): Home.AtwZoneMode => {
  if (side === 'cool') {
    return family.startsWith('room') ? 'room_cool' : 'flow_cool'
  }
  if (family === 'room_cool') {
    return 'room'
  }
  return family === 'flow_cool' ? 'flow' : family
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
 * guests get everything but the power toggle, with the zone thermostat modes
 * narrowed to the coarse heating/cooling pair the MELCloud Home app offers
 * them (`flow`/`flow_cool` — live-captured guest writes with `/context`
 * readback, 2026-07-14); owners get the full precise mode set.
 */
export type HomeAtwDeviceProfile = Pick<
  Home.DeviceAtwFacade,
  'capabilities' | 'hasCoolingMode' | 'isOwner'
>

export interface HomeCapabilitiesOptionsAtw {
  readonly thermostat_mode: {
    readonly values: readonly CapabilitiesOptionsValues<
      Home.AtwZoneMode | HomeGuestAtwThermostatMode
    >[]
  }
  readonly 'thermostat_mode.zone2': {
    readonly title: LocalizedStrings
    readonly values: readonly CapabilitiesOptionsValues<
      Home.AtwZoneMode | HomeGuestAtwThermostatMode
    >[]
  }
}

// The guest app's coarse switch, labeled with the neutral heat/cool
// wording (node-homey-lib's thermostat_mode values, the vocabulary the
// ATA drivers show). The ids are abstract sides — the device converter
// projects them onto the pump's CURRENT mode family at write time
// (room ↔ room_cool, flow ↔ flow_cool), so an owner-side family change
// never strands the guest toggle.
const guestHeat: CapabilitiesOptionsValues<'heat'> = {
  id: 'heat',
  title: {
    ar: 'تسخين',
    da: 'Opvarm',
    de: 'Heizen',
    en: 'Heat',
    es: 'Calentar',
    fr: 'Chauffer',
    it: 'Calore',
    ko: '난방',
    nl: 'Verhitten',
    no: 'Varme',
    pl: 'Ogrzewanie',
    ru: 'Обогрев',
    sv: 'Värme',
  },
}

const guestCool: CapabilitiesOptionsValues<'cool'> = {
  id: 'cool',
  title: {
    ar: 'تبريد',
    da: 'Køl ned',
    de: 'Kühlen',
    en: 'Cool',
    es: 'Enfriar',
    fr: 'Refroidir',
    it: 'Raffreddamento',
    ko: '냉방',
    nl: 'Koelen',
    no: 'Avkjøle',
    pl: 'Chłodzenie',
    ru: 'Охлаждение',
    sv: 'Kyla',
  },
}

// Only complete option objects, and only for capabilities the device will
// actually have: device-level options shadow the manifest's per capability
// (temperature ranges/steps/titles stay in the compose manifest — the facade
// clamps setpoints device-side anyway), and setting options on an absent
// capability fails.
export const homeGetCapabilitiesOptionsAtw = ({
  capabilities: { hasZone2 },
  hasCoolingMode,
  isOwner,
}: HomeAtwDeviceProfile): Partial<HomeCapabilitiesOptionsAtw> => {
  const values =
    isOwner ? getThermostatModeValuesAtw(hasCoolingMode)
    : hasCoolingMode ? [guestHeat, guestCool]
    : [guestHeat]
  return {
    thermostat_mode: { values },
    ...(hasZone2 && {
      'thermostat_mode.zone2': { title: thermostatModeZone2TitleAtw, values },
    }),
  }
}
