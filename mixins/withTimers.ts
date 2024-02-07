import {
  DateTime,
  Duration,
  type DurationLike,
  type DurationLikeObject,
} from 'luxon'
import type { HomeyClass } from '../types'

interface BaseTimerOptions {
  readonly actionType: string
  readonly units: readonly (keyof DurationLikeObject)[]
}

interface TimerOptions extends BaseTimerOptions {
  readonly timerWords: { dateSpecifier: string; timeSpecifier: string }
  readonly timerType: 'setInterval' | 'setTimeout'
}

type Timer = (
  callback: () => Promise<void>,
  interval: DurationLike,
  options: BaseTimerOptions,
) => NodeJS.Timeout

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TimerClass = new (...args: any[]) => {
  setInterval: Timer
  setTimeout: Timer
}

const FIRST_CHAR = 0
const SECOND_CHAR = 1

// eslint-disable-next-line max-lines-per-function
const withTimers = <T extends HomeyClass>(base: T): T & TimerClass =>
  class extends base {
    public setInterval(
      callback: () => Promise<void>,
      interval: DurationLike,
      options: BaseTimerOptions,
    ): NodeJS.Timeout {
      const { actionType, units } = options
      return this.setTimer(callback, interval, {
        actionType,
        timerType: 'setInterval',
        timerWords: { dateSpecifier: 'starting', timeSpecifier: 'every' },
        units,
      })
    }

    public setTimeout(
      callback: () => Promise<void>,
      interval: DurationLike,
      options: BaseTimerOptions,
    ): NodeJS.Timeout {
      const { actionType, units } = options
      return this.setTimer(callback, interval, {
        actionType,
        timerType: 'setTimeout',
        timerWords: { dateSpecifier: 'on', timeSpecifier: 'in' },
        units,
      })
    }

    private setTimer(
      callback: () => Promise<void>,
      interval: DurationLike,
      options: TimerOptions,
    ): NodeJS.Timeout {
      const { actionType, timerWords, timerType, units } = options
      const duration: Duration = Duration.fromDurationLike(interval)
      this.log(
        `${actionType.charAt(FIRST_CHAR).toUpperCase()}${actionType
          .slice(SECOND_CHAR)
          .toLowerCase()}`,
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
