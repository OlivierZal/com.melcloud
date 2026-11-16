import type * as Classic from '@olivierzal/melcloud-api/classic'
import { sequential } from '@olivierzal/homey-kit'
import {
  getMockCallArg,
  mock,
  settleDetached,
} from '@olivierzal/homey-kit/testing'
import {
  type ApiRequestError,
  err,
  HttpError,
  ok,
} from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { HeldWarningReason } from '../../drivers/base-device.mts'
import type { EnergyReportConfig } from '../../drivers/base-report.mts'
import type { ClassicMELCloudDevice } from '../../drivers/classic-device.mts'
import type { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import type { EnergyCapabilityTagMapping } from '../../types/classic-capabilities.mts'
import { EnergyReport } from '../../drivers/classic-report.mts'
import {
  createReportDeviceMocks,
  FAKE_NOW,
  SINGLE_INSTANT,
} from '../report-mocks.ts'
import {
  createTransportFailure,
  TRANSPORT_FAILURE_CHAIN,
} from '../transport-failure.ts'

type TestDeviceType = typeof Classic.DeviceType.Ata

const MS_PER_MINUTE = 60_000

const {
  cleanMappingMock,
  clearTimeoutMock,
  ensureDeviceMock,
  getTimezoneMock,
  homey,
  setCapabilityValueMock,
  setTimeoutMock,
} = createReportDeviceMocks()
const logMock = vi.fn<(...args: unknown[]) => void>()
const errorMock = vi.fn<(...args: unknown[]) => void>()
const holdWarningMock = vi.fn<(reason: HeldWarningReason) => Promise<boolean>>()
const releaseWarningMock =
  vi.fn<(reason: HeldWarningReason) => Promise<boolean>>()

const regularConfig = {
  duration: { hours: 1 },
  minus: { hours: 1 },
  mode: 'regular',
  spread: SINGLE_INSTANT,
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const totalConfig = {
  duration: { days: 1 },
  minus: { hours: 1 },
  mode: 'total',
  spread: SINGLE_INSTANT,
  values: { hour: 1, millisecond: 0, minute: 30, second: 0 },
} satisfies EnergyReportConfig

// 12:00 CET (`FAKE_NOW`) to the total's next slot, 01:30.
const MINUTES_TO_TOTAL_SLOT = 810

const energyTagMapping = mock<EnergyCapabilityTagMapping<TestDeviceType>>({
  measure_power: ['Auto', 'Cooling'],
  'meter_power.daily': ['TotalAutoConsumed', 'TotalCoolingConsumed'],
})

const mockDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
  tagMappings: { energy: energyTagMapping },
})

const createMockDevice = (id = 1): ClassicMELCloudDevice<TestDeviceType> =>
  mock<ClassicMELCloudDevice<TestDeviceType>>({
    cleanMapping: cleanMappingMock,
    driver: mockDriver,
    ensureDevice: ensureDeviceMock,
    error: errorMock,
    holdWarning: holdWarningMock,
    homey,
    id,
    log: logMock,
    releaseWarning: releaseWarningMock,
    setCapabilityValue: setCapabilityValueMock,
  })

const mockDevice = createMockDevice()

const mockEnergyFetch = (energyData: unknown): ReturnType<typeof vi.fn> => {
  const getEnergyMock = vi
    .fn<(query?: unknown) => Promise<unknown>>()
    .mockResolvedValue(ok(energyData))
  ensureDeviceMock.mockResolvedValue({ data: {}, getEnergy: getEnergyMock })
  return getEnergyMock
}

const NETWORK_FAILURE: ApiRequestError = { kind: 'network' }

const mockFailingFetch = (failure: ApiRequestError = NETWORK_FAILURE): void => {
  ensureDeviceMock.mockResolvedValue({
    data: {},
    getEnergy: vi
      .fn<(query?: unknown) => Promise<unknown>>()
      .mockResolvedValue(err(failure)),
  })
}

// The next fetch hangs until the test answers it.
const mockHangingFetch = (): ((energyData: unknown) => void) => {
  const { promise, resolve } = Promise.withResolvers<unknown>()
  ensureDeviceMock.mockResolvedValueOnce({
    data: {},
    getEnergy: vi
      .fn<(query?: unknown) => Promise<unknown>>()
      .mockReturnValue(promise),
  })
  return (energyData: unknown): void => {
    resolve(ok(energyData))
  }
}

// Fires the timer a report armed with its `index`-th `setTimeout`.
const fireArmed = async (index: number): Promise<void> => {
  getMockCallArg<() => void>(setTimeoutMock, index, 0)()
  await settleDetached()
}

// Every delay armed so far, in arming order.
const armedMinutes = (): number[] =>
  setTimeoutMock.mock.calls.map(
    ([, delay]: unknown[]) => Number(delay) / MS_PER_MINUTE,
  )

const createCopMocks = (
  tags: readonly string[] = ['TagProduced', 'TagConsumed'],
): ClassicMELCloudDevice<TestDeviceType> => {
  // The COP arithmetic is capability-name agnostic — `cleanMapping` is
  // mocked to hand it this key — so the mapping is synthetic on purpose
  // and typed as such. Claiming it is `EnergyCapabilityTagMapping` would
  // need an assertion to hide a key no device declares.
  type SyntheticTagMapping = Readonly<Record<string, readonly string[]>>

  const copEnergyMapping: SyntheticTagMapping = { 'measure_power.cop': tags }
  const copDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
    tagMappings: { energy: copEnergyMapping },
  })
  return mock<ClassicMELCloudDevice<TestDeviceType>>({
    cleanMapping: vi
      .fn<(mapping: unknown) => Record<string, unknown>>()
      .mockReturnValue(copEnergyMapping),
    driver: copDriver,
    ensureDevice: ensureDeviceMock,
    holdWarning: holdWarningMock,
    homey,
    log: logMock,
    releaseWarning: releaseWarningMock,
    setCapabilityValue: setCapabilityValueMock,
  })
}

// Faking Date is not enough since temporal-polyfill v1: on runtimes
// shipping native Temporal it delegates to it, and the native clock
// does not consult the mocked Date. Pin Temporal.Now directly
const pinNow = (epochMilliseconds: number): void => {
  vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockImplementation(
    (timeZone = 'UTC') =>
      Temporal.Instant.fromEpochMilliseconds(
        epochMilliseconds,
      ).toZonedDateTimeISO(timeZone),
  )
}

describe(EnergyReport, () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: FAKE_NOW, toFake: ['Date'] })
    pinNow(FAKE_NOW)
  })

  beforeEach(() => {
    cleanMappingMock.mockReturnValue({ measure_power: ['Auto', 'Cooling'] })
  })

  // A case that moves the clock or the time zone hands both back here,
  // so one red assertion cannot turn the cases after it red too.
  afterEach(() => {
    getTimezoneMock.mockReturnValue('Europe/Paris')
    pinNow(FAKE_NOW)
  })

  afterAll(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('scheduling and data fetching', () => {
    it('should unschedule when no energy capability tag entries', async () => {
      cleanMappingMock.mockReturnValue({})
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(clearTimeoutMock).toHaveBeenCalledWith(undefined)
    })

    it('should fetch energy data and schedule when entries exist', async () => {
      const getEnergyMock = mockEnergyFetch({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(getEnergyMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-03-18', to: '2026-03-18' }),
      )
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    // The line follows the SDK's `logFailure` rule: a failure the SDK has
    // a class for — here the transport failure behind the `network`
    // descriptor — is ONE line naming the cause chain, with no error
    // object and so no stack; a bug keeps its object (the next clause).
    it('should log a classified fetch failure as one line naming its cause chain', async () => {
      mockFailingFetch({ cause: createTransportFailure(), kind: 'network' })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        `Energy report fetch failed: Error: MELCloud request failed: network — caused by ${TRANSPORT_FAILURE_CHAIN}`,
      )
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    // The wire's common failure: the `HttpError` behind a `server`
    // descriptor is a link the SDK has a class for, so the line is one.
    it('should log an HTTP failure as one line naming the status', async () => {
      mockFailingFetch({
        cause: new HttpError('Request failed with status code 500', {
          response: { data: {}, headers: {}, status: 500 },
        }),
        kind: 'server',
        status: 500,
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed: Error: MELCloud request failed: server — caused by HttpError: Request failed with status code 500',
      )
    })

    // The SDK answers its own rate-limit gate with a descriptor and no
    // classified error, so `unwrapResult`'s wrapper carries the plain
    // object as its cause: no link the SDK has a class for, and the line
    // keeps the wrapper `Error`, stack included. The small-object form
    // holds at the app's direct `failureCause` site alone.
    it('should keep the wrapper error when the SDK answers rate-limited', async () => {
      const descriptor: ApiRequestError = {
        kind: 'rate-limited',
        retryAfterMs: 42_000,
      }
      mockFailingFetch(descriptor)
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        expect.any(Error),
      )
      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        expect.objectContaining({
          cause: descriptor,
          message: 'MELCloud request failed: rate-limited',
        }),
      )
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should keep the error object and still schedule when setCapabilityValue throws', async () => {
      const capabilityError = new Error('capability rejected')
      setCapabilityValueMock.mockRejectedValueOnce(capabilityError)
      mockEnergyFetch({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        capabilityError,
      )
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should not schedule twice', async () => {
      mockEnergyFetch({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should handle null device from ensureDevice', async () => {
      ensureDeviceMock.mockResolvedValue(null)
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })
  })

  // A failing report is a LASTING condition: it reaches the device's HELD
  // warning under its own reason, never the one-shot toast, which shows
  // and clears in the same call (#1696). The device verbs own the
  // de-duplication, so the report calls them on every run past the
  // threshold and logs a transition only when the call changed the record.
  describe('failure warning and success logging', () => {
    const validEnergyData = {
      Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    }

    it('should hold the warning from the third consecutive failure and log it once', async () => {
      holdWarningMock.mockResolvedValueOnce(true).mockResolvedValue(false)
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()

      expect(holdWarningMock).not.toHaveBeenCalled()

      await report.start()
      await report.start()

      expect(holdWarningMock.mock.calls).toStrictEqual([
        ['regularEnergyReports'],
        ['regularEnergyReports'],
      ])
      expect(
        errorMock.mock.calls.filter(
          ([message]) =>
            message === 'regular energy report failing, warning held',
        ),
      ).toHaveLength(1)
    })

    it('should release the warning and reset the streak on the next success', async () => {
      holdWarningMock.mockResolvedValue(true)
      releaseWarningMock.mockResolvedValueOnce(true)
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()
      await report.start()
      mockEnergyFetch(validEnergyData)
      await report.start()

      expect(releaseWarningMock).toHaveBeenCalledWith('regularEnergyReports')
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report recovered, warning released',
      )
    })

    it('should not hold when successes interleave the failures', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()
      mockEnergyFetch(validEnergyData)
      await report.start()
      mockFailingFetch()
      await report.start()
      await report.start()

      expect(holdWarningMock).not.toHaveBeenCalled()
    })

    // A skipped run — the facade unavailable, a condition `ensureDevice`
    // already warned — proves nothing about the report's health: it
    // neither ends the streak nor extends it, and a held warning stands.
    it('should count a skipped run as neither a success nor a failure', async () => {
      holdWarningMock.mockResolvedValueOnce(true)
      releaseWarningMock.mockResolvedValueOnce(true)
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()
      await report.start()
      ensureDeviceMock.mockResolvedValue(null)
      await report.start()

      expect(holdWarningMock).toHaveBeenCalledTimes(1)
      expect(releaseWarningMock).not.toHaveBeenCalled()
      expect(logMock).not.toHaveBeenCalledWith(
        expect.stringContaining('warning released'),
      )

      // The streak survived the skip: this failure is the fourth, not the
      // first, so the report still holds.
      mockFailingFetch()
      await report.start()

      expect(holdWarningMock).toHaveBeenCalledTimes(2)
      expect(releaseWarningMock).not.toHaveBeenCalled()

      mockEnergyFetch(validEnergyData)
      await report.start()

      expect(releaseWarningMock.mock.calls).toStrictEqual([
        ['regularEnergyReports'],
      ])
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report recovered, warning released',
      )
    })

    // A release that changed nothing (nothing was held) is the device's
    // silent no-op: the report writes no closing line for it.
    it('should not log a release the device did not perform', async () => {
      releaseWarningMock.mockResolvedValue(false)
      mockEnergyFetch(validEnergyData)
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(releaseWarningMock).toHaveBeenCalledWith('regularEnergyReports')
      expect(logMock).not.toHaveBeenCalledWith(
        expect.stringContaining('warning released'),
      )
    })

    // The two reports of a device fail independently: the total report
    // holds a reason of its own, so its warning outlives the regular
    // report's recovery.
    it('should hold the total report under its own reason', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['TotalAutoConsumed'] })
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      await report.start()
      await report.start()

      expect(holdWarningMock).toHaveBeenCalledWith('totalEnergyReports')
    })

    it('should log a compact summary of the applied values', async () => {
      mockEnergyFetch(validEnergyData)
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(logMock).toHaveBeenCalledWith(
        'regular energy report applied:',
        expect.stringMatching(/^measure_power=\d+(?:\.\d+)?$/v),
      )
    })
  })

  describe('unscheduling', () => {
    it('should clear the timeout', () => {
      const report = new EnergyReport(mockDevice, regularConfig)
      report.unschedule()

      expect(clearTimeoutMock).toHaveBeenCalledWith(undefined)
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report has been cancelled',
      )
    })
  })

  describe('energy value calculations', () => {
    it('should set power values using hourly data', async () => {
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 100],
          Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50],
        }),
      )
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power',
        11_000,
      )
    })

    it('should calculate energy values for total mode using total entries', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          TotalAutoConsumed: 100,
          TotalCoolingConsumed: 50,
        }),
      )
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 150)
    })

    it('should use zero fallback when hourly array element is undefined', async () => {
      const sparseArray: (number | undefined)[] = []
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          Auto: sparseArray,
          Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
        }),
      )
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 0)
    })

    it('should handle non-array tag data by skipping power calculation', async () => {
      mockEnergyFetch(mock<Classic.EnergyDataAta>({ Auto: 100, Cooling: 50 }))
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 0)
    })

    it('should handle UsageDisclaimerPercentages for linked device count', async () => {
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 100],
          Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50],
          UsageDisclaimerPercentages: '50,50',
        }),
      )
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 5500)
    })
  })

  describe('energy value for non-power non-cop entries', () => {
    it('should calculate energy values by summing tags and dividing by device count', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          TotalAutoConsumed: 100,
          TotalCoolingConsumed: 50,
        }),
      )
      const report = new EnergyReport(mockDevice, {
        duration: { hours: 1 },
        minus: { hours: 1 },
        mode: 'total',
        spread: SINGLE_INSTANT,
        values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
      })
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 150)
    })

    it('should count non-finite tag values as 0 instead of propagating NaN', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          TotalAutoConsumed: 100,
          TotalCoolingConsumed: undefined,
        }),
      )
      const report = new EnergyReport(mockDevice, {
        duration: { hours: 1 },
        minus: { hours: 1 },
        mode: 'total',
        spread: SINGLE_INSTANT,
        values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
      })
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 100)
    })
  })

  describe('offset-free configs', () => {
    it('should anchor on now when minus is omitted', async () => {
      const getEnergyMock = mockEnergyFetch({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      const report = new EnergyReport(mockDevice, {
        duration: { hours: 1 },
        mode: 'regular',
        spread: SINGLE_INSTANT,
        values: { millisecond: 0, minute: 5, second: 0 },
      })
      await report.start()

      expect(getEnergyMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-03-18', to: '2026-03-18' }),
      )
    })
  })

  describe('total mode', () => {
    it.each([
      { now: '2026-03-18T12:00:00+01:00', to: '2026-03-18' },
      // `minus` takes an hour back: read in the hour after midnight, a
      // total stops at the day that just closed.
      { now: '2026-03-18T00:40:00+01:00', to: '2026-03-17' },
    ])(
      'should omit from and stop at $to when read at $now',
      async ({ now, to }) => {
        pinNow(Temporal.Instant.from(now).epochMilliseconds)
        cleanMappingMock.mockReturnValue({ meter_power: ['TotalAutoConsumed'] })
        const getEnergyMockLocal = mockEnergyFetch(
          mock<Classic.EnergyDataAta>({ TotalAutoConsumed: 100 }),
        )
        const report = new EnergyReport(mockDevice, totalConfig)
        await report.start()

        expect(getEnergyMockLocal).toHaveBeenCalledWith({ to })
      },
    )
  })

  describe('wall-clock re-anchoring', () => {
    it('should re-arm a fresh timeout after each fire instead of a fixed interval', async () => {
      mockEnergyFetch({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      const timeoutCallback = getMockCallArg<() => void>(setTimeoutMock, 0, 0)
      timeoutCallback()
      await settleDetached()

      expect(setTimeoutMock).toHaveBeenCalledTimes(2)
      expect(setTimeoutMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        expect.any(Number),
      )
      expect(logMock).toHaveBeenCalledWith(
        'Regular energy report',
        'will run in',
        expect.any(String),
        'on',
        expect.any(String),
      )

      const secondCallback = getMockCallArg<() => void>(setTimeoutMock, 1, 0)
      secondCallback()
      await settleDetached()

      expect(ensureDeviceMock).toHaveBeenCalledTimes(3)
    })

    it('should recompute each delay from the wall clock across a DST transition', async () => {
      // Spring forward in Europe/Paris: 2026-03-29 02:00 CET → 03:00 CEST.
      pinNow(
        Temporal.Instant.from('2026-03-29T01:30:00+01:00').epochMilliseconds,
      )
      mockEnergyFetch({ Auto: [0], Cooling: [0] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      // 01:30 CET + 1 h = 03:30 CEST, aligned to hh:05 → 03:05 CEST = 35 min.
      const firstDelay = getMockCallArg<number>(setTimeoutMock, 0, 1)

      expect(firstDelay).toBe(35 * MS_PER_MINUTE)

      pinNow(
        Temporal.Instant.from('2026-03-29T03:05:00+02:00').epochMilliseconds,
      )
      const timeoutCallback = getMockCallArg<() => void>(setTimeoutMock, 0, 0)
      timeoutCallback()
      await settleDetached()

      // Re-anchored on the new wall clock: next fire at 04:05 CEST, a full hour.
      const secondDelay = getMockCallArg<number>(setTimeoutMock, 1, 1)

      expect(secondDelay).toBe(60 * MS_PER_MINUTE)
    })

    it('should stop the chain when unscheduled during a fire', async () => {
      mockEnergyFetch({ Auto: [0], Cooling: [0] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      const timeoutCallback = getMockCallArg<() => void>(setTimeoutMock, 0, 0)
      report.unschedule()
      timeoutCallback()
      await settleDetached()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should unschedule from a fire once every energy capability is disabled', async () => {
      mockEnergyFetch({ Auto: [0], Cooling: [0] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      cleanMappingMock.mockReturnValue({})
      const timeoutCallback = getMockCallArg<() => void>(setTimeoutMock, 0, 0)
      timeoutCallback()
      await settleDetached()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report has been cancelled',
      )
    })
  })

  // A report keeps one timer chain however its runs overlap: a run
  // whose fetch outlives an `unschedule()` arms nothing, whatever was
  // started since.
  describe('overlapping runs', () => {
    const hourlyData = { Auto: [0], Cooling: [0] }

    // A timer's run hangs in its fetch, the report is cancelled (its
    // last capability disabled) then started again (one enabled), and
    // that fetch hangs too. Whichever settles first, the restart's
    // timer is the only one.
    it.each([
      { first: 'restart', order: [1, 0] },
      { first: "timer's run", order: [0, 1] },
    ])(
      'should keep one timer when the $first settles first',
      async ({ order }) => {
        mockEnergyFetch(hourlyData)
        const report = new EnergyReport(mockDevice, regularConfig)
        await report.start()
        const answers = [mockHangingFetch(), mockHangingFetch()]
        getMockCallArg<() => void>(setTimeoutMock, 0, 0)()
        report.unschedule()
        const restart = report.start()
        await sequential(order, async (index) => {
          answers[index]?.(hourlyData)
          await settleDetached()
        })
        await restart

        expect(setTimeoutMock).toHaveBeenCalledTimes(2)
      },
    )

    // A device deleted during its start-up fetch.
    it('should arm nothing when cancelled during the start-up fetch', async () => {
      const answer = mockHangingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      const starting = report.start()
      report.unschedule()
      answer(hourlyData)
      await starting

      expect(setTimeoutMock).not.toHaveBeenCalled()
    })
  })

  // A failed run is retried before its cadence comes round: a nightly
  // total that fails does not cost the day.
  describe('retry after a failed run', () => {
    const totalData = mock<Classic.EnergyDataAta>({ TotalAutoConsumed: 100 })

    beforeEach(() => {
      cleanMappingMock.mockReturnValue({ meter_power: ['TotalAutoConsumed'] })
    })

    it('should retry a quarter of an hour after the failure, not at the next slot', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()

      expect(armedMinutes()).toStrictEqual([15])
      expect(setCapabilityValueMock).not.toHaveBeenCalled()
      expect(logMock).toHaveBeenCalledWith(
        'Total energy report',
        'will run in',
        expect.any(String),
        'on',
        expect.stringContaining('12:15:00'),
      )
    })

    it('should double the retry after each further consecutive failure, up to four hours', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      await sequential([0, 1, 2, 3, 4], fireArmed)

      expect(armedMinutes()).toStrictEqual([15, 30, 60, 120, 240, 240])
    })

    it('should arm the cadence once it comes sooner than the retry', async () => {
      pinNow(
        Temporal.Instant.from('2026-03-18T12:55:00+01:00').epochMilliseconds,
      )
      cleanMappingMock.mockReturnValue({ measure_power: ['Auto', 'Cooling'] })
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      // The hourly slot, 13:05, is ten minutes away.
      expect(armedMinutes()).toStrictEqual([10])
    })

    // The retry wins while it is strictly sooner than the slot: a
    // millisecond either side of the tie, and the tie itself.
    it.each([
      { delay: 900_000, now: '2026-03-18T12:49:59.999+01:00' },
      { delay: 900_000, now: '2026-03-18T12:50:00.000+01:00' },
      { delay: 899_999, now: '2026-03-18T12:50:00.001+01:00' },
    ])(
      'should arm $delay ms when an hourly run fails at $now',
      async ({ delay, now }) => {
        pinNow(Temporal.Instant.from(now).epochMilliseconds)
        cleanMappingMock.mockReturnValue({ measure_power: ['Auto', 'Cooling'] })
        mockFailingFetch()
        const report = new EnergyReport(mockDevice, regularConfig)
        await report.start()

        expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(delay)
      },
    )

    it('should arm nothing when a run fails after the report was unscheduled', async () => {
      mockEnergyFetch(totalData)
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      mockFailingFetch()
      report.unschedule()
      await fireArmed(0)

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    // An hourly report failing at its own slot: two retries, then the
    // next slot, a quarter of an hour away when the third retry would
    // be an hour away.
    it('should retry an hourly report twice before its next slot', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['Auto', 'Cooling'] })
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      pinNow(
        Temporal.Instant.from('2026-03-18T13:05:00+01:00').epochMilliseconds,
      )
      await report.start()
      pinNow(
        Temporal.Instant.from('2026-03-18T13:20:00+01:00').epochMilliseconds,
      )
      await fireArmed(0)
      pinNow(
        Temporal.Instant.from('2026-03-18T13:50:00+01:00').epochMilliseconds,
      )
      await fireArmed(1)

      expect(armedMinutes()).toStrictEqual([15, 30, 15])
    })

    it('should return to the cadence after a successful retry', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      mockEnergyFetch(totalData)
      await fireArmed(0)

      expect(armedMinutes()).toStrictEqual([15, MINUTES_TO_TOTAL_SLOT])
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 100)
    })

    // A skipped run — the unit unreachable — is not a failure: it earns
    // no retry, and the streak it leaves standing arms none either.
    it('should return to the cadence after a skipped run', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      ensureDeviceMock.mockResolvedValue(null)
      await fireArmed(0)

      expect(armedMinutes()).toStrictEqual([15, MINUTES_TO_TOTAL_SLOT])
    })

    it('should hold the warning at the third consecutive failure, retries included', async () => {
      holdWarningMock.mockResolvedValueOnce(true).mockResolvedValue(false)
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      await fireArmed(0)

      expect(holdWarningMock).not.toHaveBeenCalled()

      await fireArmed(1)

      expect(holdWarningMock).toHaveBeenCalledWith('totalEnergyReports')
      expect(errorMock).toHaveBeenCalledWith(
        'total energy report failing, warning held',
      )
    })

    // Two runs of one report can overlap — a settings change starts one
    // while a timer's is in flight — and a success settling while the
    // failed one holds the warning resets the shared count. The failed
    // run still arms the retry its own failure earned.
    it('should arm the retry its own failure earned when a success settles meanwhile', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()
      await fireArmed(0)
      const { promise: isHeld, resolve: answerHold } =
        Promise.withResolvers<boolean>()
      holdWarningMock.mockReturnValueOnce(isHeld)
      await fireArmed(1)
      mockEnergyFetch(totalData)
      await report.start()
      answerHold(true)
      await settleDetached()

      expect(armedMinutes()).toStrictEqual([15, 30, 60])
    })

    // The doubling itself has no end — it reads `Infinity` past a
    // thousand failures — but the retry does: four hours, a duration the
    // chain can always build.
    it('should keep to four hours however long the streak', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, totalConfig)
      await sequential(
        Array.from({ length: 1100 }, () => report),
        async (failing) => failing.start(),
      )
      await fireArmed(0)

      expect(armedMinutes()).toStrictEqual([15, 240])
    })
  })

  // Every install of the app shares a report's slot: each device takes
  // its own instant in the slot's window, so a slot is never one burst
  // on MELCloud.
  describe('spread across the fleet', () => {
    const WINDOW_MINUTES = 25
    const spreadConfig = {
      ...totalConfig,
      spread: { minutes: WINDOW_MINUTES },
    } satisfies EnergyReportConfig
    const deviceIds = Array.from({ length: 50 }, (_unused, index) => index + 1)

    const startFor = async (id: number): Promise<void> => {
      const report = new EnergyReport(createMockDevice(id), spreadConfig)
      await report.start()
    }

    beforeEach(() => {
      cleanMappingMock.mockReturnValue({ meter_power: ['TotalAutoConsumed'] })
      mockEnergyFetch(mock<Classic.EnergyDataAta>({ TotalAutoConsumed: 100 }))
    })

    it('should land every device in the window that opens at the slot', async () => {
      await sequential(deviceIds, startFor)

      expect(
        armedMinutes().every(
          (minutes) =>
            minutes >= MINUTES_TO_TOTAL_SLOT &&
            minutes < MINUTES_TO_TOTAL_SLOT + WINDOW_MINUTES,
        ),
      ).toBe(true)
    })

    it('should give each device an instant of its own', async () => {
      await sequential(deviceIds, startFor)
      const instants = new Set(armedMinutes())

      expect(instants.size).toBe(deviceIds.length)
    })

    // Fifty instants squeezed into the window's first minute would pass
    // the two cases above and still be one burst.
    it('should use the width of the window', async () => {
      await sequential(deviceIds, startFor)
      const minutes = armedMinutes()

      expect(Math.max(...minutes) - Math.min(...minutes)).toBeGreaterThan(
        WINDOW_MINUTES / 2,
      )
    })

    // The instant is a property of the id alone: the same across
    // restarts, app versions and Homeys, so it is pinned to the
    // millisecond for one device.
    it('should derive the instant from the id alone', async () => {
      await startFor(1)

      expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(
        MINUTES_TO_TOTAL_SLOT * MS_PER_MINUTE + 989_619,
      )
    })

    // A slot is the earliest instant its figures can be trusted at, so
    // a run before it in its period — a start-up, a retry — does not
    // stand in for it: the slot still runs.
    it.each([
      { config: regularConfig, minutes: 3, now: '2026-03-18T13:02:00+01:00' },
      { config: totalConfig, minutes: 70, now: '2026-03-18T00:20:00+01:00' },
    ])(
      'should still run the $config.mode slot after a run $minutes min before it',
      async ({ config, minutes, now }) => {
        pinNow(Temporal.Instant.from(now).epochMilliseconds)
        cleanMappingMock.mockReturnValue({
          measure_power: ['Auto', 'Cooling'],
          meter_power: ['TotalAutoConsumed'],
        })
        const report = new EnergyReport(mockDevice, config)
        await report.start()

        expect(armedMinutes()).toStrictEqual([minutes])
      },
    )

    // A timer can fire a few milliseconds before its slot: the run it
    // starts arms the next period's slot, never the same one again.
    it('should not arm the same slot again when its timer fires early', async () => {
      pinNow(
        Temporal.Instant.from('2026-03-18T13:04:59.997+01:00')
          .epochMilliseconds,
      )
      cleanMappingMock.mockReturnValue({ measure_power: ['Auto', 'Cooling'] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(
        60 * MS_PER_MINUTE + 3,
      )
    })

    // The slots are aligned on the device's own grid. Aligned on the
    // shared one, a run ending between a period's boundary and the
    // device's instant would skip that instant: here device 9652, whose
    // hourly instant is hh:08:08.345, would wait for 14:08 instead.
    it('should arm the device instant still ahead in the period', async () => {
      pinNow(
        Temporal.Instant.from('2026-03-18T13:01:00+01:00').epochMilliseconds,
      )
      cleanMappingMock.mockReturnValue({ measure_power: ['Auto', 'Cooling'] })
      const report = new EnergyReport(createMockDevice(9652), {
        ...regularConfig,
        spread: { minutes: 5 },
      })
      await report.start()

      expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(
        7 * MS_PER_MINUTE + 8345,
      )
    })

    it('should keep a device on its instant from one run to the next', async () => {
      await startFor(1)
      await startFor(1)
      await fireArmed(0)
      const [first, second, afterFire] = armedMinutes()

      expect(second).toBe(first)
      expect(afterFire).toBe(first)
    })
  })

  // Summer and winter time. A daily report runs once per local day
  // whatever the night does to the clocks: it keeps its wall-clock slot
  // across the change, a slot the clocks skip runs an hour later on the
  // clock, a full day after the last, and one they repeat runs once.
  describe('summer and winter time', () => {
    const MINUTES_PER_HOUR = 60

    it.each([
      // Paris changes at 02:00 and 03:00: the 01:30 slot only sees the
      // day's length, 23 hours in March and 25 in October.
      { hours: 24, now: '2026-03-28T01:30:00+01:00', zone: 'Europe/Paris' },
      { hours: 23, now: '2026-03-29T01:30:00+01:00', zone: 'Europe/Paris' },
      { hours: 25, now: '2026-10-25T01:30:00+02:00', zone: 'Europe/Paris' },
      // London skips 01:00 to 02:00 in March: the slot runs at 02:30
      // that night, a full day after the last, then returns to 01:30.
      { hours: 24, now: '2026-03-28T01:30:00+00:00', zone: 'Europe/London' },
      { hours: 23, now: '2026-03-29T02:30:00+01:00', zone: 'Europe/London' },
      // London repeats 01:00 to 02:00 in October: the slot runs at the
      // first 01:30, and from there the next is tomorrow's, not the
      // second 01:30 an hour later.
      { hours: 24, now: '2026-10-24T01:30:00+01:00', zone: 'Europe/London' },
      { hours: 25, now: '2026-10-25T01:30:00+01:00', zone: 'Europe/London' },
      // Lord Howe Island repeats 01:30 to 02:00 in April, its clocks
      // going back half an hour: the same once, at the first 01:30.
      {
        hours: 24,
        now: '2026-04-04T01:30:00+11:00',
        zone: 'Australia/Lord_Howe',
      },
      {
        hours: 24.5,
        now: '2026-04-05T01:30:00+11:00',
        zone: 'Australia/Lord_Howe',
      },
    ])(
      'should arm the nightly slot $hours h after $now in $zone',
      async ({ hours, now, zone }) => {
        getTimezoneMock.mockReturnValue(zone)
        pinNow(Temporal.Instant.from(now).epochMilliseconds)
        cleanMappingMock.mockReturnValue({ meter_power: ['TotalAutoConsumed'] })
        mockEnergyFetch(mock<Classic.EnergyDataAta>({ TotalAutoConsumed: 100 }))
        const report = new EnergyReport(mockDevice, totalConfig)
        await report.start()

        expect(armedMinutes()).toStrictEqual([hours * MINUTES_PER_HOUR])
      },
    )

    // That half hour puts an hourly report's next slot behind: an hour
    // after 01:10 is 01:40, whose five past is the 01:05 already gone.
    // The run is a whole period away — a slot behind is a timer that
    // runs at once, again and again — and back on its slot after it.
    it('should arm a whole period ahead when the clocks put the next slot behind', async () => {
      getTimezoneMock.mockReturnValue('Australia/Lord_Howe')
      pinNow(
        Temporal.Instant.from('2026-04-05T01:10:00+11:00').epochMilliseconds,
      )
      mockEnergyFetch({ Auto: [0], Cooling: [0] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      pinNow(
        Temporal.Instant.from('2026-04-05T01:40:00+10:30').epochMilliseconds,
      )
      await fireArmed(0)

      expect(armedMinutes()).toStrictEqual([60, 25])
    })
  })

  describe('coefficient of performance calculation', () => {
    it('should calculate COP as produced / consumed', async () => {
      const mockDeviceWithCop = createCopMocks()
      mockEnergyFetch({ TagConsumed: 2, TagProduced: 6 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        3,
      )
    })

    it('should use 1 as divisor when consumed is 0', async () => {
      const mockDeviceWithCop = createCopMocks()
      mockEnergyFetch({ TagConsumed: 0, TagProduced: 5 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        5,
      )
    })

    it('should tell the consumed tags by their suffix, the rest counting as produced', async () => {
      const mockDeviceWithCop = createCopMocks([
        'TotalHeatingProduced',
        'TotalCoolingConsumed',
      ])
      mockEnergyFetch({ TotalCoolingConsumed: 2, TotalHeatingProduced: 6 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        3,
      )
    })

    it('should read a lone unsuffixed tag as produced over a unit divisor', async () => {
      const mockDeviceWithCop = createCopMocks(['CoP'])
      mockEnergyFetch({ CoP: 4.2 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        4.2,
      )
    })
  })

  describe('usageDisclaimerPercentages divides by device count', () => {
    it('should divide energy values by linked device count', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.daily': ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          TotalAutoConsumed: 100,
          TotalCoolingConsumed: 50,
          UsageDisclaimerPercentages: '50,50',
        }),
      )
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        75,
      )
    })
  })
})
