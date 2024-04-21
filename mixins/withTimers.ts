import {
  DateTime,
  Duration,
  type DurationLike,
  type DurationLikeObject,
} from 'luxon'
import type Homey from 'homey/lib/Homey'
import type { SimpleClass } from 'homey'

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

const withTimers = <T extends HomeyClass>(base: T): T & TimerClass =>
  class extends base {
    public setInterval(
      callback: () => Promise<void>,
      interval: DurationLike,
      options: BaseTimerOptions,
    ): NodeJS.Timeout {
      return this.#setTimer(callback, interval, {
        actionType: options.actionType,
        timerType: 'setInterval',
        timerWords: { dateSpecifier: 'starting', timeSpecifier: 'every' },
        units: options.units,
      })
    }

    public setTimeout(
      callback: () => Promise<void>,
      interval: DurationLike,
      options: BaseTimerOptions,
    ): NodeJS.Timeout {
      return this.#setTimer(callback, interval, {
        actionType: options.actionType,
        timerType: 'setTimeout',
        timerWords: { dateSpecifier: 'on', timeSpecifier: 'in' },
        units: options.units,
      })
    }

    #setTimer(
      callback: () => Promise<void>,
      interval: DurationLike,
      options: TimerOptions,
    ): NodeJS.Timeout {
      const { actionType, timerWords, timerType, units } = options
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

export default withTimers
