import type { LoginCredentials } from '@olivierzal/melcloud-api'

export interface DriverCapabilitiesOptions {
  readonly title: string
  readonly type: string
  readonly values?: readonly DriverSettingValue[]
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
  readonly values?: readonly DriverSettingValue[]
}

export interface DriverSettingValue {
  readonly id: string
  readonly label: string
}

export interface LoginDriverSetting extends DriverSetting {
  readonly id: keyof LoginCredentials
}
