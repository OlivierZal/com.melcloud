import type Homey from 'homey/lib/Homey'
import { Temporal } from 'temporal-polyfill'

/**
 * Current Temporal moment in the user's Homey-configured timezone.
 * @param homey - Homey app instance whose configured timezone anchors the moment.
 * @returns The present instant as a `ZonedDateTime` in that timezone.
 */
export const getNow = (homey: Homey.Homey): Temporal.ZonedDateTime =>
  Temporal.Now.zonedDateTimeISO(homey.clock.getTimezone())
