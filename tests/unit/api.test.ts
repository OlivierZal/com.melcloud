import type { DriverSetting } from '@olivierzal/homey-kit/manifest'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'
import type { Homey } from 'homey/lib/Homey'
import {
  type HolidayModeState,
  type HolidayModeUpdate,
  type HomeBuildingZone,
  type HomeDeviceZone,
  type LoginCredentials,
  type ProtectionState,
  AuthenticationError,
  AuthenticationThrottledError,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceSettings, Settings } from '../../types/device-settings.mts'
import type {
  ErrorLogQueryParams,
  FormattedErrorLog,
} from '../../types/error-log.mts'
import { mock } from '../helpers.ts'

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

const mockEnsureClassicAuthenticated = vi.fn<() => Promise<boolean>>()
const mockEnsureHomeAuthenticated = vi.fn<() => Promise<boolean>>()
const mockGetHomeBuildings = vi.fn<Home.Registry['getBuildings']>()
const mockClassicAuthenticate = vi.fn<() => Promise<void>>()
const mockHomeAuthenticate = vi.fn<() => Promise<void>>()
const mockClassicLogOut = vi.fn<() => void>()
const mockHomeLogOut = vi.fn<() => void>()

const mockApp = {
  classicApi: {
    authenticate: mockClassicAuthenticate,
    ensureAuthenticated: mockEnsureClassicAuthenticated,
    logOut: mockClassicLogOut,
  },
  error: vi.fn<(...args: readonly unknown[]) => void>(),
  getDeviceSettings: vi.fn<() => DeviceSettings>(),
  getDriverSettings: vi.fn<() => Partial<Record<string, DriverSetting[]>>>(),
  getErrorLog: vi.fn<() => Promise<FormattedErrorLog>>(),
  getHomeTargets: vi.fn<() => (HomeBuildingZone | HomeDeviceZone)[]>(),
  getTargetFrostProtection: vi.fn<() => Promise<ProtectionState | null>>(),
  getTargetHolidayMode: vi.fn<() => Promise<HolidayModeState | null>>(),
  getTargetOverheatProtection: vi.fn<() => Promise<ProtectionState | null>>(),
  homeApi: {
    authenticate: mockHomeAuthenticate,
    ensureAuthenticated: mockEnsureHomeAuthenticated,
    logOut: mockHomeLogOut,
    registry: { getBuildings: mockGetHomeBuildings },
  },
  log: vi.fn<(...args: readonly unknown[]) => void>(),
  updateDeviceSettings: vi.fn<() => Promise<void>>(),
  updateTargetFrostProtection: vi.fn<() => Promise<void>>(),
  updateTargetHolidayMode: vi.fn<() => Promise<void>>(),
  updateTargetOverheatProtection: vi.fn<() => Promise<void>>(),
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
        mock<Classic.BuildingZone>({ id: 1, name: 'ClassicBuilding 1' }),
      ]
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
      // The registry merges a mixed building's connection types itself.
      mockGetHomeBuildings.mockReturnValue([
        {
          devices: [
            mock<Home.Device>({ id: 'uuid-1' }),
            mock<Home.Device>({ id: 'uuid-2' }),
          ],
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
      mockGetHomeBuildings.mockReturnValue([
        {
          devices: [mock<Home.Device>({ id: 'uuid-1' })],
          id: 'home-building-1',
          name: 'Appartement',
        },
      ])

      expect(api.getDeviceGroups({ homey })).toStrictEqual([
        { deviceIds: ['uuid-1'], name: 'Appartement' },
      ])
      expect(mockEnsureHomeAuthenticated).not.toHaveBeenCalled()
    })

    it('should return no groups when both dialects are empty', () => {
      mockGetBuildings.mockReturnValue([])
      mockGetHomeBuildings.mockReturnValue([])

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
      ).rejects.toThrow('offset: expected non-negative integer, got ')
      expect(mockApp.getErrorLog).not.toHaveBeenCalled()
    })

    it('should throw on non-numeric query param', async () => {
      await expect(
        api.getErrorLog({
          homey,
          query: mock<Partial<ErrorLogQueryParams>>({ period: 'abc' }),
        }),
      ).rejects.toThrow('period: expected non-negative integer, got abc')
      expect(mockApp.getErrorLog).not.toHaveBeenCalled()
    })

    it('should throw on infinite query param', async () => {
      await expect(
        api.getErrorLog({
          homey,
          query: mock<Partial<ErrorLogQueryParams>>({ period: 'Infinity' }),
        }),
      ).rejects.toThrow('period: expected non-negative integer, got Infinity')
      expect(mockApp.getErrorLog).not.toHaveBeenCalled()
    })
  })

  describe('home targets retrieval', () => {
    it('should delegate to app.getHomeTargets', () => {
      const targets = [mock<HomeBuildingZone>({ id: 'b1' })]
      mockApp.getHomeTargets.mockReturnValue(targets)

      expect(api.getHomeTargets({ homey })).toBe(targets)
    })
  })

  describe('target settings retrieval', () => {
    it.each([
      'getTargetFrostProtection',
      'getTargetHolidayMode',
      'getTargetOverheatProtection',
    ] as const)('should delegate %s with the raw targetId', async (handler) => {
      const value = mock<HolidayModeState & ProtectionState>()
      mockApp[handler].mockResolvedValue(value)

      const result = await api[handler]({
        homey,
        params: { targetId: 'homeDevices_guid-1' },
      })

      expect(result).toBe(value)
      expect(mockApp[handler]).toHaveBeenCalledWith('homeDevices_guid-1')
    })
  })

  describe('target settings update', () => {
    it.each([
      'updateTargetFrostProtection',
      'updateTargetOverheatProtection',
    ] as const)(
      'should delegate %s with targetId and body',
      async (handler) => {
        const body = { isEnabled: true, max: 16, min: 4 }
        mockApp[handler].mockResolvedValue()

        await api[handler]({ body, homey, params: { targetId: 'buildings_1' } })

        expect(mockApp[handler]).toHaveBeenCalledWith('buildings_1', body)
      },
    )

    it('should delegate updateTargetHolidayMode with targetId and body', async () => {
      const body = mock<HolidayModeUpdate>()
      mockApp.updateTargetHolidayMode.mockResolvedValue()

      await api.updateTargetHolidayMode({
        body,
        homey,
        params: { targetId: 'homeBuildings_b1' },
      })

      expect(mockApp.updateTargetHolidayMode).toHaveBeenCalledWith(
        'homeBuildings_b1',
        body,
      )
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
    it('should delegate to app.classicApi.ensureAuthenticated', async () => {
      mockEnsureClassicAuthenticated.mockResolvedValue(true)

      await expect(api.isClassicAuthenticated({ homey })).resolves.toBe(true)
      expect(mockEnsureClassicAuthenticated).toHaveBeenCalledTimes(1)
    })

    it('should return false when not authenticated', async () => {
      mockEnsureClassicAuthenticated.mockResolvedValue(false)

      await expect(api.isClassicAuthenticated({ homey })).resolves.toBe(false)
    })
  })

  describe('home session retrieval', () => {
    it('should delegate the lazy self-heal to the SDK contract', async () => {
      mockEnsureHomeAuthenticated.mockResolvedValue(true)

      const isAuthenticated = await api.isHomeAuthenticated({ homey })

      expect(isAuthenticated).toBe(true)
      expect(mockEnsureHomeAuthenticated).toHaveBeenCalledTimes(1)
    })

    it('should return false when the SDK cannot restore the session', async () => {
      mockEnsureHomeAuthenticated.mockResolvedValue(false)

      const isAuthenticated = await api.isHomeAuthenticated({ homey })

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
        api.classicAuthenticate({ body: mock<LoginCredentials>(), homey }),
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

      await api.updateDeviceSettings({ body, homey, query: {} })

      expect(mockApp.updateDeviceSettings).toHaveBeenCalledWith({
        driverId: undefined,
        settings: body,
      })
    })
  })

  describe('webview hashes', () => {
    it('should serve the packaged manifest map', async () => {
      // A dev suite run packages no manifest: the empty map is the
      // documented fresh-by-default answer.
      await expect(api.getWebviewHashes({ homey })).resolves.toStrictEqual({})
    })
  })
})
