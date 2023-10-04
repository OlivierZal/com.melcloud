import type Homey from 'homey/lib/Homey'
import { DateTime, Duration, type DurationLikeObject } from 'luxon'

type TimerClass = new (...args: any[]) => {
  homey: Homey
  /* eslint-disable @typescript-eslint/method-signature-style */
  error(...errorArgs: any[]): void
  log(...logArgs: any[]): void
  /* eslint-enable @typescript-eslint/method-signature-style */
}

/* eslint-disable-next-line
  @typescript-eslint/explicit-function-return-type,
  @typescript-eslint/explicit-module-boundary-types
*/
export default function withTimers<T extends TimerClass>(base: T) {
  return class extends base {
    protected setInterval(
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

    protected setTimeout(
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
