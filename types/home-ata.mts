import type { HomeAtaValues } from '@olivierzal/melcloud-api'

import type { ThermostatModeAta } from './ata.mts'
import type { BaseGetCapabilities, BaseSetCapabilities } from './bases.mts'

export type HomeCapabilitiesAta = HomeGetCapabilitiesAta &
  HomeListCapabilitiesAta &
  HomeSetCapabilitiesAta

export type HomeGetCapabilitiesAta = BaseGetCapabilities

export type HomeListCapabilitiesAta = Record<string, never>

export interface HomeSetCapabilitiesAta extends BaseSetCapabilities {
  readonly fan_speed: number
  readonly horizontal: string
  readonly target_temperature: number
  readonly thermostat_mode: keyof typeof ThermostatModeAta
  readonly vertical: string
}

export const homeSetCapabilityTagMappingAta: Record<
  keyof HomeSetCapabilitiesAta,
  keyof HomeAtaValues
> = {
  fan_speed: 'setFanSpeed',
  horizontal: 'vaneHorizontalDirection',
  onoff: 'power',
  target_temperature: 'setTemperature',
  thermostat_mode: 'operationMode',
  vertical: 'vaneVerticalDirection',
}
