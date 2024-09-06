import type {
  BaseModel,
  DeviceType,
  EnergyData,
  ListDevice,
  ListDeviceDataAta,
  ListDeviceDataErv,
  LoginCredentials,
  SetDeviceData,
  UpdateDeviceData,
} from '@olivierzal/melcloud-api'
import type { DateObjectUnits, DurationLike } from 'luxon'

import type AtaDevice from '../drivers/melcloud/device'
import type AtaDriver from '../drivers/melcloud/driver'
import type AtwDevice from '../drivers/melcloud_atw/device'
import type AtwDriver from '../drivers/melcloud_atw/driver'
import type ErvDevice from '../drivers/melcloud_erv/device'
import type ErvDriver from '../drivers/melcloud_erv/driver'
import type {
  CapabilitiesAta,
  ENERGY_CAPABILITY_TAG_MAPPING_ATA,
  EnergyCapabilitiesAta,
  FlowArgsAta,
  GET_CAPABILITY_TAGS_MAPPING_ATA,
  LIST_CAPABILITY_TAGS_MAPPING_ATA,
  OpCapabilitiesAta,
  SET_CAPABILITY_TAGS_MAPPING_ATA,
  SetCapabilitiesAta,
} from './ata'
import type { RangeOptions } from './bases'
import type {
  CapabilitiesErv,
  ENERGY_CAPABILITY_TAG_MAPPING_ERV,
  EnergyCapabilitiesErv,
  FlowArgsErv,
  GET_CAPABILITY_TAGS_MAPPING_ERV,
  LIST_CAPABILITY_TAGS_MAPPING_ERV,
  OpCapabilitiesErv,
  SET_CAPABILITY_TAGS_MAPPING_ERV,
  SetCapabilitiesErv,
} from './erv'

import {
  type CapabilitiesAtw,
  type CapabilitiesOptionsAtw,
  type ENERGY_CAPABILITY_TAG_MAPPING_ATW,
  type EnergyCapabilitiesAtw,
  type FlowArgsAtw,
  type GET_CAPABILITY_TAGS_MAPPING_ATW,
  type LIST_CAPABILITY_TAGS_MAPPING_ATW,
  type OpCapabilitiesAtw,
  type SET_CAPABILITY_TAGS_MAPPING_ATW,
  type SetCapabilitiesAtw,
  getCapabilitiesOptionsAtw,
} from './atw'

export const K_MULTIPLIER = 1000

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
    readonly label: Record<string, string>
  }[]
  readonly id: string
  readonly label: Record<string, string>
  readonly type: string
}

export interface ManifestDriverSetting {
  readonly children?: readonly ManifestDriverSettingData[]
  readonly id?: string
  readonly label: Record<string, string>
}

export interface PairSetting {
  readonly id: string
}

export interface LoginSetting extends PairSetting {
  readonly id: 'login'
  readonly options: {
    readonly passwordLabel: Record<string, string>
    readonly passwordPlaceholder: Record<string, string>
    readonly usernameLabel: Record<string, string>
    readonly usernamePlaceholder: Record<string, string>
  }
}

export interface ManifestDriverCapabilitiesOptions {
  readonly title?: Record<string, string>
  readonly type?: string
  readonly values?: readonly {
    readonly id: string
    readonly title: Record<string, string>
  }[]
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
  readonly Ata: typeof SET_CAPABILITY_TAGS_MAPPING_ATA
  readonly Atw: typeof SET_CAPABILITY_TAGS_MAPPING_ATW
  readonly Erv: typeof SET_CAPABILITY_TAGS_MAPPING_ERV
}

export interface GetCapabilityTagMapping {
  readonly Ata: typeof GET_CAPABILITY_TAGS_MAPPING_ATA
  readonly Atw: typeof GET_CAPABILITY_TAGS_MAPPING_ATW
  readonly Erv: typeof GET_CAPABILITY_TAGS_MAPPING_ERV
}

export interface ListCapabilityTagMapping {
  readonly Ata: typeof LIST_CAPABILITY_TAGS_MAPPING_ATA
  readonly Atw: typeof LIST_CAPABILITY_TAGS_MAPPING_ATW
  readonly Erv: typeof LIST_CAPABILITY_TAGS_MAPPING_ERV
}

export interface EnergyCapabilityTagMapping {
  readonly Ata: typeof ENERGY_CAPABILITY_TAG_MAPPING_ATA
  readonly Atw: typeof ENERGY_CAPABILITY_TAG_MAPPING_ATW
  readonly Erv: typeof ENERGY_CAPABILITY_TAG_MAPPING_ERV
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
  },
})

export const getCapabilitiesOptions = {
  Ata: getCapabilitiesOptionsAtaErv,
  Atw: getCapabilitiesOptionsAtw,
  Erv: getCapabilitiesOptionsAtaErv,
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

export type Building = BaseModel & {
  areas?: BaseModel[]
  floors?: (BaseModel & { areas: BaseModel[] })[]
}
