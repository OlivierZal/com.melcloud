import { Temporal } from 'temporal-polyfill'

// MELCloud is younger than this: an older stamp is a placeholder (the
// year-one date of a unit that never communicated), not a date to show.
const OLDEST_PLAUSIBLE_YEAR = 2000

const toPlainDate = (stamp: string): Temporal.PlainDate | null => {
  try {
    return Temporal.PlainDateTime.from(stamp).toPlainDate()
  } catch {
    return null
  }
}

/**
 * The calendar date of a MELCloud Classic unit's last communication, as
 * a message shown to its owner spells it. The listing's stamp is the
 * building's own wall clock, so its date is the one the owner lived and
 * no zone is applied.
 * @param lastTimestamp - The listing's `LastTimeStamp`, if any.
 * @param locale - The language the date is spelled in.
 * @returns The date in long form, or `null` when the stamp is missing,
 * cannot be read or is a placeholder.
 */
export const formatLastCommunicationDate = (
  lastTimestamp: string | undefined,
  locale: string,
): string | null => {
  const date = lastTimestamp === undefined ? null : toPlainDate(lastTimestamp)
  return date === null || date.year < OLDEST_PLAUSIBLE_YEAR
    ? null
    : date.toLocaleString(locale, { dateStyle: 'long' })
}
