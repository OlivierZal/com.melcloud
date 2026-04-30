import type { Result } from '@olivierzal/melcloud-api'

export const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(`MELCloud request failed: ${result.error.kind}`)
  }
  return result.value
}
