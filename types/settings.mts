import type {
  ErrorDetails,
  ErrorLog,
  LoginCredentials,
} from '@olivierzal/melcloud-api'

import type { BaseSettings } from './bases.mts'

export type DeviceSetting = Record<string, ValueOf<Settings>>

export type DeviceSettings = Record<string, DeviceSetting>

export interface DriverCapabilitiesOptions {
  readonly title: string
  readonly type: string
  readonly values?: readonly { readonly id: string; readonly label: string }[]
}

export interface DriverSetting {
  readonly driverId: string
  readonly id: string
  readonly title: string
  readonly type: string
  readonly groupId?: string
  readonly groupLabel?: string
  readonly max?: number
  readonly min?: number
  readonly placeholder?: string
  readonly units?: string
  readonly values?: readonly { readonly id: string; readonly label: string }[]
}

export interface FormattedErrorDetails extends Omit<ErrorDetails, 'deviceId'> {
  readonly device: string
}

export interface FormattedErrorLog extends Omit<
  ErrorLog,
  'errors' | 'fromDate'
> {
  readonly errors: readonly FormattedErrorDetails[]
  readonly fromDateHuman: string
}

export interface HomeySettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly homeAccessToken?: string | null
  readonly homeExpiry?: string | null
  readonly homePassword?: string | null
  readonly homeRefreshToken?: string | null
  readonly homeUsername?: string | null
  readonly notifiedVersion?: string | null
  readonly password?: string | null
  readonly username?: string | null
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}

export interface Settings extends BaseSettings {
  readonly always_on?: boolean
}

export type ValueOf<T> = T[keyof T]
