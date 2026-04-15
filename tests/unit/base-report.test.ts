import type { DeviceType, EnergyDataAta } from '@olivierzal/melcloud-api'
import { DateTime, Settings } from 'luxon'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicMELCloudDevice } from '../../drivers/classic-device.mts'
import type { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import type { Homey } from '../../lib/homey.mts'
import type { EnergyCapabilityTagMapping } from '../../types/capabilities.mts'
import {
  type EnergyReportConfig,
  EnergyReport,
} from '../../drivers/base-report.mts'
import { getMockCallArg, mock } from '../helpers.ts'

type TestDeviceType = typeof DeviceType.Ata

const FAKE_NOW_MILLIS = DateTime.fromISO('2026-03-18T12:00:00.000').toMillis()

const setCapabilityValueMock = vi.fn()
const ensureDeviceMock = vi.fn()
const cleanMappingMock = vi.fn()
const clearTimeoutMock = vi.fn()
const clearIntervalMock = vi.fn()
const setTimeoutMock = vi.fn().mockReturnValue(1)
const setIntervalMock = vi.fn().mockReturnValue(2)
const logMock = vi.fn()
const errorMock = vi.fn()

const regularConfig = {
  duration: { hours: 1 },
  interval: { hours: 1 },
  minus: { hours: 1 },
  mode: 'regular',
  values: { millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const totalConfig = {
  duration: { days: 1 },
  interval: { days: 1 },
  minus: { hours: 1 },
  mode: 'total',
  values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
} satisfies EnergyReportConfig

const energyCapabilityTagMapping = mock<
  EnergyCapabilityTagMapping<TestDeviceType>
>({
  measure_power: ['Auto', 'Cooling'],
  'meter_power.daily': ['TotalAutoConsumed', 'TotalCoolingConsumed'],
})

const mockDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
  consumedTagMapping: { measure_power: ['Auto', 'Cooling'] },
  energyCapabilityTagMapping,
  producedTagMapping: {},
})

const mockDevice = mock<ClassicMELCloudDevice<TestDeviceType>>({
  cleanMapping: cleanMappingMock,
  driver: mockDriver,
  ensureDevice: ensureDeviceMock,
  error: errorMock,
  homey: mock<Homey.Homey>({
    clearInterval: clearIntervalMock,
    clearTimeout: clearTimeoutMock,
  }),
  log: logMock,
  setCapabilityValue: setCapabilityValueMock,
  setInterval: setIntervalMock,
  setTimeout: setTimeoutMock,
})

const mockEnergyFetch = (energyData: unknown): ReturnType<typeof vi.fn> => {
  const getEnergyMock = vi.fn().mockResolvedValue(energyData)
  ensureDeviceMock.mockResolvedValue({ data: {}, getEnergy: getEnergyMock })
  return getEnergyMock
}

const createCopMocks = (): ClassicMELCloudDevice<TestDeviceType> => {
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
    consumedTagMapping: copConsumed,
    energyCapabilityTagMapping: copEnergyMapping,
    producedTagMapping: copProduced,
  })
  return mock<ClassicMELCloudDevice<TestDeviceType>>({
    cleanMapping: vi.fn().mockReturnValue({
      'measure_power.cop': ['ProducedTag', 'ConsumedTag'],
    }),
    driver: copDriver,
    ensureDevice: ensureDeviceMock,
    homey: mock<Homey.Homey>({
      clearInterval: clearIntervalMock,
      clearTimeout: clearTimeoutMock,
    }),
    log: logMock,
    setCapabilityValue: setCapabilityValueMock,
    setInterval: setIntervalMock,
    setTimeout: setTimeoutMock,
  })
}

describe(EnergyReport, () => {
  beforeAll(() => {
    Settings.now = (): number => FAKE_NOW_MILLIS
  })

  beforeEach(() => {
    vi.clearAllMocks()
    cleanMappingMock.mockReturnValue({
      measure_power: ['Auto', 'Cooling'],
    })
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

    it('should log error when getEnergy fails', async () => {
      const energyError = new Error('fetch failed')
      ensureDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockRejectedValue(energyError),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.start()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        energyError,
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

  describe('unscheduling', () => {
    it('should clear timeout and interval', () => {
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
        mock<EnergyDataAta>({
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
        mock<EnergyDataAta>({
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
        mock<EnergyDataAta>({
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
        mock<EnergyDataAta>({
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
        mock<EnergyDataAta>({
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
        mock<EnergyDataAta>({
          TotalAutoConsumed: 100,
          TotalCoolingConsumed: 50,
        }),
      )
      const report = new EnergyReport(mockDevice, {
        duration: { hours: 1 },
        interval: { hours: 1 },
        minus: { hours: 1 },
        mode: 'total',
        values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
      })
      await report.start()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 150)
    })
  })

  describe('total mode', () => {
    it('should pass undefined from for total mode energy requests', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed'],
      })
      const getEnergyMockLocal = mockEnergyFetch(
        mock<EnergyDataAta>({
          TotalAutoConsumed: 100,
        }),
      )
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.start()

      expect(getEnergyMockLocal).toHaveBeenCalledWith(
        expect.objectContaining({ from: undefined }),
      )
    })
  })

  describe('interval scheduling', () => {
    it('should call setInterval inside setTimeout callback', async () => {
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

      expect(setIntervalMock).toHaveBeenCalledWith(
        expect.any(Function),
        { hours: 1 },
        'regular energy report',
      )

      const intervalCallback = getMockCallArg<() => Promise<void>>(
        setIntervalMock,
        0,
        0,
      )
      await intervalCallback()

      expect(ensureDeviceMock).toHaveBeenCalledWith()
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
  })

  describe('usageDisclaimerPercentages divides by device count', () => {
    it('should divide energy values by linked device count', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.daily': ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      mockEnergyFetch(
        mock<EnergyDataAta>({
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
