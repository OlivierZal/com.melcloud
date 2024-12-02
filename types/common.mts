import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
  type DeviceType,
  type EnergyData,
  type FanSpeed,
  type GetDeviceData,
  type Horizontal,
  type ListDeviceData,
  type ListDeviceDataAta,
  type ListDeviceDataErv,
  type LoginCredentials,
  type OperationMode,
  type UpdateDeviceData,
  type Vertical,
} from '@olivierzal/melcloud-api'

import type { DateObjectUnits, DurationLike } from 'luxon'

import type MELCloudDeviceAta from '../drivers/melcloud/device.mts'
import type { EnergyReportRegularAta } from '../drivers/melcloud/reports/regular.mts'
import type { EnergyReportTotalAta } from '../drivers/melcloud/reports/total.mts'
import type MELCloudDeviceAtw from '../drivers/melcloud_atw/device.mts'
import type { EnergyReportRegularAtw } from '../drivers/melcloud_atw/reports/regular.mts'
import type { EnergyReportTotalAtw } from '../drivers/melcloud_atw/reports/total.mts'
import type MELCloudDeviceErv from '../drivers/melcloud_erv/device.mts'

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
import type {
  BaseSettings,
  CapabilitiesOptionsValues,
  LocalizedStrings,
  RangeOptions,
} from './bases.mts'
import type {
  CapabilitiesErv,
  EnergyCapabilitiesErv,
  FlowArgsErv,
  GetCapabilitiesErv,
  ListCapabilitiesErv,
  SetCapabilitiesErv,
} from './erv.mts'

export const K_MULTIPLIER = 1000

export const zoneModel = {
  areas: AreaModel,
  buildings: BuildingModel,
  devices: DeviceModel,
  floors: FloorModel,
} as const

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

export interface AreaZone extends DeviceZone {
  readonly devices?: DeviceZone[]
}

export interface BuildingZone extends FloorZone {
  readonly floors?: FloorZone[]
}

export interface CapabilitiesOptionsAtaErv {
  readonly fan_speed: RangeOptions
}

export interface DaysQuery {
  readonly days: string
}

export interface DeviceDetails<T extends DeviceType> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions<T>>
  readonly data: { readonly id: number }
  readonly name: string
}

export interface DeviceZone {
  readonly id: string
  readonly level: number
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

export interface FloorZone extends AreaZone {
  readonly areas?: AreaZone[]
}

export interface GetAtaOptions {
  readonly mode?: 'detailed'
  readonly status?: 'on'
}

export interface GroupAtaStates {
  readonly FanSpeed: Exclude<FanSpeed, FanSpeed.silent>[]
  readonly OperationMode: OperationMode[]
  readonly Power: boolean[]
  readonly SetTemperature: number[]
  readonly VaneHorizontalDirection: Horizontal[]
  readonly VaneHorizontalSwing: boolean[]
  readonly VaneVerticalDirection: Vertical[]
  readonly VaneVerticalSwing: boolean[]
}

export interface HomeySettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly notifiedVersion?: string | null
  readonly password?: string | null
  readonly username?: string | null
}

export interface HomeyWidgetSettingsAtaGroupSetting extends BaseSettings {
  readonly animations: boolean
  readonly default_zone: DeviceZone | null
}

export interface HomeyWidgetSettingsTemperatures extends BaseSettings {
  readonly days: number
  readonly default_zone: DeviceZone | null
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

export interface PairSetting {
  readonly id: string
}

export interface ReportPlanParameters {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly values: DateObjectUnits
}

export interface Settings extends BaseSettings {
  readonly always_on?: boolean
}

export interface ZoneData {
  readonly zoneId: string
  readonly zoneType: Exclude<keyof typeof zoneModel, 'devices'>
}

type GetCapabilities<T extends DeviceType> =
  T extends DeviceType.Ata ? GetCapabilitiesAta
  : T extends DeviceType.Atw ? GetCapabilitiesAtw
  : T extends DeviceType.Erv ? GetCapabilitiesErv
  : never

type ListCapabilities<T extends DeviceType> =
  T extends DeviceType.Ata ? ListCapabilitiesAta
  : T extends DeviceType.Atw ? ListCapabilitiesAtw
  : T extends DeviceType.Erv ? ListCapabilitiesErv
  : never

export type Capabilities<T extends DeviceType> =
  T extends DeviceType.Ata ? CapabilitiesAta
  : T extends DeviceType.Atw ? CapabilitiesAtw
  : T extends DeviceType.Erv ? CapabilitiesErv
  : never

export type CapabilitiesOptions<T extends DeviceType> =
  T extends DeviceType.Atw ? CapabilitiesOptionsAtw : CapabilitiesOptionsAtaErv

export type ConvertFromDevice<T extends DeviceType> = (
  value: ListDeviceData<T>[keyof ListDeviceData<T>],
  data?: ListDeviceData<T>,
) => OpCapabilities<T>[keyof OpCapabilities<T>]

export type ConvertToDevice<T extends DeviceType> = (
  value: SetCapabilities<T>[keyof SetCapabilities<T>],
) => UpdateDeviceData<T>[keyof UpdateDeviceData<T>]

export type DeviceSetting = Record<string, ValueOf<Settings>>

export type DeviceSettings = Record<string, DeviceSetting>

export type EnergyCapabilities<T extends DeviceType> =
  T extends DeviceType.Ata ? EnergyCapabilitiesAta
  : T extends DeviceType.Atw ? EnergyCapabilitiesAtw
  : T extends DeviceType.Erv ? EnergyCapabilitiesErv
  : Record<string, never>

export type EnergyCapabilityTagEntry<T extends DeviceType> = [
  capability: string & keyof EnergyCapabilities<T>,
  tags: (keyof EnergyData<T>)[],
]

export type EnergyCapabilityTagMapping<T extends DeviceType> = Record<
  keyof EnergyCapabilities<T>,
  readonly (keyof EnergyData<T>)[]
>

export type EnergyReportMode = 'regular' | 'total'

export type EnergyReportRegular<T extends DeviceType> =
  T extends DeviceType.Ata ? EnergyReportRegularAta
  : T extends DeviceType.Atw ? EnergyReportRegularAtw
  : never

export type EnergyReportTotal<T extends DeviceType> =
  T extends DeviceType.Ata ? EnergyReportTotalAta
  : T extends DeviceType.Atw ? EnergyReportTotalAtw
  : never

export type FlowArgs<T extends DeviceType> =
  T extends DeviceType.Ata ? FlowArgsAta
  : T extends DeviceType.Atw ? FlowArgsAtw
  : T extends DeviceType.Erv ? FlowArgsErv
  : never

export type GetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof GetCapabilities<T>,
  keyof GetDeviceData<T>
>

export type ListCapabilityTagMapping<T extends DeviceType> = Record<
  keyof ListCapabilities<T>,
  keyof ListDeviceData<T>
>

export type MELCloudDevice =
  | MELCloudDeviceAta
  | MELCloudDeviceAtw
  | MELCloudDeviceErv

export type OpCapabilities<T extends DeviceType> = GetCapabilities<T> &
  ListCapabilities<T> &
  SetCapabilities<T>

export type OpCapabilityTagEntry<T extends DeviceType> = [
  capability: string & keyof OpCapabilities<T>,
  tag: OpDeviceData<T>,
]

export type OpDeviceData<T extends DeviceType> = keyof ListDeviceData<T>

export type SetCapabilities<T extends DeviceType> =
  T extends DeviceType.Ata ? SetCapabilitiesAta
  : T extends DeviceType.Atw ? SetCapabilitiesAtw
  : T extends DeviceType.Erv ? SetCapabilitiesErv
  : never

export type SetCapabilityTagMapping<T extends DeviceType> = Record<
  keyof SetCapabilities<T>,
  keyof UpdateDeviceData<T>
>

export type ValueOf<T> = T[keyof T]

export type Zone = AreaZone | BuildingZone | DeviceZone | FloorZone
