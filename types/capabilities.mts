import type {
  DeviceType,
  EnergyData,
  GetDeviceData,
  ListDeviceData,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type {
  ClassicCapabilitiesAta,
  ClassicEnergyCapabilitiesAta,
  ClassicGetCapabilitiesAta,
  ClassicListCapabilitiesAta,
  ClassicSetCapabilitiesAta,
} from './ata.mts'
import type {
  ClassicCapabilitiesAtw,
  ClassicCapabilitiesOptionsAtw,
  ClassicEnergyCapabilitiesAtw,
  ClassicGetCapabilitiesAtw,
  ClassicListCapabilitiesAtw,
  ClassicSetCapabilitiesAtw,
} from './atw.mts'
import type { RangeOptions } from './bases.mts'
import type {
  ClassicCapabilitiesErv,
  ClassicEnergyCapabilitiesErv,
  ClassicGetCapabilitiesErv,
  ClassicListCapabilitiesErv,
  ClassicSetCapabilitiesErv,
} from './erv.mts'

type GetCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? ClassicGetCapabilitiesAta
  : T extends typeof DeviceType.Atw ? ClassicGetCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? ClassicGetCapabilitiesErv
  : never

type ListCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? ClassicListCapabilitiesAta
  : T extends typeof DeviceType.Atw ? ClassicListCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? ClassicListCapabilitiesErv
  : never

export type Capabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? ClassicCapabilitiesAta
  : T extends typeof DeviceType.Atw ? ClassicCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? ClassicCapabilitiesErv
  : never

export type CapabilitiesOptions<T extends DeviceType> =
  T extends typeof DeviceType.Atw ? ClassicCapabilitiesOptionsAtw
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
  T extends typeof DeviceType.Ata ? ClassicEnergyCapabilitiesAta
  : T extends typeof DeviceType.Atw ? ClassicEnergyCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? ClassicEnergyCapabilitiesErv
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
  T extends typeof DeviceType.Ata ? ClassicSetCapabilitiesAta
  : T extends typeof DeviceType.Atw ? ClassicSetCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? ClassicSetCapabilitiesErv
  : never

export type SetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof UpdateDeviceData<T>
>
