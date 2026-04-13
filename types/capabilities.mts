import type {
  DeviceType,
  EnergyData,
  GetDeviceData,
  ListDeviceData,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type { RangeOptions } from './bases.mts'
import type * as classicAta from './classic-ata.mts'
import type * as classicAtw from './classic-atw.mts'
import type * as classicErv from './classic-erv.mts'

type GetCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? classicAta.GetCapabilities
  : T extends typeof DeviceType.Atw ? classicAtw.GetCapabilities
  : T extends typeof DeviceType.Erv ? classicErv.GetCapabilities
  : never

type ListCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? classicAta.ListCapabilities
  : T extends typeof DeviceType.Atw ? classicAtw.ListCapabilities
  : T extends typeof DeviceType.Erv ? classicErv.ListCapabilities
  : never

export type Capabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? classicAta.Capabilities
  : T extends typeof DeviceType.Atw ? classicAtw.Capabilities
  : T extends typeof DeviceType.Erv ? classicErv.Capabilities
  : never

export type CapabilitiesOptions<T extends DeviceType> =
  T extends typeof DeviceType.Atw ? classicAtw.CapabilitiesOptions
  : CapabilitiesOptionsAtaErv

export interface CapabilitiesOptionsAtaErv {
  readonly fan_speed: RangeOptions
}

/*
 * Uses method signature syntax (bivariant) instead of arrow function syntax
 * (contravariant). This allows converter functions to accept narrower parameter
 * types (e.g., FanSpeed instead of the full ListDeviceData value union) without
 * type errors.
 */
export type ConvertFromDevice<T extends DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): OperationalCapabilities<T>[keyof OperationalCapabilities<T>]
}['bivariant']

/*
 * Uses method signature syntax (bivariant) instead of arrow function syntax
 * (contravariant). This allows converter functions to accept narrower parameter
 * types (e.g., FanSpeed instead of the full UpdateDeviceData value union)
 * without type errors.
 */
export type ConvertToDevice<T extends DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax required for bivariant type checking
  bivariant(
    value: SetCapabilities<T>[keyof SetCapabilities<T>],
  ): UpdateDeviceData<T>[keyof UpdateDeviceData<T>]
}['bivariant']

export type EnergyCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? classicAta.EnergyCapabilities
  : T extends typeof DeviceType.Atw ? classicAtw.EnergyCapabilities
  : T extends typeof DeviceType.Erv ? classicErv.EnergyCapabilities
  : Record<string, never>

export type EnergyCapabilityTagEntry<T extends DeviceType> = [
  capability: string & keyof EnergyCapabilities<T>,
  tags: readonly (keyof EnergyData<T>)[],
]

export type EnergyCapabilityTagMapping<T extends DeviceType> = Record<
  keyof EnergyCapabilities<T>,
  readonly (string & keyof EnergyData<T>)[]
>

export type GetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof GetCapabilities<T>,
  keyof GetDeviceData<T>
>

export type ListCapabilityTagMapping<T extends DeviceType> = Record<
  keyof ListCapabilities<T>,
  keyof ListDeviceData<T>
>

export type OperationalCapabilities<T extends DeviceType> = GetCapabilities<T> &
  ListCapabilities<T> &
  SetCapabilities<T>

export type OperationalCapabilityTagEntry<T extends DeviceType> = [
  capability: string & keyof OperationalCapabilities<T>,
  tag: keyof ListDeviceData<T>,
]

export type SetCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? classicAta.SetCapabilities
  : T extends typeof DeviceType.Atw ? classicAtw.SetCapabilities
  : T extends typeof DeviceType.Erv ? classicErv.SetCapabilities
  : never

export type SetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof UpdateDeviceData<T>
>
