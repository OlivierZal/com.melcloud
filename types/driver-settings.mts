import type {
  DriverSetting,
  DriverSettingValue,
} from '@olivierzal/homey-kit/manifest'
import type { LoginCredentials } from '@olivierzal/melcloud-api'

export interface DriverCapabilitiesOptions {
  readonly title: string
  readonly type: string
  // Straight from the driver manifest, so a webview picker reads its
  // grid at the source instead of hardcoding one.
  readonly max?: number | undefined
  readonly min?: number | undefined
  readonly step?: number | undefined
  readonly values?: readonly DriverSettingValue[] | undefined
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}
