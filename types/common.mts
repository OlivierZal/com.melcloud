import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
  type DeviceType,
  type EnergyData,
  type FanSpeed,
  type IModel,
  type ListDevice,
  type ListDeviceDataAta,
  type ListDeviceDataErv,
  type LoginCredentials,
  type SetDeviceData,
  type UpdateDeviceData,
} from '@olivierzal/melcloud-api'

import type { DateObjectUnits, DurationLike } from 'luxon'

import type MELCloudDeviceAta from '../drivers/melcloud/device.mts'
import type MELCloudDriverAta from '../drivers/melcloud/driver.mts'
import type MELCloudDeviceAtw from '../drivers/melcloud_atw/device.mts'
import type MELCloudDriverAtw from '../drivers/melcloud_atw/driver.mts'
import type MELCloudDeviceErv from '../drivers/melcloud_erv/device.mts'
import type MELCloudDriverErv from '../drivers/melcloud_erv/driver.mts'
import type { EnergyReportRegularAta } from '../reports/melcloud/regular.mts'
import type { EnergyReportTotalAta } from '../reports/melcloud/total.mts'
import type { EnergyReportRegularAtw } from '../reports/melcloud_atw/regular.mts'
import type { EnergyReportTotalAtw } from '../reports/melcloud_atw/total.mts'

import type {
  CapabilitiesAta,
  EnergyCapabilitiesAta,
  energyCapabilityTagMappingAta,
  FlowArgsAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  OpCapabilitiesAta,
  SetCapabilitiesAta,
  setCapabilityTagMappingAta,
} from './ata.mts'
import type {
  CapabilitiesAtw,
  CapabilitiesOptionsAtw,
  EnergyCapabilitiesAtw,
  energyCapabilityTagMappingAtw,
  FlowArgsAtw,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  OpCapabilitiesAtw,
  SetCapabilitiesAtw,
  setCapabilityTagMappingAtw,
} from './atw.mts'
import type {
  CapabilitiesOptionsValues,
  LocalizedStrings,
  RangeOptions,
} from './bases.mts'
import type {
  CapabilitiesErv,
  EnergyCapabilitiesErv,
  energyCapabilityTagMappingErv,
  FlowArgsErv,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  OpCapabilitiesErv,
  SetCapabilitiesErv,
  setCapabilityTagMappingErv,
} from './erv.mts'

export const K_MULTIPLIER = 1000

export const getCapabilitiesOptionsAtaErv = ({
  HasAutomaticFanSpeed: hasAutomaticFanSpeed,
  NumberOfFanSpeeds: numberOfFanSpeeds,
}:
  | ListDeviceDataAta
  | ListDeviceDataErv): Partial<CapabilitiesOptionsAtaErv> => ({
  fan_speed: {
    max: numberOfFanSpeeds,
    min: Number(!hasAutomaticFanSpeed),
    step: 1,
    units: '',
  },
})

export interface BuildingZone extends IModel {
  areas?: AreaZone[]
  floors?: FloorZone[]
}

export interface Capabilities {
  readonly Ata: CapabilitiesAta
  readonly Atw: CapabilitiesAtw
  readonly Erv: CapabilitiesErv
}

export interface CapabilitiesOptions {
  readonly Ata: CapabilitiesOptionsAtaErv
  readonly Atw: CapabilitiesOptionsAtw
  readonly Erv: CapabilitiesOptionsAtaErv
}

export interface CapabilitiesOptionsAtaErv {
  readonly fan_speed: RangeOptions
}

export interface DeviceDetails<T extends keyof typeof DeviceType> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions[T]>
  readonly data: { readonly id: number }
  readonly name: string
}

export interface DriverCapabilitiesOptions {
  readonly title: string
  readonly type: string
  readonly values?: readonly { readonly id: string; readonly label: string }[]
}

export interface DriverSetting {
  readonly driverId: string
  readonly id: string
  title: string
  readonly type: string
  readonly groupId?: string
  readonly groupLabel?: string
  readonly max?: number
  readonly min?: number
  placeholder?: string
  readonly units?: string
  readonly values?: readonly { readonly id: string; readonly label: string }[]
}

export interface EnergyCapabilities {
  readonly Ata: EnergyCapabilitiesAta
  readonly Atw: EnergyCapabilitiesAtw
  readonly Erv: EnergyCapabilitiesErv
}

export interface EnergyCapabilityTagMapping {
  readonly Ata: typeof energyCapabilityTagMappingAta
  readonly Atw: typeof energyCapabilityTagMappingAtw
  readonly Erv: typeof energyCapabilityTagMappingErv
}

export interface FloorZone extends IModel {
  areas?: AreaZone[]
}

export interface FlowArgs {
  readonly Ata: FlowArgsAta
  readonly Atw: FlowArgsAtw
  readonly Erv: FlowArgsErv
}

export interface GetCapabilityTagMapping {
  readonly Ata: typeof getCapabilityTagMappingAta
  readonly Atw: typeof getCapabilityTagMappingAtw
  readonly Erv: typeof getCapabilityTagMappingErv
}

export interface HomeySettingsUI {
  readonly contextKey?: string
  readonly expiry?: string
  readonly password?: string
  readonly username?: string
}

export interface ListCapabilityTagMapping {
  readonly Ata: typeof listCapabilityTagMappingAta
  readonly Atw: typeof listCapabilityTagMappingAtw
  readonly Erv: typeof listCapabilityTagMappingErv
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}

export interface LoginSetting extends PairSetting {
  readonly id: 'login'
  readonly options: {
    readonly passwordLabel: LocalizedStrings
    readonly passwordPlaceholder: LocalizedStrings
    readonly usernameLabel: LocalizedStrings
    readonly usernamePlaceholder: LocalizedStrings
  }
}

export interface Manifest {
  readonly drivers: readonly ManifestDriver[]
  readonly version: string
}

export interface ManifestDriver {
  readonly id: string
  readonly capabilities?: readonly string[]
  readonly capabilitiesOptions?: Record<
    string,
    ManifestDriverCapabilitiesOptions
  >
  readonly pair?: LoginSetting & readonly PairSetting[]
  readonly settings?: readonly ManifestDriverSetting[]
}

export interface ManifestDriverCapabilitiesOptions {
  readonly title: LocalizedStrings
  readonly type: string
  readonly values?: readonly CapabilitiesOptionsValues<string>[]
}

export interface ManifestDriverSetting {
  readonly label: LocalizedStrings
  readonly children?: readonly ManifestDriverSettingData[]
  readonly id?: string
}

export interface ManifestDriverSettingData {
  readonly id: string
  readonly label: LocalizedStrings
  readonly type: string
  readonly max?: number
  readonly min?: number
  readonly units?: string
  readonly values?: readonly {
    readonly id: string
    readonly label: LocalizedStrings
  }[]
}

export interface MELCloudDriver {
  readonly Ata: MELCloudDriverAta
  readonly Atw: MELCloudDriverAtw
  readonly Erv: MELCloudDriverErv
}

export interface OpCapabilities {
  readonly Ata: OpCapabilitiesAta
  readonly Atw: OpCapabilitiesAtw
  readonly Erv: OpCapabilitiesErv
}

export interface PairSetting {
  readonly id: string
}

export interface ReportPlanParameters {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly values: DateObjectUnits
}

export interface SetCapabilities {
  readonly Ata: SetCapabilitiesAta
  readonly Atw: SetCapabilitiesAtw
  readonly Erv: SetCapabilitiesErv
}

export interface SetCapabilityTagMapping {
  readonly Ata: typeof setCapabilityTagMappingAta
  readonly Atw: typeof setCapabilityTagMappingAtw
  readonly Erv: typeof setCapabilityTagMappingErv
}

export interface Settings
  extends Record<string, boolean | number | string | null | undefined> {
  readonly always_on?: boolean
}

export type AreaZone = IModel

export type ConvertFromDevice<T extends keyof typeof DeviceType> = (
  value: ListDevice[T]['Device'][keyof ListDevice[T]['Device']],
  data?: ListDevice[T]['Device'],
) => OpCapabilities[T][keyof OpCapabilities[T]]

export type ConvertToDevice<T extends keyof typeof DeviceType> = (
  value: SetCapabilities[T][keyof SetCapabilities[T]],
) => UpdateDeviceData[T][keyof UpdateDeviceData[T]]

export type DeviceSetting = Record<string, ValueOf<Settings>>

export type DeviceSettings = Record<string, DeviceSetting>

export type EnergyCapabilityTagEntry<T extends keyof typeof DeviceType> = [
  capability: Extract<keyof EnergyCapabilities[T], string>,
  tags: (keyof EnergyData[T])[],
]

export type MELCloudDevice =
  | MELCloudDeviceAta
  | MELCloudDeviceAtw
  | MELCloudDeviceErv

export type OpCapabilityTagEntry<T extends keyof typeof DeviceType> = [
  capability: Extract<keyof OpCapabilities[T], string>,
  tag: OpDeviceData<T>,
]

export type OpDeviceData<T extends keyof typeof DeviceType> =
  | keyof ListDevice[T]['Device']
  | keyof SetDeviceData[T]

export type ValueOf<T> = T[keyof T]
export type Zone = AreaZone | BuildingZone | FloorZone

export const zoneModel = {
  areas: AreaModel,
  buildings: BuildingModel,
  devices: DeviceModel,
  floors: FloorModel,
} as const
export interface ZoneData {
  zoneId: string
  zoneType: Exclude<keyof typeof zoneModel, 'devices'>
}

const addPrefixToTitle = (
  title: LocalizedStrings,
  prefix: LocalizedStrings,
): LocalizedStrings =>
  Object.fromEntries(
    Object.entries(prefix).map(([language, localizedPrefix]) => [
      language,
      `${localizedPrefix ?? prefix.en} ${(title[language] ?? title.en).toLowerCase()}`,
    ]),
  ) as LocalizedStrings

const auto: CapabilitiesOptionsValues<'auto'> = {
  id: 'auto',
  title: {
    da: 'Automatisk',
    en: 'Automatic',
    es: 'Automático',
    fr: 'Automatique',
    nl: 'Automatisch',
    no: 'Automatisk',
    sv: 'Automatiskt',
  },
} as const

const fast: CapabilitiesOptionsValues<'fast'> = {
  id: 'fast',
  title: {
    da: 'Hurtig',
    en: 'Fast',
    es: 'Rápido',
    fr: 'Rapide',
    nl: 'Snel',
    no: 'Rask',
    sv: 'Snabb',
  },
} as const

const moderate: CapabilitiesOptionsValues<'moderate'> = {
  id: 'moderate',
  title: {
    da: 'Moderat',
    en: 'Moderate',
    es: 'Moderado',
    fr: 'Modéré',
    nl: 'Matig',
    no: 'Moderat',
    sv: 'Måttlig',
  },
} as const

const slow: CapabilitiesOptionsValues<'slow'> = {
  id: 'slow',
  title: {
    da: 'Langsom',
    en: 'Slow',
    es: 'Lento',
    fr: 'Lent',
    nl: 'Langzaam',
    no: 'Sakte',
    sv: 'Långsam',
  },
} as const

const createVeryObject = ({
  id,
  title,
}: {
  id: 'fast' | 'slow'
  title: LocalizedStrings
}): CapabilitiesOptionsValues<keyof typeof FanSpeed> => ({
  id: `very_${id}`,
  title: addPrefixToTitle(title, {
    da: 'Meget',
    en: 'Very',
    es: 'Muy',
    fr: 'Très',
    nl: 'Zeer',
    no: 'Veldig',
    sv: 'Mycket',
  }),
})

export const fanSpeedValues = [
  auto,
  createVeryObject(fast),
  fast,
  moderate,
  slow,
  createVeryObject(slow),
] as const

export interface EnergyReportRegular {
  readonly Ata: EnergyReportRegularAta
  readonly Atw: EnergyReportRegularAtw
  readonly Erv: never
}

export interface EnergyReportTotal {
  readonly Ata: EnergyReportTotalAta
  readonly Atw: EnergyReportTotalAtw
  readonly Erv: never
}

export interface GetAtaOptions {
  mode?: 'detailed'
  status?: 'on'
}

export type EnergyReportMode = 'regular' | 'total'
