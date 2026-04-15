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
  ClassicFacadeManager,
  DeviceType,
  HomeDeviceAtaFacade,
  HomeDeviceType,
} from '@olivierzal/melcloud-api'
import { Settings as LuxonSettings } from 'luxon'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as FilesModule from '../../files.mts'
import type { ClassicMELCloudDevice } from '../../types/classic.mts'
import type { ManifestDriver, Settings } from '../../types/index.mts'
import { getMockCallArg, mock } from '../helpers.js'

const mockSetFacadeManager = vi.fn<() => void>()

// eslint-disable-next-line vitest/prefer-import-in-mock -- Mock App constructor is not assignable to typeof App
vi.mock('../../lib/homey.mts', () => ({
  App: Function,
}))

vi.mock(
  import('../../lib/classic-facade-manager.mts'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    setClassicFacadeManager: mockSetFacadeManager,
  }),
)

// eslint-disable-next-line vitest/prefer-import-in-mock -- Partial mock data is not assignable to the full file exports
vi.mock('../../files.mts', async (importOriginal) => {
  const original = await importOriginal<typeof FilesModule>()
  return {
    ...original,
    changelog: {
      ...original.changelog,
      '1.0.0': { en: 'English changelog', nl: 'Dutch changelog' },
    },
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
  }
})

const mockApiInstance = {
  authenticate: vi.fn<() => Promise<boolean>>(),
  clearSync: vi.fn(),
  getErrorLog: vi.fn<() => Promise<ErrorLog>>(),
  registry: {
    areas: { getById: vi.fn() },
    buildings: { getById: vi.fn() },
    devices: { getById: vi.fn() },
    floors: { getById: vi.fn() },
    getDevicesByType: vi.fn().mockReturnValue([]),
  },
}

const mockHomeRegistry = {
  getById: vi.fn(),
  getByType: vi.fn(),
}

const mockHomeApiInstance = {
  authenticate: vi.fn<() => Promise<boolean>>(),
  clearSync: vi.fn(),
  list: vi.fn(),
  registry: mockHomeRegistry,
}

const mockFacadeManagerGet = vi.fn()
const mockFacadeManagerGetZones = vi.fn().mockReturnValue([])

const { mockCreate, mockFacadeManagerConstructor, mockHomeCreate } = vi.hoisted(
  () => ({
    mockCreate: vi.fn(),
    mockFacadeManagerConstructor: vi.fn(),
    mockHomeCreate: vi.fn(),
  }),
)

// eslint-disable-next-line vitest/prefer-import-in-mock -- Mock API classes lack prototype/static members required by typeof ClassicAPI
vi.mock('@olivierzal/melcloud-api', async (importOriginal) => ({
  ...(await importOriginal()),
  ClassicAPI: {
    create: mockCreate,
  },
  ClassicFacadeManager: mockFacadeManagerConstructor,
  HomeAPI: {
    create: mockHomeCreate,
  },
}))

const { default: MelCloudApp } = await import('../../app.mts')

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
    capabilities: [],
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
  mockCreate.mockResolvedValue(mockApiInstance)
  mockHomeCreate.mockResolvedValue(mockHomeApiInstance)
  // eslint-disable-next-line prefer-arrow-callback -- Constructor mock requires function expression for `new` semantics
  mockFacadeManagerConstructor.mockImplementation(function mockConstructor() {
    return mock<ClassicFacadeManager>({
      get: mockFacadeManagerGet,
      getZones: mockFacadeManagerGetZones,
    })
  })
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

const initWithFacade = async (
  app: InstanceType<typeof MelCloudApp>,
  facade: BuildingFacade | ZoneFacade,
): Promise<void> => {
  mockFacadeManagerGet.mockReturnValue(facade)
  mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
  await app.onInit()
}

const createMockDriver = (
  devices: ClassicMELCloudDevice[],
): {
  getDevices: ReturnType<typeof vi.fn>
  ready: ReturnType<typeof vi.fn>
} => ({
  getDevices: vi.fn().mockReturnValue(devices),
  ready: vi.fn<() => Promise<void>>().mockResolvedValue(),
})

const getOnSyncCallback = (): ((params?: {
  ids?: number[]
  type?: number
}) => Promise<void>) => {
  const config = getMockCallArg<{
    onSync: (params?: { ids?: number[]; type?: number }) => Promise<void>
  }>(mockCreate, 0, 0)
  return config.onSync
}

const createSyncDevice = (
  id: number,
  syncFromDevice = vi.fn<() => Promise<void>>().mockResolvedValue(),
): {
  device: ClassicMELCloudDevice
  syncFromDevice: ReturnType<typeof vi.fn>
} => ({
  device: mock<ClassicMELCloudDevice>({
    driver: { id: 'melcloud' },
    getSettings: vi.fn().mockReturnValue({}),
    id,
    syncFromDevice,
  }),
  syncFromDevice,
})

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

  describe('initialization', () => {
    it('should initialize the API and facade manager', async () => {
      await app.onInit()

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'en',
          timezone: 'Europe/Paris',
        }),
      )
      expect(mockHomeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: expect.objectContaining({
            error: expect.any(Function) as unknown,
            log: expect.any(Function) as unknown,
          }),
          settingManager: expect.objectContaining({
            get: expect.any(Function) as unknown,
            set: expect.any(Function) as unknown,
          }),
        }),
      )
      expect(ClassicFacadeManager).toHaveBeenCalledTimes(1)
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

      const { logger } = getMockCallArg<{
        logger: {
          error: (...args: unknown[]) => void
          log: (...args: unknown[]) => void
        }
      }>(mockCreate, 0, 0)
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

  describe('uninitialization', () => {
    it('should clear sync', async () => {
      await app.onInit()
      await app.onUninit()

      expect(mockApiInstance.clearSync).toHaveBeenCalledTimes(1)
      expect(mockHomeApiInstance.clearSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('ata capabilities', () => {
    it('should return localized capability configs', async () => {
      await app.onInit()
      const capabilities = app.getClassicAtaCapabilities()

      expect(capabilities).toBeInstanceOf(Array)
      expect(capabilities.length).toBeGreaterThan(0)

      const [firstCapability] = capabilities

      expect(firstCapability).toBeDefined()

      const [firstKey, firstOptions] = firstCapability ?? ['', {}]

      expect(firstKey).toBe('Power')
      expect(firstOptions).toHaveProperty('title')
      expect(firstOptions).toHaveProperty('type')
    })

    it('should filter out off mode from thermostat values', async () => {
      await app.onInit()
      const capabilities = app.getClassicAtaCapabilities()
      const [, operationModeOptions] =
        capabilities.find(([key]) => key === 'OperationMode') ?? []

      expect(operationModeOptions).toBeDefined()
      expect(
        operationModeOptions?.values?.find((value) => value.id === 'off'),
      ).toBeUndefined()
    })
  })

  describe('ata detailed states', () => {
    it('should return detailed states for ATA devices', async () => {
      const mockFacade = mock<BuildingFacade>({
        devices: [
          {
            data: { FanSpeed: 3, Power: true, SetTemperature: 21 },
            type: DeviceType.Ata,
          },
        ],
      })
      await initWithFacade(app, mockFacade)

      const detailedValues = app.getClassicAtaDetailedStates({
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
          },
          {
            data: mock<ListDeviceDataAta>({
              FanSpeed: 2,
              Power: false,
              SetTemperature: 19,
            }),
            type: DeviceType.Ata,
          },
        ],
      })
      await initWithFacade(app, mockFacade)

      const detailedValues = app.getClassicAtaDetailedStates({
        status: 'on',
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(detailedValues.Power).toStrictEqual([true])
    })

    it('should throw when no devices found', async () => {
      const mockFacade = mock<BuildingFacade>({ devices: [] })
      await initWithFacade(app, mockFacade)

      expect(() =>
        app.getClassicAtaDetailedStates({ zoneId: '1', zoneType: 'buildings' }),
      ).toThrow('errors.deviceNotFound')
    })
  })

  describe('ata values', () => {
    it('should delegate to facade getGroup', async () => {
      const mockGroupState = mock<GroupState>()
      const mockFacade = mock<BuildingFacade>({
        getGroup: vi
          .fn<() => Promise<GroupState>>()
          .mockResolvedValue(mockGroupState),
      })
      await initWithFacade(app, mockFacade)

      const groupState = await app.getClassicAtaState({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(groupState).toBe(mockGroupState)
    })
  })

  describe('device settings retrieval', () => {
    it('should aggregate device settings', async () => {
      const mockDevice1 = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
      })
      const mockDevice2 = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
      })
      const mockDriver = createMockDriver([mockDevice1, mockDevice2])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings['melcloud']?.['always_on']).toBe(true)
    })

    it('should set to null when settings differ between devices', async () => {
      const mockDevice1 = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
      })
      const mockDevice2 = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSettings: vi.fn().mockReturnValue({ always_on: false }),
      })
      const mockDriver = createMockDriver([mockDevice1, mockDevice2])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings['melcloud']?.['always_on']).toBeNull()
    })
  })

  describe('driver settings retrieval', () => {
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

  describe('error retrieval', () => {
    it('should format dates and resolve device names from api error log', async () => {
      const deviceName = 'Living Room'
      mockApiInstance.getErrorLog.mockResolvedValue({
        errors: [
          { date: '2026-03-28T14:30:00.000Z', deviceId: 42, error: 'test' },
        ],
        fromDate: '2026-03-01',
        nextFromDate: '2026-03-15',
        nextToDate: '2026-03-31',
      })
      mockApiInstance.registry.devices.getById.mockReturnValue({
        name: deviceName,
      })
      await app.onInit()

      const query = mock<ErrorLogQuery>()
      const errorLog = await app.getClassicErrorLog(query)

      expect(mockApiInstance.getErrorLog).toHaveBeenCalledWith(query)
      expect(errorLog).toStrictEqual({
        errors: [
          {
            date: expect.not.stringContaining('2026-03-28T'),
            device: deviceName,
            error: 'test',
          },
        ],
        fromDateHuman: expect.not.stringContaining('2026-03-01'),
        nextFromDate: '2026-03-15',
        nextToDate: '2026-03-31',
      })
    })

    it('should fall back to empty device name when device is not in registry', async () => {
      mockApiInstance.getErrorLog.mockResolvedValue({
        errors: [
          { date: '2026-03-28T14:30:00.000Z', deviceId: 999, error: 'test' },
        ],
        fromDate: '2026-03-01',
        nextFromDate: '2026-03-15',
        nextToDate: '2026-03-31',
      })
      mockApiInstance.registry.devices.getById.mockReset()
      await app.onInit()

      const query = mock<ErrorLogQuery>()
      const errorLog = await app.getClassicErrorLog(query)

      expect(errorLog.errors[0]?.device).toBe('')
    })
  })

  describe('facade retrieval', () => {
    it('should return facade for a valid zone', async () => {
      const mockInstance = { id: 1 }
      const mockFacade = mock<BuildingFacade>()
      mockApiInstance.registry.buildings.getById.mockReturnValue(mockInstance)
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      await app.onInit()

      const facade = app.getClassicFacade('buildings', '1')

      expect(facade).toBe(mockFacade)
    })

    it('should throw for zone not found', async () => {
      mockApiInstance.registry.buildings.getById.mockReset()
      await app.onInit()

      expect(() => app.getClassicFacade('buildings', '999')).toThrow(
        'errors.zoneNotFound',
      )
      expect(mockTranslate).toHaveBeenCalledWith('errors.zoneNotFound')
    })

    it('should throw with device error for device type', async () => {
      mockApiInstance.registry.devices.getById.mockReset()
      await app.onInit()

      expect(() => app.getClassicFacade('devices', '999')).toThrow(
        'errors.deviceNotFound',
      )
      expect(mockTranslate).toHaveBeenCalledWith('errors.deviceNotFound')
    })
  })

  describe('device listing by type', () => {
    it('should delegate to registry getDevicesByType', async () => {
      const mockDevices = [{ id: 1, name: 'Device 1' }]
      mockApiInstance.registry.getDevicesByType.mockReturnValue(mockDevices)
      await app.onInit()

      const result = app.getDevicesByType(DeviceType.Ata)

      expect(result).toBe(mockDevices)
      expect(mockApiInstance.registry.getDevicesByType).toHaveBeenCalledWith(
        DeviceType.Ata,
      )
    })
  })

  describe('home device listing by type', () => {
    it('should delegate to registry getByType after syncing', async () => {
      const mockModels = [{ id: 'device-1', name: 'Living Room' }]
      mockHomeApiInstance.list.mockResolvedValue([])
      mockHomeRegistry.getByType.mockReturnValue(mockModels)
      await app.onInit()

      const result = app.getHomeDevicesByType(HomeDeviceType.Ata)

      expect(result).toBe(mockModels)
      expect(mockHomeRegistry.getByType).toHaveBeenCalledWith(
        HomeDeviceType.Ata,
      )
    })
  })

  describe('home facade retrieval', () => {
    const mockModel = { id: 'device-1', name: 'Living Room' }

    it('should return a facade for a matching device', async () => {
      mockHomeApiInstance.list.mockResolvedValue([])
      mockHomeRegistry.getById.mockReturnValue(mockModel)
      await app.onInit()

      const facade = app.getHomeFacade('device-1')

      expect(facade).toBeInstanceOf(HomeDeviceAtaFacade)
      expect(mockHomeRegistry.getById).toHaveBeenCalledWith('device-1')
    })

    it('should throw when device is not found in registry', async () => {
      mockHomeApiInstance.list.mockResolvedValue([])
      mockHomeRegistry.getById.mockReset()
      await app.onInit()

      expect(() => app.getHomeFacade('device-1')).toThrow(
        'errors.deviceNotFound',
      )
      expect(mockTranslate).toHaveBeenCalledWith('errors.deviceNotFound')
    })
  })

  describe('frost protection settings retrieval', () => {
    it('should delegate to facade', async () => {
      const mockData = mock<FrostProtectionData>()
      const mockFacade = mock<ZoneFacade>({
        getFrostProtection: vi
          .fn<() => Promise<FrostProtectionData>>()
          .mockResolvedValue(mockData),
      })
      await initWithFacade(app, mockFacade)

      const frostProtection = await app.getClassicFrostProtection({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(frostProtection).toBe(mockData)
    })
  })

  describe('holiday mode settings retrieval', () => {
    it('should delegate to facade', async () => {
      const mockData = mock<HolidayModeData>()
      const mockFacade = mock<ZoneFacade>({
        getHolidayMode: vi
          .fn<() => Promise<HolidayModeData>>()
          .mockResolvedValue(mockData),
      })
      await initWithFacade(app, mockFacade)

      const holidayMode = await app.getClassicHolidayMode({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(holidayMode).toBe(mockData)
    })
  })

  describe('hourly temperature retrieval', () => {
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

      const temperatures = await app.getClassicHourlyTemperatures({
        deviceId: '1',
        hour: 10,
      })

      expect(temperatures).toBe(mockData)
    })
  })

  describe('operation mode retrieval', () => {
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

      const operationModes = await app.getClassicOperationModes({
        days: 7,
        deviceId: '1',
      })

      expect(operationModes).toBe(mockData)
    })
  })

  describe('signal retrieval', () => {
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

      const signal = await app.getClassicSignal({ deviceId: '1', hour: 5 })

      expect(signal).toBe(mockData)
    })
  })

  describe('temperature retrieval', () => {
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

      const temperatures = await app.getClassicTemperatures({
        days: 30,
        deviceId: '1',
      })

      expect(temperatures).toBe(mockData)
    })
  })

  describe('authentication', () => {
    it('should expose classicApi getter', async () => {
      await app.onInit()

      expect(app.classicApi).toBe(mockApiInstance)
    })

    it('should delegate to api authenticate', async () => {
      mockApiInstance.authenticate.mockResolvedValue(true)
      await app.onInit()

      const credentials = mock<LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      const isAuthenticated = await app.authenticateClassic(credentials)

      expect(isAuthenticated).toBe(true)
      expect(mockApiInstance.authenticate).toHaveBeenCalledWith(credentials)
    })
  })

  describe('home api', () => {
    it('should expose homeApi getter', async () => {
      await app.onInit()

      expect(app.homeApi).toBe(mockHomeApiInstance)
    })

    it('should delegate authenticateHome to homeApi authenticate', async () => {
      mockHomeApiInstance.authenticate.mockResolvedValue(true)
      await app.onInit()

      const isLoggedIn = await app.authenticateHome(mock<LoginCredentials>())

      expect(isLoggedIn).toBe(true)
    })

    it('should create home setting manager with camelCase key prefixing', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: {
          get: (key: string) => unknown
          set: (key: string, value: string) => void
        }
      }>(mockHomeCreate, 0, 0)
      settingManager.get('username')

      expect(mockSettingsGet).toHaveBeenCalledWith('homeUsername')

      settingManager.set('password', 'secret')

      expect(mockSettingsSet).toHaveBeenCalledWith('homePassword', 'secret')
    })

    it('should create classic setting manager without key prefixing', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: {
          get: (key: string) => unknown
          set: (key: string, value: string) => void
        }
      }>(mockCreate, 0, 0)
      settingManager.get('contextKey')

      expect(mockSettingsGet).toHaveBeenCalledWith('contextKey')

      settingManager.set('expiry', '2026-12-31')

      expect(mockSettingsSet).toHaveBeenCalledWith('expiry', '2026-12-31')
    })
  })

  describe('ata value update', () => {
    it('should set group values and not throw on success', async () => {
      const mockFacade = mock<BuildingFacade>({
        updateGroupState: vi.fn().mockResolvedValue({ AttributeErrors: null }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicAtaState({
          state: mock<GroupState>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<BuildingFacade>({
        updateGroupState: vi.fn().mockResolvedValue({
          AttributeErrors: { temp: ['Invalid value'] },
        }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicAtaState({
          state: mock<GroupState>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('temp: Invalid value')
    })
  })

  describe('device settings update', () => {
    it('should update changed settings on matching devices', async () => {
      const mockSetSettings = vi.fn<() => Promise<void>>().mockResolvedValue()
      const mockOnSettings = vi.fn<() => Promise<void>>().mockResolvedValue()
      const mockDevice = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSetting: vi.fn().mockReturnValue(false),
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
        onSettings: mockOnSettings,
        setSettings: mockSetSettings,
      })
      const mockDriver = createMockDriver([mockDevice])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.updateDeviceSettings({ settings })

      expect(mockSetSettings).toHaveBeenCalledWith({ always_on: true })
      expect(mockOnSettings).toHaveBeenCalledTimes(1)
    })

    it('should skip devices with no changed keys', async () => {
      const mockSetSettings = vi.fn()
      const mockDevice = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSetting: vi.fn().mockReturnValue(true),
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
        setSettings: mockSetSettings,
      })
      const mockDriver = createMockDriver([mockDevice])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.updateDeviceSettings({ settings })

      expect(mockSetSettings).not.toHaveBeenCalled()
    })

    it('should filter by driverId when provided', async () => {
      const mockDevice = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSetting: vi.fn().mockReturnValue(false),
        getSettings: vi.fn().mockReturnValue({ always_on: true }),
        onSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
        setSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
      })
      const mockDriver = createMockDriver([mockDevice])
      mockGetDriver.mockReturnValue(mockDriver)
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.updateDeviceSettings({ driverId: 'melcloud', settings })

      expect(mockGetDriver).toHaveBeenCalledWith('melcloud')
    })
  })

  describe('frost protection settings update', () => {
    it('should delegate to facade and not throw on success', async () => {
      const mockFacade = mock<ZoneFacade>({
        updateFrostProtection: vi
          .fn()
          .mockResolvedValue({ AttributeErrors: null }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicFrostProtection({
          settings: mock<FrostProtectionQuery>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<ZoneFacade>({
        updateFrostProtection: vi.fn().mockResolvedValue({
          AttributeErrors: { min: ['Too low'] },
        }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicFrostProtection({
          settings: mock<FrostProtectionQuery>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('min: Too low')
    })
  })

  describe('holiday mode settings update', () => {
    it('should delegate to facade and not throw on success', async () => {
      const mockFacade = mock<ZoneFacade>({
        updateHolidayMode: vi.fn().mockResolvedValue({ AttributeErrors: null }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicHolidayMode({
          settings: mock<HolidayModeQuery>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<ZoneFacade>({
        updateHolidayMode: vi.fn().mockResolvedValue({
          AttributeErrors: { date: ['Invalid date'] },
        }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicHolidayMode({
          settings: mock<HolidayModeQuery>(),
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
          capabilities: [],
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

      const callback = getMockCallArg<() => Promise<void>>(mockSetTimeout, 0, 0)
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

      const callback = getMockCallArg<() => Promise<void>>(mockSetTimeout, 0, 0)

      await expect(callback()).resolves.toBeUndefined()
    })
  })

  describe('device filtering by ids', () => {
    it('should filter devices by ids', async () => {
      const mockDevice1 = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSettings: vi.fn().mockReturnValue({}),
        id: 1,
      })
      const mockDevice2 = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud' },
        getSettings: vi.fn().mockReturnValue({}),
        id: 2,
      })
      const mockDriver = createMockDriver([mockDevice1, mockDevice2])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings).toBeDefined()
    })
  })

  describe('widget listener query filtering', () => {
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

      const ataCallback = getMockCallArg<(query: string) => unknown[]>(
        mockRegisterAta,
        0,
        1,
      )
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

      const chartsCallback = getMockCallArg<(query: string) => unknown[]>(
        mockRegisterCharts,
        0,
        1,
      )
      const result = chartsCallback('device 1')

      expect(result).toStrictEqual([{ model: 'devices', name: 'Device 1' }])
    })
  })

  describe('device synchronization via onSync callback', () => {
    it('should sync devices from onSync callback', async () => {
      const { device, syncFromDevice } = createSyncDevice(1)
      const mockDriver = createMockDriver([device])
      mockGetDriver.mockReturnValue(mockDriver)
      await app.onInit()

      await getOnSyncCallback()({ type: DeviceType.Ata })

      expect(syncFromDevice).toHaveBeenCalledTimes(1)
    })

    it('should sync devices with ids filter', async () => {
      const { device: device1, syncFromDevice } = createSyncDevice(1)
      const { device: device2 } = createSyncDevice(2)
      const mockDriver = createMockDriver([device1, device2])
      mockGetDriver.mockReturnValue(mockDriver)
      await app.onInit()

      await getOnSyncCallback()({ ids: [1], type: DeviceType.Ata })

      expect(syncFromDevice).toHaveBeenCalledTimes(1)
    })

    it('should sync all devices when no type specified', async () => {
      const { device, syncFromDevice } = createSyncDevice(1)
      const mockDriver = createMockDriver([device])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      await getOnSyncCallback()()

      expect(syncFromDevice).toHaveBeenCalledTimes(1)
    })

    it('should log error when device sync fails', async () => {
      const errorSpy = vi.fn()
      Object.defineProperty(app, 'error', {
        configurable: true,
        value: errorSpy,
      })
      const { device } = createSyncDevice(
        1,
        vi.fn<() => Promise<void>>().mockRejectedValue(new Error('sync error')),
      )
      const mockDriver = createMockDriver([device])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      await getOnSyncCallback()()

      expect(errorSpy).toHaveBeenCalledWith(
        'Device sync failed:',
        expect.any(Error),
      )
    })

    it('should continue syncing other devices when one fails', async () => {
      const errorSpy = vi.fn()
      Object.defineProperty(app, 'error', {
        configurable: true,
        value: errorSpy,
      })
      const { device: failingDevice } = createSyncDevice(
        1,
        vi.fn<() => Promise<void>>().mockRejectedValue(new Error('sync error')),
      )
      const { device: healthyDevice, syncFromDevice: healthySync } =
        createSyncDevice(2)
      const mockDriver = createMockDriver([failingDevice, healthyDevice])
      mockGetDrivers.mockReturnValue({ melcloud: mockDriver })
      await app.onInit()

      await getOnSyncCallback()()

      expect(healthySync).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith(
        'Device sync failed:',
        expect.any(Error),
      )
    })
  })

  describe('home device synchronization via onSync callback', () => {
    it('should sync home devices from onSync callback', async () => {
      const syncMock = vi.fn<() => Promise<void>>().mockResolvedValue()
      const mockDriver = createMockDriver([
        mock<ClassicMELCloudDevice>({ syncFromDevice: syncMock }),
      ])
      mockGetDriver.mockReturnValue(mockDriver)
      mockHomeApiInstance.list.mockResolvedValue([])
      await app.onInit()

      const { onSync } = getMockCallArg<{
        onSync: () => Promise<void>
      }>(mockHomeCreate, 0, 0)
      await onSync()

      expect(syncMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getDriverSettings with setting values', () => {
    it('should include values in driver settings when defined', async () => {
      const driversWithValues: ManifestDriver[] = [
        {
          capabilities: [],
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
