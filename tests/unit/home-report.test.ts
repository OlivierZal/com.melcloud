import type * as Home from '@olivierzal/melcloud-api/home'
import {
  getMockCallArg,
  mock,
  settleDetached,
} from '@olivierzal/homey-kit/testing'
import { type ApiRequestError, err, ok } from '@olivierzal/melcloud-api'
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
import type { HomeMELCloudDevice } from '../../drivers/home-device.mts'
import {
  ATA_ENERGY_STRATEGY,
  ATW_ENERGY_STRATEGY,
  HomeEnergyReport,
} from '../../drivers/home-report.mts'
import {
  createReportDeviceMocks,
  FAKE_NOW,
  SINGLE_INSTANT,
} from '../report-mocks.ts'
import {
  createTransportFailure,
  TRANSPORT_FAILURE_CHAIN,
} from '../transport-failure.ts'

const {
  cleanMappingMock,
  clearTimeoutMock,
  ensureDeviceMock,
  homey,
  setCapabilityValueMock,
  setTimeoutMock,
} = createReportDeviceMocks()
const getStoreValueMock = vi.fn<(key: string) => unknown>()
const setStoreValueMock =
  vi.fn<(key: string, value: unknown) => Promise<void>>()
const logMock = vi.fn<(...args: unknown[]) => void>()
const errorMock = vi.fn<(...args: unknown[]) => void>()
const holdWarningMock = vi.fn<(reason: HeldWarningReason) => Promise<boolean>>()
const releaseWarningMock =
  vi.fn<(reason: HeldWarningReason) => Promise<boolean>>()

const regularConfig = {
  duration: { hours: 1 },
  mode: 'regular',
  spread: SINGLE_INSTANT,
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const totalConfig = {
  duration: { hours: 1 },
  mode: 'total',
  spread: SINGLE_INSTANT,
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

// The Home air-to-water regular report, as its driver declares it.
const fiveMinuteConfig = {
  duration: { minutes: 5 },
  mode: 'regular',
  spread: { minutes: 1 },
  values: { millisecond: 0, second: 0 },
} satisfies EnergyReportConfig

const MS_PER_MINUTE = 60_000

const mockDevice = <T extends Home.DeviceType>(
  id = 'f1e2d3c4-0000-4000-8000-000000000001',
): HomeMELCloudDevice<T> =>
  mock<HomeMELCloudDevice<T>>({
    cleanMapping: cleanMappingMock,
    driver: { tagMappings: { energy: {} } },
    ensureDevice: ensureDeviceMock,
    error: errorMock,
    getStoreValue: getStoreValueMock,
    holdWarning: holdWarningMock,
    homey,
    id,
    log: logMock,
    releaseWarning: releaseWarningMock,
    setCapabilityValue: setCapabilityValueMock,
    setStoreValue: setStoreValueMock,
  })

// One hour bucket of the library's normalized series: its start as
// epoch ms, its energy in kWh — `null` on either field where the wire
// garbled it.
const point = (
  at: string | null,
  kilowattHours: number | null,
): Home.EnergySeriesPoint => ({
  atEpochMs: at === null ? null : Temporal.Instant.from(at).epochMilliseconds,
  kilowattHours,
})

const NETWORK_FAILURE: ApiRequestError = { kind: 'network' }

const mockFailingFetch = (failure: ApiRequestError = NETWORK_FAILURE): void => {
  ensureDeviceMock.mockResolvedValue({
    getEnergySeries: vi
      .fn<(query: unknown) => Promise<unknown>>()
      .mockResolvedValue(err(failure)),
  })
}

// An air-to-air unit answers its one direction.
const mockAtaFetch = (
  consumed: Home.EnergySeriesPoint[],
): ReturnType<typeof vi.fn> => {
  const getEnergySeriesMock = vi
    .fn<(query: unknown) => Promise<unknown>>()
    .mockResolvedValue(ok({ consumed }))
  ensureDeviceMock.mockResolvedValue({ getEnergySeries: getEnergySeriesMock })
  return getEnergySeriesMock
}

// An air-to-water unit answers both directions in one read.
const mockAtwFetch = ({
  consumed = [],
  produced = [],
}: {
  consumed?: Home.EnergySeriesPoint[]
  produced?: Home.EnergySeriesPoint[]
}): ReturnType<typeof vi.fn> => {
  const getEnergySeriesMock = vi
    .fn<(query: unknown) => Promise<unknown>>()
    .mockResolvedValue(ok({ consumed, produced }))
  ensureDeviceMock.mockResolvedValue({ getEnergySeries: getEnergySeriesMock })
  return getEnergySeriesMock
}

const instantOf = (iso: string): number =>
  Temporal.Instant.from(iso).epochMilliseconds

const pinNow = (epochMilliseconds: number): void => {
  vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockImplementation(
    (timeZone = 'UTC') =>
      Temporal.Instant.fromEpochMilliseconds(
        epochMilliseconds,
      ).toZonedDateTimeISO(timeZone),
  )
}

describe('home energy reports', () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: FAKE_NOW, toFake: ['Date'] })
    pinNow(FAKE_NOW)
  })

  beforeEach(() => {
    getStoreValueMock.mockReturnValue(undefined)
    setStoreValueMock.mockResolvedValue(undefined)
  })

  // A case that moves the clock hands it back here, so one red
  // assertion cannot turn the cases after it red too.
  afterEach(() => {
    pinNow(FAKE_NOW)
  })

  afterAll(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('with the ATA strategy', () => {
    // A failed fetch leaves the cursor where it was, so the early retry
    // accrues the gap once: no window counted twice, none lost.
    it('should accrue from the untouched cursor when a failed total is retried', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T08:55:00Z' : 1.5,
      )
      mockFailingFetch()
      pinNow(instantOf('2026-03-18T11:10:00Z'))
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setStoreValueMock).not.toHaveBeenCalled()
      expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(
        15 * MS_PER_MINUTE,
      )

      pinNow(instantOf('2026-03-18T11:25:00Z'))
      const getEnergySeriesMock = mockAtaFetch([
        point('2026-03-18T09:00:00Z', 0.2),
      ])
      getMockCallArg<() => void>(setTimeoutMock, 0, 0)()
      await settleDetached()

      // The retry reads up to its own horizon.
      expect(getEnergySeriesMock).toHaveBeenCalledWith({
        from: '2026-03-18T08:55:00Z',
        to: '2026-03-18T10:21:00Z',
      })
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-18T10:21:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 1.7)
    })

    // A Home id is a string: it is told apart like a Classic number.
    it('should give each unit an instant of its own in the window', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      mockAtaFetch([])
      await Promise.all(
        ['01', '02', '03'].map(async (suffix) => {
          const report = new HomeEnergyReport(
            mockDevice(`f1e2d3c4-0000-4000-8000-0000000000${suffix}`),
            { ...totalConfig, spread: { minutes: 5 } },
            ATA_ENERGY_STRATEGY,
          )
          await report.start()
        }),
      )
      const delays = setTimeoutMock.mock.calls.map(([, delay]: unknown[]) =>
        Number(delay),
      )

      // 12:00 to 12:05, then the unit's own place in the five minutes.
      expect(delays.toSorted((first, second) => first - second)).toStrictEqual(
        [191_577, 196_587, 268_068].map((offset) => 5 * MS_PER_MINUTE + offset),
      )
    })

    it('should unschedule when no energy capability is enabled', async () => {
      cleanMappingMock.mockReturnValue({})
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(clearTimeoutMock).toHaveBeenCalledWith(undefined)
      expect(setTimeoutMock).not.toHaveBeenCalled()
    })

    it('should do nothing when the facade is unavailable', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      ensureDeviceMock.mockResolvedValue(null)
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).not.toHaveBeenCalled()
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    // One line for a failure the SDK has a class for, the error object
    // for a bug: the base report's `logFailure` line, on this leg too.
    it('should log a classified telemetry failure as one line', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockFailingFetch({ cause: createTransportFailure(), kind: 'network' })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        `Energy report fetch failed: Error: MELCloud request failed: network — caused by ${TRANSPORT_FAILURE_CHAIN}`,
      )
      expect(holdWarningMock).not.toHaveBeenCalled()
    })

    // Home's `not-found` is the one descriptor the SDK answers with no
    // classified error: through `unwrapResult` the line keeps the
    // wrapper `Error`, stack included, the plain descriptor as its cause.
    it('should keep the wrapper error when the registry does not hold the unit', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      const descriptor: ApiRequestError = {
        entityId: 'home-1',
        kind: 'not-found',
      }
      mockFailingFetch(descriptor)
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        expect.any(Error),
      )
      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        expect.objectContaining({
          cause: descriptor,
          message: 'MELCloud request failed: not-found',
        }),
      )
    })

    it('should keep the error object when a capability write throws', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtaFetch([point('2026-03-18T10:00:00Z', 0.1)])
      const capabilityError = new Error('capability rejected')
      setCapabilityValueMock.mockRejectedValueOnce(capabilityError)
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        capabilityError,
      )
    })

    // The Home leg shares the base report's lasting warning: held under
    // the report's own reason from the third consecutive failure, never
    // toasted, and released on the first success.
    it('should hold the warning from the third consecutive failure', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      holdWarningMock.mockResolvedValueOnce(true)
      mockFailingFetch()
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()
      await report.start()
      await report.start()

      expect(holdWarningMock.mock.calls).toStrictEqual([
        ['regularEnergyReports'],
      ])
      expect(errorMock).toHaveBeenCalledWith(
        'regular energy report failing, warning held',
      )
    })

    it('should release the warning on the next success', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      releaseWarningMock.mockResolvedValueOnce(true)
      mockFailingFetch()
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()
      await report.start()
      await report.start()
      mockAtaFetch([])
      await report.start()

      expect(releaseWarningMock.mock.calls).toStrictEqual([
        ['regularEnergyReports'],
      ])
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report recovered, warning released',
      )
    })

    // Same base contract as the Classic leg: a skipped run (no facade)
    // neither ends the failure streak nor releases a held warning.
    it('should keep the streak and the held warning across a skipped run', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockFailingFetch()
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()
      await report.start()
      await report.start()
      ensureDeviceMock.mockResolvedValue(null)
      await report.start()
      mockFailingFetch()
      await report.start()

      expect(holdWarningMock).toHaveBeenCalledTimes(2)
      expect(releaseWarningMock).not.toHaveBeenCalled()
    })

    // No live power on the wire, and an air-to-air counter moves in
    // 100 Wh steps: the reading is the average of the last two closed
    // hours, the hour in progress left out of it.
    it('should average the last two closed hours and sum the local day', async () => {
      pinNow(instantOf('2026-03-18T11:20:00Z'))
      cleanMappingMock.mockReturnValue({
        measure_power: ['consumed'],
        'meter_power.daily': ['consumed'],
      })
      const getEnergySeriesMock = mockAtaFetch([
        // Before the local midnight (2026-03-17T23:00Z): excluded everywhere.
        point('2026-03-17T22:00:00Z', 0.1),
        // In the local day, before the two closed hours.
        point('2026-03-18T05:00:00Z', 0.1),
        // The two closed hours.
        point('2026-03-18T09:00:00Z', 0.1),
        point('2026-03-18T10:00:00Z', 0.3),
        // The hour in progress: in the day, not in the power.
        point('2026-03-18T11:00:00Z', 0.5),
      ])
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      // The read spans from the local midnight (earlier than now − 2 h).
      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2026-03-17T23:00:00Z',
        to: '2026-03-18T11:20:00Z',
      })
      // 0.4 kWh over the two closed hours → 200 W.
      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 200)
      // Since local midnight: 1 kWh.
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        1,
      )
    })

    // The library reads a garbled energy as `null`; the app counts it
    // as 0 like the Classic report's tags.
    it('should count a null energy as 0', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtaFetch([
        point('2026-03-18T09:00:00Z', null),
        point('2026-03-18T10:00:00Z', 0.1),
      ])
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 50)
    })

    // A sample without an instant cannot join any window: it is
    // dropped instead of polluting a sum it cannot date.
    it('should drop a sample without an instant', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtaFetch([point(null, 5), point('2026-03-18T10:00:00Z', 0.1)])
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 50)
    })

    it('should fall back to the consumed measure when the mapping lists none', async () => {
      cleanMappingMock.mockReturnValue({
        measure_power: [],
        'meter_power.daily': [],
      })
      mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 0)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        0,
      )
    })

    it('should span only the trailing window shortly after local midnight', async () => {
      // 01:00 CET: the local day started less than 2 h ago, so the power
      // window reaches back into yesterday and drives the fetch span.
      pinNow(
        Temporal.Instant.from('2026-03-18T01:00:00+01:00').epochMilliseconds,
      )
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledWith({
        from: '2026-03-17T22:00:00Z',
        to: '2026-03-18T00:00:00Z',
      })
    })

    it('should default empty total mappings to zeroed meters', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: [],
        'meter_power.cop': [],
      })
      mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 0)
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power.cop', 0)
    })

    it('should anchor the cursor without accruing on the first total run', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      // Cursor anchored at the horizon, an hour and four minutes back:
      // no bucket that started before the meter did is its to count.
      expect(setStoreValueMock).toHaveBeenCalledWith('energy_total_consumed', 0)
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-18T09:56:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 0)
    })

    // A bucket is counted once it has closed, an hour after its start,
    // and stood four minutes more.
    it('should accrue the settled hours past the cursor and advance it', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T07:45:00Z' : 1.5,
      )
      const getEnergySeriesMock = mockAtaFetch([
        // Started before the cursor: counted by an earlier run.
        point('2026-03-18T07:00:00Z', 0.1),
        point('2026-03-18T08:00:00Z', 0.2),
        point('2026-03-18T09:00:00Z', 0.3),
        // Closed on the hour, a moment ago: left for the next run.
        point('2026-03-18T10:00:00Z', 0.4),
      ])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2026-03-18T07:45:00Z',
        to: '2026-03-18T09:56:00Z',
      })
      expect(setStoreValueMock).toHaveBeenCalledWith('energy_total_consumed', 2)
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-18T09:56:00Z',
      )
      // The watermark is committed BEFORE the total: an interruption
      // between the two writes is permanent either way, and this order
      // undercounts by one window where the reverse overcounts.
      expect(setStoreValueMock.mock.calls.map(([key]) => key)).toStrictEqual([
        'energy_cursor_consumed',
        'energy_total_consumed',
      ])
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 2)
    })

    // Two runs meet on the watermark: the bucket that starts on it is
    // the later run's, so no hour is counted twice and none is skipped.
    it('should count each bucket once across consecutive runs', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      const store = new Map<string, unknown>([
        ['energy_cursor_consumed', '2026-03-18T07:00:00Z'],
        ['energy_total_consumed', 0],
      ])
      getStoreValueMock.mockImplementation((key: string) => store.get(key))
      setStoreValueMock.mockImplementation(async (key, value) => {
        await Promise.resolve()
        store.set(key, value)
      })
      mockAtaFetch([
        point('2026-03-18T07:00:00Z', 1),
        point('2026-03-18T08:00:00Z', 2),
        point('2026-03-18T09:00:00Z', 4),
      ])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      // Horizon 09:00: the 07:00 and 08:00 buckets.
      pinNow(instantOf('2026-03-18T10:04:00Z'))
      await report.start()

      expect(store.get('energy_total_consumed')).toBe(3)

      // Horizon 10:00: the 09:00 bucket, and nothing again.
      pinNow(instantOf('2026-03-18T11:04:00Z'))
      await report.start()

      expect(store.get('energy_total_consumed')).toBe(7)
      expect(store.get('energy_cursor_consumed')).toBe('2026-03-18T10:00:00Z')
    })

    // The report's slot is five past the hour: the hour that has just
    // closed is counted there, and not before it has stood its four
    // minutes.
    it.each([
      { minute: '05', outcome: 'count', total: 1.75 },
      { minute: '03', outcome: 'leave', total: 1.5 },
    ])(
      'should $outcome the hour that has just closed at :$minute',
      async ({ minute, total }) => {
        pinNow(instantOf(`2026-03-18T11:${minute}:00Z`))
        cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
        getStoreValueMock.mockImplementation((key: string) =>
          key === 'energy_cursor_consumed' ? '2026-03-18T09:30:00Z' : 1.5,
        )
        mockAtaFetch([point('2026-03-18T10:00:00Z', 0.25)])
        const report = new HomeEnergyReport(
          mockDevice(),
          totalConfig,
          ATA_ENERGY_STRATEGY,
        )
        await report.start()

        expect(setCapabilityValueMock).toHaveBeenCalledWith(
          'meter_power',
          total,
        )
      },
    )

    // Runs overlap: a settings change starts one while a timer's is in
    // flight. Each waits for the one before it, so the later run reads
    // the watermark the earlier one moved: fetching from the one it
    // found, it would count the same hour again.
    it('should not count a window twice when two runs overlap', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      const store = new Map<string, unknown>([
        ['energy_cursor_consumed', '2026-03-18T07:52:00Z'],
        ['energy_total_consumed', 100],
      ])
      getStoreValueMock.mockImplementation((key: string) => store.get(key))
      setStoreValueMock.mockImplementation(async (key, value) => {
        await Promise.resolve()
        store.set(key, value)
      })
      const answer = ok({ consumed: [point('2026-03-18T08:00:00Z', 1.5)] })
      const { promise: slowAnswer, resolve: answerSlow } =
        Promise.withResolvers<unknown>()
      const getEnergySeriesMock = vi
        .fn<(query: unknown) => Promise<unknown>>()
        .mockReturnValueOnce(slowAnswer)
        .mockResolvedValue(answer)
      ensureDeviceMock.mockResolvedValue({
        getEnergySeries: getEnergySeriesMock,
      })
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )

      const runs = [report.start(), report.start()]
      await settleDetached()
      answerSlow(answer)
      await Promise.all(runs)

      expect(store.get('energy_total_consumed')).toBe(101.5)
      expect(getEnergySeriesMock).toHaveBeenCalledTimes(1)
    })

    // The wire keeps about three months. A watermark from before that —
    // a Homey switched off for a season — starts at the floor: walked up
    // a week per run, it would ask windows the wire no longer has.
    it('should start a watermark older than the retention at its floor', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2025-06-01T00:00:00Z' : 10,
      )
      const getEnergySeriesMock = mockAtaFetch([
        point('2025-12-20T00:00:00Z', 0.5),
      ])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      // Ninety days before the horizon, and a week from there.
      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2025-12-18T09:56:00Z',
        to: '2025-12-25T09:56:00Z',
      })
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2025-12-25T09:56:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 10.5)
    })

    // A read costs one request per day of its window: a long downtime is
    // caught up a week per run, each run keeping what it counted.
    it('should catch up a week at most per run', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-01T00:00:00Z' : 10,
      )
      const getEnergySeriesMock = mockAtaFetch([
        point('2026-03-07T23:00:00Z', 0.5),
        // Past the week: the next run's.
        point('2026-03-08T00:00:00Z', 0.25),
      ])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-08T00:00:00Z',
      })
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-08T00:00:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 10.5)
    })

    // A Homey booting after a power cut can run with a clock still
    // behind, which puts the horizon in the past. Rewinding the
    // watermark there would have the next run re-accrue buckets already
    // counted, and a lifetime meter cannot unlearn invented energy.
    it('should keep the watermark when the clock has stepped back', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T12:00:00Z' : 1.5,
      )
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-18T12:00:00Z',
      )
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_total_consumed',
        1.5,
      )
    })

    it('should re-anchor a garbage cursor without accruing', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? 'not-a-timestamp' : 2,
      )
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 2)
    })

    it('should not fetch when the cursor already sits at the horizon', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T09:56:00Z' : 3,
      )
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATA_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 3)
    })
  })

  describe('with the ATW strategy', () => {
    // Its cadence always comes sooner than the first retry would.
    it('should not retry a five-minute report early', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockFailingFetch()
      const report = new HomeEnergyReport(
        mockDevice(),
        { ...fiveMinuteConfig, spread: SINGLE_INSTANT },
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(
        5 * MS_PER_MINUTE,
      )
    })

    // This unit's place in the minute is 59.793 s. Its run started at
    // 12:00:59.793 and ends two seconds later, in the next minute: the
    // next one is still five minutes after the first, not six.
    it('should keep its five minutes when a run ends in the next minute', async () => {
      pinNow(
        Temporal.Instant.from('2026-03-18T12:01:01.793+01:00')
          .epochMilliseconds,
      )
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({})
      const report = new HomeEnergyReport(
        mockDevice('f1e2d3c4-0000-4000-8000-000000000030'),
        fiveMinuteConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getMockCallArg<number>(setTimeoutMock, 0, 1)).toBe(
        5 * MS_PER_MINUTE - 2000,
      )
    })

    // The air-to-water hour in progress grows on the wire as it goes:
    // the reading averages the last closed hour and what has elapsed of
    // the current one, and one read answers both directions.
    it('should average the last closed hour and the hour in progress, per direction', async () => {
      pinNow(instantOf('2026-03-18T11:30:00Z'))
      cleanMappingMock.mockReturnValue({
        measure_power: ['consumed'],
        'measure_power.produced': ['produced'],
      })
      const getEnergySeriesMock = mockAtwFetch({
        consumed: [
          // Before the last closed hour: not in the reading.
          point('2026-03-18T09:00:00Z', 5),
          // Out of order on purpose: the buckets are placed by their start.
          point('2026-03-18T11:00:00Z', 0.25),
          point('2026-03-18T10:00:00Z', 0.5),
        ],
        produced: [
          point('2026-03-18T10:00:00Z', 2),
          point('2026-03-18T11:00:00Z', 1),
        ],
      })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2026-03-17T23:00:00Z',
        to: '2026-03-18T11:30:00Z',
      })
      // 0.75 kWh over an hour and a half → 500 W.
      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 500)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.produced',
        2000,
      )
    })

    // An hour the wire leaves out is an idle one: the last closed hour
    // is still averaged over the whole span.
    it('should average over the span when the hour in progress is idle', async () => {
      pinNow(instantOf('2026-03-18T11:30:00Z'))
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({ consumed: [point('2026-03-18T10:00:00Z', 0.6)] })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 400)
    })

    // The buckets start on the unit's own clock, a half hour off UTC in
    // some zones: the hour in progress is read off the buckets.
    it('should follow buckets that do not start on a round UTC hour', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({
        consumed: [
          point('2026-03-18T09:30:00Z', 0.5),
          point('2026-03-18T10:30:00Z', 0.25),
        ],
      })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      // 0.75 kWh from 09:30 to 11:00 → 500 W.
      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 500)
    })

    it('should read 0 W when the wire left out the last two hours', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({ consumed: [point('2026-03-18T09:00:00Z', 0.5)] })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 0)
    })

    it('should sum daily meters in kWh and derive the daily CoP', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.cop_daily': ['consumed', 'produced'],
        'meter_power.daily': ['consumed'],
        'meter_power.produced_daily': ['produced'],
      })
      mockAtwFetch({
        consumed: [
          // Before local midnight: excluded from every daily figure.
          point('2026-03-17T20:00:00Z', 9),
          point('2026-03-18T06:00:00Z', 2),
          point('2026-03-18T10:00:00Z', 0.5),
        ],
        produced: [
          point('2026-03-18T06:00:00Z', 7),
          point('2026-03-18T10:00:00Z', 0.5),
        ],
      })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        2.5,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.produced_daily',
        7.5,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.cop_daily',
        3,
      )
    })

    it('should treat missing telemetry directions as empty for the daily CoP', async () => {
      cleanMappingMock.mockReturnValue({ 'meter_power.cop_daily': [] })
      mockAtwFetch({})
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.cop_daily',
        0,
      )
    })

    it('should use 1 as the daily CoP divisor when nothing was consumed', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.cop_daily': ['consumed', 'produced'],
      })
      mockAtwFetch({ produced: [point('2026-03-18T06:00:00Z', 6)] })
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.cop_daily',
        6,
      )
    })

    it('should accrue both directions from one read and derive the total CoP', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['consumed'],
        'meter_power.cop': ['consumed', 'produced'],
        'meter_power.produced': ['produced'],
      })
      getStoreValueMock.mockImplementation((key: string) => {
        if (key.startsWith('energy_cursor')) {
          return '2026-03-18T08:00:00Z'
        }
        return key === 'energy_total_consumed' ? 2 : 6
      })
      const getEnergySeriesMock = mockAtwFetch({
        consumed: [point('2026-03-18T09:00:00Z', 1)],
        produced: [point('2026-03-18T09:00:00Z', 3)],
      })
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2026-03-18T08:00:00Z',
        to: '2026-03-18T09:56:00Z',
      })
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 3)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.produced',
        9,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power.cop', 3)
    })

    // The two meters keep a watermark each: the one read starts at the
    // older, and each direction counts from its own.
    it('should count each direction from its own watermark', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['consumed'],
        'meter_power.produced': ['produced'],
      })
      getStoreValueMock.mockImplementation((key: string) => {
        if (key === 'energy_cursor_consumed') {
          return '2026-03-18T07:45:00Z'
        }
        return key === 'energy_cursor_produced' ? '2026-03-18T08:45:00Z' : 0
      })
      const hours = [
        point('2026-03-18T08:00:00Z', 1),
        point('2026-03-18T09:00:00Z', 2),
      ]
      const getEnergySeriesMock = mockAtwFetch({
        consumed: hours,
        produced: hours,
      })
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledExactlyOnceWith({
        from: '2026-03-18T07:45:00Z',
        to: '2026-03-18T09:56:00Z',
      })
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 3)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.produced',
        2,
      )
    })

    // A meter that starts while the other is catching up counts nothing
    // of the downtime it never saw: its watermark opens at the horizon.
    it('should start a new meter at the horizon while another catches up', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['consumed'],
        'meter_power.produced': ['produced'],
      })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-01T00:00:00Z' : undefined,
      )
      const week = [point('2026-03-02T00:00:00Z', 4)]
      mockAtwFetch({ consumed: week, produced: week })
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-08T00:00:00Z',
      )
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_produced',
        '2026-03-18T09:56:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 4)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.produced',
        0,
      )
    })

    it('should use 1 as the total CoP divisor when nothing was consumed', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.cop': ['consumed', 'produced'],
      })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_total_produced' ? 5 : undefined,
      )
      mockAtwFetch({})
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power.cop', 5)
    })

    // The total report is a separate holder: its reason is its own, so
    // the regular report recovering never clears its warning.
    it('should hold the total report under its own reason', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T09:00:00Z' : 1.5,
      )
      mockFailingFetch()
      const report = new HomeEnergyReport(
        mockDevice(),
        totalConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()
      await report.start()
      await report.start()

      expect(holdWarningMock).toHaveBeenCalledWith('totalEnergyReports')
    })

    it('should schedule the next fire after a successful run', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({})
      const report = new HomeEnergyReport(
        mockDevice(),
        regularConfig,
        ATW_ENERGY_STRATEGY,
      )
      await report.start()

      expect(setTimeoutMock).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Number),
      )

      const timeoutCallback = getMockCallArg<() => void>(setTimeoutMock, 0, 0)
      timeoutCallback()
      await settleDetached()

      expect(setTimeoutMock).toHaveBeenCalledTimes(2)
    })
  })
})
