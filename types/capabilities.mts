import type {
  DeviceType,
  EnergyData,
  GetDeviceData,
  ListDeviceData,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type {
  CapabilitiesAta,
  EnergyCapabilitiesAta,
  GetCapabilitiesAta,
  ListCapabilitiesAta,
  SetCapabilitiesAta,
} from './ata.mts'
import type {
  CapabilitiesAtw,
  CapabilitiesOptionsAtw,
  EnergyCapabilitiesAtw,
  GetCapabilitiesAtw,
  ListCapabilitiesAtw,
  SetCapabilitiesAtw,
} from './atw.mts'
import type { RangeOptions } from './bases.mts'
import type {
  CapabilitiesErv,
  EnergyCapabilitiesErv,
  GetCapabilitiesErv,
  ListCapabilitiesErv,
  SetCapabilitiesErv,
} from './erv.mts'

type GetCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? GetCapabilitiesAta
  : T extends typeof DeviceType.Atw ? GetCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? GetCapabilitiesErv
  : never

type ListCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? ListCapabilitiesAta
  : T extends typeof DeviceType.Atw ? ListCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? ListCapabilitiesErv
  : never

export type Capabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? CapabilitiesAta
  : T extends typeof DeviceType.Atw ? CapabilitiesAtw
  : T extends typeof DeviceType.Erv ? CapabilitiesErv
  : never

export type CapabilitiesOptions<T extends DeviceType> =
  T extends typeof DeviceType.Atw ? CapabilitiesOptionsAtw
  : CapabilitiesOptionsAtaErv

export interface CapabilitiesOptionsAtaErv {
  readonly fan_speed: RangeOptions
}

export type ConvertFromDevice<T extends DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  bivariant(
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): OperationalCapabilities<T>[keyof OperationalCapabilities<T>]
}['bivariant']

export type ConvertToDevice<T extends DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  bivariant(
    value: SetCapabilities<T>[keyof SetCapabilities<T>],
  ): UpdateDeviceData<T>[keyof UpdateDeviceData<T>]
}['bivariant']

export type EnergyCapabilities<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? EnergyCapabilitiesAta
  : T extends typeof DeviceType.Atw ? EnergyCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? EnergyCapabilitiesErv
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
  T extends typeof DeviceType.Ata ? SetCapabilitiesAta
  : T extends typeof DeviceType.Atw ? SetCapabilitiesAtw
  : T extends typeof DeviceType.Erv ? SetCapabilitiesErv
  : never

export type SetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof UpdateDeviceData<T>
>
