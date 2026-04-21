import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { CapabilitiesOptions } from './capabilities.mts'

export interface AuthAPI {
  readonly authenticate: (credentials: LoginCredentials) => Promise<void>
  readonly isAuthenticated: () => boolean
}

export interface ClassicDeviceFacade {
  readonly updateValues: (data: Record<string, unknown>) => Promise<unknown>
}

export interface DeviceDetails<
  T extends Classic.DeviceType = Classic.DeviceType,
  TId extends number | string = number,
> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions<T>>
  readonly data: { readonly id: TId }
  readonly name: string
}

export type EnergyReportMode = 'regular' | 'total'

export interface EnergyReportOperation {
  readonly start: () => Promise<void>
  readonly unschedule: () => void
}
