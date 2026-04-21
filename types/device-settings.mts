import type { BaseSettings } from './bases.mts'

export type DeviceSetting = Record<string, Settings[keyof Settings]>

export type DeviceSettings = Record<string, DeviceSetting>

export interface Settings extends BaseSettings {
  readonly always_on?: boolean
}
