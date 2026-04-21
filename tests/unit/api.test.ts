import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Settings } from '../../types/device-settings.mts'
import type { ZoneData } from '../../types/zone.mts'
import { mock } from '../helpers.js'

vi.mock(import('../../lib/classic-facade-manager.mts'), () => ({
  getClassicBuildings:
    vi.fn<
      (options?: { type?: Classic.DeviceType }) => Classic.BuildingZone[]
    >(),
}))

const { default: api } = await import('../../api.mts')

const mockApp = {
  updateClassicFrostProtection: vi.fn<() => Promise<void>>(),
  updateClassicHolidayMode: vi.fn<() => Promise<void>>(),
  updateDeviceSettings: vi.fn<() => Promise<void>>(),
}

const homey = mock<Homey>({ app: mockApp })

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Pass-through handlers (`return app.xxx(body)`) are covered by the TS
  // signature match — only behaviour that reshapes input is worth asserting.

  describe('updateDeviceSettings', () => {
    it('rewraps { body, query.driverId } into { driverId, settings }', async () => {
      const body = mock<Settings>({ always_on: true })
      mockApp.updateDeviceSettings.mockResolvedValue()

      await api.updateDeviceSettings({
        body,
        homey,
        query: { driverId: 'melcloud' },
      })

      expect(mockApp.updateDeviceSettings).toHaveBeenCalledWith({
        driverId: 'melcloud',
        settings: body,
      })
    })

    it('forwards undefined driverId unchanged', async () => {
      const body = mock<Settings>()
      mockApp.updateDeviceSettings.mockResolvedValue()

      await api.updateDeviceSettings({
        body,
        homey,
        query: { driverId: undefined },
      })

      expect(mockApp.updateDeviceSettings).toHaveBeenCalledWith({
        driverId: undefined,
        settings: body,
      })
    })
  })

  describe('updateClassicFrostProtection', () => {
    it('merges { body, ...params } as { settings, ...params }', async () => {
      const body = mock<Classic.FrostProtectionQuery>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.updateClassicFrostProtection.mockResolvedValue()

      await api.updateClassicFrostProtection({ body, homey, params })

      expect(mockApp.updateClassicFrostProtection).toHaveBeenCalledWith({
        settings: body,
        ...params,
      })
    })
  })

  describe('updateClassicHolidayMode', () => {
    it('merges { body, ...params } as { settings, ...params }', async () => {
      const body = mock<Classic.HolidayModeQuery>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.updateClassicHolidayMode.mockResolvedValue()

      await api.updateClassicHolidayMode({ body, homey, params })

      expect(mockApp.updateClassicHolidayMode).toHaveBeenCalledWith({
        settings: body,
        ...params,
      })
    })
  })
})
