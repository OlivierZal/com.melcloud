/* eslint-disable @typescript-eslint/no-explicit-any */
import { DateTime, Duration, type DurationLikeObject } from 'luxon'
import type { HomeyClass } from '../types'

type TimerClass = new (...args: any[]) => {
  setInterval: (
    actionType: string,
    callback: () => Promise<void>,
    interval: DurationLikeObject | number,
    ...units: (keyof DurationLikeObject)[]
  ) => NodeJS.Timeout
  setTimeout: (
    actionType: string,
    callback: () => Promise<void>,
    interval: DurationLikeObject | number,
    ...units: (keyof DurationLikeObject)[]
  ) => NodeJS.Timeout
}

export default function withTimers<T extends HomeyClass>(
  base: T,
): T & TimerClass {
  return class extends base {
    public setInterval(
      actionType: string,
      callback: () => Promise<void>,
      interval: DurationLikeObject | number,
      ...units: (keyof DurationLikeObject)[]
    ): NodeJS.Timeout {
      return this.setTimer(
        actionType,
        ['every', 'starting'],
        'setInterval',
        callback,
        interval,
        ...units,
      )
    }

    public setTimeout(
      actionType: string,
      callback: () => Promise<void>,
      interval: DurationLikeObject | number,
      ...units: (keyof DurationLikeObject)[]
    ): NodeJS.Timeout {
      return this.setTimer(
        actionType,
        ['in', 'on'],
        'setTimeout',
        callback,
        interval,
        ...units,
      )
    }

    private setTimer(
      actionType: string,
      timerWords: [string, string],
      timerType: 'setInterval' | 'setTimeout',
      callback: () => Promise<void>,
      interval: DurationLikeObject | number,
      ...units: (keyof DurationLikeObject)[]
    ): NodeJS.Timeout {
      const duration: Duration = Duration.fromDurationLike(interval)
      this.log(
        `${actionType.charAt(0).toUpperCase()}${actionType
          .slice(1)
          .toLowerCase()}`,
        'will run',
        timerWords[0],
        duration.shiftTo(...units).toHuman(),
        timerWords[1],
        DateTime.now()
          .plus(duration)
          .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS),
      )
      return this.homey[timerType](callback, Number(duration))
    }
  }
}