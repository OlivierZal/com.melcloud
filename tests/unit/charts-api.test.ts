import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mock } from '../helpers.js'

const { default: api } = await import('../../widgets/charts/api.mts')

const mockApp = {
  error: vi.fn<(...args: readonly unknown[]) => void>(),
  getClassicDeviceZones: vi.fn<() => unknown[]>(),
  getClassicEnergyReport: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getClassicHourlyTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getClassicOperationModes: vi.fn<() => Promise<ReportChartPieOptions>>(),
  getClassicSignal: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getClassicTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getHomeDeviceZones: vi.fn<() => unknown[]>(),
  getHomeEnergyReport: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getHomeHourlyTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getHomeOperationModes: vi.fn<() => Promise<ReportChartPieOptions>>(),
  getHomeSignal: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getHomeTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('charts api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('webview boot logging', () => {
    it('should log the boot failure body via app.error', () => {
      api.logWebviewBoot({ body: { message: 'boom' }, homey })

      expect(mockApp.error).toHaveBeenCalledTimes(1)
    })
  })

  describe('device retrieval', () => {
    it('should list the Classic device zones without a type filter', () => {
      const zones = [
        { id: 2, level: 1, model: 'devices', name: 'Device 1 (Casa)' },
      ]
      mockApp.getClassicDeviceZones.mockReturnValue(zones)

      const result = api.getClassicDevices({ homey, query: {} })

      expect(result).toBe(zones)
      expect(mockApp.getClassicDeviceZones).toHaveBeenCalledWith(undefined)
    })

    it('should pass the numeric type filter through', () => {
      mockApp.getClassicDeviceZones.mockReturnValue([])

      api.getClassicDevices({ homey, query: { type: '0' } })

      expect(mockApp.getClassicDeviceZones).toHaveBeenCalledWith(0)
    })

    it('should throw on invalid device type', () => {
      expect(() =>
        api.getClassicDevices({ homey, query: { type: '99' as '0' } }),
      ).toThrow(RangeError)
    })
  })

  describe('hourly temperature retrieval', () => {
    it('should call app.getClassicHourlyTemperatures with hour number', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getClassicHourlyTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getClassicHourlyTemperatures({
        homey,
        params: { deviceId: 'dev1' },
        query: { hour: '10' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicHourlyTemperatures).toHaveBeenCalledWith({
        deviceId: 'dev1',
        hour: 10,
      })
    })

    it('should pass undefined when hour is undefined', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getClassicHourlyTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getClassicHourlyTemperatures({
        homey,
        params: { deviceId: 'dev1' },
        query: {},
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicHourlyTemperatures).toHaveBeenCalledWith({
        deviceId: 'dev1',
        hour: undefined,
      })
    })
  })

  describe('energy report retrieval', () => {
    it('should call app.getClassicEnergyReport with numeric days', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getClassicEnergyReport.mockResolvedValue(lineOptions)

      const result = await api.getClassicEnergyReport({
        homey,
        params: { deviceId: 'dev1' },
        query: { days: '7' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicEnergyReport).toHaveBeenCalledWith({
        days: 7,
        deviceId: 'dev1',
      })
    })

    it('should call app.getHomeEnergyReport with numeric days', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHomeEnergyReport.mockResolvedValue(lineOptions)

      const result = await api.getHomeEnergyReport({
        homey,
        params: { deviceId: 'guid-1' },
        query: { days: '30' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getHomeEnergyReport).toHaveBeenCalledWith({
        days: 30,
        deviceId: 'guid-1',
      })
    })
  })

  describe('home device retrieval', () => {
    it('should list the Home device zones without a type filter', () => {
      const zones = [
        { id: 'guid-1', level: 1, model: 'homeDevices', name: 'Garage' },
      ]
      mockApp.getHomeDeviceZones.mockReturnValue(zones)

      const result = api.getHomeDevices({ homey, query: {} })

      expect(result).toBe(zones)
      expect(mockApp.getHomeDeviceZones).toHaveBeenCalledWith(undefined)
    })

    it('should pass the Home device type filter through', () => {
      mockApp.getHomeDeviceZones.mockReturnValue([])

      api.getHomeDevices({ homey, query: { type: 'airToWater' } })

      expect(mockApp.getHomeDeviceZones).toHaveBeenCalledWith('airToWater')
    })

    it('should throw on an invalid Home device type', () => {
      expect(() =>
        api.getHomeDevices({
          homey,
          query: { type: 'submarine' as 'airToAir' },
        }),
      ).toThrow(RangeError)
    })
  })

  describe('home chart retrieval', () => {
    it('should call app.getHomeTemperatures with numeric days', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHomeTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getHomeTemperatures({
        homey,
        params: { deviceId: 'guid-1' },
        query: { days: '1' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getHomeTemperatures).toHaveBeenCalledWith({
        days: 1,
        deviceId: 'guid-1',
      })
    })

    it('should call app.getHomeOperationModes with numeric days', async () => {
      const pieOptions = mock<ReportChartPieOptions>()
      mockApp.getHomeOperationModes.mockResolvedValue(pieOptions)

      const result = await api.getHomeOperationModes({
        homey,
        params: { deviceId: 'guid-1' },
        query: { days: '7' },
      })

      expect(result).toBe(pieOptions)
      expect(mockApp.getHomeOperationModes).toHaveBeenCalledWith({
        days: 7,
        deviceId: 'guid-1',
      })
    })

    it('should call app.getHomeHourlyTemperatures with hour number', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHomeHourlyTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getHomeHourlyTemperatures({
        homey,
        params: { deviceId: 'guid-1' },
        query: { hour: '10' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getHomeHourlyTemperatures).toHaveBeenCalledWith({
        deviceId: 'guid-1',
        hour: 10,
      })
    })

    it('should default the hourly-temperatures hour when absent', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHomeHourlyTemperatures.mockResolvedValue(lineOptions)

      await api.getHomeHourlyTemperatures({
        homey,
        params: { deviceId: 'guid-1' },
        query: {},
      })

      expect(mockApp.getHomeHourlyTemperatures).toHaveBeenCalledWith({
        deviceId: 'guid-1',
        hour: undefined,
      })
    })

    it('should call app.getHomeSignal with hour number', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHomeSignal.mockResolvedValue(lineOptions)

      await api.getHomeSignal({
        homey,
        params: { deviceId: 'guid-1' },
        query: { hour: '5' },
      })

      expect(mockApp.getHomeSignal).toHaveBeenCalledWith({
        deviceId: 'guid-1',
        hour: 5,
      })
    })

    it('should call app.getHomeSignal, defaulting the hour', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHomeSignal.mockResolvedValue(lineOptions)

      const result = await api.getHomeSignal({
        homey,
        params: { deviceId: 'guid-1' },
        query: {},
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getHomeSignal).toHaveBeenCalledWith({
        deviceId: 'guid-1',
        hour: undefined,
      })
    })
  })

  describe('language retrieval', () => {
    it('should return the language from i18n', () => {
      mockI18n.getLanguage.mockReturnValue('nl')

      const result = api.getLanguage({ homey })

      expect(result).toBe('nl')
      expect(mockI18n.getLanguage).toHaveBeenCalledTimes(1)
    })
  })

  describe('operation mode retrieval', () => {
    it('should call app.getClassicOperationModes with numeric days', async () => {
      const pieOptions = mock<ReportChartPieOptions>()
      mockApp.getClassicOperationModes.mockResolvedValue(pieOptions)

      const result = await api.getClassicOperationModes({
        homey,
        params: { deviceId: 'dev1' },
        query: { days: '7' },
      })

      expect(result).toBe(pieOptions)
      expect(mockApp.getClassicOperationModes).toHaveBeenCalledWith({
        days: 7,
        deviceId: 'dev1',
      })
    })
  })

  describe('signal retrieval', () => {
    it('should call app.getClassicSignal with hour number', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getClassicSignal.mockResolvedValue(lineOptions)

      const result = await api.getClassicSignal({
        homey,
        params: { deviceId: 'dev1' },
        query: { hour: '5' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicSignal).toHaveBeenCalledWith({
        deviceId: 'dev1',
        hour: 5,
      })
    })

    it('should pass undefined when hour is undefined', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getClassicSignal.mockResolvedValue(lineOptions)

      const result = await api.getClassicSignal({
        homey,
        params: { deviceId: 'dev1' },
        query: {},
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicSignal).toHaveBeenCalledWith({
        deviceId: 'dev1',
        hour: undefined,
      })
    })
  })

  describe('temperature retrieval', () => {
    it('should call app.getClassicTemperatures with numeric days', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getClassicTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getClassicTemperatures({
        homey,
        params: { deviceId: 'dev1' },
        query: { days: '30' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicTemperatures).toHaveBeenCalledWith({
        days: 30,
        deviceId: 'dev1',
      })
    })
  })
})
