import type Homey from 'homey/lib/Homey'
import { DateTime, Duration, type DurationLikeObject } from 'luxon'

type TimerClass = new (...args: any[]) => {
  error(...errorArgs: any[]): void
  log(...logArgs: any[]): void
  homey: Homey
}

export default function WithTimers<T extends TimerClass>(Base: T) {
  return class extends Base {
    setTimer(
      actionType: string,
      timerWords: [string, string],
      timerType: 'setInterval' | 'setTimeout',
      callback: () => Promise<void>,
      interval: number | DurationLikeObject,
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

    setInterval(
      actionType: string,
      callback: () => Promise<void>,
      interval: number | DurationLikeObject,
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

    setTimeout(
      actionType: string,
      callback: () => Promise<void>,
      interval: number | DurationLikeObject,
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
  }
}
