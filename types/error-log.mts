import type * as Classic from '@olivierzal/melcloud-api/classic'

// Shared between settings/index.mts (URLSearchParams source) and api.mts
// (Homey-routed query receiver). Defined as strings because URL query params
// are inherently strings — api.mts converts to numbers for ClassicErrorLogQuery.
export interface ClassicErrorLogQueryParams {
  readonly from: string
  readonly offset: string
  readonly period: string
  readonly to: string
}

export interface FormattedErrorDetails extends Omit<
  Classic.ErrorDetails,
  'deviceId'
> {
  readonly device: string
}

export interface FormattedErrorLog extends Omit<
  Classic.ErrorLog,
  'errors' | 'fromDate'
> {
  readonly errors: readonly FormattedErrorDetails[]
  readonly fromDateHuman: string
}
