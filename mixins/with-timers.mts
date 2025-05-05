import type { SimpleClass } from 'homey'
import type Homey from 'homey/lib/Homey'

import { type DurationLike, DateTime, Duration } from 'luxon'

interface TimerOptions {
  readonly actionType: string
  readonly timerType: 'setInterval' | 'setTimeout'
  readonly timerWords: {
    readonly dateSpecifier: string
    readonly timeSpecifier: string
  }
}

type HomeyClass = new (
  ...args: any[]
) => SimpleClass & { readonly homey: Homey }

type Timer = (
  callback: () => Promise<void>,
  interval: DurationLike,
  actionType: string,
) => NodeJS.Timeout

type TimerClass = new (...args: any[]) => {
  readonly setInterval: Timer
  readonly setTimeout: Timer
}

const capitalize = ([first = '', ...rest] = ''): string =>
  first.toUpperCase() + rest.join('')

export const withTimers = <T extends HomeyClass>(base: T): T & TimerClass =>
  class extends base {
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

    #setTimer(
      callback: () => Promise<void>,
      interval: DurationLike,
      { actionType, timerType, timerWords }: TimerOptions,
    ): NodeJS.Timeout {
      const duration = Duration.fromDurationLike(interval)
      this.log(
        capitalize(actionType),
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
