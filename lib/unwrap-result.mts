import type { ApiRequestError, Result } from '@olivierzal/melcloud-api'

// What a failure line names behind its label. The SDK classifies the
// error a best-effort read threw into a plain descriptor, which a cause
// chain can only spell as "a thrown object": the descriptor stands aside
// for the error it classified — an `HttpError`, a refused credential, a
// transport failure — and the two the SDK answers without one (its own
// rate-limit gate, a Home id the registry does not hold) stand on their
// own, as the small object they are.
export const failureCause = (error: ApiRequestError): unknown =>
  'cause' in error && error.cause !== undefined ? error.cause : error

// Trust boundary: `@olivierzal/melcloud-api` owns the validation of raw
// MELCloud responses and surfaces failures through `Result`. Past this
// unwrap, payload shapes are trusted as typed — the app only adds targeted
// guards where a single bad field would corrupt capability values (e.g.
// non-finite energy tags in `drivers/base-report.mts`).
export const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    const { error } = result
    throw new Error(`MELCloud request failed: ${error.kind}`, {
      cause: failureCause(error),
    })
  }
  return result.value
}
