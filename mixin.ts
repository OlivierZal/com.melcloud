// eslint-disable-next-line import/no-extraneous-dependencies
import { Device } from 'homey'
import { DateTime, Duration } from 'luxon'
import type { DurationLikeObject } from 'luxon'

type TimerFunction = (
  callback: () => Promise<void>,
  duration: number
) => NodeJS.Timeout

type TimerClass = new (...args: any[]) => {
  error(...errorArgs: any[]): void
  log(...logArgs: any[]): void
  homey: {
    setInterval: TimerFunction
    setTimeout: TimerFunction
  }
}

export default function WithCustomLogging<T extends TimerClass>(Base: T) {
  return class extends Base {
    customLog(method: 'log' | 'error', ...args: any[]): void {
      if (this instanceof Device) {
        super[method](this.getName(), '-', ...args)
      } else {
        super[method](...args)
      }
    }

    error(...args: any[]): void {
      this.customLog('error', ...args)
    }

    log(...args: any[]): void {
      this.customLog('log', ...args)
    }

    setInterval(
      type: string,
      callback: () => Promise<void>,
      interval: number | DurationLikeObject,
      ...units: (keyof DurationLikeObject)[]
    ): NodeJS.Timeout {
      const duration: Duration = Duration.fromDurationLike(interval)
      this.log(
        `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()}`,
        'will run every',
        duration.shiftTo(...units).toHuman(),
        'starting',
        DateTime.now()
          .plus(duration)
          .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
      )
      return this.homey.setInterval(callback, Number(duration))
    }

    setTimeout(
      type: string,
      callback: () => Promise<void>,
      interval: number | DurationLikeObject,
      ...units: (keyof DurationLikeObject)[]
    ): NodeJS.Timeout {
      const duration: Duration = Duration.fromDurationLike(interval)
      this.log(
        'Next',
        type.toLowerCase(),
        'will run in',
        duration.shiftTo(...units).toHuman(),
        'on',
        DateTime.now()
          .plus(duration)
          .toLocaleString(DateTime.DATETIME_HUGE_WITH_SECONDS)
      )
      return this.homey.setTimeout(callback, Number(duration))
    }
  }
}
