import type { ErrorLogEntry } from '@olivierzal/melcloud-api'

// An entry without an instant is still a fault, older than any dated one.
const instantOf = ({ atEpochMs }: ErrorLogEntry): number => atEpochMs ?? 0

// The fault a unit still reports, as its error log words it: the newest
// entry not yet cleared, in the `code : reason` form the Classic listing
// words a fault in (`E6 : …`) — either part alone when the log gives only
// one, `null` when every entry is cleared.
export const describeOpenFault = (
  entries: readonly ErrorLogEntry[],
): string | null => {
  const [latest] = entries
    .filter(({ clearedAt }) => clearedAt === undefined)
    .toSorted((first, other) => instantOf(other) - instantOf(first))
  if (latest === undefined) {
    return null
  }
  const { code, message } = latest
  if (code === undefined) {
    return message ?? null
  }
  return message === undefined ? code : `${code} : ${message}`
}
