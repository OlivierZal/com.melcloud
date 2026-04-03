/* eslint-disable @typescript-eslint/unbound-method -- vitest/unbound-method only allows expect(), not vi.mocked() or mock assignments */
import { DateTime, Settings } from 'luxon'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { withTimers } from '../../mixins/with-timers.mts'

const FAKE_NOW_MILLIS = DateTime.fromISO('2026-03-18T12:00:00.000').toMillis()

const callback = async (): Promise<void> => {
  await Promise.resolve()
}

class BaseClass {
  public error = vi.fn()

  public readonly homey = {
    clearInterval: vi.fn(),
    clearTimeout: vi.fn(),
    setInterval: vi.fn().mockReturnValue(1),
    setTimeout: vi.fn().mockReturnValue(2),
  }

  public log = vi.fn()
}

const TimerClass = withTimers(
  // @ts-expect-error -- Mock class intentionally doesn't implement full Homey type
  BaseClass,
)

describe(withTimers, () => {
  beforeAll(() => {
    Settings.now = (): number => FAKE_NOW_MILLIS
  })

  describe('timeout scheduling', () => {
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

  describe('interval scheduling', () => {
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
