import type { Logger } from '@olivierzal/homey-kit'

// Runs independent per-device work to completion and reports every
// failure separately.
//
// `Promise.all` is the wrong aggregate here on both counts: it abandons
// the aggregate at the first rejection — leaving the other devices'
// work unsettled — and it surfaces one reason while hiding the others,
// so a second failing device leaves no trace. Reserve `Promise.all` for
// aggregates whose caller genuinely cannot continue without every
// branch.
export const settleAll = async (
  promises: Iterable<Promise<unknown>>,
  logger: Logger,
  message: string,
): Promise<void> => {
  const results = await Promise.allSettled(promises)
  for (const result of results) {
    if (result.status === 'rejected') {
      logger.error(message, result.reason)
    }
  }
}
