import type { SimpleClass } from 'homey'
import type Homey from 'homey/lib/Homey'

import {
  type DurationLike,
  type DurationLikeObject,
  DateTime,
  Duration,
} from 'luxon'

type HomeyClass = new (
  ...args: any[]
) => SimpleClass & { readonly homey: Homey }

interface BaseTimerOptions {
  readonly actionType: string
  readonly units: readonly (keyof DurationLikeObject)[]
}

interface TimerOptions extends BaseTimerOptions {
  readonly timerType: 'setInterval' | 'setTimeout'
  readonly timerWords: { dateSpecifier: string; timeSpecifier: string }
}

type Timer = (
  callback: () => Promise<void>,
  interval: DurationLike,
  options: BaseTimerOptions,
) => NodeJS.Timeout

type TimerClass = new (...args: any[]) => {
  setInterval: Timer
  setTimeout: Timer
}

const FIRST_CHAR = 0
const SECOND_CHAR = 1
const formatActionType = (actionType: string): string =>
  `${actionType.charAt(FIRST_CHAR).toUpperCase()}${actionType.slice(SECOND_CHAR).toLowerCase()}`

export default <T extends HomeyClass>(base: T): T & TimerClass =>
  class extends base {
    public setInterval(
      callback: () => Promise<void>,
      interval: DurationLike,
      { actionType, units }: BaseTimerOptions,
    ): NodeJS.Timeout {
      return this.#setTimer(callback, interval, {
        actionType,
        timerType: 'setInterval',
        timerWords: { dateSpecifier: 'starting', timeSpecifier: 'every' },
        units,
      })
    }

    public setTimeout(
      callback: () => Promise<void>,
      interval: DurationLike,
      { actionType, units }: BaseTimerOptions,
    ): NodeJS.Timeout {
      return this.#setTimer(callback, interval, {
        actionType,
        timerType: 'setTimeout',
        timerWords: { dateSpecifier: 'on', timeSpecifier: 'in' },
        units,
      })
    }

    #setTimer(
      callback: () => Promise<void>,
      interval: DurationLike,
      { actionType, timerWords, timerType, units }: TimerOptions,
    ): NodeJS.Timeout {
      const duration = Duration.fromDurationLike(interval)
      this.log(
        formatActionType(actionType),
        'will run',
        timerWords.timeSpecifier,
        duration.shiftTo(...units).toHuman(),
        timerWords.dateSpecifier,
        DateTime.now()
          .plus(duration)
          .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS),
      )
      return this.homey[timerType](callback, duration.as('milliseconds'))
    }
  }
