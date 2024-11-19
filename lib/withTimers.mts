import { DateTime, Duration, type DurationLike } from 'luxon'

import type { SimpleClass } from 'homey'
import type Homey from 'homey/lib/Homey'

type HomeyClass = new (
  ...args: any[]
) => SimpleClass & { readonly homey: Homey }

interface TimerOptions {
  readonly actionType: string
  readonly timerType: 'setInterval' | 'setTimeout'
  readonly timerWords: { dateSpecifier: string; timeSpecifier: string }
}

type Timer = (
  callback: () => Promise<void>,
  interval: DurationLike,
  actionType: string,
) => NodeJS.Timeout

type TimerClass = new (...args: any[]) => {
  setInterval: Timer
  setTimeout: Timer
}

const FIRST_CHAR = 0
const SECOND_CHAR = 1
const formatActionType = (actionType: string): string =>
  `${actionType.charAt(FIRST_CHAR).toUpperCase()}${actionType.slice(SECOND_CHAR).toLowerCase()}`

export const withTimers = <T extends HomeyClass>(base: T): T & TimerClass =>
  class extends base {
    public setTimeout(
      callback: () => Promise<void>,
      interval: DurationLike,
      actionType: string,
    ): NodeJS.Timeout {
      return this.#setTimer(callback, interval, {
        actionType,
        timerType: 'setTimeout',
        timerWords: { dateSpecifier: 'on', timeSpecifier: 'in' },
      })
    }

    public setInterval(
      callback: () => Promise<void>,
      interval: DurationLike,
      actionType: string,
    ): NodeJS.Timeout {
      return this.#setTimer(callback, interval, {
        actionType,
        timerType: 'setInterval',
        timerWords: { dateSpecifier: 'starting', timeSpecifier: 'every' },
      })
    }

    #setTimer(
      callback: () => Promise<void>,
      interval: DurationLike,
      { actionType, timerType, timerWords }: TimerOptions,
    ): NodeJS.Timeout {
      const duration = Duration.fromDurationLike(interval)
      this.log(
        formatActionType(actionType),
        'will run',
        timerWords.timeSpecifier,
        duration.rescale().toHuman(),
        timerWords.dateSpecifier,
        DateTime.now()
          .plus(duration)
          .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS),
      )
      return this.homey[timerType](callback, duration.as('milliseconds'))
    }
  }
