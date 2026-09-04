import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mock } from '../helpers.ts'
import {
  createWidgetApiHarness,
  describeWebviewBootLogging,
} from '../widget-api.ts'

const { default: api } = await import('../../widgets/charts/api.mts')

const mockApp = {
  error: vi.fn<(...args: readonly unknown[]) => void>(),
  getDeviceZones: vi.fn<() => unknown[]>(),
  getTargetEnergyReport: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getTargetHourlyTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getTargetOperationModes: vi.fn<() => Promise<ReportChartPieOptions>>(),
  getTargetSignal: vi.fn<() => Promise<ReportChartLineOptions>>(),
  getTargetTemperatures: vi.fn<() => Promise<ReportChartLineOptions>>(),
}

const { homey, mockI18n } = createWidgetApiHarness(mockApp)

describe('charts api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describeWebviewBootLogging(() => {
    api.logWebviewBoot({ body: { message: 'boom' }, homey })
  }, mockApp.error)

  describe('device retrieval', () => {
    it('should serve the one merged device-zone list', () => {
      const zones = [
        {
          deviceType: 'ata',
          id: 2,
          level: 1,
          model: 'devices',
          name: 'Device 1 (Casa)',
        },
        {
          buildingName: 'Huis',
          deviceType: 'atw',
          id: 'guid-1',
          level: 1,
          model: 'homeDevices',
          name: 'Warmtepomp (Huis)',
        },
      ]
      mockApp.getDeviceZones.mockReturnValue(zones)

      const result = api.getDevices({ homey })

      expect(result).toBe(zones)
      expect(mockApp.getDeviceZones).toHaveBeenCalledTimes(1)
    })
  })

  describe('hourly temperature retrieval', () => {
    it.each(['devices_1', 'homeDevices_guid-1'])(
      'should delegate %s to app.getTargetHourlyTemperatures',
      async (targetId) => {
        const lineOptions = mock<ReportChartLineOptions>()
        mockApp.getTargetHourlyTemperatures.mockResolvedValue(lineOptions)

        const result = await api.getTargetHourlyTemperatures({
          homey,
          params: { targetId },
        })

        expect(result).toBe(lineOptions)
        expect(mockApp.getTargetHourlyTemperatures).toHaveBeenCalledWith(
          targetId,
        )
      },
    )
  })

  describe('energy report retrieval', () => {
    it.each(['devices_1', 'homeDevices_guid-1'])(
      'should call app.getTargetEnergyReport for %s with numeric days',
      async (targetId) => {
        const lineOptions = mock<ReportChartLineOptions>()
        mockApp.getTargetEnergyReport.mockResolvedValue(lineOptions)

        const result = await api.getTargetEnergyReport({
          homey,
          params: { targetId },
          query: { days: '7' },
        })

        expect(result).toBe(lineOptions)
        expect(mockApp.getTargetEnergyReport).toHaveBeenCalledWith({
          days: 7,
          targetId,
        })
      },
    )

    it('should reject an out-of-range day count', async () => {
      await expect(
        api.getTargetEnergyReport({
          homey,
          params: { targetId: 'devices_1' },
          query: { days: '9999' },
        }),
      ).rejects.toThrow(RangeError)
      expect(mockApp.getTargetEnergyReport).not.toHaveBeenCalled()
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
    it('should call app.getTargetOperationModes with numeric days', async () => {
      const pieOptions = mock<ReportChartPieOptions>()
      mockApp.getTargetOperationModes.mockResolvedValue(pieOptions)

      const result = await api.getTargetOperationModes({
        homey,
        params: { targetId: 'devices_1' },
        query: { days: '7' },
      })

      expect(result).toBe(pieOptions)
      expect(mockApp.getTargetOperationModes).toHaveBeenCalledWith({
        days: 7,
        targetId: 'devices_1',
      })
    })
  })

  describe('signal retrieval', () => {
    it.each(['devices_1', 'homeDevices_guid-1'])(
      'should delegate %s to app.getTargetSignal',
      async (targetId) => {
        const lineOptions = mock<ReportChartLineOptions>()
        mockApp.getTargetSignal.mockResolvedValue(lineOptions)

        const result = await api.getTargetSignal({
          homey,
          params: { targetId },
        })

        expect(result).toBe(lineOptions)
        expect(mockApp.getTargetSignal).toHaveBeenCalledWith(targetId)
      },
    )
  })

  describe('temperature retrieval', () => {
    it('should call app.getTargetTemperatures with numeric days', async () => {
      const lineOptions = mock<ReportChartLineOptions>()
      mockApp.getTargetTemperatures.mockResolvedValue(lineOptions)

      const result = await api.getTargetTemperatures({
        homey,
        params: { targetId: 'devices_1' },
        query: { days: '30' },
      })

      expect(result).toBe(lineOptions)
      expect(mockApp.getTargetTemperatures).toHaveBeenCalledWith({
        days: 30,
        targetId: 'devices_1',
      })
    })
  })

  describe('webview hashes', () => {
    it('should serve the packaged manifest map', async () => {
      // A dev suite run packages no manifest: the empty map is the
      // documented fresh-by-default answer.
      await expect(api.getWebviewHashes()).resolves.toStrictEqual({})
    })
  })
})
