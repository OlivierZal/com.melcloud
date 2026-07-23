import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import {
  type HolidayModeUpdate,
  type LoginCredentials,
  AuthenticationError,
  AuthenticationThrottledError,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Home from '@olivierzal/melcloud-api/home'

import type { DeviceSettings, Settings } from '../../types/device-settings.mts'
import type { DriverSetting } from '../../types/driver-settings.mts'
import type {
  ErrorLogQueryParams,
  FormattedErrorLog,
} from '../../types/error-log.mts'
import type { ZoneData } from '../../types/zone.mts'
import { mock } from '../helpers.js'

const mockGetBuildings =
  vi.fn<
    (options?: {
      type?: Classic.DeviceType | undefined
    }) => Classic.BuildingZone[]
  >()

vi.mock(import('../../lib/classic-facade-manager.mts'), () => ({
  getClassicBuildings: mockGetBuildings,
}))

const { default: api } = await import('../../api.mts')

const mockIsAuthenticated = vi.fn<() => boolean>()
const mockIsHomeAuthenticated = vi.fn<() => boolean>()
const mockHomeList = vi.fn<() => Promise<unknown[]>>()
const mockGetBuildingsByType = vi.fn<Home.Registry['getBuildingsByType']>()
const mockClassicAuthenticate = vi.fn<() => Promise<void>>()
const mockHomeAuthenticate = vi.fn<() => Promise<void>>()
const mockClassicLogOut = vi.fn<() => void>()
const mockHomeLogOut = vi.fn<() => void>()

const mockApp = {
  classicApi: {
    authenticate: mockClassicAuthenticate,
    isAuthenticated: mockIsAuthenticated,
    logOut: mockClassicLogOut,
  },
  error: vi.fn<(...args: readonly unknown[]) => void>(),
  getClassicFrostProtection:
    vi.fn<() => Promise<Classic.FrostProtectionData>>(),
  getClassicHolidayMode: vi.fn<() => Promise<Classic.HolidayModeData>>(),
  getDeviceSettings: vi.fn<() => DeviceSettings>(),
  getDriverSettings: vi.fn<() => Partial<Record<string, DriverSetting[]>>>(),
  getErrorLog: vi.fn<() => Promise<FormattedErrorLog>>(),
  homeApi: {
    authenticate: mockHomeAuthenticate,
    isAuthenticated: mockIsHomeAuthenticated,
    list: mockHomeList,
    logOut: mockHomeLogOut,
    registry: { getBuildingsByType: mockGetBuildingsByType },
  },
  log: vi.fn<(...args: readonly unknown[]) => void>(),
  updateClassicFrostProtection: vi.fn<() => Promise<void>>(),
  updateClassicHolidayMode: vi.fn<() => Promise<void>>(),
  updateDeviceSettings: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const mockTranslate = vi.fn<(key: string, tags?: object) => string>(
  (key) => key,
)

const homey = mock<Homey>({ __: mockTranslate, app: mockApp, i18n: mockI18n })

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

  describe('device groups retrieval', () => {
    it('should flatten both dialects into named groups sorted by name', () => {
      mockGetBuildings.mockReturnValue([
        mock<Classic.BuildingZone>({
          areas: [mock<Classic.AreaZone>({ devices: [{ id: 3 }] })],
          devices: [{ id: 1 }, { id: 2 }],
          floors: [
            mock<Classic.FloorZone>({
              areas: [mock<Classic.AreaZone>({ devices: [{ id: 5 }] })],
              devices: [{ id: 4 }],
            }),
          ],
          name: 'Ma maison',
        }),
        mock<Classic.BuildingZone>({
          areas: [],
          devices: [],
          floors: [],
          name: 'Bâtiment vide',
        }),
      ])
      mockGetBuildingsByType.mockImplementation((type) => [
        {
          devices:
            type === Home.DeviceType.Ata ?
              [mock<Home.Device>({ id: 'uuid-1' })]
            : [mock<Home.Device>({ id: 'uuid-2' })],
          id: 'home-building-1',
          name: 'Appartement',
        },
      ])

      expect(api.getDeviceGroups({ homey })).toStrictEqual([
        { deviceIds: ['uuid-1', 'uuid-2'], name: 'Appartement' },
        { deviceIds: ['1', '2', '3', '4', '5'], name: 'Ma maison' },
      ])
    })

    it('should serve Home groups from the registry without a wire call', () => {
      mockGetBuildings.mockReturnValue([])
      mockGetBuildingsByType.mockImplementation((type) =>
        type === Home.DeviceType.Ata ?
          [
            {
              devices: [mock<Home.Device>({ id: 'uuid-1' })],
              id: 'home-building-1',
              name: 'Appartement',
            },
          ]
        : [],
      )

      expect(api.getDeviceGroups({ homey })).toStrictEqual([
        { deviceIds: ['uuid-1'], name: 'Appartement' },
      ])
      expect(mockHomeList).not.toHaveBeenCalled()
    })

    it('should return no groups when both dialects are empty', () => {
      mockGetBuildings.mockReturnValue([])
      mockGetBuildingsByType.mockReturnValue([])

      expect(api.getDeviceGroups({ homey })).toStrictEqual([])
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
    it('should parse numeric query params before delegating to app.getErrorLog', async () => {
      const errorLog = mock<FormattedErrorLog>()
      const query = mock<ErrorLogQueryParams>({
        from: '2026-01-01',
        offset: '2',
        period: '7',
        to: '2026-01-31',
      })
      mockApp.getErrorLog.mockResolvedValue(errorLog)

      const result = await api.getErrorLog({ homey, query })

      expect(result).toBe(errorLog)
      expect(mockApp.getErrorLog).toHaveBeenCalledWith({
        from: '2026-01-01',
        offset: 2,
        period: 7,
        to: '2026-01-31',
      })
    })

    it('should omit missing numeric query params', async () => {
      const errorLog = mock<FormattedErrorLog>()
      mockApp.getErrorLog.mockResolvedValue(errorLog)

      await api.getErrorLog({
        homey,
        query: mock<Partial<ErrorLogQueryParams>>(),
      })

      expect(mockApp.getErrorLog).toHaveBeenCalledWith({})
    })

    it('should throw on empty string numeric query param', async () => {
      await expect(
        api.getErrorLog({
          homey,
          query: mock<Partial<ErrorLogQueryParams>>({ offset: '' }),
        }),
      ).rejects.toThrow('Invalid numeric query param: ""')
      expect(mockApp.getErrorLog).not.toHaveBeenCalled()
    })

    it('should throw on non-numeric query param', async () => {
      await expect(
        api.getErrorLog({
          homey,
          query: mock<Partial<ErrorLogQueryParams>>({ period: 'abc' }),
        }),
      ).rejects.toThrow('Invalid numeric query param: "abc"')
      expect(mockApp.getErrorLog).not.toHaveBeenCalled()
    })

    it('should throw on infinite query param', async () => {
      await expect(
        api.getErrorLog({
          homey,
          query: mock<Partial<ErrorLogQueryParams>>({
            period: 'Infinity',
          }),
        }),
      ).rejects.toThrow('Invalid numeric query param: "Infinity"')
      expect(mockApp.getErrorLog).not.toHaveBeenCalled()
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

  describe('webview boot logging', () => {
    it('should log the boot failure body via app.error', () => {
      api.logWebviewBoot({ body: { message: 'boom' }, homey })

      expect(mockApp.error).toHaveBeenCalledTimes(1)
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

  describe('login failure classification', () => {
    it('translates a credential rejection into its localized reason', async () => {
      mockClassicAuthenticate.mockRejectedValueOnce(
        new AuthenticationError('MELCloud Classic rejected the credentials'),
      )

      await expect(
        api.classicAuthenticate({ body: mock<LoginCredentials>(), homey }),
      ).rejects.toThrow('settings.authenticate.rejected')
      expect(mockTranslate).toHaveBeenCalledWith(
        'settings.authenticate.rejected',
        { name: 'MELCloud Classic' },
      )
    })

    it('translates the login throttle into its localized reason', async () => {
      mockHomeAuthenticate.mockRejectedValueOnce(
        new AuthenticationThrottledError('blocked'),
      )

      await expect(
        api.homeAuthenticate({ body: mock<LoginCredentials>(), homey }),
      ).rejects.toThrow('settings.authenticate.throttled')
      expect(mockTranslate).toHaveBeenCalledWith(
        'settings.authenticate.throttled',
        { name: 'MELCloud Home' },
      )
    })
  })

  describe('logout', () => {
    it('should delegate the Classic logout to app.classicApi.logOut', () => {
      api.classicLogOut({ homey })

      expect(mockClassicLogOut).toHaveBeenCalledTimes(1)
    })

    it('should delegate the Home logout to app.homeApi.logOut', () => {
      api.homeLogOut({ homey })

      expect(mockHomeLogOut).toHaveBeenCalledTimes(1)
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
    it('should not retry the context fetch when already authenticated', async () => {
      mockIsHomeAuthenticated.mockReturnValue(true)

      const isAuthenticated = await api.isHomeAuthenticated({ homey })

      expect(isAuthenticated).toBe(true)
      expect(mockHomeList).not.toHaveBeenCalled()
    })

    it('should retry the context fetch once when the boot restore failed', async () => {
      mockIsHomeAuthenticated
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      mockHomeList.mockResolvedValue([])

      const isAuthenticated = await api.isHomeAuthenticated({ homey })

      expect(isAuthenticated).toBe(true)
      expect(mockHomeList).toHaveBeenCalledTimes(1)
    })

    it('should return false when the retried context fetch does not restore the session', async () => {
      mockIsHomeAuthenticated.mockReturnValue(false)
      mockHomeList.mockResolvedValue([])

      const isAuthenticated = await api.isHomeAuthenticated({ homey })

      expect(isAuthenticated).toBe(false)
      expect(mockHomeList).toHaveBeenCalledTimes(1)
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
        query: {},
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
      const body = mock<HolidayModeUpdate>()
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
