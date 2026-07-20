import type * as Classic from '@olivierzal/melcloud-api/classic'
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
import type { ClassicMELCloudDevice } from '../../drivers/classic-device.mts'
import type { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import type { Homey } from '../../lib/homey.mts'
import type { EnergyCapabilityTagMapping } from '../../types/capabilities.mts'
import { EnergyReport } from '../../drivers/classic-report.mts'
import { getMockCallArg, mock } from '../helpers.ts'

type TestDeviceType = typeof Classic.DeviceType.Ata

const FAKE_NOW = Temporal.Instant.from(
  '2026-03-18T12:00:00.000+01:00',
).epochMilliseconds

const setCapabilityValueMock =
  vi.fn<(capability: string, value: unknown) => Promise<void>>()
const ensureDeviceMock = vi.fn<() => Promise<unknown>>()
const cleanMappingMock = vi.fn<(mapping: unknown) => Record<string, unknown>>()
const clearTimeoutMock = vi.fn<(timeout: NodeJS.Timeout | null) => void>()
const clearIntervalMock =
  vi.fn<(interval: NodeJS.Timeout | undefined) => void>()
const setTimeoutMock = vi
  .fn<
    (
      callback: () => Promise<void>,
      interval: unknown,
      actionType: string,
    ) => number
  >()
  .mockReturnValue(1)
const setIntervalMock = vi
  .fn<
    (
      callback: () => Promise<void>,
      interval: unknown,
      actionType: string,
    ) => number
  >()
  .mockReturnValue(2)
const logMock = vi.fn<(...args: unknown[]) => void>()
const errorMock = vi.fn<(...args: unknown[]) => void>()
const setWarningMock = vi.fn<(warning: string | null) => Promise<void>>()
const translateMock = vi.fn<(key: string) => string>((key) => key)

const regularConfig = {
  duration: { hours: 1 },
  minus: { hours: 1 },
  mode: 'regular',
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const totalConfig = {
  duration: { days: 1 },
  minus: { hours: 1 },
  mode: 'total',
  values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const energyTagMapping = mock<EnergyCapabilityTagMapping<TestDeviceType>>({
  measure_power: ['Auto', 'Cooling'],
  'meter_power.daily': ['TotalAutoConsumed', 'TotalCoolingConsumed'],
})

const mockDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
  consumedTagMapping: { measure_power: ['Auto', 'Cooling'] },
  producedTagMapping: {},
  tagMappings: { energy: energyTagMapping },
})

const mockDevice = mock<ClassicMELCloudDevice<TestDeviceType>>({
  cleanMapping: cleanMappingMock,
  driver: mockDriver,
  ensureDevice: ensureDeviceMock,
  error: errorMock,
  homey: mock<Homey.Homey>({
    __: translateMock,
    clearInterval: clearIntervalMock,
    clearTimeout: clearTimeoutMock,
    clock: mock<Homey.Homey['clock']>({
      getTimezone: vi.fn<() => string>(() => 'Europe/Paris'),
    }),
  }),
  log: logMock,
  setCapabilityValue: setCapabilityValueMock,
  setInterval: setIntervalMock,
  setTimeout: setTimeoutMock,
  setWarning: setWarningMock,
})

const mockEnergyFetch = (energyData: unknown): ReturnType<typeof vi.fn> => {
  const getEnergyMock = vi
    .fn<(query?: unknown) => Promise<unknown>>()
    .mockResolvedValue(ok(energyData))
  ensureDeviceMock.mockResolvedValue({ data: {}, getEnergy: getEnergyMock })
  return getEnergyMock
}

const mockFailingFetch = (): void => {
  ensureDeviceMock.mockResolvedValue({
    data: {},
    getEnergy: vi
      .fn<(query?: unknown) => Promise<unknown>>()
      .mockResolvedValue(err({ kind: 'network' as const })),
  })
}

const createCopMocks = (
  hasTagMappings = true,
): ClassicMELCloudDevice<TestDeviceType> => {
  const copConsumed = {
    'measure_power.cop': ['ConsumedTag'],
  } as unknown as Partial<EnergyCapabilityTagMapping<TestDeviceType>>
  const copProduced = {
    'measure_power.cop': ['ProducedTag'],
  } as unknown as Partial<EnergyCapabilityTagMapping<TestDeviceType>>
  const copEnergyMapping = {
    'measure_power.cop': ['ProducedTag', 'ConsumedTag'],
  } as unknown as EnergyCapabilityTagMapping<TestDeviceType>
  const copDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
    consumedTagMapping: hasTagMappings ? copConsumed : {},
    producedTagMapping: hasTagMappings ? copProduced : {},
    tagMappings: { energy: copEnergyMapping },
  })
  return mock<ClassicMELCloudDevice<TestDeviceType>>({
    cleanMapping: vi
      .fn<(mapping: unknown) => Record<string, unknown>>()
      .mockReturnValue({
        'measure_power.cop': ['ProducedTag', 'ConsumedTag'],
      }),
    driver: copDriver,
    ensureDevice: ensureDeviceMock,
    homey: mock<Homey.Homey>({
      clearInterval: clearIntervalMock,
      clearTimeout: clearTimeoutMock,
      clock: mock<Homey.Homey['clock']>({
        getTimezone: vi.fn<() => string>(() => 'Europe/Paris'),
      }),
    }),
    log: logMock,
    setCapabilityValue: setCapabilityValueMock,
    setInterval: setIntervalMock,
    setTimeout: setTimeoutMock,
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
    vi.clearAllMocks()
    cleanMappingMock.mockReturnValue({
      measure_power: ['Auto', 'Cooling'],
    })
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

      expect(clearTimeoutMock).toHaveBeenCalledWith(null)
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

    it('should log wrapped error when getEnergy fails', async () => {
      const energyError = { kind: 'network' as const }
      ensureDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi
          .fn<(query?: unknown) => Promise<unknown>>()
          .mockResolvedValue(err(energyError)),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        expect.objectContaining({
          cause: energyError,
          message: 'MELCloud request failed: network',
        }),
      )
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should log error and still schedule when setCapabilityValue throws', async () => {
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

  describe('failure warning and success logging', () => {
    const validEnergyData = {
      Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
    }

    it('should warn the device once after three consecutive failures', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()

      expect(setWarningMock).not.toHaveBeenCalled()

      await report.start()
      await report.start()

      expect(setWarningMock).toHaveBeenCalledTimes(1)
      expect(setWarningMock).toHaveBeenCalledWith('errors.energyReportsFailing')
    })

    it('should clear the warning and reset the streak on the next success', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()
      await report.start()
      mockEnergyFetch(validEnergyData)
      await report.start()

      expect(setWarningMock).toHaveBeenCalledTimes(2)
      expect(setWarningMock).toHaveBeenLastCalledWith(null)
    })

    it('should not warn when successes interleave the failures', async () => {
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()
      mockEnergyFetch(validEnergyData)
      await report.start()
      mockFailingFetch()
      await report.start()
      await report.start()

      expect(setWarningMock).not.toHaveBeenCalled()
    })

    it('should keep the chain alive when the warning update itself fails', async () => {
      setWarningMock.mockRejectedValueOnce(new Error('ipc down'))
      mockFailingFetch()
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()
      await report.start()
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Failed to update the device warning:',
        expect.any(Error),
      )
      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
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

      expect(clearTimeoutMock).toHaveBeenCalledWith(null)
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
      mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          Auto: 100,
          Cooling: 50,
        }),
      )
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
          TotalCoolingConsumed: undefined as unknown as number,
        }),
      )
      const report = new EnergyReport(mockDevice, {
        duration: { hours: 1 },
        minus: { hours: 1 },
        mode: 'total',
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
        values: { millisecond: 0, minute: 5, second: 0 },
      })
      await report.start()

      expect(getEnergyMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-03-18', to: '2026-03-18' }),
      )
    })
  })

  describe('total mode', () => {
    it('should omit from for total mode energy requests', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed'],
      })
      const getEnergyMockLocal = mockEnergyFetch(
        mock<Classic.EnergyDataAta>({
          TotalAutoConsumed: 100,
        }),
      )
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()

      expect(getEnergyMockLocal).toHaveBeenCalledWith({ to: '2026-03-18' })
    })
  })

  describe('wall-clock re-anchoring', () => {
    it('should re-arm a fresh timeout after each fire instead of a fixed interval', async () => {
      mockEnergyFetch({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      const timeoutCallback = getMockCallArg<() => Promise<void>>(
        setTimeoutMock,
        0,
        0,
      )
      await timeoutCallback()

      expect(setIntervalMock).not.toHaveBeenCalled()
      expect(setTimeoutMock).toHaveBeenCalledTimes(2)
      expect(setTimeoutMock).toHaveBeenLastCalledWith(
        expect.any(Function),
        expect.anything(),
        'regular energy report',
      )

      const secondCallback = getMockCallArg<() => Promise<void>>(
        setTimeoutMock,
        1,
        0,
      )
      await secondCallback()

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
      const firstDelay = getMockCallArg<Temporal.Duration>(setTimeoutMock, 0, 1)

      expect(firstDelay.total({ unit: 'minutes' })).toBe(35)

      pinNow(
        Temporal.Instant.from('2026-03-29T03:05:00+02:00').epochMilliseconds,
      )
      const timeoutCallback = getMockCallArg<() => Promise<void>>(
        setTimeoutMock,
        0,
        0,
      )
      await timeoutCallback()

      // Re-anchored on the new wall clock: next fire at 04:05 CEST, a full hour.
      const secondDelay = getMockCallArg<Temporal.Duration>(
        setTimeoutMock,
        1,
        1,
      )

      expect(secondDelay.total({ unit: 'minutes' })).toBe(60)

      pinNow(FAKE_NOW)
    })

    it('should stop the chain when unscheduled during a fire', async () => {
      mockEnergyFetch({ Auto: [0], Cooling: [0] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      const timeoutCallback = getMockCallArg<() => Promise<void>>(
        setTimeoutMock,
        0,
        0,
      )
      report.unschedule()
      await timeoutCallback()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should unschedule from a fire once every energy capability is disabled', async () => {
      mockEnergyFetch({ Auto: [0], Cooling: [0] })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      cleanMappingMock.mockReturnValue({})
      const timeoutCallback = getMockCallArg<() => Promise<void>>(
        setTimeoutMock,
        0,
        0,
      )
      await timeoutCallback()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report has been cancelled',
      )
    })
  })

  describe('coefficient of performance calculation', () => {
    it('should calculate COP as produced / consumed', async () => {
      const mockDeviceWithCop = createCopMocks()
      mockEnergyFetch({ ConsumedTag: 2, ProducedTag: 6 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        3,
      )
    })

    it('should use 1 as divisor when consumed is 0', async () => {
      const mockDeviceWithCop = createCopMocks()
      mockEnergyFetch({ ConsumedTag: 0, ProducedTag: 5 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        5,
      )
    })

    it('should default to empty tag lists when mappings lack the capability', async () => {
      const mockDeviceWithCop = createCopMocks(false)
      mockEnergyFetch({ ConsumedTag: 2, ProducedTag: 6 })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        0,
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
