import type { DeviceType, LoginCredentials } from '@olivierzal/melcloud-api'

import type { CapabilitiesOptions } from './capabilities.mts'

export interface AuthAPI {
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>
  readonly isAuthenticated: () => boolean
}

export interface DeviceDetails<
  T extends DeviceType = DeviceType,
  TId extends number | string = number,
> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions<T>>
  readonly data: { readonly id: TId }
  readonly name: string
}

export interface DeviceFacade {
  readonly updateValues: (data: Record<string, unknown>) => Promise<unknown>
}

export type EnergyReportMode = 'regular' | 'total'

export interface EnergyReportOperation {
  readonly start: () => Promise<void>
  readonly unschedule: () => void
}
