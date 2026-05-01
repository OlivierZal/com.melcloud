import type { Result } from '@olivierzal/melcloud-api'

export const unwrapResult = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    const { error } = result
    throw new Error(`MELCloud request failed: ${error.kind}`, { cause: error })
  }
  return result.value
}
