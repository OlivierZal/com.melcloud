import type * as Home from '@olivierzal/melcloud-api/home'

import type {
  HomeMELCloudDeviceAta,
  HomeMELCloudDeviceAtw,
  HomeMELCloudDriverAta,
  HomeMELCloudDriverAtw,
} from '../drivers/index.mts'
import type {
  HomeCapabilitiesAta,
  HomeSetCapabilitiesAta,
} from './home-ata.mts'
import type {
  HomeCapabilitiesAtw,
  HomeSetCapabilitiesAtw,
} from './home-atw.mts'

type HomeCapabilities<T extends Home.DeviceType> =
  T extends typeof Home.DeviceType.Ata ? HomeCapabilitiesAta
  : T extends typeof Home.DeviceType.Atw ? HomeCapabilitiesAtw
  : never

type HomeSetCapabilities<T extends Home.DeviceType> =
  T extends typeof Home.DeviceType.Ata ? HomeSetCapabilitiesAta
  : T extends typeof Home.DeviceType.Atw ? HomeSetCapabilitiesAtw
  : never

type HomeValues<T extends Home.DeviceType> =
  T extends typeof Home.DeviceType.Ata ? Home.AtaValues
  : T extends typeof Home.DeviceType.Atw ? Home.AtwValues
  : never

/**
 * Converter from a Home device facade to the corresponding Homey capability
 * value, parameterized by device type. `null` clears the Homey value — used
 * when the facade reports no reading (e.g. zone-2 fields on a single-zone
 * ATW unit).
 */
export type HomeConvertFromDevice<T extends Home.DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow the return to a specific capability type
  bivariant(
    facade: HomeDeviceFacade<T>,
  ): HomeCapabilities<T>[keyof HomeCapabilities<T>] | null
}['bivariant']

/**
 * Converter from a Homey capability value to the corresponding Home device
 * value, parameterized by device type.
 */
export type HomeConvertToDevice<T extends Home.DeviceType> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow `value` to a specific member of the set-capability value union
  bivariant(
    value: HomeSetCapabilities<T>[keyof HomeSetCapabilities<T>],
  ): HomeValues<T>[keyof HomeValues<T>]
}['bivariant']

export interface HomeDeviceDetails {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<Record<string, unknown>>
  readonly data: { readonly id: string }
  readonly name: string
}

export type HomeDeviceFacade<T extends Home.DeviceType> =
  T extends typeof Home.DeviceType.Ata ? Home.DeviceAtaFacade
  : T extends typeof Home.DeviceType.Atw ? Home.DeviceAtwFacade
  : never

export type HomeMELCloudDevice = HomeMELCloudDeviceAta | HomeMELCloudDeviceAtw

export type HomeMELCloudDriver = HomeMELCloudDriverAta | HomeMELCloudDriverAtw
