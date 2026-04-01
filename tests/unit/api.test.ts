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

const mockApp = {
  getDeviceSettings: vi.fn<() => DeviceSettings>(),
  getDriverSettings: vi.fn<() => Partial<Record<string, DriverSetting[]>>>(),
  getErrorLog: vi.fn<() => Promise<FormattedErrorLog>>(),
  getFrostProtectionSettings: vi.fn<() => Promise<FrostProtectionData>>(),
  getHolidayModeSettings: vi.fn<() => Promise<HolidayModeData>>(),
  homeLogin: vi.fn<() => Promise<boolean>>(),
  login: vi.fn<() => Promise<boolean>>(),
  setDeviceSettings: vi.fn<() => Promise<void>>(),
  setFrostProtectionSettings: vi.fn<() => Promise<void>>(),
  setHolidayModeSettings: vi.fn<() => Promise<void>>(),
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
    it('should delegate to app.getErrorLog with query', async () => {
      const errorLog = mock<FormattedErrorLog>()
      const query = mock<ErrorLogQuery>()
      mockApp.getErrorLog.mockResolvedValue(errorLog)

      const result = await api.getErrorLog({ homey, query })

      expect(result).toBe(errorLog)
      expect(mockApp.getErrorLog).toHaveBeenCalledWith(query)
    })
  })

  describe('frost protection settings retrieval', () => {
    it('should delegate to app.getFrostProtectionSettings with params', async () => {
      const frostProtection = mock<FrostProtectionData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getFrostProtectionSettings.mockResolvedValue(frostProtection)

      const result = await api.getFrostProtectionSettings({ homey, params })

      expect(result).toBe(frostProtection)
      expect(mockApp.getFrostProtectionSettings).toHaveBeenCalledWith(params)
    })
  })

  describe('holiday mode settings retrieval', () => {
    it('should delegate to app.getHolidayModeSettings with params', async () => {
      const holidayMode = mock<HolidayModeData>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.getHolidayModeSettings.mockResolvedValue(holidayMode)

      const result = await api.getHolidayModeSettings({ homey, params })

      expect(result).toBe(holidayMode)
      expect(mockApp.getHolidayModeSettings).toHaveBeenCalledWith(params)
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
    it('should delegate to app.homeLogin with body', async () => {
      mockApp.homeLogin.mockResolvedValue(true)
      const body = mock<LoginCredentials>()

      const isLoggedIn = await api.homeLogin({ body, homey })

      expect(isLoggedIn).toBe(true)
      expect(mockApp.homeLogin).toHaveBeenCalledWith(body)
    })
  })

  describe('authentication', () => {
    it('should delegate to app.login with body', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
      const credentials = mock<LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      mockApp.login.mockResolvedValue(true)

      const isLoggedIn = await api.login({ body: credentials, homey })

      expect(isLoggedIn).toBe(true)
      expect(mockApp.login).toHaveBeenCalledWith(credentials)
    })

    it('should return false on failed login', async () => {
      const credentials = mock<LoginCredentials>()
      mockApp.login.mockResolvedValue(false)

      const isLoggedIn = await api.login({ body: credentials, homey })

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

      expect(mockApp.setDeviceSettings).toHaveBeenCalledWith(body, {
        driverId: 'melcloud',
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

      expect(mockApp.setDeviceSettings).toHaveBeenCalledWith(body, {
        driverId: undefined,
      })
    })
  })

  describe('frost protection settings update', () => {
    it('should delegate to app.setFrostProtectionSettings', async () => {
      const body = mock<FrostProtectionQuery>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.setFrostProtectionSettings.mockResolvedValue()

      await api.setFrostProtectionSettings({ body, homey, params })

      expect(mockApp.setFrostProtectionSettings).toHaveBeenCalledWith(
        body,
        params,
      )
    })
  })

  describe('holiday mode settings update', () => {
    it('should delegate to app.setHolidayModeSettings', async () => {
      const body = mock<HolidayModeQuery>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.setHolidayModeSettings.mockResolvedValue()

      await api.setHolidayModeSettings({ body, homey, params })

      expect(mockApp.setHolidayModeSettings).toHaveBeenCalledWith(body, params)
    })
  })
})
