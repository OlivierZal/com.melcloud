// Shared between settings/index.mts (URLSearchParams source) and api.mts
// (Homey-routed query receiver). Defined as strings because URL query params
// are inherently strings — api.mts converts to numbers for the Classic
// query that drives the aggregated log's pagination window.
export interface ErrorLogQueryParams {
  readonly from: string
  readonly offset: string
  readonly period: string
  readonly to: string
}

// The display row the settings table renders: the neutral entry's
// moment and message localized, its device id resolved to a name.
export interface FormattedErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}

export interface FormattedErrorLog {
  readonly errors: readonly FormattedErrorDetails[]
  readonly fromDateHuman: string
  readonly nextFromDate: string
  readonly nextToDate: string
}
