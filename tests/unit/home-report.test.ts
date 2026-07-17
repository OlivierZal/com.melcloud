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

// 12:00 CET in Paris = 11:00Z; the local day started at 2026-03-17T23:00Z.
const FAKE_NOW = Temporal.Instant.from(
  '2026-03-18T12:00:00.000+01:00',
).epochMilliseconds

const setCapabilityValueMock =
  vi.fn<(capability: string, value: unknown) => Promise<void>>()
const ensureDeviceMock = vi.fn<() => Promise<unknown>>()
const cleanMappingMock = vi.fn<(mapping: unknown) => Record<string, unknown>>()
const clearTimeoutMock = vi.fn<(timeout: NodeJS.Timeout | null) => void>()
const setTimeoutMock = vi
  .fn<
    (
      callback: () => Promise<void>,
      interval: unknown,
      actionType: string,
    ) => number
  >()
  .mockReturnValue(1)
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

const point = (
  time: string,
  value: string,
): { time: string; value: string } => ({ time, value })

const telemetry = (
  values: { time: string; value: string }[],
): Home.EnergyData => ({
  measureData: [{ type: 'test', values }],
})

const mockAtaFetch = (
  values: { time: string; value: string }[],
): ReturnType<typeof vi.fn> => {
  const getEnergyMock = vi
    .fn<(query: unknown) => Promise<unknown>>()
    .mockResolvedValue(ok(telemetry(values)))
  ensureDeviceMock.mockResolvedValue({ getEnergy: getEnergyMock })
  return getEnergyMock
}

const mockAtwFetch = (perMeasure: {
  consumed?: { time: string; value: string }[]
  produced?: { time: string; value: string }[]
}): ReturnType<typeof vi.fn> => {
  // Synchronous mock of the async contract: awaiting a plain value works,
  // and a promise-returning arrow here would ping-pong between
  // promise-function-async's autofix and require-await.
  const getEnergyMock = vi
    .fn<(query: { measure: 'consumed' | 'produced' }) => unknown>()
    .mockImplementation(({ measure }) =>
      ok(telemetry(perMeasure[measure] ?? [])),
    )
  ensureDeviceMock.mockResolvedValue({ getEnergy: getEnergyMock })
  return getEnergyMock
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
      const getEnergyMock = vi
        .fn<(query: unknown) => Promise<unknown>>()
        .mockResolvedValue(err({ kind: 'network' as const }))
      ensureDeviceMock.mockResolvedValue({ getEnergy: getEnergyMock })
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
      const getEnergyMock = mockAtaFetch([
        // Before the local midnight (2026-03-17T23:00Z): excluded everywhere.
        point('2026-03-17 22:00:00.000000000', '100.0'),
        // In the local day, before the trailing 2 h window (09:00Z).
        point('2026-03-18 05:00:00.000000000', '100.0'),
        // In both the day and the power window.
        point('2026-03-18 10:30:00.000000000', '100.0'),
        point('2026-03-18 10:59:00.000000000', '300.0'),
      ])
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      // The fetch spans from the local midnight (earlier than now − 2 h).
      expect(getEnergyMock).toHaveBeenCalledWith({
        from: '2026-03-17T23:00:00Z',
        interval: 'Minute',
        to: '2026-03-18T11:00:00Z',
      })
      // 400 Wh over the trailing 2 h → 200 W.
      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 200)
      // 500 Wh since local midnight → 0.5 kWh.
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        0.5,
      )
    })

    it('should count non-finite pulse values as 0', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      mockAtaFetch([
        point('2026-03-18 10:30:00.000000000', 'garbage'),
        point('2026-03-18 10:31:00.000000000', '100.0'),
      ])
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
      const getEnergyMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(getEnergyMock).toHaveBeenCalledWith({
        from: '2026-03-17T22:00:00Z',
        interval: 'Minute',
        to: '2026-03-18T00:00:00Z',
      })

      pinNow(FAKE_NOW)
    })

    it('should report zeros when the telemetry payload has no measure entry', async () => {
      cleanMappingMock.mockReturnValue({ measure_power: ['consumed'] })
      const getEnergyMock = vi
        .fn<(query: unknown) => Promise<unknown>>()
        .mockResolvedValue(ok({ measureData: [] }))
      ensureDeviceMock.mockResolvedValue({ getEnergy: getEnergyMock })
      const report = new HomeEnergyReportAta(mockDevice(), regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 0)
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
      const getEnergyMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergyMock).not.toHaveBeenCalled()
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
      const getEnergyMock = mockAtaFetch([
        // Exactly at the cursor: already counted by the previous run.
        point('2026-03-18 09:00:00.000000000', '100.0'),
        point('2026-03-18 10:00:00.000000000', '200.0'),
        // Beyond the safety margin (now − 15 min): left for the next run.
        point('2026-03-18 10:50:00.000000000', '400.0'),
      ])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergyMock).toHaveBeenCalledWith({
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
      const getEnergyMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergyMock).not.toHaveBeenCalled()
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 2)
    })

    it('should not fetch when the cursor already sits at the safety margin', async () => {
      cleanMappingMock.mockReturnValue({ meter_power: ['consumed'] })
      getStoreValueMock.mockImplementation((key: string) =>
        key === 'energy_cursor_consumed' ? '2026-03-18T10:45:00Z' : 3,
      )
      const getEnergyMock = mockAtaFetch([])
      const report = new HomeEnergyReportAta(mockDevice(), totalConfig)
      await report.start()

      expect(getEnergyMock).not.toHaveBeenCalled()
      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 3)
    })
  })

  describe(HomeEnergyReportAtw, () => {
    it('should derive near-live power from the freshest minute bucket per direction', async () => {
      cleanMappingMock.mockReturnValue({
        measure_power: ['consumed'],
        'measure_power.produced': ['produced'],
      })
      const getEnergyMock = mockAtwFetch({
        consumed: [
          // Out-of-order on purpose: the freshest bucket must win.
          point('2026-03-18 10:58:00.000000000', '0.05'),
          point('2026-03-18 10:57:00.000000000', '0.2'),
        ],
        produced: [point('2026-03-18 10:59:00.000000000', '0.15')],
      })
      const report = new HomeEnergyReportAtw(mockDevice(), regularConfig)
      await report.start()

      expect(getEnergyMock).toHaveBeenCalledWith(
        expect.objectContaining({ interval: 'Minute', measure: 'consumed' }),
      )
      expect(getEnergyMock).toHaveBeenCalledWith(
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
      mockAtwFetch({
        consumed: [point('2026-03-18 10:00:00.000000000', '0.5')],
      })
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
          point('2026-03-17 20:00:00.000000000', '9.0'),
          point('2026-03-18 06:00:00.000000000', '2.0'),
          point('2026-03-18 10:58:00.000000000', '0.5'),
        ],
        produced: [
          point('2026-03-18 06:30:00.000000000', '7.0'),
          point('2026-03-18 10:59:00.000000000', '0.5'),
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
      mockAtwFetch({
        produced: [point('2026-03-18 06:30:00.000000000', '6.0')],
      })
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
        consumed: [point('2026-03-18 10:30:00.000000000', '1.0')],
        produced: [point('2026-03-18 10:30:00.000000000', '3.0')],
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
