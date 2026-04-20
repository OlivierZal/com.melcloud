import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  SyncCallback,
} from '@olivierzal/melcloud-api'
import { Settings as LuxonSettings } from 'luxon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type * as FilesModule from '../../files.mts'
import type { ClassicMELCloudDevice } from '../../types/classic.mts'
import type { ManifestDriver } from '../../types/manifest.mts'
import type { Settings } from '../../types/settings.mts'
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
  authenticate: vi.fn<() => Promise<void>>(),
  clearSync: vi.fn<() => void>(),
  getErrorLog: vi.fn<() => Promise<Classic.ErrorLog>>(),
  registry: {
    areas: { getById: vi.fn<(id: number) => unknown>() },
    buildings: { getById: vi.fn<(id: number) => unknown>() },
    devices: { getById: vi.fn<(id: number) => unknown>() },
    floors: { getById: vi.fn<(id: number) => unknown>() },
    getDevicesByType: vi
      .fn<(type: Classic.DeviceType) => unknown[]>()
      .mockReturnValue([]),
  },
}

const mockHomeRegistry = {
  getById: vi.fn<(id: string) => unknown>(),
  getByType: vi.fn<(type: Home.DeviceType) => unknown[]>(),
}

const mockHomeApiInstance = {
  authenticate: vi.fn<() => Promise<void>>(),
  clearSync: vi.fn<() => void>(),
  list: vi.fn<() => Promise<unknown[]>>(),
  registry: mockHomeRegistry,
}

const mockFacadeManagerGet = vi.fn<(instance: unknown) => unknown>()
const mockFacadeManagerGetZones = vi
  .fn<(options?: { type?: Classic.DeviceType }) => unknown[]>()
  .mockReturnValue([])

const { mockCreate, mockFacadeManagerConstructor, mockHomeCreate } = vi.hoisted(
  () => ({
    mockCreate: vi.fn<(options: unknown) => Promise<unknown>>(),
    mockFacadeManagerConstructor: vi.fn<(...args: unknown[]) => unknown>(),
    mockHomeCreate: vi.fn<(options: unknown) => Promise<unknown>>(),
  }),
)

// eslint-disable-next-line vitest/prefer-import-in-mock -- Mock API classes lack prototype/static members required by typeof ClassicAPI
vi.mock('@olivierzal/melcloud-api/classic', async (importOriginal) => ({
  ...(await importOriginal()),
  API: {
    create: mockCreate,
  },
  FacadeManager: mockFacadeManagerConstructor,
}))

// eslint-disable-next-line vitest/prefer-import-in-mock -- Mock API classes lack prototype/static members required by typeof HomeAPI
vi.mock('@olivierzal/melcloud-api/home', async (importOriginal) => ({
  ...(await importOriginal()),
  API: {
    create: mockHomeCreate,
  },
}))

const { default: MelCloudApp } = await import('../../app.mts')

const mockGetLanguage = vi.fn<() => string>().mockReturnValue('en')
const mockGetTimezone = vi.fn<() => string>().mockReturnValue('Europe/Paris')
const mockSettingsGet = vi.fn<(key: string) => string | null>()
const mockSettingsSet = vi.fn<(key: string, value: string) => void>()
const mockSetTimeout =
  vi.fn<(callback: () => Promise<void> | void, ms: number) => void>()
const mockCreateNotification = vi.fn<() => Promise<void>>()
const mockWidgetRegister =
  vi.fn<(id: string, listener: (query: string) => unknown) => void>()
const mockGetWidget = vi
  .fn<
    (id: string) => {
      registerSettingAutocompleteListener: typeof mockWidgetRegister
    }
  >()
  .mockReturnValue({
    registerSettingAutocompleteListener: mockWidgetRegister,
  })
const mockGetDrivers = vi
  .fn<() => Record<string, unknown>>()
  .mockReturnValue({})
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
    return mock<Classic.FacadeManager>({
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
      drivers: { getDrivers: mockGetDrivers },
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
  facade: Classic.BuildingFacade | Classic.ZoneFacade,
): Promise<void> => {
  mockFacadeManagerGet.mockReturnValue(facade)
  mockApiInstance.registry.buildings.getById.mockReturnValue({ id: 1 })
  await app.onInit()
}

const initWithDeviceFacade = async (
  app: InstanceType<typeof MelCloudApp>,
  method: string,
  mockData: unknown,
): Promise<void> => {
  mockFacadeManagerGet.mockReturnValue(
    mock({
      [method]: vi.fn<() => Promise<unknown>>().mockResolvedValue(mockData),
    }),
  )
  mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
  await app.onInit()
}

const createMockDriver = (
  devices: ClassicMELCloudDevice[],
  id = 'melcloud',
): {
  getDevices: ReturnType<typeof vi.fn>
  id: string
  ready: ReturnType<typeof vi.fn>
} => ({
  getDevices: vi.fn<() => ClassicMELCloudDevice[]>().mockReturnValue(devices),
  id,
  ready: vi.fn<() => Promise<void>>().mockResolvedValue(),
})

const setupDriver = (
  devices: ClassicMELCloudDevice[],
  id = 'melcloud',
): void => {
  mockGetDrivers.mockReturnValue({ [id]: createMockDriver(devices, id) })
}

const createClassicDevice = (
  overrides: Partial<ClassicMELCloudDevice> = {},
): ClassicMELCloudDevice =>
  mock<ClassicMELCloudDevice>({
    driver: { id: 'melcloud' },
    getSettings: vi.fn<() => Record<string, unknown>>().mockReturnValue({}),
    ...overrides,
  })

const setupWidgetListeners = (): {
  mockRegisterAta: ReturnType<typeof vi.fn>
  mockRegisterCharts: ReturnType<typeof vi.fn>
} => {
  const mockRegisterAta =
    vi.fn<(id: string, listener: (query: string) => unknown) => void>()
  const mockRegisterCharts =
    vi.fn<(id: string, listener: (query: string) => unknown) => void>()
  mockGetWidget.mockImplementation((widgetId: string) =>
    widgetId === 'ata-group-setting' ?
      { registerSettingAutocompleteListener: mockRegisterAta }
    : { registerSettingAutocompleteListener: mockRegisterCharts },
  )
  return { mockRegisterAta, mockRegisterCharts }
}

const mockUpdateResult = (
  attributeErrors: Record<string, string[]> | null,
): ReturnType<typeof vi.fn> =>
  vi
    .fn<() => Promise<{ AttributeErrors: Record<string, string[]> | null }>>()
    .mockResolvedValue({ AttributeErrors: attributeErrors })

const getSyncCallbackFrom = (
  mockCreateFunction: ReturnType<typeof vi.fn>,
): SyncCallback =>
  getMockCallArg<{ events: { onSyncComplete: SyncCallback } }>(
    mockCreateFunction,
    0,
    0,
  ).events.onSyncComplete

const getSyncCallback = (): SyncCallback => getSyncCallbackFrom(mockCreate)

const getHomeSyncCallback = (): SyncCallback =>
  getSyncCallbackFrom(mockHomeCreate)

const createSyncDevice = (
  id: number,
  syncFromDevice = vi.fn<() => Promise<void>>().mockResolvedValue(),
): {
  device: ClassicMELCloudDevice
  syncFromDevice: ReturnType<typeof vi.fn>
} => ({
  device: mock<ClassicMELCloudDevice>({
    driver: { id: 'melcloud' },
    getSettings: vi.fn<() => Record<string, unknown>>().mockReturnValue({}),
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
      expect(Classic.FacadeManager).toHaveBeenCalledTimes(1)
      expect(mockSetFacadeManager).toHaveBeenCalledTimes(1)
    })

    it('should pass logger callbacks that delegate to app.log and app.error', async () => {
      const logMock = vi.fn<(...args: unknown[]) => void>()
      const errorMock = vi.fn<(...args: unknown[]) => void>()
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
      const mockFacade = mock<Classic.BuildingFacade>({
        devices: [
          {
            data: { FanSpeed: 3, Power: true, SetTemperature: 21 },
            type: Classic.DeviceType.Ata,
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
      const mockFacade = mock<Classic.BuildingFacade>({
        devices: [
          {
            data: mock<Classic.ListDeviceDataAta>({
              FanSpeed: 3,
              Power: true,
              SetTemperature: 21,
            }),
            type: Classic.DeviceType.Ata,
          },
          {
            data: mock<Classic.ListDeviceDataAta>({
              FanSpeed: 2,
              Power: false,
              SetTemperature: 19,
            }),
            type: Classic.DeviceType.Ata,
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
      const mockFacade = mock<Classic.BuildingFacade>({ devices: [] })
      await initWithFacade(app, mockFacade)

      expect(() =>
        app.getClassicAtaDetailedStates({ zoneId: '1', zoneType: 'buildings' }),
      ).toThrow('errors.deviceNotFound')
    })
  })

  describe('ata values', () => {
    it('should delegate to facade getGroup', async () => {
      const mockGroupState = mock<Classic.GroupState>()
      const mockFacade = mock<Classic.BuildingFacade>({
        getGroup: vi
          .fn<() => Promise<Classic.GroupState>>()
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
      setupDriver([
        createClassicDevice({
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: true }),
        }),
        createClassicDevice({
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: true }),
        }),
      ])
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings['melcloud']?.['always_on']).toBe(true)
    })

    it('should set to null when settings differ between devices', async () => {
      setupDriver([
        createClassicDevice({
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: true }),
        }),
        createClassicDevice({
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: false }),
        }),
      ])
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

      const query = mock<Classic.ErrorLogQuery>()
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

      const query = mock<Classic.ErrorLogQuery>()
      const errorLog = await app.getClassicErrorLog(query)

      expect(errorLog.errors[0]?.device).toBe('')
    })
  })

  describe('facade retrieval', () => {
    it('should return facade for a valid zone', async () => {
      const mockInstance = { id: 1 }
      const mockFacade = mock<Classic.BuildingFacade>()
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

      const result = app.getDevicesByType(Classic.DeviceType.Ata)

      expect(result).toBe(mockDevices)
      expect(mockApiInstance.registry.getDevicesByType).toHaveBeenCalledWith(
        Classic.DeviceType.Ata,
      )
    })
  })

  describe('home device listing by type', () => {
    it('should delegate to registry getByType after syncing', async () => {
      const mockModels = [{ id: 'device-1', name: 'Living Room' }]
      mockHomeApiInstance.list.mockResolvedValue([])
      mockHomeRegistry.getByType.mockReturnValue(mockModels)
      await app.onInit()

      const result = app.getHomeDevicesByType(Home.DeviceType.Ata)

      expect(result).toBe(mockModels)
      expect(mockHomeRegistry.getByType).toHaveBeenCalledWith(
        Home.DeviceType.Ata,
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

      expect(facade).toBeInstanceOf(Home.DeviceAtaFacade)
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
      const mockData = mock<Classic.FrostProtectionData>()
      const mockFacade = mock<Classic.ZoneFacade>({
        getFrostProtection: vi
          .fn<() => Promise<Classic.FrostProtectionData>>()
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
      const mockData = mock<Classic.HolidayModeData>()
      const mockFacade = mock<Classic.ZoneFacade>({
        getHolidayMode: vi
          .fn<() => Promise<Classic.HolidayModeData>>()
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
      await initWithDeviceFacade(app, 'getHourlyTemperatures', mockData)

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
      await initWithDeviceFacade(app, 'getOperationModes', mockData)

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
      await initWithDeviceFacade(app, 'getSignalStrength', mockData)

      const signal = await app.getClassicSignal({ deviceId: '1', hour: 5 })

      expect(signal).toBe(mockData)
    })
  })

  describe('temperature retrieval', () => {
    it('should delegate to device facade with date range', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithDeviceFacade(app, 'getTemperatures', mockData)

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
      mockApiInstance.authenticate.mockResolvedValue()
      await app.onInit()

      const credentials = mock<Classic.LoginCredentials>({
        password: 'pass',
        username: 'user',
      })
      await app.classicApi.authenticate(credentials)

      expect(mockApiInstance.authenticate).toHaveBeenCalledWith(credentials)
    })

    it('should propagate authenticate errors', async () => {
      const error = new Error('invalid credentials')
      mockApiInstance.authenticate.mockRejectedValue(error)
      await app.onInit()

      await expect(
        app.classicApi.authenticate(mock<Classic.LoginCredentials>()),
      ).rejects.toThrow(error)
    })
  })

  describe('home api', () => {
    it('should expose homeApi getter', async () => {
      await app.onInit()

      expect(app.homeApi).toBe(mockHomeApiInstance)
    })

    it('should delegate homeAuthenticate to homeApi authenticate', async () => {
      mockHomeApiInstance.authenticate.mockResolvedValue()
      await app.onInit()
      const credentials = mock<Classic.LoginCredentials>()

      await app.homeApi.authenticate(credentials)

      expect(mockHomeApiInstance.authenticate).toHaveBeenCalledWith(credentials)
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
      await initWithFacade(
        app,
        mock<Classic.BuildingFacade>({
          updateGroupState: mockUpdateResult(null),
        }),
      )

      await expect(
        app.updateClassicAtaState({
          state: mock<Classic.GroupState>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      await initWithFacade(
        app,
        mock<Classic.BuildingFacade>({
          updateGroupState: mockUpdateResult({ temp: ['Invalid value'] }),
        }),
      )

      await expect(
        app.updateClassicAtaState({
          state: mock<Classic.GroupState>(),
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
      setupDriver([
        createClassicDevice({
          getSetting: vi
            .fn<ClassicMELCloudDevice['getSetting']>()
            .mockReturnValue(false as never),
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: true }),
          onSettings: mockOnSettings,
          setSettings: mockSetSettings,
        }),
      ])
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.updateDeviceSettings({ settings })

      expect(mockSetSettings).toHaveBeenCalledWith({ always_on: true })
      expect(mockOnSettings).toHaveBeenCalledTimes(1)
    })

    it('should skip devices with no changed keys', async () => {
      const mockSetSettings = vi.fn<() => Promise<void>>()
      setupDriver([
        createClassicDevice({
          getSetting: vi
            .fn<ClassicMELCloudDevice['getSetting']>()
            .mockReturnValue(true as never),
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: true }),
          setSettings: mockSetSettings,
        }),
      ])
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.updateDeviceSettings({ settings })

      expect(mockSetSettings).not.toHaveBeenCalled()
    })

    it('should filter by driverId when provided', async () => {
      const mockDevice = createClassicDevice({
        getSetting: vi
          .fn<ClassicMELCloudDevice['getSetting']>()
          .mockReturnValue(false as never),
        getSettings: vi
          .fn<() => Record<string, unknown>>()
          .mockReturnValue({ always_on: true }),
        onSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
        setSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
      })
      const otherDevice = mock<ClassicMELCloudDevice>({
        driver: { id: 'melcloud_atw' },
        getSetting: vi
          .fn<ClassicMELCloudDevice['getSetting']>()
          .mockReturnValue(false as never),
        getSettings: vi
          .fn<() => Record<string, unknown>>()
          .mockReturnValue({ always_on: true }),
        onSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
        setSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
      })
      mockGetDrivers.mockReturnValue({
        melcloud: createMockDriver([mockDevice]),
        melcloud_atw: createMockDriver([otherDevice], 'melcloud_atw'),
      })
      await app.onInit()

      const settings = mock<Settings>({ always_on: true })
      await app.updateDeviceSettings({ driverId: 'melcloud', settings })

      expect(mockDevice.setSettings).toHaveBeenCalledWith({ always_on: true })
      expect(otherDevice.setSettings).not.toHaveBeenCalled()
    })
  })

  describe('frost protection settings update', () => {
    it('should delegate to facade and not throw on success', async () => {
      await initWithFacade(
        app,
        mock<Classic.ZoneFacade>({
          updateFrostProtection: mockUpdateResult(null),
        }),
      )

      await expect(
        app.updateClassicFrostProtection({
          settings: mock<Classic.FrostProtectionQuery>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      await initWithFacade(
        app,
        mock<Classic.ZoneFacade>({
          updateFrostProtection: mockUpdateResult({ min: ['Too low'] }),
        }),
      )

      await expect(
        app.updateClassicFrostProtection({
          settings: mock<Classic.FrostProtectionQuery>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('min: Too low')
    })
  })

  describe('holiday mode settings update', () => {
    it('should delegate to facade and not throw on success', async () => {
      await initWithFacade(
        app,
        mock<Classic.ZoneFacade>({ updateHolidayMode: mockUpdateResult(null) }),
      )

      await expect(
        app.updateClassicHolidayMode({
          settings: mock<Classic.HolidayModeQuery>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).resolves.toBeUndefined()
    })

    it('should throw on attribute errors', async () => {
      const mockFacade = mock<Classic.ZoneFacade>({
        updateHolidayMode: mockUpdateResult({ date: ['Invalid date'] }),
      })
      await initWithFacade(app, mockFacade)

      await expect(
        app.updateClassicHolidayMode({
          settings: mock<Classic.HolidayModeQuery>(),
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
      setupDriver([
        createClassicDevice({ id: 1 }),
        createClassicDevice({ id: 2 }),
      ])
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings).toBeDefined()
    })
  })

  describe('widget listener query filtering', () => {
    it('should filter zones by query for ata-group-setting widget', async () => {
      const { mockRegisterAta } = setupWidgetListeners()
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
      const { mockRegisterCharts } = setupWidgetListeners()
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
      setupDriver([device])
      await app.onInit()

      await getSyncCallback()({ type: Classic.DeviceType.Ata })

      expect(syncFromDevice).toHaveBeenCalledTimes(1)
    })

    it('should sync devices with ids filter', async () => {
      const { device: device1, syncFromDevice } = createSyncDevice(1)
      const { device: device2 } = createSyncDevice(2)
      setupDriver([device1, device2])
      await app.onInit()

      await getSyncCallback()({ ids: [1], type: Classic.DeviceType.Ata })

      expect(syncFromDevice).toHaveBeenCalledTimes(1)
    })

    it('should sync all devices when no type specified', async () => {
      const { device, syncFromDevice } = createSyncDevice(1)
      setupDriver([device])
      await app.onInit()

      await getSyncCallback()()

      expect(syncFromDevice).toHaveBeenCalledTimes(1)
    })

    it('should log error when device sync fails', async () => {
      const errorSpy = vi.fn<(...args: unknown[]) => void>()
      Object.defineProperty(app, 'error', {
        configurable: true,
        value: errorSpy,
      })
      const { device } = createSyncDevice(
        1,
        vi.fn<() => Promise<void>>().mockRejectedValue(new Error('sync error')),
      )
      setupDriver([device])
      await app.onInit()

      await getSyncCallback()()

      expect(errorSpy).toHaveBeenCalledWith(
        'Device sync failed:',
        expect.any(Error),
      )
    })

    it('should continue syncing other devices when one fails', async () => {
      const errorSpy = vi.fn<(...args: unknown[]) => void>()
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
      setupDriver([failingDevice, healthyDevice])
      await app.onInit()

      await getSyncCallback()()

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
      setupDriver(
        [mock<ClassicMELCloudDevice>({ syncFromDevice: syncMock })],
        'home-melcloud',
      )
      mockHomeApiInstance.list.mockResolvedValue([])
      await app.onInit()

      await getHomeSyncCallback()()

      expect(syncMock).toHaveBeenCalledTimes(1)
    })

    it('should filter home devices by string UUID ids', async () => {
      const syncTarget = vi.fn<() => Promise<void>>().mockResolvedValue()
      const syncOther = vi.fn<() => Promise<void>>().mockResolvedValue()
      setupDriver(
        [
          mock<ClassicMELCloudDevice>({
            id: 'e9f997d3-d537-4628-aeed-ad638fad6515',
            syncFromDevice: syncTarget,
          }),
          mock<ClassicMELCloudDevice>({
            id: '6b0cb3af-d35e-4c03-bb26-e837c50f218d',
            syncFromDevice: syncOther,
          }),
        ],
        'home-melcloud',
      )
      mockHomeApiInstance.list.mockResolvedValue([])
      await app.onInit()

      await getHomeSyncCallback()({
        ids: ['e9f997d3-d537-4628-aeed-ad638fad6515'],
      })

      expect(syncTarget).toHaveBeenCalledTimes(1)
      expect(syncOther).not.toHaveBeenCalled()
    })

    it('should silently skip sync when driver is not yet registered', async () => {
      const syncMock = vi.fn<() => Promise<void>>().mockResolvedValue()
      mockGetDrivers.mockReturnValue({})
      mockHomeApiInstance.list.mockResolvedValue([])
      await app.onInit()

      await getHomeSyncCallback()()

      expect(syncMock).not.toHaveBeenCalled()
    })

    it('should wire the same onSync callback on both Classic and Home APIs', async () => {
      mockHomeApiInstance.list.mockResolvedValue([])
      await app.onInit()

      expect(getSyncCallback()).toBe(getHomeSyncCallback())
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
