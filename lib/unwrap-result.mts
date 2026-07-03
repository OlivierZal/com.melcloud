import type { Result } from '@olivierzal/melcloud-api'

// Trust boundary: `@olivierzal/melcloud-api` owns the validation of raw
// MELCloud responses and surfaces failures through `Result`. Past this
// unwrap, payload shapes are trusted as typed — the app only adds targeted
// guards where a single bad field would corrupt capability values (e.g.
// non-finite energy tags in `drivers/base-report.mts`).
export const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    const { error } = result
    throw new Error(`MELCloud request failed: ${error.kind}`, { cause: error })
  }
  return result.value
}
