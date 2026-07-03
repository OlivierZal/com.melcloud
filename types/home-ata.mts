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

/**
 * Converter from a Home ATA device facade to the corresponding Homey
 * capability value.
 */
export type HomeConvertFromDevice = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow the return to a specific capability type
  bivariant(
    facade: Home.DeviceAtaFacade,
  ):
    | HomeCapabilitiesAta[keyof HomeSetCapabilitiesAta]
    | HomeCapabilitiesAta[
        | keyof HomeGetCapabilitiesAta
        | keyof HomeListCapabilitiesAta]
}['bivariant']

/**
 * Converter from a Homey capability value to the corresponding Home ATA
 * device value.
 */
export type HomeConvertToDevice = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow `value` to a specific member of the HomeSetCapabilitiesAta value union
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
