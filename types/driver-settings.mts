import type {
  DriverSetting,
  DriverSettingValue,
} from '@olivierzal/homey-kit/manifest'
import type { LoginCredentials } from '@olivierzal/melcloud-api'

export interface DriverCapabilitiesOptions {
  readonly title: string
  readonly type: string
  readonly values?: readonly DriverSettingValue[] | undefined
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}
