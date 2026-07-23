import type Homey from 'homey/lib/Homey'
import { Temporal } from 'temporal-polyfill'

/**
 * IANA timezone identifier from Homey's clock manager (e.g. `'Europe/Paris'`).
 * @param homey - Homey app instance exposing the clock manager.
 * @returns The user-configured IANA timezone identifier.
 */
export const getTimeZone = (homey: Homey.Homey): string =>
  homey.clock.getTimezone()

/**
 * Current Temporal moment in the user's Homey-configured timezone.
 * @param homey - Homey app instance whose configured timezone anchors the moment.
 * @returns The present instant as a `ZonedDateTime` in that timezone.
 */
export const getNow = (homey: Homey.Homey): Temporal.ZonedDateTime =>
  Temporal.Now.zonedDateTimeISO(getTimeZone(homey))

/**
 * BCP-47 locale tag from Homey's i18n manager (e.g. `'en'`, `'fr'`).
 * @param homey - Homey app instance exposing the i18n manager.
 * @returns The active BCP-47 locale tag driving translations.
 */
export const getLocale = (homey: Homey.Homey): string =>
  homey.i18n.getLanguage()

/**
 * Calendar date of a MELCloud timestamp, which arrives either as a UTC
 * instant (`Z`/offset suffix) or as a bare wall-clock time — the same
 * dialect split as the error log. An instant is projected into `timeZone`
 * before its date is taken: handing it straight to `Temporal.PlainDate.from`
 * would throw on the `Z` form and silently drop the offset on the other,
 * either way losing the real local day. A bare wall-clock time has no
 * instant to project and falls through to `PlainDate.from`.
 * @param date - A MELCloud timestamp, instant (`Z`/offset) or wall-clock.
 * @param timeZone - IANA timezone the instant form is projected into.
 * @returns The local calendar date the timestamp falls on.
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
