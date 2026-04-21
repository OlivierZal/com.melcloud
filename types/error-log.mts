import type * as Classic from '@olivierzal/melcloud-api/classic'

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
