import type { DateObjectUnits, DurationLike } from 'luxon'

import {
  type BaseModel,
  type DeviceType,
  type EnergyData,
  type ListDevice,
  type ListDeviceDataAta,
  type ListDeviceDataErv,
  type LoginCredentials,
  type SetDeviceData,
  type UpdateDeviceData,
  AreaModel,
  BuildingModel,
  FloorModel,
} from '@olivierzal/melcloud-api'

import type AtaDevice from '../drivers/melcloud/device'
import type AtaDriver from '../drivers/melcloud/driver'
import type AtwDevice from '../drivers/melcloud_atw/device'
import type AtwDriver from '../drivers/melcloud_atw/driver'
import type ErvDevice from '../drivers/melcloud_erv/device'
import type ErvDriver from '../drivers/melcloud_erv/driver'
import type {
  CapabilitiesAta,
  EnergyCapabilitiesAta,
  FlowArgsAta,
  OpCapabilitiesAta,
  SetCapabilitiesAta,
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from './ata'
import type {
  CapabilitiesAtw,
  CapabilitiesOptionsAtw,
  EnergyCapabilitiesAtw,
  FlowArgsAtw,
  OpCapabilitiesAtw,
  SetCapabilitiesAtw,
  energyCapabilityTagMappingAtw,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
} from './atw'
import type { LocalizedStrings, RangeOptions } from './bases'
import type {
  CapabilitiesErv,
  EnergyCapabilitiesErv,
  FlowArgsErv,
  OpCapabilitiesErv,
  SetCapabilitiesErv,
  energyCapabilityTagMappingErv,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
} from './erv'

export const K_MULTIPLIER = 1000

export const getCapabilitiesOptionsAtaErv = ({
  HasAutomaticFanSpeed: hasAutomaticFanSpeed,
  NumberOfFanSpeeds: numberOfFanSpeeds,
}:
  | ListDeviceDataAta
  | ListDeviceDataErv): Partial<CapabilitiesOptionsAtaErv> => ({
  fan_power: {
    max: numberOfFanSpeeds,
    min: Number(!hasAutomaticFanSpeed),
    step: 1,
    units: { en: '' },
  },
})

export interface MELCloudDriver {
  readonly Ata: AtaDriver
  readonly Atw: AtwDriver
  readonly Erv: ErvDriver
}

export type MELCloudDevice = AtaDevice | AtwDevice | ErvDevice

export type ValueOf<T> = T[keyof T]

export interface Settings
  extends Record<string, boolean | number | string | null | undefined> {
  readonly always_on?: boolean
}

export interface HomeySettingsUI {
  readonly contextKey?: string
  readonly expiry?: string
  readonly password?: string
  readonly username?: string
}

export interface ReportPlanParameters {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly values: DateObjectUnits
}

export interface ManifestDriverSettingData {
  readonly max?: number
  readonly min?: number
  readonly units?: string
  readonly values?: readonly {
    readonly id: string
    readonly label: LocalizedStrings
  }[]
  readonly id: string
  readonly label: LocalizedStrings
  readonly type: string
}

export interface ManifestDriverSetting {
  readonly children?: readonly ManifestDriverSettingData[]
  readonly id?: string
  readonly label: LocalizedStrings
}

export interface PairSetting {
  readonly id: string
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

export interface ManifestDriverCapabilitiesOptions {
  readonly values?: readonly {
    readonly id: string
    readonly title: LocalizedStrings
  }[]
  readonly title: LocalizedStrings
  readonly type: string
}

export interface ManifestDriver {
  readonly capabilities?: readonly string[]
  readonly capabilitiesOptions?: Record<
    string,
    ManifestDriverCapabilitiesOptions
  >
  readonly pair?: LoginSetting & readonly PairSetting[]
  readonly settings?: readonly ManifestDriverSetting[]
  readonly id: string
}

export interface Manifest {
  readonly drivers: readonly ManifestDriver[]
  readonly version: string
}

export interface DriverSetting {
  readonly groupId?: string
  readonly groupLabel?: string
  readonly max?: number
  readonly min?: number
  placeholder?: string
  readonly units?: string
  readonly values?: readonly { readonly id: string; readonly label: string }[]
  readonly driverId: string
  readonly id: string
  title: string
  readonly type: string
}

export interface DriverCapabilitiesOptions {
  readonly values?: readonly { readonly id: string; readonly label: string }[]
  readonly title: string
  readonly type: string
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}

export type DeviceSetting = Record<string, ValueOf<Settings>[]>

export type DeviceSettings = Record<string, DeviceSetting>

export type OpDeviceData<T extends keyof typeof DeviceType> =
  | keyof ListDevice[T]['Device']
  | keyof SetDeviceData[T]

export interface SetCapabilities {
  readonly Ata: SetCapabilitiesAta
  readonly Atw: SetCapabilitiesAtw
  readonly Erv: SetCapabilitiesErv
}

export interface OpCapabilities {
  readonly Ata: OpCapabilitiesAta
  readonly Atw: OpCapabilitiesAtw
  readonly Erv: OpCapabilitiesErv
}

export interface EnergyCapabilities {
  readonly Ata: EnergyCapabilitiesAta
  readonly Atw: EnergyCapabilitiesAtw
  readonly Erv: EnergyCapabilitiesErv
}

export interface Capabilities {
  Ata: CapabilitiesAta
  Atw: CapabilitiesAtw
  Erv: CapabilitiesErv
}

export interface SetCapabilityTagMapping {
  readonly Ata: typeof setCapabilityTagMappingAta
  readonly Atw: typeof setCapabilityTagMappingAtw
  readonly Erv: typeof setCapabilityTagMappingErv
}

export interface GetCapabilityTagMapping {
  readonly Ata: typeof getCapabilityTagMappingAta
  readonly Atw: typeof getCapabilityTagMappingAtw
  readonly Erv: typeof getCapabilityTagMappingErv
}

export interface ListCapabilityTagMapping {
  readonly Ata: typeof listCapabilityTagMappingAta
  readonly Atw: typeof listCapabilityTagMappingAtw
  readonly Erv: typeof listCapabilityTagMappingErv
}

export interface EnergyCapabilityTagMapping {
  readonly Ata: typeof energyCapabilityTagMappingAta
  readonly Atw: typeof energyCapabilityTagMappingAtw
  readonly Erv: typeof energyCapabilityTagMappingErv
}

export type OpCapabilityTagEntry<T extends keyof typeof DeviceType> = [
  capability: Extract<keyof OpCapabilities[T], string>,
  tag: OpDeviceData<T>,
]

export type EnergyCapabilityTagEntry<T extends keyof typeof DeviceType> = [
  capability: Extract<keyof EnergyCapabilities[T], string>,
  tags: (keyof EnergyData[T])[],
]

export type ConvertFromDevice<T extends keyof typeof DeviceType> = (
  value: ListDevice[T]['Device'][keyof ListDevice[T]['Device']],
  data?: ListDevice[T]['Device'],
) => OpCapabilities[T][keyof OpCapabilities[T]]

export type ConvertToDevice<T extends keyof typeof DeviceType> = (
  value: SetCapabilities[T][keyof SetCapabilities[T]],
) => UpdateDeviceData[T][keyof UpdateDeviceData[T]]

export interface FlowArgs {
  readonly Ata: FlowArgsAta
  readonly Atw: FlowArgsAtw
  readonly Erv: FlowArgsErv
}

export interface CapabilitiesOptionsAtaErv {
  readonly fan_power: RangeOptions
}

export interface CapabilitiesOptions {
  readonly Ata: CapabilitiesOptionsAtaErv
  readonly Atw: CapabilitiesOptionsAtw
  readonly Erv: CapabilitiesOptionsAtaErv
}

export interface DeviceDetails<T extends keyof typeof DeviceType> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions[T]>
  readonly data: { readonly id: number }
  readonly name: string
}

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}

export interface ErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}

export interface ErrorLog {
  readonly errors: ErrorDetails[]
  readonly fromDateHuman: string
  readonly nextFromDate: string
  readonly nextToDate: string
}

export interface FrostProtectionSettings {
  readonly enabled: boolean
  readonly max: number
  readonly min: number
}

export interface HolidayModeSettings {
  readonly from?: string
  readonly to?: string
  readonly enabled: boolean
}

export type AreaZone = BaseModel
export interface FloorZone extends BaseModel {
  areas?: AreaZone[]
}
export interface BuildingZone extends BaseModel {
  areas?: AreaZone[]
  floors?: FloorZone[]
}
export type Zone = AreaZone | BuildingZone | FloorZone

export const modelClass = {
  areas: AreaModel,
  buildings: BuildingModel,
  floors: FloorModel,
}
export interface ZoneData {
  zoneId: string
  zoneType: keyof typeof modelClass
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

const auto = {
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
const fast = {
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
const moderate = {
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
const slow = {
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
}) =>
  ({
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
  }) as const

export const fanSpeedValues = [
  auto,
  createVeryObject(fast),
  fast,
  moderate,
  slow,
  createVeryObject(slow),
] as const
