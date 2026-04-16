import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { RangeOptions } from './bases.mts'
import type * as classicAta from './classic-ata.mts'
import type * as classicAtw from './classic-atw.mts'
import type * as classicErv from './classic-erv.mts'

type GetCapabilities<T extends Classic.DeviceType> =
  T extends typeof Classic.DeviceType.Ata ? classicAta.GetCapabilities
  : T extends typeof Classic.DeviceType.Atw ? classicAtw.GetCapabilities
  : T extends typeof Classic.DeviceType.Erv ? classicErv.GetCapabilities
  : never

type ListCapabilities<T extends Classic.DeviceType> =
  T extends typeof Classic.DeviceType.Ata ? classicAta.ListCapabilities
  : T extends typeof Classic.DeviceType.Atw ? classicAtw.ListCapabilities
  : T extends typeof Classic.DeviceType.Erv ? classicErv.ListCapabilities
  : never

export type Capabilities<T extends Classic.DeviceType> =
  T extends typeof Classic.DeviceType.Ata ? classicAta.Capabilities
  : T extends typeof Classic.DeviceType.Atw ? classicAtw.Capabilities
  : T extends typeof Classic.DeviceType.Erv ? classicErv.Capabilities
  : never

export type CapabilitiesOptions<T extends Classic.DeviceType> =
  T extends typeof Classic.DeviceType.Atw ? classicAtw.CapabilitiesOptions
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
 * to accept narrower parameter types (e.g., ClassicFanSpeed instead of the full
 * Classic.ListDeviceData value union).
 */
export type ConvertFromDevice<T extends Classic.DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: Classic.ListDeviceData<T>[keyof Classic.ListDeviceData<T>],
    data?: Classic.ListDeviceData<T>,
  ): OperationalCapabilities<T>[keyof OperationalCapabilities<T>]
}['bivariant']

/*
 * Uses method signature syntax (bivariant) to allow converter functions
 * to accept narrower parameter types (e.g., ClassicFanSpeed instead of the full
 * Classic.UpdateDeviceData value union).
 */
export type ConvertToDevice<T extends Classic.DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: SetCapabilities<T>[keyof SetCapabilities<T>],
  ): Classic.UpdateDeviceData<T>[keyof Classic.UpdateDeviceData<T>]
}['bivariant']

export type EnergyCapabilities<T extends Classic.DeviceType> =
  T extends typeof Classic.DeviceType.Ata ? classicAta.EnergyCapabilities
  : T extends typeof Classic.DeviceType.Atw ? classicAtw.EnergyCapabilities
  : T extends typeof Classic.DeviceType.Erv ? classicErv.EnergyCapabilities
  : Record<string, never>

export type EnergyCapabilityTagEntry<T extends Classic.DeviceType> = [
  capability: string & keyof EnergyCapabilities<T>,
  tags: readonly (keyof Classic.EnergyData<T>)[],
]

export type EnergyCapabilityTagMapping<T extends Classic.DeviceType> = Record<
  keyof EnergyCapabilities<T>,
  readonly (string & keyof Classic.EnergyData<T>)[]
>

export type GetCapabilityTagMapping<T extends Classic.DeviceType> = Record<
  keyof GetCapabilities<T>,
  keyof Classic.GetDeviceData<T>
>

export type ListCapabilityTagMapping<T extends Classic.DeviceType> = Record<
  keyof ListCapabilities<T>,
  keyof Classic.ListDeviceData<T>
>

export type OperationalCapabilities<T extends Classic.DeviceType> =
  GetCapabilities<T> & ListCapabilities<T> & SetCapabilities<T>

export type OperationalCapabilityTagEntry<T extends Classic.DeviceType> = [
  capability: string & keyof OperationalCapabilities<T>,
  tag: keyof Classic.ListDeviceData<T>,
]

export type SetCapabilities<T extends Classic.DeviceType> =
  T extends typeof Classic.DeviceType.Ata ? classicAta.SetCapabilities
  : T extends typeof Classic.DeviceType.Atw ? classicAtw.SetCapabilities
  : T extends typeof Classic.DeviceType.Erv ? classicErv.SetCapabilities
  : never

export type SetCapabilityTagMapping<T extends Classic.DeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof Classic.UpdateDeviceData<T>
>
