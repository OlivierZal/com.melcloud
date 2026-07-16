import type Homey from 'homey/lib/Homey'
import { Temporal } from 'temporal-polyfill'

/** IANA timezone identifier from Homey's clock manager (e.g. `'Europe/Paris'`). */
export const getTimeZone = (homey: Homey.Homey): string =>
  homey.clock.getTimezone()

/** Current Temporal moment in the user's Homey-configured timezone. */
export const getNow = (homey: Homey.Homey): Temporal.ZonedDateTime =>
  Temporal.Now.zonedDateTimeISO(getTimeZone(homey))

/** BCP-47 locale tag from Homey's i18n manager (e.g. `'en'`, `'fr'`). */
export const getLocale = (homey: Homey.Homey): string =>
  homey.i18n.getLanguage()

/**
 * Calendar date of a MELCloud timestamp, which arrives either as a UTC
 * instant (`Z`/offset suffix) or as a wall-clock time — the same
 * dialect split as the error log. `Temporal.PlainDate.from` rejects
 * the instant form outright, so it is projected into the given
 * timezone first.
 * @param date - The MELCloud timestamp.
 * @param timeZone - IANA timezone the instant form is projected into.
 * @returns The calendar date.
 */
export const toPlainDate = (
  date: string,
  timeZone: string,
): Temporal.PlainDate => {
  try {
    return Temporal.Instant.from(date)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate()
  } catch {
    return Temporal.PlainDate.from(date)
  }
}
