import type * as Home from '@olivierzal/melcloud-api/home'

import type { ThermostatModeAta } from './ata.mts'
import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases.mts'
import type { HomeEnergyMeasureName } from './device.mts'

type HomeGetCapabilitiesAta = BaseGetCapabilities

type HomeListCapabilitiesAta = BaseListCapabilities

/**
 * Structural slice of {@link Home.DeviceAtaFacade} driving a Home ATA
 * device's capability options. Satisfied by the facade itself.
 */
export type HomeAtaDeviceProfile = Pick<Home.DeviceAtaFacade, 'capabilities'>

export type HomeCapabilitiesAta = HomeGetCapabilitiesAta &
  HomeListCapabilitiesAta &
  HomeSetCapabilitiesAta

export interface HomeSetCapabilitiesAta extends BaseSetCapabilities {
  readonly fan_speed: number
  readonly horizontal: string
  readonly target_temperature: number
  readonly thermostat_mode: keyof typeof ThermostatModeAta
  readonly vertical: string
}

const homeSetCapabilityTagMappingAta: Record<
  keyof HomeSetCapabilitiesAta,
  keyof Home.AtaValues
> = {
  fan_speed: 'setFanSpeed',
  horizontal: 'vaneHorizontalDirection',
  onoff: 'power',
  target_temperature: 'setTemperature',
  thermostat_mode: 'operationMode',
  vertical: 'vaneVerticalDirection',
}

export const homeTagMappingsAta: {
  readonly energy: Readonly<Record<string, readonly HomeEnergyMeasureName[]>>
  readonly get: Readonly<Record<string, string>>
  readonly list: Readonly<Record<string, string>>
  readonly set: typeof homeSetCapabilityTagMappingAta
} = {
  // Values name the telemetry measure each capability reads; behavior is
  // keyed on the capability name (measure_power*/*daily*/cop) like Classic.
  energy: {
    measure_power: ['consumed'],
    meter_power: ['consumed'],
    'meter_power.daily': ['consumed'],
  },
  get: {},
  list: {},
  set: homeSetCapabilityTagMappingAta,
}
