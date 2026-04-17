import type * as Home from '@olivierzal/melcloud-api/home'

import type { ThermostatModeAta } from './ata.mts'
import type {
  BaseGetCapabilities,
  BaseListCapabilities,
  BaseSetCapabilities,
} from './bases.mts'

export type HomeCapabilitiesAta = HomeGetCapabilitiesAta &
  HomeListCapabilitiesAta &
  HomeSetCapabilitiesAta

/*
 * Uses method signature syntax (bivariant) to allow converter functions
 * to accept narrower parameter types from the facade getters.
 */
export type HomeConvertFromDevice = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    facade: Home.DeviceAtaFacade,
  ):
    | HomeCapabilitiesAta[keyof HomeSetCapabilitiesAta]
    | HomeCapabilitiesAta[
        | keyof HomeGetCapabilitiesAta
        | keyof HomeListCapabilitiesAta]
}['bivariant']

/*
 * Uses method signature syntax (bivariant) to allow converter functions
 * to accept narrower parameter types from capability values.
 */
export type HomeConvertToDevice = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: HomeSetCapabilitiesAta[keyof HomeSetCapabilitiesAta],
  ): Home.AtaValues[keyof Home.AtaValues]
}['bivariant']

export type HomeGetCapabilitiesAta = BaseGetCapabilities

export type HomeListCapabilitiesAta = BaseListCapabilities

export interface HomeSetCapabilitiesAta extends BaseSetCapabilities {
  readonly fan_speed: number
  readonly horizontal: string
  readonly target_temperature: number
  readonly thermostat_mode: keyof typeof ThermostatModeAta
  readonly vertical: string
}

export const homeSetCapabilityTagMappingAta: Record<
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
