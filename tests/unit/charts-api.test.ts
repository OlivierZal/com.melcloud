import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mock } from '../helpers.js'

const mockGetClassicZones = vi.fn()

vi.mock(
  import('../../lib/classic-facade-manager.mts'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    getClassicZones: mockGetClassicZones,
  }),
)

const { default: api } = await import('../../widgets/charts/api.mts')

const mockApp = {
  getClassicHourlyTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getClassicOperationModes: vi.fn<() => Promise<ReportChartPieOptions>>(),
  getClassicSignal: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getClassicTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('charts api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('device retrieval', () => {
    it('should return only device zones without type filter', () => {
      const zones = [
        {
          id: 1,
          level: 0,
          model: 'buildings' as const,
          name: 'ClassicBuilding 1',
        },
        { id: 2, level: 1, model: 'devices' as const, name: 'Device 1' },
        { id: 3, level: 1, model: 'devices' as const, name: 'Device 2' },
      ]
      mockGetClassicZones.mockReturnValue(zones)

      const result = api.getClassicDevices({ query: { type: undefined } })

      expect(result).toStrictEqual([
        { id: 2, level: 1, model: 'devices', name: 'Device 1' },
        { id: 3, level: 1, model: 'devices', name: 'Device 2' },
      ])
      expect(mockGetClassicZones).toHaveBeenCalledWith({ type: undefined })
    })

    it('should pass numeric type filter', () => {
      const zones = [
        { id: 2, level: 1, model: 'devices' as const, name: 'Device 1' },
      ]
      mockGetClassicZones.mockReturnValue(zones)

      const result = api.getClassicDevices({ query: { type: '0' } })

      expect(result).toStrictEqual([
        { id: 2, level: 1, model: 'devices', name: 'Device 1' },
      ])
      expect(mockGetClassicZones).toHaveBeenCalledWith({ type: 0 })
    })

    it('should throw on invalid device type', () => {
      expect(() =>
        api.getClassicDevices({ query: { type: '99' as '0' } }),
      ).toThrow(RangeError)
    })

    it('should return empty array when no device zones exist', () => {
      const zones = [
        {
          id: 1,
          level: 0,
          model: 'buildings' as const,
          name: 'ClassicBuilding 1',
        },
      ]
      mockGetClassicZones.mockReturnValue(zones)

      const result = api.getClassicDevices({ query: { type: undefined } })

      expect(result).toStrictEqual([])
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
        query: { hour: undefined },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getClassicHourlyTemperatures).toHaveBeenCalledWith({
        deviceId: 'dev1',
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
        query: { hour: undefined },
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
