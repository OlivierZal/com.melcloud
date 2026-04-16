import type {
  ClassicDeviceType,
  EnergyData,
  GetDeviceData,
  ListDeviceData,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type { RangeOptions } from './bases.mts'
import type * as classicAta from './classic-ata.mts'
import type * as classicAtw from './classic-atw.mts'
import type * as classicErv from './classic-erv.mts'

type GetCapabilities<T extends ClassicDeviceType> =
  T extends typeof ClassicDeviceType.Ata ? classicAta.GetCapabilities
  : T extends typeof ClassicDeviceType.Atw ? classicAtw.GetCapabilities
  : T extends typeof ClassicDeviceType.Erv ? classicErv.GetCapabilities
  : never

type ListCapabilities<T extends ClassicDeviceType> =
  T extends typeof ClassicDeviceType.Ata ? classicAta.ListCapabilities
  : T extends typeof ClassicDeviceType.Atw ? classicAtw.ListCapabilities
  : T extends typeof ClassicDeviceType.Erv ? classicErv.ListCapabilities
  : never

export type Capabilities<T extends ClassicDeviceType> =
  T extends typeof ClassicDeviceType.Ata ? classicAta.Capabilities
  : T extends typeof ClassicDeviceType.Atw ? classicAtw.Capabilities
  : T extends typeof ClassicDeviceType.Erv ? classicErv.Capabilities
  : never

export type CapabilitiesOptions<T extends ClassicDeviceType> =
  T extends typeof ClassicDeviceType.Atw ? classicAtw.CapabilitiesOptions
  : CapabilitiesOptionsAtaErv

export interface CapabilitiesOptionsAtaErv {
  readonly fan_speed: RangeOptions
}

/*
 * Uses method signature syntax (bivariant) so that concrete converter
 * implementations can accept narrower parameter types without type errors.
 */
export type CapabilityConverter = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(value: unknown, data?: unknown): unknown
}['bivariant']

/*
 * Uses method signature syntax (bivariant) to allow converter functions
 * to accept narrower parameter types (e.g., FanSpeed instead of the full
 * ListDeviceData value union).
 */
export type ConvertFromDevice<T extends ClassicDeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): OperationalCapabilities<T>[keyof OperationalCapabilities<T>]
}['bivariant']

/*
 * Uses method signature syntax (bivariant) to allow converter functions
 * to accept narrower parameter types (e.g., FanSpeed instead of the full
 * UpdateDeviceData value union).
 */
export type ConvertToDevice<T extends ClassicDeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: SetCapabilities<T>[keyof SetCapabilities<T>],
  ): UpdateDeviceData<T>[keyof UpdateDeviceData<T>]
}['bivariant']

export type EnergyCapabilities<T extends ClassicDeviceType> =
  T extends typeof ClassicDeviceType.Ata ? classicAta.EnergyCapabilities
  : T extends typeof ClassicDeviceType.Atw ? classicAtw.EnergyCapabilities
  : T extends typeof ClassicDeviceType.Erv ? classicErv.EnergyCapabilities
  : Record<string, never>

export type EnergyCapabilityTagEntry<T extends ClassicDeviceType> = [
  capability: string & keyof EnergyCapabilities<T>,
  tags: readonly (keyof EnergyData<T>)[],
]

export type EnergyCapabilityTagMapping<T extends ClassicDeviceType> = Record<
  keyof EnergyCapabilities<T>,
  readonly (string & keyof EnergyData<T>)[]
>

export type GetCapabilityTagMapping<T extends ClassicDeviceType> = Record<
  keyof GetCapabilities<T>,
  keyof GetDeviceData<T>
>

export type ListCapabilityTagMapping<T extends ClassicDeviceType> = Record<
  keyof ListCapabilities<T>,
  keyof ListDeviceData<T>
>

export type OperationalCapabilities<T extends ClassicDeviceType> =
  GetCapabilities<T> & ListCapabilities<T> & SetCapabilities<T>

export type OperationalCapabilityTagEntry<T extends ClassicDeviceType> = [
  capability: string & keyof OperationalCapabilities<T>,
  tag: keyof ListDeviceData<T>,
]

export type SetCapabilities<T extends ClassicDeviceType> =
  T extends typeof ClassicDeviceType.Ata ? classicAta.SetCapabilities
  : T extends typeof ClassicDeviceType.Atw ? classicAtw.SetCapabilities
  : T extends typeof ClassicDeviceType.Erv ? classicErv.SetCapabilities
  : never

export type SetCapabilityTagMapping<T extends ClassicDeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof UpdateDeviceData<T>
>
