// The one sanctioned fire-and-forget seam (melcloud-api's shape):
// detach already-started work from the caller's critical path, logging
// a rejection instead of propagating it.
export const fireAndForget = (
  promise: Promise<unknown>,
  logError: (...args: unknown[]) => void,
  message: string,
): void => {
  // eslint-disable-next-line unicorn/prefer-await -- the single fire-and-forget seam: rejections are logged, never propagated
  promise.catch((error: unknown) => {
    logError(message, error)
  })
}
