import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { CapabilitiesOptions } from './classic-capabilities.mts'

export interface ClassicDeviceFacade {
  readonly updateValues: (data: Record<string, unknown>) => Promise<unknown>
}

export interface DeviceDetails<
  T extends Classic.DeviceType = Classic.DeviceType,
> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions<T>>
  readonly data: { readonly id: number }
  readonly name: string
}

export type EnergyReportMode = 'regular' | 'total'

export interface EnergyReportOperation {
  readonly start: () => Promise<void>
  readonly unschedule: () => void
}

/**
 * Telemetry direction a Home energy capability reads.
 */
export type HomeEnergyMeasureName = 'consumed' | 'produced'
