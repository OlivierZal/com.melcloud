import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceSettings, Settings } from '../../types/device-settings.mts'
import type { DriverSetting } from '../../types/driver-settings.mts'
import type {
  ClassicErrorLogQueryParams,
  FormattedErrorLog,
} from '../../types/error-log.mts'
import type { ZoneData } from '../../types/zone.mts'
import { mock } from '../helpers.js'

const mockGetBuildings =
  vi.fn<(options?: { type?: Classic.DeviceType }) => Classic.BuildingZone[]>()

vi.mock(import('../../lib/classic-facade-manager.mts'), () => ({
  getClassicBuildings: mockGetBuildings,
}))

const { default: api } = await import('../../api.mts')

const mockIsAuthenticated = vi.fn<() => boolean>()
const mockIsHomeAuthenticated = vi.fn<() => boolean>()
const mockClassicAuthenticate = vi.fn<() => Promise<void>>()
const mockHomeAuthenticate = vi.fn<() => Promise<void>>()

const mockApp = {
  classicApi: {
    authenticate: mockClassicAuthenticate,
    isAuthenticated: mockIsAuthenticated,
  },
  getClassicErrorLog: vi.fn<() => Promise<FormattedErrorLog>>(),
  getClassicFrostProtection:
    vi.fn<() => Promise<Classic.FrostProtectionData>>(),
  getClassicHolidayMode: vi.fn<() => Promise<Classic.HolidayModeData>>(),
  getDeviceSettings: vi.fn<() => DeviceSettings>(),
  getDriverSettings: vi.fn<() => Partial<Record<string, DriverSetting[]>>>(),
  homeApi: {
    authenticate: mockHomeAuthenticate,
    isAuthenticated: mockIsHomeAuthenticated,
  },
  updateClassicFrostProtection: vi.fn<() => Promise<void>>(),
  updateClassicHolidayMode: vi.fn<() => Promise<void>>(),
  updateDeviceSettings: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('building retrieval', () => {
    it('should delegate to getClassicBuildings', () => {
      const buildings = [
        { id: 1, name: 'ClassicBuilding 1' },
      ] as unknown as Classic.BuildingZone[]
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getClassicBuildings()

      expect(result).toBe(buildings)
      expect(mockGetBuildings).toHaveBeenCalledTimes(1)
    })
  })

  describe('device settings retrieval', () => {
    it('should delegate to app.getDeviceSettings', () => {
      const deviceSettings = mock<DeviceSettings>()
      mockApp.getDeviceSettings.mockReturnValue(deviceSettings)

      const result = api.getDeviceSettings({ homey })

      expect(result).toBe(deviceSettings)
      expect(mockApp.getDeviceSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('driver settings retrieval', () => {
    it('should delegate to app.getDriverSettings', () => {
      const driverSettings = mock<Partial<Record<string, DriverSetting[]>>>()
      mockApp.getDriverSettings.mockReturnValue(driverSettings)

      const result = api.getDriverSettings({ homey })

      expect(result).toBe(driverSettings)
      expect(mockApp.getDriverSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('error retrieval', () => {
    it('should parse numeric query params before delegating to app.getClassicErrorLog', async () => {
      const errorLog = mock<FormattedErrorLog>()
      const query = mock<ClassicErrorLogQueryParams>({
        from: '2026-01-01',
        offset: '2',
        period: '7',
        to: '2026-01-31',
      })
      mockApp.getClassicErrorLog.mockResolvedValue(errorLog)

      const result = await api.getClassicErrorLog({ homey, query })

      expect(result).toBe(errorLog)
      expect(mockApp.getClassicErrorLog).toHaveBeenCalledWith({
        from: '2026-01-01',
        offset: 2,
        period: 7,
        to: '2026-01-31',
      })
    })

    it('should pass undefined for missing numeric query params', async () => {
      const errorLog = mock<FormattedErrorLog>()
      mockApp.getClassicErrorLog.mockResolvedValue(errorLog)

      await api.getClassicErrorLog({
        homey,
        query: mock<Partial<ClassicErrorLogQueryParams>>(),
      })

      expect(mockApp.getClassicErrorLog).toHaveBeenCalledWith({
        from: undefined,
        offset: undefined,
        period: undefined,
        to: undefined,
      })
    })
  })

  describe('frost protection settings retrieval', () => {
    it('should delegate to app.getClassicFrostProtection with params', async () => {
      const frostProtection = mock<Classic.FrostProtectionData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getClassicFrostProtection.mockResolvedValue(frostProtection)

      const result = await api.getClassicFrostProtection({ homey, params })

      expect(result).toBe(frostProtection)
      expect(mockApp.getClassicFrostProtection).toHaveBeenCalledWith(params)
    })
  })

  describe('holiday mode settings retrieval', () => {
    it('should delegate to app.getClassicHolidayMode with params', async () => {
      const holidayMode = mock<Classic.HolidayModeData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getClassicHolidayMode.mockResolvedValue(holidayMode)

      const result = await api.getClassicHolidayMode({ homey, params })

      expect(result).toBe(holidayMode)
      expect(mockApp.getClassicHolidayMode).toHaveBeenCalledWith(params)
    })
  })

  describe('language retrieval', () => {
    it('should return the language from i18n', () => {
      mockI18n.getLanguage.mockReturnValue('en')

      const result = api.getLanguage({ homey })

      expect(result).toBe('en')
      expect(mockI18n.getLanguage).toHaveBeenCalledTimes(1)
    })

    it('should return non-English language', () => {
      mockI18n.getLanguage.mockReturnValue('fr')

      const result = api.getLanguage({ homey })

      expect(result).toBe('fr')
    })
  })

  describe('home authentication', () => {
    it('should delegate to app.homeApi.authenticate with body', async () => {
      mockHomeAuthenticate.mockResolvedValue()
      const body = mock<LoginCredentials>()

      await api.homeAuthenticate({ body, homey })

      expect(mockHomeAuthenticate).toHaveBeenCalledWith(body)
    })

    it('should propagate errors from app.homeApi.authenticate', async () => {
      const error = new Error('invalid credentials')
      mockHomeAuthenticate.mockRejectedValue(error)

      await expect(
        api.homeAuthenticate({ body: mock<LoginCredentials>(), homey }),
      ).rejects.toThrow(error)
    })
  })

  describe('classic session retrieval', () => {
    it('should delegate to app.classicApi.isAuthenticated', () => {
      mockIsAuthenticated.mockReturnValue(true)

      const isAuthenticated = api.isClassicAuthenticated({ homey })

      expect(isAuthenticated).toBe(true)
      expect(mockIsAuthenticated).toHaveBeenCalledTimes(1)
    })

    it('should return false when not authenticated', () => {
      mockIsAuthenticated.mockReturnValue(false)

      const isAuthenticated = api.isClassicAuthenticated({ homey })

      expect(isAuthenticated).toBe(false)
    })
  })

  describe('home session retrieval', () => {
    it('should delegate to app.homeApi.isAuthenticated', () => {
      mockIsHomeAuthenticated.mockReturnValue(true)

      const isAuthenticated = api.isHomeAuthenticated({ homey })

      expect(isAuthenticated).toBe(true)
      expect(mockIsHomeAuthenticated).toHaveBeenCalledTimes(1)
    })

    it('should return false when not authenticated', () => {
      mockIsHomeAuthenticated.mockReturnValue(false)

      const isAuthenticated = api.isHomeAuthenticated({ homey })

      expect(isAuthenticated).toBe(false)
    })
  })

  describe('authentication', () => {
    it('should delegate to app.classicApi.authenticate with body', async () => {
      const credentials = mock<LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      mockClassicAuthenticate.mockResolvedValue()

      await api.classicAuthenticate({ body: credentials, homey })

      expect(mockClassicAuthenticate).toHaveBeenCalledWith(credentials)
    })

    it('should propagate errors from app.classicApi.authenticate', async () => {
      const error = new Error('invalid credentials')
      mockClassicAuthenticate.mockRejectedValue(error)

      await expect(
        api.classicAuthenticate({
          body: mock<LoginCredentials>(),
          homey,
        }),
      ).rejects.toThrow(error)
    })
  })

  describe('device settings update', () => {
    it('should delegate to app.updateDeviceSettings with body and driverId', async () => {
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

    it('should pass undefined driverId', async () => {
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

  describe('frost protection settings update', () => {
    it('should delegate to app.updateClassicFrostProtection', async () => {
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

  describe('holiday mode settings update', () => {
    it('should delegate to app.updateClassicHolidayMode', async () => {
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
