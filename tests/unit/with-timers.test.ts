/* eslint-disable @typescript-eslint/unbound-method -- vitest/unbound-method only allows expect(), not vi.mocked() or mock assignments */
import { DateTime, Settings } from 'luxon'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { withTimers } from '../../mixins/with-timers.mts'

const FAKE_NOW_MILLIS = DateTime.fromISO('2026-03-18T12:00:00.000').toMillis()

const callback = async (): Promise<void> => {
  await Promise.resolve()
}

class BaseClass {
  public readonly homey = {
    clearInterval: vi.fn(),
    clearTimeout: vi.fn(),
    setInterval: vi.fn().mockReturnValue(1 as never),
    setTimeout: vi.fn().mockReturnValue(2 as never),
  }

  public log = vi.fn()

  public error(..._context: unknown[]): void {
    // Noop
  }
}

const TimerClass = withTimers(
  BaseClass as unknown as Parameters<typeof withTimers>[0],
)

describe(withTimers, () => {
  beforeAll(() => {
    Settings.now = (): number => FAKE_NOW_MILLIS
  })

  describe('setTimeout', () => {
    it('should call homey.setTimeout with the correct duration in ms', () => {
      const instance = new TimerClass()
      instance.setTimeout(callback, { hours: 1 }, 'sync data')

      expect(instance.homey.setTimeout).toHaveBeenCalledWith(
        callback,
        3_600_000,
      )
    })

    it('should return the timer id from homey', () => {
      const instance = new TimerClass()
      const result = instance.setTimeout(callback, { minutes: 30 }, 'refresh')

      expect(result).toBe(2)
    })

    it('should log the action with "in" and "on" wording', () => {
      const instance = new TimerClass()
      instance.setTimeout(callback, { hours: 2 }, 'sync data')

      expect(instance.log).toHaveBeenCalledWith(
        'Sync data',
        'will run',
        'in',
        expect.any(String),
        'on',
        expect.any(String),
      )
    })
  })

  describe('setInterval', () => {
    it('should call homey.setInterval with the correct duration in ms', () => {
      const instance = new TimerClass()
      instance.setInterval(callback, { minutes: 5 }, 'poll status')

      expect(instance.homey.setInterval).toHaveBeenCalledWith(callback, 300_000)
    })

    it('should return the timer id from homey', () => {
      const instance = new TimerClass()
      const result = instance.setInterval(callback, { minutes: 10 }, 'poll')

      expect(result).toBe(1)
    })

    it('should log the action with "every" and "starting" wording', () => {
      const instance = new TimerClass()
      instance.setInterval(callback, { hours: 1 }, 'poll status')

      expect(instance.log).toHaveBeenCalledWith(
        'Poll status',
        'will run',
        'every',
        expect.any(String),
        'starting',
        expect.any(String),
      )
    })
  })
})
