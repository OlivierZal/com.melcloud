/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  type BuildingFacade,
  type ErrorLog,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionQuery,
  type GroupState,
  type HolidayModeData,
  type HolidayModeQuery,
  type ListDeviceDataAta,
  type LoginCredentials,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type ZoneFacade,
  DeviceType,
  FacadeManager,
  MELCloudAPI,
} from '@olivierzal/melcloud-api'
import { Settings as LuxonSettings } from 'luxon'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ManifestDriver,
  MELCloudDevice,
  Settings,
} from '../../types/index.mts'

import { assertDefined, mock } from '../helpers.js'

const mockSetFacadeManager = vi.fn<() => void>()

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
vi.mock('homey', () => ({ default: { App: class HomeyApp {} } }))

vi.mock('../../lib/get-zones.mts', () => ({
  setFacadeManager: mockSetFacadeManager,
}))

vi.mock('../../files.mts', () => ({
  changelog: { '1.0.0': { en: 'English changelog', nl: 'Dutch changelog' } },
  fanSpeed: {
    title: { en: 'Fan speed' },
    type: 'enum',
  },
  horizontal: {
    title: { en: 'Horizontal' },
    type: 'enum',
    values: [{ id: 'auto', title: { en: 'Auto' } }],
  },
  power: {
    title: { en: 'Power' },
    type: 'boolean',
  },
  setTemperature: {
    title: { en: 'Set temperature' },
    type: 'number',
  },
  thermostatMode: {
    title: { en: 'Thermostat mode' },
    type: 'enum',
  },
  vertical: {
    title: { en: 'Vertical' },
    type: 'enum',
    values: [{ id: 'auto', title: { en: 'Auto' } }],
  },
}))

const mockApiInstance = {
  authenticate: vi.fn<() => Promise<boolean>>(),
  clearSync: vi.fn(),
  getErrorLog: vi.fn<() => Promise<ErrorLog>>(),
  registry: {
    areas: { getById: vi.fn() },
    buildings: { getById: vi.fn() },
    devices: { getById: vi.fn() },
    floors: { getById: vi.fn() },
  },
}

const mockFacadeManagerGet = vi.fn()
const mockFacadeManagerGetZones = vi.fn().mockReturnValue([])

vi.mock('@olivierzal/melcloud-api', async (importOriginal) => ({
  ...(await importOriginal()),
  FacadeManager: vi.fn(),
  MELCloudAPI: {
    create: vi.fn(),
  },
}))

const { default: MelCloudApp } = await import('../../app.mts')

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockCreate = vi.mocked(MELCloudAPI.create)

const mockGetLanguage = vi.fn<() => string>().mockReturnValue('en')
const mockGetTimezone = vi.fn<() => string>().mockReturnValue('Europe/Paris')
const mockSettingsGet = vi.fn<(key: string) => string | null>()
const mockSettingsSet = vi.fn()
const mockSetTimeout = vi.fn()
const mockCreateNotification = vi.fn<() => Promise<void>>()
const mockWidgetRegister = vi.fn()
const mockGetWidget = vi.fn().mockReturnValue({
  registerSettingAutocompleteListener: mockWidgetRegister,
})
const mockGetDrivers = vi.fn().mockReturnValue({})
const mockGetDriver = vi.fn()
const mockTranslate = vi
  .fn<(key: string) => string>()
  .mockImplementation((key: string) => key)

const mockManifestDrivers: ManifestDriver[] = [
  {
    capabilitiesOptions: {
      thermostat_mode: {
        title: { en: 'Mode' },
        type: 'enum',
        values: [
          { id: 'heat', title: { en: 'Heat' } },
          { id: 'cool', title: { en: 'Cool' } },
          { id: 'off', title: { en: 'Off' } },
        ],
      },
    },
    id: 'melcloud',
    settings: [
      {
        children: [
          {
            id: 'setting1',
            label: { en: 'Setting 1', nl: 'Instelling 1' },
            type: 'number',
          },
        ],
        id: 'group1',
        label: { en: 'Group 1', nl: 'Groep 1' },
      },
    ],
  },
]

const setupMocks = (): void => {
  mockCreate.mockResolvedValue(mockApiInstance as never)
  vi.mocked(FacadeManager).mockImplementation(function mockConstructor() {
    return mock<FacadeManager>({
      get: mockFacadeManagerGet,
      getZones: mockFacadeManagerGetZones,
    })
  } as never)
  mockGetLanguage.mockReturnValue('en')
  mockGetTimezone.mockReturnValue('Europe/Paris')
  mockTranslate.mockImplementation((key: string) => key)
  mockGetWidget.mockReturnValue({
    registerSettingAutocompleteListener: mockWidgetRegister,
  })
}

const createApp = (): InstanceType<typeof MelCloudApp> => {
  const app = new MelCloudApp()
  Object.defineProperty(app, 'homey', {
    configurable: true,
    value: {
      __: mockTranslate,
      clock: { getTimezone: mockGetTimezone },
      dashboards: { getWidget: mockGetWidget },
      drivers: { getDriver: mockGetDriver, getDrivers: mockGetDrivers },
      i18n: { getLanguage: mockGetLanguage },
      manifest: { drivers: mockManifestDrivers, version: '1.0.0' },
      notifications: { createNotification: mockCreateNotification },
      setTimeout: mockSetTimeout,
      settings: {
        get: mockSettingsGet,
        set: mockSettingsSet,
      },
    },
    writable: false,
  })
  return app
}

describe('melCloudApp', () => {
  let app: InstanceType<typeof MelCloudApp>

  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
    mockSettingsGet.mockReturnValue(null)
    mockGetDrivers.mockReturnValue({})
    mockFacadeManagerGetZones.mockReturnValue([])
    app = createApp()
  })

  describe('onInit', () => {
    it('should initialize the API and facade manager', async () => {
      await app.onInit()

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'en',
          timezone: 'Europe/Paris',
        }),
      )
      expect(FacadeManager).toHaveBeenCalledTimes(1)
      expect(mockSetFacadeManager).toHaveBeenCalledTimes(1)
    })

    it('should pass logger callbacks that delegate to app.log and app.error', async () => {
      const logMock = vi.fn()
      const errorMock = vi.fn()
      Object.defineProperty(app, 'log', { configurable: true, value: logMock })
      Object.defineProperty(app, 'error', {
        configurable: true,
        value: errorMock,
      })
      await app.onInit()

      const createCallArgs = mockCreate.mock.calls[0]?.[0]

      expect(createCallArgs).toBeDefined()

      const { logger } = createCallArgs as unknown as {
        logger: {
          error: (...args: unknown[]) => void
          log: (...args: unknown[]) => void
        }
      }
      logger.log('test log')
      logger.error('test error')

      expect(logMock).toHaveBeenCalledWith('test log')
      expect(errorMock).toHaveBeenCalledWith('test error')
    })

    it('should set luxon defaults', async () => {
      await app.onInit()

      expect(LuxonSettings.defaultLocale).toBe('en')
      expect(LuxonSettings.defaultZone).toStrictEqual(
        expect.objectContaining({ zoneName: 'Europe/Paris' }),
      )
    })

    it('should create notification when version differs', async () => {
      mockSettingsGet.mockReturnValue('0.9.0')

      await app.onInit()

      expect(mockSetTimeout).toHaveBeenCalledTimes(1)
    })

    it('should not create notification when version matches', async () => {
      mockSettingsGet.mockReturnValue('1.0.0')

      await app.onInit()

      expect(mockSetTimeout).not.toHaveBeenCalled()
    })

    it('should register widget listeners', async () => {
      await app.onInit()

      expect(mockGetWidget).toHaveBeenCalledWith('ata-group-setting')
      expect(mockGetWidget).toHaveBeenCalledWith('charts')
      expect(mockWidgetRegister).toHaveBeenCalledTimes(2)
    })
  })

  describe('onUninit', () => {
    it('should clear sync', async () => {
      await app.onInit()
      await app.onUninit()

      expect(mockApiInstance.clearSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('getAtaCapabilities', () => {
    it('should return localized capability configs', async () => {
      await app.onInit()
      const capabilities = app.getAtaCapabilities()

      expect(capabilities).toBeInstanceOf(Array)
      expect(capabilities.length).toBeGreaterThan(0)

      const firstCapability = capabilities[0]

      expect(firstCapability).toBeDefined()

      const [firstKey, firstOptions] = firstCapability ?? ['', {}]

      expect(firstKey).toBe('Power')
      expect(firstOptions).toHaveProperty('title')
      expect(firstOptions).toHaveProperty('type')
    })

    it('should filter out off mode from thermostat values', async () => {
      await app.onInit()
      const capabilities = app.getAtaCapabilities()
      const [, operationModeOptions] =
        capabilities.find(([key]) => key === 'OperationMode') ?? []

      expect(operationModeOptions).toBeDefined()
      expect(
        operationModeOptions?.values?.find((value) => value.id === 'off'),
      ).toBeUndefined()
    })
  })

  describe('getAtaDetailedValues', () => {
    it('should return detailed values for ATA devices', async () => {
      const mockFacade = mock<BuildingFacade>({
        devices: [
          {
            data: { FanSpeed: 3, Power: true, SetTemperature: 21 },
            type: DeviceType.Ata,
          } as never,
        ],
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const detailedValues = app.getAtaDetailedValues({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(detailedValues).toBeDefined()
      expect(detailedValues.Power).toStrictEqual([true])
    })

    it('should filter by power status when status is on', async () => {
      const mockFacade = mock<BuildingFacade>({
        devices: [
          {
            data: mock<ListDeviceDataAta>({
              FanSpeed: 3,
              Power: true,
              SetTemperature: 21,
            }),
            type: DeviceType.Ata,
          } as never,
          {
            data: mock<ListDeviceDataAta>({
              FanSpeed: 2,
              Power: false,
              SetTemperature: 19,
            }),
            type: DeviceType.Ata,
          } as never,
        ],
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const detailedValues = app.getAtaDetailedValues(
        { zoneId: '1', zoneType: 'buildings' },
        { status: 'on' },
      )

      expect(detailedValues.Power).toStrictEqual([true])
    })

    it('should throw when no devices found', async () => {
      const mockFacade = mock<BuildingFacade>({ devices: [] })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      expect(() =>
        app.getAtaDetailedValues({ zoneId: '1', zoneType: 'buildings' }),
      ).toThrow('errors.deviceNotFound')
    })
  })

  describe('getAtaValues', () => {
    it('should delegate to facade getGroup', async () => {
      const mockGroupState = mock<GroupState>()
      const mockFacade = mock<BuildingFacade>({
        getGroup: vi
          .fn<() => Promise<GroupState>>()
          .mockResolvedValue(mockGroupState),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const groupState = await app.getAtaValues({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(groupState).toBe(mockGroupState)
    })
  })

  describe('getDeviceSettings', () => {
    it('should aggregate device settings', async () => {
      const mockDevice1 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
      })
      const mockDevice2 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice1, mockDevice2]),
      }
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings['melcloud']?.['always_on']).toBe(true)
    })

    it('should set to null when settings differ between devices', async () => {
      const mockDevice1 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
      })
      const mockDevice2 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({ always_on: false }),
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice1, mockDevice2]),
      }
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings['melcloud']?.['always_on']).toBeNull()
    })
  })

  describe('getDriverSettings', () => {
    it('should return driver settings grouped by ID', async () => {
      await app.onInit()

      const driverSettings = app.getDriverSettings()

      expect(driverSettings).toBeDefined()
      expect(driverSettings['group1']).toBeInstanceOf(Array)
    })

    it('should use language-specific labels', async () => {
      mockGetLanguage.mockReturnValue('nl')
      app = createApp()
      await app.onInit()

      const { group1: settings } = app.getDriverSettings()

      expect(settings?.[0]?.groupLabel).toBe('Groep 1')
      expect(settings?.[0]?.title).toBe('Instelling 1')
    })
  })

  describe('getErrors', () => {
    it('should delegate to api getErrorLog', async () => {
      const mockErrorLog = mock<ErrorLog>()
      mockApiInstance.getErrorLog.mockResolvedValue(mockErrorLog)
      await app.onInit()

      const query = mock<ErrorLogQuery>()
      const errorLog = await app.getErrors(query)

      expect(errorLog).toBe(mockErrorLog)
      expect(mockApiInstance.getErrorLog).toHaveBeenCalledWith(query)
    })
  })

  describe('getFacade', () => {
    it('should return facade for a valid zone', async () => {
      const mockInstance = { id: 1 }
      const mockFacade = mock<BuildingFacade>()
      mockApiInstance.registry.buildings.getById.mockReturnValue(mockInstance)
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      await app.onInit()

      const facade = app.getFacade('buildings', '1')

      expect(facade).toBe(mockFacade)
    })

    it('should throw for zone not found', async () => {
      mockApiInstance.registry.buildings.getById.mockReturnValue(undefined)
      await app.onInit()

      expect(() => app.getFacade('buildings', '999')).toThrow(
        'errors.zoneNotFound',
      )
      expect(mockTranslate).toHaveBeenCalledWith('errors.zoneNotFound')
    })

    it('should throw with device error for device type', async () => {
      mockApiInstance.registry.devices.getById.mockReturnValue(undefined)
      await app.onInit()

      expect(() => app.getFacade('devices', '999')).toThrow(
        'errors.deviceNotFound',
      )
      expect(mockTranslate).toHaveBeenCalledWith('errors.deviceNotFound')
    })
  })

  describe('getFrostProtectionSettings', () => {
    it('should delegate to facade', async () => {
      const mockData = mock<FrostProtectionData>()
      const mockFacade = mock<ZoneFacade>({
        getFrostProtection: vi
          .fn<() => Promise<FrostProtectionData>>()
          .mockResolvedValue(mockData),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const frostProtection = await app.getFrostProtectionSettings({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(frostProtection).toBe(mockData)
    })
  })

  describe('getHolidayModeSettings', () => {
    it('should delegate to facade', async () => {
      const mockData = mock<HolidayModeData>()
      const mockFacade = mock<ZoneFacade>({
        getHolidayMode: vi
          .fn<() => Promise<HolidayModeData>>()
          .mockResolvedValue(mockData),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const holidayMode = await app.getHolidayModeSettings({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(holidayMode).toBe(mockData)
    })
  })

  describe('getHourlyTemperatures', () => {
    it('should delegate to device facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      mockFacadeManagerGet.mockReturnValue(
        mock({
          getHourlyTemperatures: vi
            .fn<() => Promise<ReportChartLineOptions>>()
            .mockResolvedValue(mockData),
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const temperatures = await app.getHourlyTemperatures('1', 10)

      expect(temperatures).toBe(mockData)
    })
  })

  describe('getOperationModes', () => {
    it('should delegate to device facade with date range', async () => {
      const mockData = mock<ReportChartPieOptions>()
      mockFacadeManagerGet.mockReturnValue(
        mock({
          getOperationModes: vi
            .fn<() => Promise<ReportChartPieOptions>>()
            .mockResolvedValue(mockData),
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const operationModes = await app.getOperationModes('1', 7)

      expect(operationModes).toBe(mockData)
    })
  })

  describe('getSignal', () => {
    it('should delegate to device facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      mockFacadeManagerGet.mockReturnValue(
        mock({
          getSignalStrength: vi
            .fn<() => Promise<ReportChartLineOptions>>()
            .mockResolvedValue(mockData),
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const signal = await app.getSignal('1', 5)

      expect(signal).toBe(mockData)
    })
  })

  describe('getTemperatures', () => {
    it('should delegate to device facade with date range', async () => {
      const mockData = mock<ReportChartLineOptions>()
      mockFacadeManagerGet.mockReturnValue(
        mock({
          getTemperatures: vi
            .fn<() => Promise<ReportChartLineOptions>>()
            .mockResolvedValue(mockData),
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const temperatures = await app.getTemperatures('1', 30)

      expect(temperatures).toBe(mockData)
    })
  })

  describe('login', () => {
    it('should delegate to api authenticate', async () => {
      mockApiInstance.authenticate.mockResolvedValue(true)
      await app.onInit()

      const credentials = mock<LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      const isAuthenticated = await app.login(credentials)

      expect(isAuthenticated).toBe(true)
      expect(mockApiInstance.authenticate).toHaveBeenCalledWith(credentials)
    })
  })

  describe('setAtaValues', () => {
    it('should set group values and not throw on success', async () => {
      const mockFacade = mock<BuildingFacade>({
        setGroup: vi.fn().mockResolvedValue({ AttributeErrors: null }),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.setAtaValues(mock<GroupState>(), {
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<BuildingFacade>({
        setGroup: vi.fn().mockResolvedValue({
          AttributeErrors: { temp: ['Invalid value'] },
        }),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.setAtaValues(mock<GroupState>(), {
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('temp: Invalid value')
    })
  })

  describe('setDeviceSettings', () => {
    it('should update changed settings on matching devices', async () => {
      const mockSetSettings = vi.fn<() => Promise<void>>().mockResolvedValue()
      const mockOnSettings = vi.fn<() => Promise<void>>().mockResolvedValue()
      const mockDevice = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSetting: vi.fn().mockReturnValue(false),
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
        onSettings: mockOnSettings,
        setSettings: mockSetSettings,
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice]),
      }
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.setDeviceSettings(settings)

      expect(mockSetSettings).toHaveBeenCalledWith({ always_on: true })
      expect(mockOnSettings).toHaveBeenCalledTimes(1)
    })

    it('should skip devices with no changed keys', async () => {
      const mockSetSettings = vi.fn()
      const mockDevice = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSetting: vi.fn().mockReturnValue(true),
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
        setSettings: mockSetSettings,
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice]),
      }
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.setDeviceSettings(settings)

      expect(mockSetSettings).not.toHaveBeenCalled()
    })

    it('should filter by driverId when provided', async () => {
      const mockDevice = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSetting: vi.fn().mockReturnValue(false),
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
        onSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
        setSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice]),
      }
      mockGetDriver.mockReturnValue(mockDriver)
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.setDeviceSettings(settings, { driverId: 'melcloud' })

      expect(mockGetDriver).toHaveBeenCalledWith('melcloud')
    })
  })

  describe('setFrostProtectionSettings', () => {
    it('should delegate to facade and not throw on success', async () => {
      const mockFacade = mock<ZoneFacade>({
        setFrostProtection: vi
          .fn()
          .mockResolvedValue({ AttributeErrors: null }),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.setFrostProtectionSettings(mock<FrostProtectionQuery>(), {
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<ZoneFacade>({
        setFrostProtection: vi.fn().mockResolvedValue({
          AttributeErrors: { min: ['Too low'] },
        }),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.setFrostProtectionSettings(mock<FrostProtectionQuery>(), {
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('min: Too low')
    })
  })

  describe('setHolidayModeSettings', () => {
    it('should delegate to facade and not throw on success', async () => {
      const mockFacade = mock<ZoneFacade>({
        setHolidayMode: vi.fn().mockResolvedValue({ AttributeErrors: null }),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.setHolidayModeSettings(mock<HolidayModeQuery>(), {
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<ZoneFacade>({
        setHolidayMode: vi.fn().mockResolvedValue({
          AttributeErrors: { date: ['Invalid date'] },
        }),
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.setHolidayModeSettings(mock<HolidayModeQuery>(), {
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('date: Invalid date')
    })
  })

  describe('getDriverSettings with login settings', () => {
    it('should extract login settings from pair config', async () => {
      const driversWithLogin: ManifestDriver[] = [
        {
          id: 'melcloud',
          pair: Object.assign(
            [
              {
                id: 'login' as const,
                options: {
                  passwordLabel: { en: 'Password' },
                  passwordPlaceholder: { en: 'Enter password' },
                  usernameLabel: { en: 'Username' },
                  usernamePlaceholder: { en: 'Enter username' },
                },
              },
            ],
            {
              id: 'login' as const,
              options: {
                passwordLabel: { en: 'Password' },
                passwordPlaceholder: { en: 'Enter password' },
                usernameLabel: { en: 'Username' },
                usernamePlaceholder: { en: 'Enter username' },
              },
            },
          ),
        },
      ]
      Object.defineProperty(app.homey, 'manifest', {
        configurable: true,
        value: { drivers: driversWithLogin, version: '1.0.0' },
      })
      await app.onInit()

      const { login: loginSettings } = app.getDriverSettings()

      expect(loginSettings).toBeDefined()
      expect(loginSettings?.length).toBe(2)
    })
  })

  describe('notification when language not in changelog', () => {
    it('should not set timeout when language is not in changelog', async () => {
      mockGetLanguage.mockReturnValue('ja')
      mockSettingsGet.mockReturnValue('0.9.0')
      app = createApp()
      await app.onInit()

      expect(mockSetTimeout).not.toHaveBeenCalled()
    })
  })

  describe('notification setTimeout callback', () => {
    it('should create notification and set notifiedVersion on success', async () => {
      mockSettingsGet.mockReturnValue('0.9.0')
      mockCreateNotification.mockResolvedValue()
      await app.onInit()

      expect(mockSetTimeout).toHaveBeenCalledTimes(1)

      const callback = mockSetTimeout.mock.calls.at(0)?.at(0) as
        | (() => Promise<void>)
        | undefined
      assertDefined(callback)
      await callback()

      expect(mockCreateNotification).toHaveBeenCalledWith({
        excerpt: 'English changelog',
      })
      expect(mockSettingsSet).toHaveBeenCalledWith('notifiedVersion', '1.0.0')
    })

    it('should not throw when notification creation fails', async () => {
      mockSettingsGet.mockReturnValue('0.9.0')
      mockCreateNotification.mockRejectedValue(new Error('fail'))
      await app.onInit()

      const callback = mockSetTimeout.mock.calls.at(0)?.at(0) as
        | (() => Promise<void>)
        | undefined
      assertDefined(callback)

      await expect(callback()).resolves.toBeUndefined()
    })
  })

  describe('#getDevices with ids filter', () => {
    it('should filter devices by ids', async () => {
      const mockDevice1 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({}),
        id: 1,
      })
      const mockDevice2 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({}),
        id: 2,
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice1, mockDevice2]),
      }
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings).toBeDefined()
    })
  })

  describe('#registerWidgetListeners with query filtering', () => {
    it('should filter zones by query for ata-group-setting widget', async () => {
      const mockRegisterAta = vi.fn()
      const mockRegisterCharts = vi.fn()
      mockGetWidget.mockImplementation((widgetId: string) => {
        if (widgetId === 'ata-group-setting') {
          return { registerSettingAutocompleteListener: mockRegisterAta }
        }
        return { registerSettingAutocompleteListener: mockRegisterCharts }
      })
      mockFacadeManagerGetZones.mockReturnValue([
        { model: 'buildings', name: 'Building 1' },
        { model: 'buildings', name: 'Office' },
        { model: 'devices', name: 'Device 1' },
      ])
      await app.onInit()

      const ataCallback = mockRegisterAta.mock.calls.at(0)?.at(1) as
        | ((query: string) => unknown[])
        | undefined
      assertDefined(ataCallback)
      const result = ataCallback('build')

      expect(result).toStrictEqual([{ model: 'buildings', name: 'Building 1' }])
    })

    it('should filter zones by query for charts widget', async () => {
      const mockRegisterAta = vi.fn()
      const mockRegisterCharts = vi.fn()
      mockGetWidget.mockImplementation((widgetId: string) => {
        if (widgetId === 'ata-group-setting') {
          return { registerSettingAutocompleteListener: mockRegisterAta }
        }
        return { registerSettingAutocompleteListener: mockRegisterCharts }
      })
      mockFacadeManagerGetZones.mockReturnValue([
        { model: 'buildings', name: 'Building 1' },
        { model: 'devices', name: 'Device 1' },
        { model: 'devices', name: 'Device 2' },
      ])
      await app.onInit()

      const chartsCallback = mockRegisterCharts.mock.calls.at(0)?.at(1) as
        | ((query: string) => unknown[])
        | undefined
      assertDefined(chartsCallback)
      const result = chartsCallback('device 1')

      expect(result).toStrictEqual([{ model: 'devices', name: 'Device 1' }])
    })
  })

  describe('#syncFromDevices via onSync callback', () => {
    it('should sync devices from onSync callback', async () => {
      const syncFromDeviceMock = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue()
      const mockDevice = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({}),
        id: 1,
        syncFromDevice: syncFromDeviceMock,
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice]),
      }
      mockGetDriver.mockReturnValue(mockDriver)
      await app.onInit()

      const config = mockCreate.mock.calls.at(0)?.at(0) as
        | { onSync?: (params: { ids?: number[]; type?: number }) => Promise<void> }
        | undefined
      assertDefined(config?.onSync)
      await config.onSync({ type: DeviceType.Ata })

      expect(syncFromDeviceMock).toHaveBeenCalledTimes(1)
    })

    it('should sync devices with ids filter', async () => {
      const syncFromDeviceMock = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue()
      const mockDevice1 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({}),
        id: 1,
        syncFromDevice: syncFromDeviceMock,
      })
      const mockDevice2 = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({}),
        id: 2,
        syncFromDevice: vi.fn<() => Promise<void>>().mockResolvedValue(),
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice1, mockDevice2]),
      }
      mockGetDriver.mockReturnValue(mockDriver)
      await app.onInit()

      const config = mockCreate.mock.calls.at(0)?.at(0) as
        | { onSync?: (params: { ids?: number[]; type?: number }) => Promise<void> }
        | undefined
      assertDefined(config?.onSync)
      await config.onSync({ ids: [1], type: DeviceType.Ata })

      expect(syncFromDeviceMock).toHaveBeenCalledTimes(1)
    })

    it('should sync all devices when no type specified', async () => {
      const syncFromDeviceMock = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue()
      const mockDevice = mock<MELCloudDevice>({
        driver: { id: 'melcloud' } as never,
        getSettings: vi.fn().mockReturnValue({}),
        id: 1,
        syncFromDevice: syncFromDeviceMock,
      })
      const mockDriver = {
        getDevices: vi.fn().mockReturnValue([mockDevice]),
      }
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const config = mockCreate.mock.calls.at(0)?.at(0) as
        | { onSync?: (params?: { ids?: number[]; type?: number }) => Promise<void> }
        | undefined
      assertDefined(config?.onSync)
      await config.onSync()

      expect(syncFromDeviceMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getDriverSettings with setting values', () => {
    it('should include values in driver settings when defined', async () => {
      const driversWithValues: ManifestDriver[] = [
        {
          id: 'melcloud',
          settings: [
            {
              children: [
                {
                  id: 'setting_enum',
                  label: { en: 'Enum Setting' },
                  type: 'enum',
                  values: [
                    { id: 'val1', label: { en: 'Value 1', nl: 'Waarde 1' } },
                  ],
                },
              ],
              id: 'group1',
              label: { en: 'Group 1' },
            },
          ],
        },
      ]
      Object.defineProperty(app.homey, 'manifest', {
        configurable: true,
        value: { drivers: driversWithValues, version: '1.0.0' },
      })
      await app.onInit()

      const { group1: settings } = app.getDriverSettings()

      expect(settings?.[0]?.values?.[0]?.label).toBe('Value 1')
    })
  })
})
