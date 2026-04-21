import type { BaseSettings } from './bases.mts'

export type DeviceSetting = Record<string, Settings[keyof Settings]>

export type DeviceSettings = Record<string, DeviceSetting>

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

export interface Settings extends BaseSettings {
  readonly always_on?: boolean
}
