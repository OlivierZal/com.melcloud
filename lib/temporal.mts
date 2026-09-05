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
