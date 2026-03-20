import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mock } from '../helpers.js'

const mockGetZones = vi.fn()

vi.mock('../../lib/index.mts', () => ({
  getZones: mockGetZones,
}))

const { default: api } = await import('../../widgets/charts/api.mts')

const mockApp = {
  getHourlyTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getOperationModes: vi.fn<() => Promise<ReportChartPieOptions>>(),
  getSignal: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const homey = mock<Homey>({ app: mockApp, i18n: mockI18n } as never)

describe('charts api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDevices', () => {
    it('should return only device zones without type filter', () => {
      const zones = [
        { id: 1, level: 0, model: 'buildings' as const, name: 'Building 1' },
        { id: 2, level: 1, model: 'devices' as const, name: 'Device 1' },
        { id: 3, level: 1, model: 'devices' as const, name: 'Device 2' },
      ]
      mockGetZones.mockReturnValue(zones)

      const result = api.getDevices({ query: { type: undefined } })

      expect(result).toStrictEqual([
        { id: 2, level: 1, model: 'devices', name: 'Device 1' },
        { id: 3, level: 1, model: 'devices', name: 'Device 2' },
      ])
      expect(mockGetZones).toHaveBeenCalledWith({ type: undefined })
    })

    it('should pass numeric type filter', () => {
      const zones = [
        { id: 2, level: 1, model: 'devices' as const, name: 'Device 1' },
      ]
      mockGetZones.mockReturnValue(zones)

      const result = api.getDevices({ query: { type: '0' } })

      expect(result).toStrictEqual([
        { id: 2, level: 1, model: 'devices', name: 'Device 1' },
      ])
      expect(mockGetZones).toHaveBeenCalledWith({ type: 0 })
    })

    it('should return empty array when no device zones exist', () => {
      const zones = [
        { id: 1, level: 0, model: 'buildings' as const, name: 'Building 1' },
      ]
      mockGetZones.mockReturnValue(zones)

      const result = api.getDevices({ query: { type: undefined } })

      expect(result).toStrictEqual([])
    })
  })

  describe('getHourlyTemperatures', () => {
    it('should call app.getHourlyTemperatures with hour number', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHourlyTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getHourlyTemperatures({
        homey,
        params: { deviceId: 'dev1' },
        query: { hour: '10' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getHourlyTemperatures).toHaveBeenCalledWith('dev1', 10)
    })

    it('should pass undefined when hour is undefined', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getHourlyTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getHourlyTemperatures({
        homey,
        params: { deviceId: 'dev1' },
        query: { hour: undefined },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getHourlyTemperatures).toHaveBeenCalledWith(
        'dev1',
        undefined,
      )
    })
  })

  describe('getLanguage', () => {
    it('should return the language from i18n', () => {
      mockI18n.getLanguage.mockReturnValue('nl')

      const result = api.getLanguage({ homey })

      expect(result).toBe('nl')
      expect(mockI18n.getLanguage).toHaveBeenCalledTimes(1)
    })
  })

  describe('getOperationModes', () => {
    it('should call app.getOperationModes with numeric days', async () => {
      const pieOptions = mock<ReportChartPieOptions>()
      mockApp.getOperationModes.mockResolvedValue(pieOptions)

      const result = await api.getOperationModes({
        homey,
        params: { deviceId: 'dev1' },
        query: { days: '7' },
      })

      expect(result).toBe(pieOptions)
      expect(mockApp.getOperationModes).toHaveBeenCalledWith('dev1', 7)
    })
  })

  describe('getSignal', () => {
    it('should call app.getSignal with hour number', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getSignal.mockResolvedValue(lineOptions)

      const result = await api.getSignal({
        homey,
        params: { deviceId: 'dev1' },
        query: { hour: '5' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getSignal).toHaveBeenCalledWith('dev1', 5)
    })

    it('should pass undefined when hour is undefined', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getSignal.mockResolvedValue(lineOptions)

      const result = await api.getSignal({
        homey,
        params: { deviceId: 'dev1' },
        query: { hour: undefined },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getSignal).toHaveBeenCalledWith('dev1', undefined)
    })
  })

  describe('getTemperatures', () => {
    it('should call app.getTemperatures with numeric days', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getTemperatures({
        homey,
        params: { deviceId: 'dev1' },
        query: { days: '30' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getTemperatures).toHaveBeenCalledWith('dev1', 30)
    })
  })
})
