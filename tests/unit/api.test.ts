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
  getBuildings: mockGetBuildings,
}))

const { default: api } = await import('../../api.mts')

const mockIsAuthenticated = vi.fn<() => boolean>()

const mockApp = {
  api: { isAuthenticated: mockIsAuthenticated },
  createHomeSession: vi.fn<() => Promise<boolean>>(),
  createSession: vi.fn<() => Promise<boolean>>(),
  getDeviceSettings: vi.fn<() => DeviceSettings>(),
  getDriverSettings: vi.fn<() => Partial<Record<string, DriverSetting[]>>>(),
  getErrors: vi.fn<() => Promise<FormattedErrorLog>>(),
  getFrostProtection: vi.fn<() => Promise<FrostProtectionData>>(),
  getHolidayMode: vi.fn<() => Promise<HolidayModeData>>(),
  setDeviceSettings: vi.fn<() => Promise<void>>(),
  setFrostProtection: vi.fn<() => Promise<void>>(),
  setHolidayMode: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('building retrieval', () => {
    it('should delegate to getBuildings', () => {
      const buildings = [{ id: 1, name: 'Building 1' }]
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getBuildings()

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
    it('should delegate to app.getErrors with query', async () => {
      const errorLog = mock<FormattedErrorLog>()
      const query = mock<ErrorLogQuery>()
      mockApp.getErrors.mockResolvedValue(errorLog)

      const result = await api.getErrors({ homey, query })

      expect(result).toBe(errorLog)
      expect(mockApp.getErrors).toHaveBeenCalledWith(query)
    })
  })

  describe('frost protection settings retrieval', () => {
    it('should delegate to app.getFrostProtection with params', async () => {
      const frostProtection = mock<FrostProtectionData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getFrostProtection.mockResolvedValue(frostProtection)

      const result = await api.getFrostProtection({ homey, params })

      expect(result).toBe(frostProtection)
      expect(mockApp.getFrostProtection).toHaveBeenCalledWith(params)
    })
  })

  describe('holiday mode settings retrieval', () => {
    it('should delegate to app.getHolidayMode with params', async () => {
      const holidayMode = mock<HolidayModeData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getHolidayMode.mockResolvedValue(holidayMode)

      const result = await api.getHolidayMode({ homey, params })

      expect(result).toBe(holidayMode)
      expect(mockApp.getHolidayMode).toHaveBeenCalledWith(params)
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
    it('should delegate to app.createHomeSession with body', async () => {
      mockApp.createHomeSession.mockResolvedValue(true)
      const body = mock<LoginCredentials>()

      const isLoggedIn = await api.createHomeSession({ body, homey })

      expect(isLoggedIn).toBe(true)
      expect(mockApp.createHomeSession).toHaveBeenCalledWith(body)
    })
  })

  describe('classic session retrieval', () => {
    it('should delegate to app.api.isAuthenticated', () => {
      mockIsAuthenticated.mockReturnValue(true)

      const isAuthenticated = api.getClassicSession({ homey })

      expect(isAuthenticated).toBe(true)
      expect(mockIsAuthenticated).toHaveBeenCalledTimes(1)
    })

    it('should return false when not authenticated', () => {
      mockIsAuthenticated.mockReturnValue(false)

      const isAuthenticated = api.getClassicSession({ homey })

      expect(isAuthenticated).toBe(false)
    })
  })

  describe('authentication', () => {
    it('should delegate to app.createSession with body', async () => {
      const credentials = mock<LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      mockApp.createSession.mockResolvedValue(true)

      const isLoggedIn = await api.createSession({ body: credentials, homey })

      expect(isLoggedIn).toBe(true)
      expect(mockApp.createSession).toHaveBeenCalledWith(credentials)
    })

    it('should return false on failed login', async () => {
      const credentials = mock<LoginCredentials>()
      mockApp.createSession.mockResolvedValue(false)

      const isLoggedIn = await api.createSession({ body: credentials, homey })

      expect(isLoggedIn).toBe(false)
    })
  })

  describe('device settings update', () => {
    it('should delegate to app.setDeviceSettings with body and driverId', async () => {
      const body = mock<Settings>({ always_on: true })
      mockApp.setDeviceSettings.mockResolvedValue()

      await api.setDeviceSettings({
        body,
        homey,
        query: { driverId: 'melcloud' },
      })

      expect(mockApp.setDeviceSettings).toHaveBeenCalledWith({
        driverId: 'melcloud',
        settings: body,
      })
    })

    it('should pass undefined driverId', async () => {
      const body = mock<Settings>()
      mockApp.setDeviceSettings.mockResolvedValue()

      await api.setDeviceSettings({
        body,
        homey,
        query: { driverId: undefined },
      })

      expect(mockApp.setDeviceSettings).toHaveBeenCalledWith({
        driverId: undefined,
        settings: body,
      })
    })
  })

  describe('frost protection settings update', () => {
    it('should delegate to app.setFrostProtection', async () => {
      const body = mock<FrostProtectionQuery>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.setFrostProtection.mockResolvedValue()

      await api.setFrostProtection({ body, homey, params })

      expect(mockApp.setFrostProtection).toHaveBeenCalledWith({
        settings: body,
        ...params,
      })
    })
  })

  describe('holiday mode settings update', () => {
    it('should delegate to app.setHolidayMode', async () => {
      const body = mock<HolidayModeQuery>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.setHolidayMode.mockResolvedValue()

      await api.setHolidayMode({ body, homey, params })

      expect(mockApp.setHolidayMode).toHaveBeenCalledWith({
        settings: body,
        ...params,
      })
    })
  })
})
