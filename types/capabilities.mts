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
  FlowArgsAta,
  GetCapabilitiesAta,
  ListCapabilitiesAta,
  SetCapabilitiesAta,
} from './ata.mts'
import type {
  CapabilitiesAtw,
  CapabilitiesOptionsAtw,
  EnergyCapabilitiesAtw,
  FlowArgsAtw,
  GetCapabilitiesAtw,
  ListCapabilitiesAtw,
  SetCapabilitiesAtw,
} from './atw.mts'
import type { RangeOptions } from './bases.mts'
import type {
  CapabilitiesErv,
  EnergyCapabilitiesErv,
  FlowArgsErv,
  GetCapabilitiesErv,
  ListCapabilitiesErv,
  SetCapabilitiesErv,
} from './erv.mts'

interface DeviceTypeMap {
  [DeviceType.Ata]: {
    readonly capabilities: CapabilitiesAta
    readonly capabilitiesOptions: CapabilitiesOptionsAtaErv
    readonly energyCapabilities: EnergyCapabilitiesAta
    readonly flowArgs: FlowArgsAta
    readonly getCapabilities: GetCapabilitiesAta
    readonly listCapabilities: ListCapabilitiesAta
    readonly setCapabilities: SetCapabilitiesAta
  }
  [DeviceType.Atw]: {
    readonly capabilities: CapabilitiesAtw
    readonly capabilitiesOptions: CapabilitiesOptionsAtw
    readonly energyCapabilities: EnergyCapabilitiesAtw
    readonly flowArgs: FlowArgsAtw
    readonly getCapabilities: GetCapabilitiesAtw
    readonly listCapabilities: ListCapabilitiesAtw
    readonly setCapabilities: SetCapabilitiesAtw
  }
  [DeviceType.Erv]: {
    readonly capabilities: CapabilitiesErv
    readonly capabilitiesOptions: CapabilitiesOptionsAtaErv
    readonly energyCapabilities: EnergyCapabilitiesErv
    readonly flowArgs: FlowArgsErv
    readonly getCapabilities: GetCapabilitiesErv
    readonly listCapabilities: ListCapabilitiesErv
    readonly setCapabilities: SetCapabilitiesErv
  }
}

type GetCapabilities<T extends DeviceType> =
  DeviceTypeMap[T]['getCapabilities']

type ListCapabilities<T extends DeviceType> =
  DeviceTypeMap[T]['listCapabilities']

export type Capabilities<T extends DeviceType> =
  DeviceTypeMap[T]['capabilities']

export type CapabilitiesOptions<T extends DeviceType> =
  DeviceTypeMap[T]['capabilitiesOptions']

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
  // eslint-disable-next-line @typescript-eslint/method-signature-style
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
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  bivariant(
    value: SetCapabilities<T>[keyof SetCapabilities<T>],
  ): UpdateDeviceData<T>[keyof UpdateDeviceData<T>]
}['bivariant']

export type EnergyCapabilities<T extends DeviceType> =
  DeviceTypeMap[T]['energyCapabilities']

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
  DeviceTypeMap[T]['setCapabilities']

export type FlowArgs<T extends DeviceType> = DeviceTypeMap[T]['flowArgs']

export type SetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof UpdateDeviceData<T>
>
