import type { Logger } from '@olivierzal/melcloud-api'

// The one sanctioned fire-and-forget seam (melcloud-api's shape):
// detach already-started work from the caller's critical path, logging
// a rejection instead of propagating it. The logger is an object so an
// app or device instance passes itself — no per-site error adapter.
export const fireAndForget = (
  promise: Promise<unknown>,
  logger: Logger,
  message: string,
): void => {
  // eslint-disable-next-line unicorn/prefer-await -- the single fire-and-forget seam: rejections are logged, never propagated
  promise.catch((error: unknown) => {
    logger.error(message, error)
  })
}
