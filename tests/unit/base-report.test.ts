/* eslint-disable
    @typescript-eslint/consistent-type-imports,
    @typescript-eslint/strict-void-return,
*/
import type { DeviceType, EnergyDataAta } from '@olivierzal/melcloud-api'

import { DateTime, Settings } from 'luxon'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BaseMELCloudDevice } from '../../drivers/base-device.mts'
import type { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import type { EnergyCapabilityTagMapping } from '../../types/index.mts'

import {
  type EnergyReportConfig,
  EnergyReport,
} from '../../drivers/base-report.mts'
import { assertDefined, mock } from '../helpers.ts'

type TestDeviceType = typeof DeviceType.Ata

const FAKE_NOW_MILLIS = DateTime.fromISO('2026-03-18T12:00:00.000').toMillis()

const setCapabilityValueMock = vi.fn()
const fetchDeviceMock = vi.fn()
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

const mockDriver = mock<BaseMELCloudDriver<TestDeviceType>>({
  consumedTagMapping: { measure_power: ['Auto', 'Cooling'] },
  energyCapabilityTagMapping,
  producedTagMapping: {},
})

const mockDevice = mock<BaseMELCloudDevice<TestDeviceType>>({
  cleanMapping: cleanMappingMock,
  driver: mockDriver,
  error: errorMock,
  fetchDevice: fetchDeviceMock,
  homey: mock<import('homey').Homey>({
    clearInterval: clearIntervalMock,
    clearTimeout: clearTimeoutMock,
  }),
  log: logMock,
  setCapabilityValue: setCapabilityValueMock,
  setInterval: setIntervalMock,
  setTimeout: setTimeoutMock,
})

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

  describe('handle', () => {
    it('should unschedule when no energy capability tag entries', async () => {
      cleanMappingMock.mockReturnValue({})
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(clearTimeoutMock).toHaveBeenCalled()
    })

    it('should fetch energy data and schedule when entries exist', async () => {
      const getEnergyMock = vi.fn().mockResolvedValue({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      })
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: getEnergyMock,
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(getEnergyMock).toHaveBeenCalled()
      expect(setTimeoutMock).toHaveBeenCalled()
    })

    it('should log error when getEnergy fails', async () => {
      const energyError = new Error('fetch failed')
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockRejectedValue(energyError),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(errorMock).toHaveBeenCalledWith(
        'Energy report fetch failed:',
        energyError,
      )
      expect(setTimeoutMock).toHaveBeenCalled()
    })

    it('should not schedule twice', async () => {
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue({
          Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
        }),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()
      await report.handle()

      expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    })

    it('should handle null device from fetchDevice', async () => {
      fetchDeviceMock.mockResolvedValue(null)
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(setTimeoutMock).toHaveBeenCalled()
    })
  })

  describe('unschedule', () => {
    it('should clear timeout and interval', () => {
      const report = new EnergyReport(mockDevice, regularConfig)
      report.unschedule()

      expect(clearTimeoutMock).toHaveBeenCalled()
      expect(logMock).toHaveBeenCalledWith(
        'regular energy report has been cancelled',
      )
    })
  })

  describe('energy value calculations', () => {
    it('should set power values using hourly data', async () => {
      const energyData = mock<EnergyDataAta>({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 100],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50],
      })
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalled()
    })

    it('should calculate energy values for total mode using total entries', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      const energyData = mock<EnergyDataAta>({
        TotalAutoConsumed: 100,
        TotalCoolingConsumed: 50,
      })
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalled()
    })

    it('should use zero fallback when hourly array element is undefined', async () => {
      const sparseArray: (number | undefined)[] = []
      const energyData = {
        Auto: sparseArray,
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
      } as unknown as EnergyDataAta
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalled()
    })

    it('should handle non-array tag data by skipping power calculation', async () => {
      const energyData = {
        Auto: 100,
        Cooling: 50,
      } as unknown as EnergyDataAta
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('measure_power', 0)
    })

    it('should handle UsageDisclaimerPercentages for linked device count', async () => {
      const energyData = mock<EnergyDataAta>({
        Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 100],
        Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50],
        UsageDisclaimerPercentages: '50,50',
      })
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalled()
    })
  })

  describe('energy value for non-power non-cop entries', () => {
    it('should calculate energy values by summing tags and dividing by device count', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      const energyData = mock<EnergyDataAta>({
        TotalAutoConsumed: 100,
        TotalCoolingConsumed: 50,
      })
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, {
        duration: { hours: 1 },
        interval: { hours: 1 },
        minus: { hours: 1 },
        mode: 'total',
        values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
      })
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalledWith('meter_power', 150)
    })
  })

  describe('total mode', () => {
    it('should pass undefined from for total mode energy requests', async () => {
      cleanMappingMock.mockReturnValue({
        meter_power: ['TotalAutoConsumed'],
      })
      const getEnergyMockLocal = vi.fn().mockResolvedValue(
        mock<EnergyDataAta>({
          TotalAutoConsumed: 100,
        }),
      )
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: getEnergyMockLocal,
      })
      const report = new EnergyReport(mockDevice, totalConfig)
      await report.handle()

      expect(getEnergyMockLocal).toHaveBeenCalledWith(
        expect.objectContaining({ from: undefined }),
      )
    })
  })

  describe('#schedule interval setup', () => {
    it('should call setInterval inside setTimeout callback', async () => {
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue({
          Auto: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          Cooling: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5],
        }),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      const timeoutCallback = setTimeoutMock.mock.calls.at(0)?.at(0) as
        | (() => Promise<void>)
        | undefined
      assertDefined(timeoutCallback)
      await timeoutCallback()

      expect(setIntervalMock).toHaveBeenCalled()

      const intervalCallback = setIntervalMock.mock.calls.at(0)?.at(0) as
        | (() => Promise<void>)
        | undefined
      assertDefined(intervalCallback)
      await intervalCallback()

      expect(fetchDeviceMock).toHaveBeenCalled()
    })
  })

  // eslint-disable-next-line vitest/prefer-lowercase-title
  describe('COP calculation', () => {
    const createCopMocks = (): BaseMELCloudDevice<TestDeviceType> => {
      const copConsumed = {
        'measure_power.cop': ['ConsumedTag'],
      } as unknown as Partial<EnergyCapabilityTagMapping<TestDeviceType>>
      const copProduced = {
        'measure_power.cop': ['ProducedTag'],
      } as unknown as Partial<EnergyCapabilityTagMapping<TestDeviceType>>
      const copEnergyMapping = {
        'measure_power.cop': ['ProducedTag', 'ConsumedTag'],
      } as unknown as EnergyCapabilityTagMapping<TestDeviceType>
      const copDriver = mock<BaseMELCloudDriver<TestDeviceType>>({
        consumedTagMapping: copConsumed,
        energyCapabilityTagMapping: copEnergyMapping,
        producedTagMapping: copProduced,
      })
      return mock<BaseMELCloudDevice<TestDeviceType>>({
        cleanMapping: vi.fn().mockReturnValue({
          'measure_power.cop': ['ProducedTag', 'ConsumedTag'],
        }),
        driver: copDriver,
        fetchDevice: fetchDeviceMock,
        homey: mock<import('homey').Homey>({
          clearInterval: clearIntervalMock,
          clearTimeout: clearTimeoutMock,
        }),
        log: logMock,
        setCapabilityValue: setCapabilityValueMock,
        setInterval: setIntervalMock,
        setTimeout: setTimeoutMock,
      })
    }

    it('should calculate COP as produced / consumed', async () => {
      const mockDeviceWithCop = createCopMocks()
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue({
          ConsumedTag: 2,
          ProducedTag: 6,
        }),
      })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        3,
      )
    })

    it('should use 1 as divisor when consumed is 0', async () => {
      const mockDeviceWithCop = createCopMocks()
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue({
          ConsumedTag: 0,
          ProducedTag: 5,
        }),
      })
      const report = new EnergyReport(mockDeviceWithCop, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_power.cop',
        5,
      )
    })
  })

  // eslint-disable-next-line vitest/prefer-lowercase-title
  describe('UsageDisclaimerPercentages divides by device count', () => {
    it('should divide energy values by linked device count', async () => {
      cleanMappingMock.mockReturnValue({
        'meter_power.daily': ['TotalAutoConsumed', 'TotalCoolingConsumed'],
      })
      const energyData = mock<EnergyDataAta>({
        TotalAutoConsumed: 100,
        TotalCoolingConsumed: 50,
        UsageDisclaimerPercentages: '50,50',
      })
      fetchDeviceMock.mockResolvedValue({
        data: {},
        getEnergy: vi.fn().mockResolvedValue(energyData),
      })
      const report = new EnergyReport(mockDevice, regularConfig)
      await report.handle()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'meter_power.daily',
        75,
      )
    })
  })
})
