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
