import type {
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionQuery,
  HolidayModeData,
  HolidayModeQuery,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  DeviceSettings,
  DriverSetting,
  FormattedErrorLog,
  Settings,
  ZoneData,
} from '../../types/index.mts'
import { mock } from '../helpers.js'

const mockGetBuildings = vi.fn()

vi.mock(import('../../lib/index.mts'), () => ({
  getClassicBuildings: mockGetBuildings,
}))

const { default: api } = await import('../../api.mts')

const mockIsAuthenticated = vi.fn<() => boolean>()

const mockApp = {
  api: { isAuthenticated: mockIsAuthenticated },
  authenticateClassic: vi.fn<() => Promise<boolean>>(),
  authenticateHome: vi.fn<() => Promise<boolean>>(),
  getClassicErrorLog: vi.fn<() => Promise<FormattedErrorLog>>(),
  getClassicFrostProtection: vi.fn<() => Promise<FrostProtectionData>>(),
  getClassicHolidayMode: vi.fn<() => Promise<HolidayModeData>>(),
  getDeviceSettings: vi.fn<() => DeviceSettings>(),
  getDriverSettings: vi.fn<() => Partial<Record<string, DriverSetting[]>>>(),
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
      const buildings = [{ id: 1, name: 'Building 1' }]
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
    it('should delegate to app.getClassicErrorLog with query', async () => {
      const errorLog = mock<FormattedErrorLog>()
      const query = mock<ErrorLogQuery>()
      mockApp.getClassicErrorLog.mockResolvedValue(errorLog)

      const result = await api.getClassicErrorLog({ homey, query })

      expect(result).toBe(errorLog)
      expect(mockApp.getClassicErrorLog).toHaveBeenCalledWith(query)
    })
  })

  describe('frost protection settings retrieval', () => {
    it('should delegate to app.getClassicFrostProtection with params', async () => {
      const frostProtection = mock<FrostProtectionData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getClassicFrostProtection.mockResolvedValue(frostProtection)

      const result = await api.getClassicFrostProtection({ homey, params })

      expect(result).toBe(frostProtection)
      expect(mockApp.getClassicFrostProtection).toHaveBeenCalledWith(params)
    })
  })

  describe('holiday mode settings retrieval', () => {
    it('should delegate to app.getClassicHolidayMode with params', async () => {
      const holidayMode = mock<HolidayModeData>()
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
    it('should delegate to app.authenticateHome with body', async () => {
      mockApp.authenticateHome.mockResolvedValue(true)
      const body = mock<LoginCredentials>()

      const isLoggedIn = await api.authenticateHome({ body, homey })

      expect(isLoggedIn).toBe(true)
      expect(mockApp.authenticateHome).toHaveBeenCalledWith(body)
    })
  })

  describe('classic session retrieval', () => {
    it('should delegate to app.api.isAuthenticated', () => {
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

  describe('authentication', () => {
    it('should delegate to app.authenticateClassic with body', async () => {
      const credentials = mock<LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      mockApp.authenticateClassic.mockResolvedValue(true)

      const isLoggedIn = await api.authenticateClassic({
        body: credentials,
        homey,
      })

      expect(isLoggedIn).toBe(true)
      expect(mockApp.authenticateClassic).toHaveBeenCalledWith(credentials)
    })

    it('should return false on failed login', async () => {
      const credentials = mock<LoginCredentials>()
      mockApp.authenticateClassic.mockResolvedValue(false)

      const isLoggedIn = await api.authenticateClassic({
        body: credentials,
        homey,
      })

      expect(isLoggedIn).toBe(false)
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
      const body = mock<FrostProtectionQuery>()
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
      const body = mock<HolidayModeQuery>()
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
