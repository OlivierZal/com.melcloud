import type * as Home from '@olivierzal/melcloud-api/home'
import type Homey from 'homey/lib/Homey'
import { err, ok } from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { EnergyReportConfig } from '../../drivers/base-report.mts'
import type { HomeMELCloudDevice } from '../../drivers/home-device.mts'
import { HomeEnergyReportAta } from '../../drivers/home-report-ata.mts'
import { HomeEnergyReportAtw } from '../../drivers/home-report-atw.mts'
import { getMockCallArg, mock } from '../helpers.ts'
import { createReportDeviceMocks, FAKE_NOW } from '../report-mocks.ts'

const {
  cleanMappingMock,
  clearTimeoutMock,
  ensureDeviceMock,
  setCapabilityValueMock,
  setTimeoutMock,
} = createReportDeviceMocks()
const getStoreValueMock = vi.fn<(key: string) => unknown>()
const setStoreValueMock =
  vi.fn<(key: string, value: unknown) => Promise<void>>()
const logMock = vi.fn<(...args: unknown[]) => void>()
const errorMock = vi.fn<(...args: unknown[]) => void>()

const regularConfig = {
  duration: { hours: 1 },
  mode: 'regular',
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const totalConfig = {
  duration: { hours: 1 },
  mode: 'total',
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const mockDevice = <T extends Home.DeviceType>(): HomeMELCloudDevice<T> =>
  mock<HomeMELCloudDevice<T>>({
    cleanMapping: cleanMappingMock,
    driver: { tagMappings: { energy: {} } },
    ensureDevice: ensureDeviceMock,
    error: errorMock,
    getStoreValue: getStoreValueMock,
    homey: mock<Homey.Homey>({
      clearTimeout: clearTimeoutMock,
      clock: mock<Homey.Homey['clock']>({
        getTimezone: vi.fn<() => string>(() => 'Europe/Paris'),
      }),
    }),
    log: logMock,
    setCapabilityValue: setCapabilityValueMock,
    setStoreValue: setStoreValueMock,
    setTimeout: setTimeoutMock,
  })

// One normalized series sample, the library's 55.2.0 shape: instant as
// epoch ms, energy in kWh — `null` on either field where the wire
// garbled it.
const point = (
  at: string | null,
  kilowattHours: number | null,
): Home.EnergySeriesPoint => ({
  atEpochMs: at === null ? null : Temporal.Instant.from(at).epochMilliseconds,
  kilowattHours,
})

const mockAtaFetch = (
  points: Home.EnergySeriesPoint[],
): ReturnType<typeof vi.fn> => {
  const getEnergySeriesMock = vi
    .fn<(query: unknown) => Promise<unknown>>()
    .mockResolvedValue(ok(points))
  ensureDeviceMock.mockResolvedValue({ getEnergySeries: getEnergySeriesMock })
  return getEnergySeriesMock
}

const mockAtwFetch = (perMeasure: {
  consumed?: Home.EnergySeriesPoint[]
  produced?: Home.EnergySeriesPoint[]
}): ReturnType<typeof vi.fn> => {
  // Synchronous mock of the async contract: awaiting a plain value works,
  // and a promise-returning arrow here would ping-pong between
  // promise-function-async's autofix and require-await.
  const getEnergySeriesMock = vi
    .fn<(query: { measure: 'consumed' | 'produced' }) => unknown>()
    .mockImplementation(({ measure }) => ok(perMeasure[measure] ?? []))
  ensureDeviceMock.mockResolvedValue({ getEnergySeries: getEnergySeriesMock })
  return getEnergySeriesMock
}

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
    vi.clearAllMocks()
    getStoreValueMock.mockReturnValue(undefined)
    setStoreValueMock.mockResolvedValue(undefined)
  })

  afterAll(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe(HomeEnergyReportAta, () => {
    it('should unschedule when no energy capability is enabled', async () => {
      cleanMappingMock.mockReturnValue({})
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(clearTimeoutMock).toHaveBeenCalledWith(null)
      expect(setTimeoutMock).not.toHaveBeenCalled()
    })

    it('should do nothing when the facade is unavailable', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      ensureDeviceMock.mockResolvedValue(null)
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(setCapabilityValueMock).not.toHaveBeenCalled()
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should log a wrapped error when the telemetry fetch fails', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      const getEnergySeriesMock = vi
        .fn<(query: unknown) => Promise<unknown>>()
        .mockResolvedValue(err({ kind: 'network' as const }))
      ensureDeviceMock.mockResolvedValue({
        getEnergySeries: getEnergySeriesMock,
      })
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        expect.objectContaining({
          message: 'MELCloud request failed: network',
        }),
      )
    })

    it('should average pulses over the trailing window and sum the local day', async () => {
      cleanMappingMock.mockReturnValue({
        measure_power: ['consumed'],
        'meter_power.daily': ['consumed'],
      })
      const getEnergySeriesMock = mockAtaFetch([
        // Before the local midnight (2026-03-17T23:00Z): excluded everywhere.
        point('2026-03-17T22:00:00Z', 0.1),
        // In the local day, before the trailing 2 h window (09:00Z).
        point('2026-03-18T05:00:00Z', 0.1),
        // In both the day and the power window.
        point('2026-03-18T10:30:00Z', 0.1),
        point('2026-03-18T10:59:00Z', 0.3),
      ])
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      // The fetch spans from the local midnight (earlier than now − 2 h).
      expect(getEnergySeriesMock).toHaveBeenCalledWith({
        from: '2026-03-17T23:00:00Z',
        interval: 'Minute',
        to: '2026-03-18T11:00:00Z',
      })
      // 0.4 kWh over the trailing 2 h → 200 W.
      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 200)
      // Since local midnight: 0.5 kWh.
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        0.5,
      )
    })

    // The library reads a garbled energy as `null`; the app counts it
    // as 0 like the Classic report's tags.
    it('should count a null energy as 0', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtaFetch([
        point('2026-03-18T10:30:00Z', null),
        point('2026-03-18T10:31:00Z', 0.1),
      ])
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 50)
    })

    // A sample without an instant cannot join any window: it is
    // dropped instead of polluting a sum it cannot date.
    it('should drop a sample without an instant', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtaFetch([point(null, 5), point('2026-03-18T10:31:00Z', 0.1)])
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 50)
    })

    it('should fall back to the consumed measure when the mapping lists none', async () => {
      cleanMappingMock.mockReturnValue({
        measure_power: [],
        'meter_power.daily': [],
      })
      mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
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
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledWith({
        from: '2026-03-17T22:00:00Z',
        interval: 'Minute',
        to: '2026-03-18T00:00:00Z',
      })

      pinNow(FAKE_NOW)
    })

    it('should default empty total mappings to zeroed meters', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: [],
        'meter_power.cop': [],
      })
      mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 0)
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power.cop', 0)
    })

    it('should anchor the cursor without accruing on the first total run', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      // Cursor anchored at now − 15 min; meter starts at 0.
      expect(setStoreValueMock).toHaveBeenCalledWith('energy_total_consumed', 0)
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-18T10:45:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 0)
    })

    it('should accrue strictly-later pulses and advance the cursor', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T09:00:00Z' : 1.5,
      )
      const getEnergySeriesMock = mockAtaFetch([
        // Exactly at the cursor: already counted by the previous run.
        point('2026-03-18T09:00:00Z', 0.1),
        point('2026-03-18T10:00:00Z', 0.2),
        // Beyond the safety margin (now − 15 min): left for the next run.
        point('2026-03-18T10:50:00Z', 0.4),
      ])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledWith({
        from: '2026-03-18T09:00:00Z',
        interval: 'Minute',
        to: '2026-03-18T10:45:00Z',
      })
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_total_consumed',
        1.7,
      )
      expect(setStoreValueMock).toHaveBeenCalledWith(
        'energy_cursor_consumed',
        '2026-03-18T10:45:00Z',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 1.7)
    })

    it('should re-anchor a garbage cursor without accruing', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? 'not-a-timestamp' : 2,
      )
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 2)
    })

    it('should not fetch when the cursor already sits at the safety margin', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T10:45:00Z' : 3,
      )
      const getEnergySeriesMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergySeriesMock).not.toHaveBeenCalled()
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 3)
    })
  })

  describe(HomeEnergyReportAtw, () => {
    it('should derive near-live power from the freshest minute bucket per direction', async () => {
      cleanMappingMock.mockReturnValue({
        measure_power: ['consumed'],
        'measure_power.produced': ['produced'],
      })
      const getEnergySeriesMock = mockAtwFetch({
        consumed: [
          // Out-of-order on purpose: the freshest bucket must win.
          point('2026-03-18T10:58:00Z', 0.05),
          point('2026-03-18T10:57:00Z', 0.2),
        ],
        produced: [point('2026-03-18T10:59:00Z', 0.15)],
      })
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
      await report.start()

      expect(getEnergySeriesMock).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 'Minute', measure: 'consumed' }),
      )
      expect(getEnergySeriesMock).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 'Minute', measure: 'produced' }),
      )
      // 0.05 kWh over one minute → 3 kW.
      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 3000)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.produced',
        9000,
      )
    })

    it('should report 0 W when the freshest bucket is older than the horizon', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({ consumed: [point('2026-03-18T10:00:00Z', 0.5)] })
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
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
          point('2026-03-18T10:58:00Z', 0.5),
        ],
        produced: [
          point('2026-03-18T06:30:00Z', 7),
          point('2026-03-18T10:59:00Z', 0.5),
        ],
      })
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
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
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
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
      mockAtwFetch({ produced: [point('2026-03-18T06:30:00Z', 6)] })
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.cop_daily',
        6,
      )
    })

    it('should accrue both directions and derive the total CoP', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['consumed'],
        'meter_power.cop': ['consumed', 'produced'],
        'meter_power.produced': ['produced'],
      })
      getStoreValueMock.mockImplementation((key: string) => {
        if (key.startsWith('energy_cursor')) {
          return '2026-03-18T10:00:00Z'
        }
        return key === 'energy_total_consumed' ? 2 : 6
      })
      mockAtwFetch({
        consumed: [point('2026-03-18T10:30:00Z', 1)],
        produced: [point('2026-03-18T10:30:00Z', 3)],
      })
      const report = new HomeEnergyReportAtw(mockDevice(), totalConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 3)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.produced',
        9,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power.cop', 3)
    })

    it('should use 1 as the total CoP divisor when nothing was consumed', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.cop': ['consumed', 'produced'],
      })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_total_produced' ? 5 : undefined,
      )
      mockAtwFetch({})
      const report = new HomeEnergyReportAtw(mockDevice(), totalConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power.cop', 5)
    })

    it('should schedule the next fire after a successful run', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtwFetch({})
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
      await report.start()

      expect(setTimeoutMock).toHaveBeenCalledWith(
        expect.any(Function),
        expect.anything(),
        'regular energy report',
      )

      const timeoutCallback = getMockCallArg<() => Promise<void>>(
        setTimeoutMock,
        0,
        0,
      )
      await timeoutCallback()

      expect(setTimeoutMock).toHaveBeenCalledTimes(2)
    })
  })
})
