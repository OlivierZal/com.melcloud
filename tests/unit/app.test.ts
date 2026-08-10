import {
  type HolidayModeState,
  type HolidayModeUpdate,
  type LoginCredentials,
  type ProtectionState,
  type ProtectionUpdate,
  type ReportChartLineOptions,
  type ReportChartPieOptions,
  type Result,
  type SyncCallback,
  err,
  NoChangesError,
  ok,
  UpdateRejectedError,
} from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type * as FilesModule from '../../files.mts'
import type * as HomeyLib from '../../lib/homey.mts'
import type { ClassicMELCloudDevice } from '../../types/classic.mts'
import type { Settings } from '../../types/device-settings.mts'
import type { ManifestDriver } from '../../types/manifest.mts'
import { getMockCallArg, mock, settleDetached } from '../helpers.ts'

const mockSetFacadeManager = vi.fn<() => void>()

vi.mock(import('../../lib/homey.mts'), async () => {
  const { mock: mockModule } = await import('../helpers.ts')
  return mockModule<typeof HomeyLib>({ App: Function })
})

vi.mock(
  import('../../lib/classic-facade-manager.mts'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    setClassicFacadeManager: mockSetFacadeManager,
  }),
)

vi.mock(import('../../files.mts'), async (importOriginal) => {
  const { mock: mockModule } = await import('../helpers.ts')
  const original = await importOriginal()
  return mockModule<typeof FilesModule>({
    ...original,
    changelog: {
      ...original.changelog,
      '1.0.0': { en: 'English changelog', nl: 'Dutch changelog' },
    },
    fanSpeed: { title: { en: 'Fan speed' }, type: 'enum' },
    horizontal: {
      title: { en: 'Horizontal' },
      type: 'enum',
      values: [{ id: 'auto', title: { en: 'Auto' } }],
    },
    power: { title: { en: 'Power' }, type: 'boolean' },
    targetTemperature: {
      // Shaped like the vendored capability: no root step, the stated
      // one riding on its flow argument.
      $flow: { actions: [{ args: [{ step: 0.5 }] }] },
      title: { en: 'Set temperature' },
      type: 'number',
    },
    thermostatMode: { title: { en: 'Thermostat mode' }, type: 'enum' },
    vertical: {
      title: { en: 'Vertical' },
      type: 'enum',
      values: [{ id: 'auto', title: { en: 'Auto' } }],
    },
  })
})

const mockApiInstance = {
  authenticate: vi.fn<() => Promise<void>>(),
  clearSync: vi.fn<() => void>(),
  getErrorLog: vi.fn<() => Promise<Result<Classic.ErrorLog>>>(),
  isAuthenticated: vi.fn<() => boolean>().mockReturnValue(true),
  registry: {
    areas: { getById: vi.fn<(id: number) => unknown>() },
    buildings: { getById: vi.fn<(id: number) => unknown>() },
    devices: { getById: vi.fn<(id: number) => unknown>() },
    floors: { getById: vi.fn<(id: number) => unknown>() },
    getDevices: vi.fn<() => unknown[]>().mockReturnValue([]),
    getDevicesByType: vi
      .fn<(type: Classic.DeviceType) => unknown[]>()
      .mockReturnValue([]),
  },
}

const mockHomeRegistry = {
  getBuildings: vi
    .fn<(params?: { type?: Home.DeviceType }) => unknown[]>()
    .mockReturnValue([]),
  getById: vi.fn<(id: string) => unknown>(),
  getDevices: vi.fn<() => unknown[]>().mockReturnValue([]),
  getDevicesByType: vi
    .fn<(type: Home.DeviceType) => unknown[]>()
    .mockReturnValue([]),
  getZones: vi
    .fn<(params?: { type?: Home.DeviceType }) => unknown[]>()
    .mockReturnValue([]),
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
const mockHomeFacadeManagerGet = vi.fn<(model: unknown) => unknown>()
const mockHomeFacadeManagerGetZones =
  vi.fn<(params?: { type?: Home.DeviceType }) => unknown[]>()
const mockHomeFacadeManagerGetBuilding = vi.fn<(id: string) => unknown>()
const mockHomeFacadeManagerUpdateFrostProtection =
  vi.fn<Home.FacadeManager['updateFrostProtection']>()
const mockHomeFacadeManagerUpdateHolidayMode =
  vi.fn<Home.FacadeManager['updateHolidayMode']>()
const mockHomeFacadeManagerUpdateOverheatProtection =
  vi.fn<Home.FacadeManager['updateOverheatProtection']>()

const {
  mockCreate,
  mockFacadeManagerConstructor,
  mockHomeCreate,
  mockHomeFacadeManagerConstructor,
} = vi.hoisted(() => ({
  mockCreate: vi.fn<(options: unknown) => Promise<unknown>>(),
  mockFacadeManagerConstructor: vi.fn<(...args: unknown[]) => unknown>(),
  mockHomeCreate: vi.fn<(options: unknown) => Promise<unknown>>(),
  mockHomeFacadeManagerConstructor: vi.fn<(...args: unknown[]) => unknown>(),
}))

vi.mock(import('@olivierzal/melcloud-api/classic'), async (importOriginal) => {
  const { mock: mockModule } = await import('../helpers.ts')
  return mockModule<typeof Classic>({
    ...(await importOriginal()),
    API: { create: mockCreate },
    FacadeManager: mockFacadeManagerConstructor,
  })
})

vi.mock(import('@olivierzal/melcloud-api/home'), async (importOriginal) => {
  const { mock: mockModule } = await import('../helpers.ts')
  return mockModule<typeof Home>({
    ...(await importOriginal()),
    API: { create: mockHomeCreate },
    FacadeManager: mockHomeFacadeManagerConstructor,
  })
})

const { default: MelCloudApp } = await import('../../app.mts')

const mockGetLanguage = vi.fn<() => string>().mockReturnValue('en')
const mockGetTimezone = vi.fn<() => string>().mockReturnValue('Europe/Paris')
// Homey's settings.get is untyped (`any`): the manager must survive
// non-string values, so the mock mirrors that width.
const mockSettingsGet = vi.fn<(key: string) => unknown>()
const mockSettingsSet = vi.fn<(key: string, value: string) => void>()
const mockSettingsUnset = vi.fn<(key: string) => void>()
const mockSetTimeout =
  vi.fn<(callback: () => Promise<void> | void, ms: number) => void>()
const mockCreateNotification = vi.fn<() => Promise<void>>()

const mockRealtime = vi.fn<(event: string, data: unknown) => void>()
const mockHomeyReady = vi.fn<() => Promise<void>>().mockResolvedValue()
const mockWidgetRegister =
  vi.fn<(id: string, listener: (query: string) => unknown) => void>()
const mockGetWidget = vi
  .fn<
    (id: string) => {
      registerSettingAutocompleteListener: typeof mockWidgetRegister
    }
  >()
  .mockReturnValue({ registerSettingAutocompleteListener: mockWidgetRegister })
const mockGetDrivers = vi
  .fn<() => Record<string, unknown>>()
  .mockReturnValue({})
const mockActionRegisterAutocomplete =
  vi.fn<(name: string, listener: (query: string) => unknown) => void>()
const mockActionRegisterRun =
  vi.fn<(listener: (args: never) => Promise<unknown>) => void>()
const mockGetActionCard =
  vi.fn<
    (id: string) => {
      registerArgumentAutocompleteListener: typeof mockActionRegisterAutocomplete
      registerRunListener: typeof mockActionRegisterRun
    }
  >()
const mockConditionRegisterAutocomplete =
  vi.fn<(name: string, listener: (query: string) => unknown) => void>()
const mockConditionRegisterRun =
  vi.fn<(listener: (args: never) => Promise<unknown>) => void>()
const mockGetConditionCard =
  vi.fn<
    (id: string) => {
      registerArgumentAutocompleteListener: typeof mockConditionRegisterAutocomplete
      registerRunListener: typeof mockConditionRegisterRun
    }
  >()
const mockTranslate = vi
  .fn<(key: string) => string>()
  .mockImplementation((key: string) => key)

const mockManifestDrivers: ManifestDriver[] = [
  {
    capabilities: [],
    capabilitiesOptions: {
      target_temperature: {
        max: 31,
        min: 10,
        title: { en: 'Target temperature' },
        type: 'number',
      },
      thermostat_mode: {
        title: { en: 'Mode' },
        type: 'enum',
        values: [
          { id: 'heat', title: { en: 'Heat' } },
          { id: 'cool', title: { en: 'Cool' } },
          { id: 'eco', title: { en: 'Eco' } },
          { id: 'off', title: { en: 'Off' } },
        ],
      },
    },
    class: 'thermostat',
    id: 'melcloud',
    name: { en: 'melcloud' },
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
  {
    capabilities: [],
    class: 'thermostat',
    id: 'melcloud-login',
    name: { en: 'melcloud-login' },
    pair: [
      {
        id: 'login',
        options: {
          passwordLabel: { en: 'Password' },
          passwordPlaceholder: 'Your password',
          usernameLabel: { en: 'Email', nl: 'E-mail' },
          usernamePlaceholder: 'Your email',
        },
      },
    ],
  },
  {
    capabilities: [],
    class: 'thermostat',
    id: 'melcloud-odd',
    name: { en: 'melcloud-odd' },
    settings: [
      {
        children: [
          {
            id: 'orphan',
            label: { en: 'Orphan' },
            type: 'dropdown',
            values: [{ id: 'first', label: { en: 'First' } }],
          },
        ],
        label: { en: 'No group id' },
      },
      { id: 'group2', label: { en: 'Childless' } },
    ],
  },
]

// `new`-able (arrows are not constructible): vitest instantiates the
// implementation when the mocked FacadeManager class is constructed.
const newMockFacadeManager =
  function newMockFacadeManager(): Classic.FacadeManager {
    return mock<Classic.FacadeManager>({
      get: mockFacadeManagerGet,
      getZones: mockFacadeManagerGetZones,
    })
  }

const newMockHomeFacadeManager =
  function newMockHomeFacadeManager(): Home.FacadeManager {
    return mock<Home.FacadeManager>({
      get: mockHomeFacadeManagerGet,
      getBuilding: mockHomeFacadeManagerGetBuilding,
      getZones: mockHomeFacadeManagerGetZones,
      updateFrostProtection: mockHomeFacadeManagerUpdateFrostProtection,
      updateHolidayMode: mockHomeFacadeManagerUpdateHolidayMode,
      updateOverheatProtection: mockHomeFacadeManagerUpdateOverheatProtection,
    })
  }

// Models the group surface the ATA device facade gains with the melcloud-api
// device-as-group-of-one contract this feature tracks.
type ClassicAtaDeviceGroupFacade = Classic.DeviceFacade<
  typeof Classic.DeviceType.Ata
> &
  Pick<Classic.ZoneFacade, 'getGroup' | 'updateGroupState'>

const setupMocks = (): void => {
  mockCreate.mockResolvedValue(mockApiInstance)
  mockHomeCreate.mockResolvedValue(mockHomeApiInstance)
  mockFacadeManagerConstructor.mockImplementation(newMockFacadeManager)
  mockHomeFacadeManagerConstructor.mockImplementation(newMockHomeFacadeManager)
  mockHomeFacadeManagerGetZones.mockReturnValue([])
  mockGetLanguage.mockReturnValue('en')
  mockGetTimezone.mockReturnValue('Europe/Paris')
  mockTranslate.mockImplementation((key: string) => key)
  mockGetWidget.mockReturnValue({
    registerSettingAutocompleteListener: mockWidgetRegister,
  })
  mockGetActionCard.mockReturnValue({
    registerArgumentAutocompleteListener: mockActionRegisterAutocomplete,
    registerRunListener: mockActionRegisterRun,
  })
  mockGetConditionCard.mockReturnValue({
    registerArgumentAutocompleteListener: mockConditionRegisterAutocomplete,
    registerRunListener: mockConditionRegisterRun,
  })
}

const createApp = (): InstanceType<typeof MelCloudApp> => {
  const app = new MelCloudApp()
  // The mocked App base is a bare Function: give every instance the
  // log/error methods the boot marks rely on (tests override at will).
  Object.defineProperties(app, {
    error: { configurable: true, value: vi.fn<(...args: unknown[]) => void>() },
    homey: {
      configurable: true,
      value: {
        __: mockTranslate,
        api: { realtime: mockRealtime },
        clock: { getTimezone: mockGetTimezone },
        dashboards: { getWidget: mockGetWidget },
        drivers: { getDrivers: mockGetDrivers },
        flow: {
          getActionCard: mockGetActionCard,
          getConditionCard: mockGetConditionCard,
        },
        i18n: { getLanguage: mockGetLanguage },
        manifest: { drivers: mockManifestDrivers, version: '1.0.0' },
        notifications: { createNotification: mockCreateNotification },
        ready: mockHomeyReady,
        setTimeout: mockSetTimeout,
        settings: {
          get: mockSettingsGet,
          set: mockSettingsSet,
          unset: mockSettingsUnset,
        },
      },
      writable: false,
    },
    log: { configurable: true, value: vi.fn<(...args: unknown[]) => void>() },
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
      [method]: vi
        .fn<() => Promise<Result<unknown>>>()
        .mockResolvedValue(ok(mockData)),
    }),
  )
  mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
  await app.onInit()
}

const initWithHomeDeviceFacade = async ({
  app,
  method,
  mockData,
  type = Home.DeviceType.Ata,
}: {
  app: InstanceType<typeof MelCloudApp>
  method: string
  mockData: unknown
  type?: Home.DeviceType
}): Promise<void> => {
  mockHomeFacadeManagerGet.mockReturnValue(
    mock({
      [method]: vi
        .fn<() => Promise<Result<unknown>>>()
        .mockResolvedValue(ok(mockData)),
    }),
  )
  mockHomeRegistry.getById.mockReturnValue({
    id: 'guid-1',
    type,
    isAta: (): boolean => type === Home.DeviceType.Ata,
    isAtw: (): boolean => type === Home.DeviceType.Atw,
  })
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
    widgetId === 'ata-group-setting'
      ? { registerSettingAutocompleteListener: mockRegisterAta }
      : { registerSettingAutocompleteListener: mockRegisterCharts },
  )
  return { mockRegisterAta, mockRegisterCharts }
}

// Mutations resolve void and throw UpdateRejectedError on a wire
// rejection (melcloud-api 45.0.0): `null` models the accepted write.
const mockUpdateResult = (
  attributeErrors: Record<string, string[]> | null,
): ReturnType<typeof vi.fn> =>
  attributeErrors === null
    ? vi.fn<() => Promise<void>>().mockResolvedValue()
    : vi
        .fn<() => Promise<void>>()
        .mockRejectedValue(new UpdateRejectedError(attributeErrors))

const initWithHolidayModeFacade = async (
  app: InstanceType<typeof MelCloudApp>,
  overrides: Partial<Record<keyof Classic.ZoneFacade, unknown>>,
): Promise<void> => {
  await initWithFacade(
    app,
    mock<Classic.ZoneFacade>({ name: 'Home', ...overrides }),
  )
}

// A holiday flow target as the run listeners receive it: a flat item whose
// `id` is the `${model}_${id}` option value the run listeners parse to route.
interface TestHolidayZone {
  id: string
}

const getActionRunListener = (): ((args: {
  duration: unknown
  zone: TestHolidayZone
}) => Promise<unknown>) => getMockCallArg(mockActionRegisterRun, 0, 0)

const getWithTimeRunListener = (): ((args: {
  duration: unknown
  time: unknown
  zone: TestHolidayZone
}) => Promise<unknown>) => getMockCallArg(mockActionRegisterRun, 1, 0)

const getFalseRunListener = (): ((args: {
  zone: TestHolidayZone
}) => Promise<unknown>) => getMockCallArg(mockActionRegisterRun, 2, 0)

// The single Home device the holiday autocomplete branch returns, as its run
// listener receives it: only the option value survives.
const homeHolidayZone = { id: 'homeDevices_guid-1' } as const

// Point the Home registry/facade at one ATA device so the Home holiday and
// frost paths resolve for `guid-1`.
// The picker tree now comes from the library; the app filters its leaves
// and suffixes them, so tests drive the manager's flat list directly.
const stubHomeZones = (
  devices: {
    buildingName: string
    id: string
    name: string
    deviceType?: 'ata' | 'atw'
  }[],
): void => {
  mockHomeFacadeManagerGetZones.mockReturnValue(
    devices.map(({ buildingName, deviceType = 'ata', id, name }) => ({
      buildingName,
      deviceType,
      id,
      level: 1,
      model: 'homeDevices',
      name,
    })),
  )
}

const stubHomeDevice = (facade: unknown): void => {
  mockHomeRegistry.getById.mockReturnValue({
    id: 'guid-1',
    isAta: (): boolean => true,
    isAtw: (): boolean => false,
  })
  mockHomeFacadeManagerGet.mockReturnValue(facade)
}

// Two ATA devices in building 'b1', each with its own frost/holiday, so the
// building aggregate can be exercised across agreement and disagreement.
const stubBuilding = (
  frostById: Record<string, unknown>,
  holidayById: Record<string, unknown> = {},
  overheatById: Record<string, unknown> = {},
): void => {
  const devices = [
    {
      building: { id: 'b1' },
      id: 'd1',
      isAta: (): boolean => true,
      isAtw: (): boolean => false,
    },
    {
      building: { id: 'b1' },
      id: 'd2',
      isAta: (): boolean => true,
      isAtw: (): boolean => false,
    },
  ]
  mockHomeRegistry.getDevices.mockReturnValue(devices)
  mockHomeRegistry.getById.mockImplementation((id) =>
    devices.find((device) => device.id === id),
  )
  mockHomeFacadeManagerGet.mockImplementation((model) => ({
    frostProtection: frostById[(model as { id: string }).id] ?? null,
    holidayMode: holidayById[(model as { id: string }).id] ?? null,
    overheatProtection: overheatById[(model as { id: string }).id] ?? null,
    // The facade guards read the discriminator the wave added, so the
    // stub carries it instead of relying on structural sniffing.
    type: Home.DeviceType.Ata,
  }))
}

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
    mockApiInstance.isAuthenticated.mockReturnValue(true)
    mockHomeRegistry.getDevices.mockReturnValue([])
    mockHomeRegistry.getDevicesByType.mockReturnValue([])
    app = createApp()
  })

  describe('initialization', () => {
    it('should poke open webviews with the freshness event at boot', async () => {
      await app.onInit()

      expect(mockRealtime).toHaveBeenCalledWith('webview_hashes_changed', null)
    })

    it('should initialize the API and facade manager', async () => {
      await app.onInit()

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: expect.any(AbortSignal) as unknown,
          language: 'en',
          locale: 'en',
          shouldResumeSessionInBackground: true,
          timezone: 'Europe/Paris',
        }),
      )
      expect(mockHomeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          abortSignal: expect.any(AbortSignal) as unknown,
          logger: expect.objectContaining({
            error: expect.any(Function) as unknown,
            log: expect.any(Function) as unknown,
          }),
          settingManager: expect.objectContaining({
            get: expect.any(Function) as unknown,
            set: expect.any(Function) as unknown,
          }),
          shouldResumeSessionInBackground: true,
        }),
      )
      expect(Classic.FacadeManager).toHaveBeenCalledTimes(1)
      expect(mockSetFacadeManager).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['classic', (): typeof mockCreate => mockCreate, 'melcloud'],
      ['home', (): typeof mockHomeCreate => mockHomeCreate, 'home-melcloud'],
    ])(
      'should turn a lost %s session into a Homey notification',
      async (api, getCreateMock, driverId) => {
        setupDriver([createClassicDevice()], driverId)
        await app.onInit()
        const { events } = getMockCallArg<{
          events: { onAuthenticationLost?: () => void }
        }>(getCreateMock(), 0, 0)

        events.onAuthenticationLost?.()
        // The notification is deferred through homey.setTimeout
        // (best-effort, off the event callstack): run the scheduled
        // callback to observe it.
        const scheduled = getMockCallArg<() => Promise<void>>(
          mockSetTimeout,
          mockSetTimeout.mock.calls.length - 1,
          0,
        )
        await scheduled()

        expect(mockCreateNotification).toHaveBeenCalledWith({
          excerpt: `notifications.sessionExpired.${api}`,
        })
      },
    )

    it.each([
      ['classic', (): typeof mockCreate => mockCreate, 'melcloud'],
      ['home', (): typeof mockHomeCreate => mockHomeCreate, 'home-melcloud'],
    ])(
      'should only log a lost %s session when the API has no paired device',
      async (api, getCreateMock, emptyDriverId) => {
        const logMock = vi.fn<(...args: unknown[]) => void>()
        Object.defineProperty(app, 'log', {
          configurable: true,
          value: logMock,
        })
        // A device paired on the OTHER API must not qualify, nor must a
        // device-less driver of the lost API.
        const otherDriverId =
          api === 'classic' ? 'home-melcloud' : 'melcloud_atw'
        mockGetDrivers.mockReturnValue({
          [emptyDriverId]: createMockDriver([], emptyDriverId),
          [otherDriverId]: createMockDriver(
            [createClassicDevice()],
            otherDriverId,
          ),
        })
        await app.onInit()
        const { events } = getMockCallArg<{
          events: { onAuthenticationLost?: () => void }
        }>(getCreateMock(), 0, 0)

        events.onAuthenticationLost?.()
        const scheduled = getMockCallArg<() => Promise<void>>(
          mockSetTimeout,
          mockSetTimeout.mock.calls.length - 1,
          0,
        )
        await scheduled()

        expect(mockCreateNotification).not.toHaveBeenCalled()
        expect(logMock).toHaveBeenCalledWith(
          'Session lost on',
          api,
          'ignored: no paired device',
        )
      },
    )

    it.each([
      ['classic', (): typeof mockCreate => mockCreate, 'melcloud'],
      ['home', (): typeof mockHomeCreate => mockHomeCreate, 'home-melcloud'],
    ])(
      'should mirror a notified lost %s session with a signed-in-again notification',
      async (api, getCreateMock, driverId) => {
        setupDriver([createClassicDevice()], driverId)
        await app.onInit()
        const { events } = getMockCallArg<{
          events: {
            onAuthenticationLost?: () => void
            onAuthenticationRestored?: () => void
          }
        }>(getCreateMock(), 0, 0)

        events.onAuthenticationLost?.()
        await getMockCallArg<() => Promise<void>>(
          mockSetTimeout,
          mockSetTimeout.mock.calls.length - 1,
          0,
        )()
        events.onAuthenticationRestored?.()
        await getMockCallArg<() => Promise<void>>(
          mockSetTimeout,
          mockSetTimeout.mock.calls.length - 1,
          0,
        )()

        expect(mockCreateNotification).toHaveBeenLastCalledWith({
          excerpt: `notifications.sessionRestored.${api}`,
        })
      },
    )

    it('should not announce a recovery when the loss was never notified', async () => {
      setupDriver([createClassicDevice()], 'melcloud')
      await app.onInit()
      const { events } = getMockCallArg<{
        events: { onAuthenticationRestored?: () => void }
      }>(mockCreate, 0, 0)
      // onInit already schedules the changelog notification: only the
      // count staying flat proves the recovery scheduled nothing.
      const scheduledCalls = mockSetTimeout.mock.calls.length

      events.onAuthenticationRestored?.()

      expect(mockSetTimeout).toHaveBeenCalledTimes(scheduledCalls)
      expect(mockCreateNotification).not.toHaveBeenCalled()
    })

    it('should keep the recovery silent when the loss notification was gated off', async () => {
      Object.defineProperty(app, 'log', {
        configurable: true,
        value: vi.fn<(...args: unknown[]) => void>(),
      })
      // A device-less driver: the loss is logged, never notified.
      setupDriver([], 'melcloud')
      await app.onInit()
      const { events } = getMockCallArg<{
        events: {
          onAuthenticationLost?: () => void
          onAuthenticationRestored?: () => void
        }
      }>(mockCreate, 0, 0)

      events.onAuthenticationLost?.()
      await getMockCallArg<() => Promise<void>>(
        mockSetTimeout,
        mockSetTimeout.mock.calls.length - 1,
        0,
      )()
      const scheduledCalls = mockSetTimeout.mock.calls.length
      events.onAuthenticationRestored?.()

      expect(mockSetTimeout).toHaveBeenCalledTimes(scheduledCalls)
      expect(mockCreateNotification).not.toHaveBeenCalled()
    })

    it('should drop both notifications when the recovery outruns the deferred loss handler', async () => {
      setupDriver([createClassicDevice()], 'melcloud')
      await app.onInit()
      const { events } = getMockCallArg<{
        events: {
          onAuthenticationLost?: () => void
          onAuthenticationRestored?: () => void
        }
      }>(mockCreate, 0, 0)

      events.onAuthenticationLost?.()
      const parkedLoss = getMockCallArg<() => Promise<void>>(
        mockSetTimeout,
        mockSetTimeout.mock.calls.length - 1,
        0,
      )
      // The session self-heals while the loss handler is still parked
      // (in the field: on `homey.ready()` during boot).
      events.onAuthenticationRestored?.()
      const scheduledCalls = mockSetTimeout.mock.calls.length
      await parkedLoss()

      expect(mockSetTimeout).toHaveBeenCalledTimes(scheduledCalls)
      expect(mockCreateNotification).not.toHaveBeenCalled()
    })

    it('should keep the recovery silent when the loss notification failed to display', async () => {
      setupDriver([createClassicDevice()], 'melcloud')
      await app.onInit()
      const { events } = getMockCallArg<{
        events: {
          onAuthenticationLost?: () => void
          onAuthenticationRestored?: () => void
        }
      }>(mockCreate, 0, 0)
      mockCreateNotification.mockRejectedValueOnce(new Error('fail'))

      events.onAuthenticationLost?.()
      await getMockCallArg<() => Promise<void>>(
        mockSetTimeout,
        mockSetTimeout.mock.calls.length - 1,
        0,
      )()
      const scheduledCalls = mockSetTimeout.mock.calls.length
      events.onAuthenticationRestored?.()

      expect(mockSetTimeout).toHaveBeenCalledTimes(scheduledCalls)
      expect(mockCreateNotification).toHaveBeenCalledTimes(1)
    })

    it('should not resurrect an episode when the recovery lands during the loss notification', async () => {
      setupDriver([createClassicDevice()], 'melcloud')
      await app.onInit()
      const { events } = getMockCallArg<{
        events: {
          onAuthenticationLost?: () => void
          onAuthenticationRestored?: () => void
        }
      }>(mockCreate, 0, 0)
      mockCreateNotification.mockImplementationOnce(async () => {
        await Promise.resolve()
        events.onAuthenticationRestored?.()
      })

      events.onAuthenticationLost?.()
      await getMockCallArg<() => Promise<void>>(
        mockSetTimeout,
        mockSetTimeout.mock.calls.length - 1,
        0,
      )()
      const scheduledCalls = mockSetTimeout.mock.calls.length
      // A later recovery must find no episode to mirror either.
      events.onAuthenticationRestored?.()

      expect(mockSetTimeout).toHaveBeenCalledTimes(scheduledCalls)
      expect(mockCreateNotification).toHaveBeenCalledTimes(1)
    })

    it('should log the boot marks around init and readiness', async () => {
      await app.onInit()
      await settleDetached()

      expect(app.log).toHaveBeenCalledWith(
        'Boot: onInit after',
        expect.any(String),
        's',
      )
      expect(app.log).toHaveBeenCalledWith(
        'Boot: ready after',
        expect.any(String),
        's',
      )
    })

    it('should log a boot readiness tracking failure', async () => {
      mockHomeyReady.mockRejectedValueOnce(new Error('never ready'))
      await app.onInit()
      await settleDetached()

      expect(app.error).toHaveBeenCalledWith(
        'Boot readiness tracking failed:',
        expect.any(Error),
      )
    })

    it('should not fetch Home devices itself (the API create contract owns it)', async () => {
      await app.onInit()

      // Boot-time fetch + auto-sync arming live in melcloud-api's
      // `create()`, identically for both APIs: an app-side `list()`
      // would duplicate the fetch when authenticated and, for a
      // Classic-only user, 401 on every rescheduled cycle.
      expect(mockHomeApiInstance.list).not.toHaveBeenCalled()
    })

    it('should pass logger callbacks that delegate to app.log and app.error', async () => {
      const logMock = vi.fn<(...args: unknown[]) => void>()
      const errorMock = vi.fn<(...args: unknown[]) => void>()
      Object.defineProperties(app, {
        error: { configurable: true, value: errorMock },
        log: { configurable: true, value: logMock },
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

    it('should abort the shutdown signal shared with the API clients', async () => {
      await app.onInit()
      const signal = getMockCallArg<{ abortSignal: AbortSignal }>(
        mockCreate,
        0,
        0,
      ).abortSignal

      expect(signal.aborted).toBe(false)

      await app.onUninit()

      expect(signal.aborted).toBe(true)
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

    it('should carry the declared numeric grid to the widget', async () => {
      await app.onInit()
      const capabilities = app.getClassicAtaCapabilities()
      const [, temperature] =
        capabilities.find(([key]) => key === 'SetTemperature') ?? []
      const [, power] = capabilities.find(([key]) => key === 'Power') ?? []

      // The picker reads its grid at the source: the manifest narrows
      // the bounds, and the step is the capability's own stated one —
      // neither is written here.
      expect(temperature).toMatchObject({ max: 31, min: 10, step: 0.5 })
      // A capability with no numeric grid carries none.
      expect(power).not.toHaveProperty('step')
      expect(power).not.toHaveProperty('min')
      expect(power).not.toHaveProperty('max')
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

    it('should keep value ids absent from the wire enum unmapped', async () => {
      await app.onInit()
      const capabilities = app.getClassicAtaCapabilities()
      const [, operationModeOptions] =
        capabilities.find(([key]) => key === 'OperationMode') ?? []

      expect(
        operationModeOptions?.values?.find((value) => value.id === 'eco'),
      ).toBeDefined()
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
          .fn<() => Promise<Result<Classic.GroupState>>>()
          .mockResolvedValue(ok(mockGroupState)),
      })
      await initWithFacade(app, mockFacade)

      const groupState = await app.getClassicAtaState({
        zoneId: '1',
        zoneType: 'buildings',
      })

      expect(groupState).toBe(mockGroupState)
    })

    it('should treat a single ata device as a group of one', async () => {
      const mockGroupState = mock<Classic.GroupState>()
      const mockFacade = mock<ClassicAtaDeviceGroupFacade>({
        getGroup: vi
          .fn<() => Promise<Result<Classic.GroupState>>>()
          .mockResolvedValue(ok(mockGroupState)),
        type: Classic.DeviceType.Ata,
      })
      mockFacadeManagerGet.mockReturnValue(mockFacade)
      mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      const groupState = await app.getClassicAtaState({
        zoneId: '1',
        zoneType: 'devices',
      })

      expect(groupState).toBe(mockGroupState)
      expect(mockApiInstance.registry.devices.getById).toHaveBeenCalledWith(1)
    })

    it('should reject a non-ata device as group target', async () => {
      mockFacadeManagerGet.mockReturnValue(
        mock<Classic.DeviceFacade<typeof Classic.DeviceType.Atw>>({
          type: Classic.DeviceType.Atw,
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
      await app.onInit()

      await expect(
        app.getClassicAtaState({ zoneId: '1', zoneType: 'devices' }),
      ).rejects.toThrow('errors.deviceNotFound')
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

      expect(deviceSettings.melcloud?.always_on).toBe(true)
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

      expect(deviceSettings.melcloud?.always_on).toBeNull()
    })

    it('should keep folding the settings after an earlier conflict', async () => {
      setupDriver([
        createClassicDevice({
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: true, max_power: 30 }),
        }),
        createClassicDevice({
          getSettings: vi
            .fn<() => Record<string, unknown>>()
            .mockReturnValue({ always_on: false, max_power: 50 }),
        }),
      ])
      await app.onInit()

      const deviceSettings = app.getDeviceSettings()

      expect(deviceSettings.melcloud?.always_on).toBeNull()
      expect(deviceSettings.melcloud?.max_power).toBeNull()
    })
  })

  describe('driver settings retrieval', () => {
    it('should return driver settings grouped by ID', async () => {
      await app.onInit()

      const driverSettings = app.getDriverSettings()

      expect(driverSettings).toBeDefined()
      expect(driverSettings.group1).toBeInstanceOf(Array)
    })

    it('should use language-specific labels', async () => {
      mockGetLanguage.mockReturnValue('nl')
      app = createApp()
      await app.onInit()

      const { group1: settings } = app.getDriverSettings()

      expect(settings?.[0]?.groupLabel).toBe('Groep 1')
      expect(settings?.[0]?.title).toBe('Instelling 1')
    })

    it('should fall back to English group and setting labels', async () => {
      mockGetLanguage.mockReturnValue('fr')
      app = createApp()
      await app.onInit()

      const { group1 } = app.getDriverSettings()
      const [setting] = group1 ?? []

      expect(setting?.groupLabel).toBe('Group 1')
      expect(setting?.title).toBe('Setting 1')
    })

    it('should fall back to English login labels and keep plain placeholders', async () => {
      mockGetLanguage.mockReturnValue('fr')
      app = createApp()
      await app.onInit()

      const { login } = app.getDriverSettings()
      const [password, username] = login ?? []

      expect(password?.title).toBe('Password')
      expect(password?.placeholder).toBe('Your password')
      expect(username?.title).toBe('Email')
      expect(username?.placeholder).toBe('Your email')
    })

    it('should fall back to English value labels and capability titles', async () => {
      mockGetLanguage.mockReturnValue('fr')
      app = createApp()
      await app.onInit()

      const [orphan] = app.getDriverSettings()['melcloud-odd'] ?? []

      expect(orphan?.values?.[0]?.label).toBe('First')
      expect(app.getClassicAtaCapabilities().length).toBeGreaterThan(0)
    })

    it('should group settings without a group ID under the driver ID', async () => {
      await app.onInit()

      const driverSettings = app.getDriverSettings()

      expect(driverSettings['melcloud-odd']?.[0]?.id).toBe('orphan')
      expect(driverSettings['melcloud-odd']?.[0]?.groupLabel).toBe(
        'No group id',
      )
    })
  })

  describe('error retrieval', () => {
    const homeAtaDevice = {
      id: 'home-1',
      name: 'Studeerkamer',
      type: Home.DeviceType.Ata,
    }

    const stubHomeAtaDevice = (
      entries: {
        clearedTimestamp: string | null
        errorCode: string
        errorReason: string | null
        timestamp: string
      }[],
    ): void => {
      mockHomeRegistry.getDevicesByType.mockImplementation((type) =>
        type === Home.DeviceType.Ata ? [homeAtaDevice] : [],
      )
      mockHomeRegistry.getById.mockReturnValue({
        type: Home.DeviceType.Ata,
        isAta: () => true,
        isAtw: () => false,
      })
      mockHomeFacadeManagerGet.mockReturnValue({
        getErrorLog: vi
          .fn<() => Promise<unknown>>()
          .mockResolvedValue(ok(entries)),
      })
    }

    it('should merge Home errors chronologically into the Classic window', async () => {
      mockApiInstance.getErrorLog.mockResolvedValue(
        ok({
          errors: [
            { date: '2026-03-28T14:30:00.000Z', deviceId: 42, error: 'test' },
          ],
          fromDate: '2026-03-01',
          nextFromDate: '2026-03-15',
          nextToDate: '2026-03-31',
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({
        name: 'Living Room',
      })
      stubHomeAtaDevice([
        {
          clearedTimestamp: null,
          errorCode: 'E101',
          errorReason: 'Sensor failure',
          timestamp: '2026-03-20T10:00:00Z',
        },
        {
          clearedTimestamp: null,
          errorCode: 'E202',
          errorReason: null,
          timestamp: '2026-03-25T08:00:00Z',
        },
        {
          clearedTimestamp: null,
          errorCode: 'E303',
          errorReason: 'Too old',
          timestamp: '2026-02-15T10:00:00Z',
        },
      ])
      await app.onInit()

      const errorLog = await app.getErrorLog(mock<Classic.ErrorLogQuery>())

      expect(errorLog.errors.map(({ error }) => error)).toStrictEqual([
        'test',
        'E202',
        'Sensor failure',
      ])
      expect(errorLog.errors[1]?.device).toBe('Studeerkamer')
    })

    it('should show an em dash for sentinel dates and sink them last', async () => {
      mockApiInstance.getErrorLog.mockResolvedValue(
        ok({
          errors: [
            {
              date: '0001-01-01T00:09:00',
              deviceId: 42,
              error: 'Unknown Error',
            },
            { date: '2026-03-28T14:30:00.000Z', deviceId: 42, error: 'test' },
          ],
          fromDate: '2026-03-01',
          nextFromDate: '2026-03-15',
          nextToDate: '2026-03-31',
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({
        name: 'Hydrobox',
      })
      await app.onInit()

      const errorLog = await app.getErrorLog(mock<Classic.ErrorLogQuery>())

      expect(errorLog.errors[0]?.date).not.toBe('—')
      expect(errorLog.errors[1]?.date).toBe('—')
      expect(errorLog.errors[1]?.error).toBe('Unknown Error')
    })

    it('should keep the log when a Home device fails to answer', async () => {
      mockApiInstance.getErrorLog.mockResolvedValue(
        ok({
          errors: [
            { date: '2026-03-28T14:30:00.000Z', deviceId: 42, error: 'test' },
          ],
          fromDate: '2026-03-01',
          nextFromDate: '2026-03-15',
          nextToDate: '2026-03-31',
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({
        name: 'Living Room',
      })
      mockHomeRegistry.getDevicesByType.mockImplementation((type) =>
        type === Home.DeviceType.Ata ? [homeAtaDevice] : [],
      )
      mockHomeRegistry.getById.mockReturnValue({
        type: Home.DeviceType.Ata,
        isAta: () => true,
        isAtw: () => false,
      })
      mockHomeFacadeManagerGet.mockReturnValue({
        getErrorLog: vi
          .fn<() => Promise<unknown>>()
          .mockResolvedValue(err({ kind: 'network' })),
      })
      const errorSpy = vi.fn<(...args: unknown[]) => void>()
      await app.onInit()
      Object.defineProperty(app, 'error', {
        configurable: true,
        value: errorSpy,
      })

      const errorLog = await app.getErrorLog(mock<Classic.ErrorLogQuery>())

      expect(errorLog.errors).toHaveLength(1)
      expect(errorSpy).toHaveBeenCalledWith(
        'Home error log fetch failed:',
        'Studeerkamer',
        { kind: 'network' },
      )
    })

    it('should serve a synthetic window with Home errors when Classic is signed out', async () => {
      mockApiInstance.isAuthenticated.mockReturnValue(false)
      stubHomeAtaDevice([
        {
          clearedTimestamp: null,
          errorCode: 'E101',
          errorReason: 'Sensor failure',
          timestamp: '2026-03-15T10:00:00Z',
        },
      ])
      await app.onInit()

      const errorLog = await app.getErrorLog(
        mock<Classic.ErrorLogQuery>({ period: 29, to: '2026-03-31' }),
      )

      expect(mockApiInstance.getErrorLog).not.toHaveBeenCalled()
      expect(errorLog.errors.map(({ device }) => device)).toStrictEqual([
        'Studeerkamer',
      ])
      expect(errorLog.nextToDate).toBe('2026-03-01')
      expect(errorLog.nextFromDate).toBe('2026-01-31')
    })

    it('should anchor the synthetic window on today when no upper bound is given', async () => {
      mockApiInstance.isAuthenticated.mockReturnValue(false)
      await app.onInit()

      const errorLog = await app.getErrorLog(
        mock<Classic.ErrorLogQuery>({ to: '' }),
      )

      expect(mockApiInstance.getErrorLog).not.toHaveBeenCalled()
      expect(errorLog.errors).toStrictEqual([])
      expect(errorLog.nextToDate).toMatch(/^\d{4}-\d{2}-\d{2}$/v)
    })

    it('should pin the synthetic window on a user-picked "since" date', async () => {
      mockApiInstance.isAuthenticated.mockReturnValue(false)
      stubHomeAtaDevice([
        {
          clearedTimestamp: null,
          errorCode: 'E101',
          errorReason: 'Sensor failure',
          timestamp: '2026-01-05T10:00:00Z',
        },
      ])
      await app.onInit()

      const errorLog = await app.getErrorLog(
        mock<Classic.ErrorLogQuery>({
          from: '2026-01-01',
          period: 29,
          to: '2026-03-31',
        }),
      )

      // The window starts at the picked date — mirroring the library's
      // Classic path — so older-than-default Home errors still show.
      expect(errorLog.errors.map(({ device }) => device)).toStrictEqual([
        'Studeerkamer',
      ])
      expect(errorLog.nextToDate).toBe('2025-12-31')
    })

    it('should format dates and resolve device names from api error log', async () => {
      const deviceName = 'Living Room'
      mockApiInstance.getErrorLog.mockResolvedValue(
        ok({
          errors: [
            { date: '2026-03-28T14:30:00.000Z', deviceId: 42, error: 'test' },
          ],
          fromDate: '2026-03-01',
          nextFromDate: '2026-03-15',
          nextToDate: '2026-03-31',
        }),
      )
      mockApiInstance.registry.devices.getById.mockReturnValue({
        name: deviceName,
      })
      await app.onInit()

      const query = mock<Classic.ErrorLogQuery>()
      const errorLog = await app.getErrorLog(query)

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
      mockApiInstance.getErrorLog.mockResolvedValue(
        ok({
          errors: [
            { date: '2026-03-28T14:30:00', deviceId: 999, error: 'test' },
          ],
          fromDate: '2026-03-01',
          nextFromDate: '2026-03-15',
          nextToDate: '2026-03-31',
        }),
      )
      mockApiInstance.registry.devices.getById.mockReset()
      await app.onInit()

      const query = mock<Classic.ErrorLogQuery>()
      const errorLog = await app.getErrorLog(query)

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
    it('should delegate to registry getByType', async () => {
      const mockModels = [{ id: 'device-1', name: 'Living Room' }]
      mockHomeRegistry.getDevicesByType.mockReturnValue(mockModels)
      await app.onInit()

      const result = app.getHomeDevicesByType(Home.DeviceType.Ata)

      expect(result).toBe(mockModels)
      expect(mockHomeRegistry.getDevicesByType).toHaveBeenCalledWith(
        Home.DeviceType.Ata,
      )
    })
  })

  describe('home facade retrieval', () => {
    const mockAtaModel = {
      id: 'device-1',
      name: 'Living Room',
      type: Home.DeviceType.Ata,
      isAta: (): boolean => true,
      isAtw: (): boolean => false,
    }

    const mockAtwModel = {
      id: 'device-1',
      name: 'Heat Pump',
      type: Home.DeviceType.Atw,
      isAta: (): boolean => false,
      isAtw: (): boolean => true,
    }

    it('should return an ATA facade for a matching ATA device', async () => {
      const mockFacade = mock<Home.DeviceAtaFacade>()
      mockHomeRegistry.getById.mockReturnValue(mockAtaModel)
      mockHomeFacadeManagerGet.mockReturnValue(mockFacade)
      await app.onInit()

      const facade = app.getHomeFacade('device-1', Home.DeviceType.Ata)

      expect(facade).toBe(mockFacade)
      expect(mockHomeFacadeManagerGet).toHaveBeenCalledWith(mockAtaModel)
      expect(mockHomeRegistry.getById).toHaveBeenCalledWith('device-1')
    })

    it('should return an ATW facade for a matching ATW device', async () => {
      const mockFacade = mock<Home.DeviceAtwFacade>()
      mockHomeRegistry.getById.mockReturnValue(mockAtwModel)
      mockHomeFacadeManagerGet.mockReturnValue(mockFacade)
      await app.onInit()

      const facade = app.getHomeFacade('device-1', Home.DeviceType.Atw)

      expect(facade).toBe(mockFacade)
      expect(mockHomeFacadeManagerGet).toHaveBeenCalledWith(mockAtwModel)
    })

    it('should throw when device is not found in registry', async () => {
      mockHomeRegistry.getById.mockReset()
      await app.onInit()

      expect(() => app.getHomeFacade('device-1', Home.DeviceType.Ata)).toThrow(
        'errors.deviceNotFound',
      )
      expect(mockTranslate).toHaveBeenCalledWith('errors.deviceNotFound')
    })

    it('should throw when the device type does not match', async () => {
      mockHomeRegistry.getById.mockReturnValue(mockAtwModel)
      await app.onInit()

      expect(() => app.getHomeFacade('device-1', Home.DeviceType.Ata)).toThrow(
        'errors.deviceNotFound',
      )
    })

    it('should throw when the model matches neither ATA nor ATW', async () => {
      mockHomeRegistry.getById.mockReturnValue({
        ...mockAtaModel,
        isAta: (): boolean => false,
      })
      await app.onInit()

      expect(() => app.getHomeFacade('device-1', Home.DeviceType.Ata)).toThrow(
        'errors.deviceNotFound',
      )
    })
  })

  describe('home ata targets', () => {
    it('should serve the library picker list, narrowed to the asked type', async () => {
      const zones = [
        {
          buildingName: 'Appartement',
          id: 'building-1',
          level: 0,
          model: 'homeBuildings',
          name: 'Appartement',
        },
        {
          buildingName: 'Appartement',
          deviceType: 'ata',
          id: 'device-3',
          level: 1,
          model: 'homeDevices',
          name: 'Woonkamer',
        },
      ]
      mockHomeFacadeManagerGetZones.mockReturnValue(zones)
      await app.onInit()

      expect(app.getHomeTargets(Home.DeviceType.Ata)).toStrictEqual(zones)
      expect(mockHomeFacadeManagerGetZones).toHaveBeenCalledWith({
        type: Home.DeviceType.Ata,
      })
    })
  })

  describe('home ata state', () => {
    const mockAtaModel = {
      id: 'device-1',
      name: 'Living Room',
      type: Home.DeviceType.Ata,
      isAta: (): boolean => true,
      isAtw: (): boolean => false,
    }

    const groupState = {
      FanSpeed: Classic.FanSpeed.slow,
      OperationMode: Classic.OperationMode.cool,
      Power: true,
      SetTemperature: 21,
      VaneHorizontalDirection: Classic.Horizontal.wide,
      VaneVerticalDirection: Classic.Vertical.swing,
    }

    const setupHomeAtaFacade = (facade: Home.DeviceAtaFacade): void => {
      mockHomeRegistry.getById.mockReturnValue(mockAtaModel)
      mockHomeFacadeManagerGet.mockReturnValue(facade)
    }

    it('should return the facade group state', async () => {
      setupHomeAtaFacade(
        mock<Home.DeviceAtaFacade>({
          getGroup: vi
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ ok: true, value: groupState }),
        }),
      )
      await app.onInit()

      await expect(app.getHomeAtaState('device-1')).resolves.toStrictEqual(
        groupState,
      )
    })

    it('should push the update delta through the group contract', async () => {
      const mockUpdateGroupState = vi
        .fn<(state: unknown) => Promise<unknown>>()
        .mockResolvedValue({ AttributeErrors: null, Success: true })
      setupHomeAtaFacade(
        mock<Home.DeviceAtaFacade>({ updateGroupState: mockUpdateGroupState }),
      )
      await app.onInit()

      await app.updateHomeAtaState({
        deviceId: 'device-1',
        state: { Power: true, SetTemperature: 20 },
      })

      expect(mockUpdateGroupState).toHaveBeenCalledWith({
        Power: true,
        SetTemperature: 20,
      })
    })

    it('should swallow a no-changes rejection', async () => {
      setupHomeAtaFacade(
        mock<Home.DeviceAtaFacade>({
          updateGroupState: vi
            .fn<(state: unknown) => Promise<unknown>>()
            .mockRejectedValue(new NoChangesError('device-1')),
        }),
      )
      await app.onInit()

      await expect(
        app.updateHomeAtaState({
          deviceId: 'device-1',
          state: { Power: true },
        }),
      ).resolves.toBeUndefined()
    })

    it('should propagate other update failures', async () => {
      setupHomeAtaFacade(
        mock<Home.DeviceAtaFacade>({
          updateGroupState: vi
            .fn<(state: unknown) => Promise<unknown>>()
            .mockRejectedValue(new Error('BFF failure')),
        }),
      )
      await app.onInit()

      await expect(
        app.updateHomeAtaState({
          deviceId: 'device-1',
          state: { Power: true },
        }),
      ).rejects.toThrow('BFF failure')
    })
  })

  describe('home building ata group', () => {
    const groupState = { Power: true }

    it('should return the building group state', async () => {
      mockHomeFacadeManagerGetBuilding.mockReturnValue(
        mock<Home.BuildingAtaFacade>({
          getGroup: vi
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ ok: true, value: groupState }),
        }),
      )
      await app.onInit()

      await expect(
        app.getHomeBuildingAtaState('building-1'),
      ).resolves.toStrictEqual(groupState)
      expect(mockHomeFacadeManagerGetBuilding).toHaveBeenCalledWith(
        'building-1',
      )
    })

    it('should fan the update out through the building facade', async () => {
      const mockUpdateGroupState = vi
        .fn<(state: unknown) => Promise<unknown>>()
        .mockResolvedValue({ AttributeErrors: null, Success: true })
      mockHomeFacadeManagerGetBuilding.mockReturnValue(
        mock<Home.BuildingAtaFacade>({
          updateGroupState: mockUpdateGroupState,
        }),
      )
      await app.onInit()

      await app.updateHomeBuildingAtaState({
        buildingId: 'building-1',
        state: groupState,
      })

      expect(mockUpdateGroupState).toHaveBeenCalledWith(groupState)
    })

    it('should list the member modes in the classic vocabulary', async () => {
      const member = { id: 'device-1' }
      mockHomeFacadeManagerGetBuilding.mockReturnValue(
        mock<Home.BuildingAtaFacade>({ devices: [member] }),
      )
      mockHomeFacadeManagerGet.mockReturnValue(
        mock<Home.DeviceAtaFacade>({ operationMode: 'Heat' }),
      )
      await app.onInit()

      expect(app.getHomeBuildingAtaModes('building-1')).toStrictEqual([
        Classic.OperationMode.heat,
      ])
      expect(mockHomeFacadeManagerGet).toHaveBeenCalledWith(member)
    })

    it('should throw not-found for an unknown building', async () => {
      mockHomeFacadeManagerGetBuilding.mockReturnValue(null)
      await app.onInit()

      await expect(app.getHomeBuildingAtaState('missing')).rejects.toThrow(
        'errors.deviceNotFound',
      )
    })
  })

  describe('frost protection settings retrieval', () => {
    it('should delegate to facade', async () => {
      const mockData = mock<Classic.FrostProtectionData>()
      const mockFacade = mock<Classic.ZoneFacade>({
        getFrostProtection: vi
          .fn<() => Promise<Result<Classic.FrostProtectionData>>>()
          .mockResolvedValue(ok(mockData)),
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
          .fn<() => Promise<Result<Classic.HolidayModeData>>>()
          .mockResolvedValue(ok(mockData)),
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

  describe('energy report retrieval', () => {
    it('should delegate the Classic report to the device facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithDeviceFacade(app, 'getEnergyReport', mockData)

      const report = await app.getClassicEnergyReport({
        days: 7,
        deviceId: '1',
      })

      expect(report).toBe(mockData)
    })

    it('should delegate the Home report to the device facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getEnergyReport',
        mockData,
      })

      const report = await app.getHomeEnergyReport({
        days: 7,
        deviceId: 'guid-1',
      })

      expect(report).toBe(mockData)
    })

    it('should anchor an N-day report window on local midnight', async () => {
      vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockReturnValue(
        Temporal.ZonedDateTime.from('2026-07-19T08:30:00+02:00[Europe/Paris]'),
      )
      try {
        const getEnergyReport = vi
          .fn<() => Promise<Result<unknown>>>()
          .mockResolvedValue(ok(mock<ReportChartLineOptions>()))
        mockFacadeManagerGet.mockReturnValue(mock({ getEnergyReport }))
        mockApiInstance.registry.devices.getById.mockReturnValue({ id: 1 })
        await app.onInit()

        await app.getClassicEnergyReport({ days: 2, deviceId: '1' })

        // Two days: yesterday and today, from yesterday's local midnight.
        expect(getEnergyReport).toHaveBeenCalledWith({
          from: '2026-07-18T00:00:00',
        })
        // The anchor must come from Homey's clock, not a hardcoded zone:
        // the mocked `Temporal.Now` ignores its argument, so without this
        // the timezone source is unpinned.
        expect(Temporal.Now.zonedDateTimeISO).toHaveBeenCalledWith(
          'Europe/Paris',
        )
      } finally {
        vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
      }
    })

    it('should keep the last-24-hours report window rolling', async () => {
      vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
        Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
      )
      try {
        const getEnergyReport = vi
          .fn<() => Promise<Result<unknown>>>()
          .mockResolvedValue(ok(mock<ReportChartLineOptions>()))
        mockHomeFacadeManagerGet.mockReturnValue(mock({ getEnergyReport }))
        mockHomeRegistry.getById.mockReturnValue({
          id: 'guid-1',
          type: Home.DeviceType.Ata,
          isAta: (): boolean => true,
          isAtw: (): boolean => false,
        })
        await app.onInit()

        await app.getHomeEnergyReport({ days: 0, deviceId: 'guid-1' })

        expect(getEnergyReport).toHaveBeenCalledWith({
          from: '2026-07-18T08:30:00',
        })
      } finally {
        vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
      }
    })
  })

  describe('home chart retrieval', () => {
    it('should delegate temperatures to any Home device facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getTemperatures',
        mockData,
      })

      const temperatures = await app.getHomeTemperatures({
        days: 1,
        deviceId: 'guid-1',
      })

      expect(temperatures).toBe(mockData)
    })

    it('should delegate the signal chart to any Home device facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getSignalStrength',
        mockData,
      })

      const signal = await app.getHomeSignal({ deviceId: 'guid-1', hour: 5 })

      expect(signal).toBe(mockData)
    })

    it('should route an ATW device through the shared chart surface', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getTemperatures',
        mockData,
        type: Home.DeviceType.Atw,
      })

      const temperatures = await app.getHomeTemperatures({
        days: 1,
        deviceId: 'guid-1',
      })

      expect(temperatures).toBe(mockData)
    })

    it('should reject an unknown Home device', async () => {
      mockHomeRegistry.getById.mockReturnValue(undefined)
      await app.onInit()

      await expect(app.getHomeSignal({ deviceId: 'missing' })).rejects.toThrow(
        'errors.deviceNotFound',
      )
    })

    it('should delegate hourly temperatures to the ATW facade', async () => {
      const mockData = mock<ReportChartLineOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getHourlyTemperatures',
        mockData,
        type: Home.DeviceType.Atw,
      })

      const temperatures = await app.getHomeHourlyTemperatures({
        deviceId: 'guid-1',
        hour: 10,
      })

      expect(temperatures).toBe(mockData)
    })

    it('should delegate operation modes to the ATW facade', async () => {
      const mockData = mock<ReportChartPieOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getOperationModes',
        mockData,
        type: Home.DeviceType.Atw,
      })

      const operationModes = await app.getHomeOperationModes({
        days: 7,
        deviceId: 'guid-1',
      })

      expect(operationModes).toBe(mockData)
    })

    it('should reject an ATW-only chart for an ATA device', async () => {
      const mockData = mock<ReportChartPieOptions>()
      await initWithHomeDeviceFacade({
        app,
        method: 'getOperationModes',
        mockData,
      })

      await expect(
        app.getHomeOperationModes({ days: 7, deviceId: 'guid-1' }),
      ).rejects.toThrow('errors.deviceNotFound')
    })
  })

  describe('home device zones', () => {
    it('should suffix the building and sort for the flat pickers', async () => {
      stubHomeZones([
        { buildingName: 'Vinkenstraat 22', id: 'b', name: 'Garage' },
        { buildingName: 'Verkstan', id: 'a', name: 'Garage ' },
      ])
      await app.onInit()

      // Same-named devices on different buildings stay tellable apart;
      // wire names are trimmed before suffixing.
      expect(app.getHomeDeviceZones()).toStrictEqual([
        {
          buildingName: 'Verkstan',
          deviceType: 'ata',
          id: 'a',
          level: 1,
          model: 'homeDevices',
          name: 'Garage (Verkstan)',
        },
        {
          buildingName: 'Vinkenstraat 22',
          deviceType: 'ata',
          id: 'b',
          level: 1,
          model: 'homeDevices',
          name: 'Garage (Vinkenstraat 22)',
        },
      ])
    })

    it('should filter by device type when one is given', async () => {
      stubHomeZones([
        {
          buildingName: 'Huis',
          deviceType: 'atw',
          id: 'atw-1',
          name: 'Warmtepomp',
        },
      ])
      await app.onInit()

      expect(app.getHomeDeviceZones(Home.DeviceType.Atw)).toStrictEqual([
        {
          buildingName: 'Huis',
          deviceType: 'atw',
          id: 'atw-1',
          level: 1,
          model: 'homeDevices',
          name: 'Warmtepomp (Huis)',
        },
      ])
      expect(mockHomeFacadeManagerGetZones).toHaveBeenCalledWith({
        type: Home.DeviceType.Atw,
      })
    })
  })

  describe('classic device zones', () => {
    it('should keep only the device leaves, suffixed and sorted', async () => {
      // The shared source flattens the whole tree, each zone stamped with its
      // building; the chart pickers keep just the devices.
      mockFacadeManagerGetZones.mockReturnValue([
        {
          buildingName: 'Casa',
          id: 1,
          level: 0,
          model: 'buildings',
          name: 'Casa',
        },
        {
          buildingName: 'Verkstan',
          id: 20,
          level: 1,
          model: 'devices',
          name: 'Garage',
        },
        {
          buildingName: 'Casa',
          id: 10,
          level: 1,
          model: 'devices',
          name: 'Hydrobox',
        },
      ])
      await app.onInit()

      expect(app.getClassicDeviceZones()).toStrictEqual([
        { id: 20, level: 1, model: 'devices', name: 'Garage (Verkstan)' },
        { id: 10, level: 1, model: 'devices', name: 'Hydrobox (Casa)' },
      ])
    })

    it('should narrow the source to a device type when one is given', async () => {
      mockFacadeManagerGetZones.mockReturnValue([
        {
          buildingName: 'Huis',
          id: 30,
          level: 1,
          model: 'devices',
          name: 'AC',
        },
      ])
      await app.onInit()

      expect(app.getClassicDeviceZones(Classic.DeviceType.Ata)).toStrictEqual([
        { id: 30, level: 1, model: 'devices', name: 'AC (Huis)' },
      ])
      expect(mockFacadeManagerGetZones).toHaveBeenCalledWith({
        type: Classic.DeviceType.Ata,
      })
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

      const credentials = mock<LoginCredentials>({
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
        app.classicApi.authenticate(mock<LoginCredentials>()),
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
      const credentials = mock<LoginCredentials>()

      await app.homeApi.authenticate(credentials)

      expect(mockHomeApiInstance.authenticate).toHaveBeenCalledWith(credentials)
    })

    it('should create home setting manager with camelCase key prefixing', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: {
          get: (key: string) => unknown
          set: (key: string, value: string) => void
          unset: (key: string) => void
        }
      }>(mockHomeCreate, 0, 0)
      settingManager.get('username')

      expect(mockSettingsGet).toHaveBeenCalledWith('homeUsername')

      settingManager.set('password', 'secret')

      expect(mockSettingsSet).toHaveBeenCalledWith('homePassword', 'secret')

      settingManager.unset('accessToken')

      expect(mockSettingsUnset).toHaveBeenCalledWith('homeAccessToken')
    })

    // The runtime half of the contract app-settings-contract.test.ts
    // pins statically: loginBackoffUntil went undeclared for releases
    // while the library wrote it under both namespaces.
    it('should prefix the login backoff key like any other', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: { get: (key: string) => unknown }
      }>(mockHomeCreate, 0, 0)
      settingManager.get('loginBackoffUntil')

      expect(mockSettingsGet).toHaveBeenCalledWith('homeLoginBackoffUntil')
    })

    it('should create classic setting manager without key prefixing', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: {
          get: (key: string) => unknown
          set: (key: string, value: string) => void
          unset: (key: string) => void
        }
      }>(mockCreate, 0, 0)
      settingManager.get('contextKey')

      expect(mockSettingsGet).toHaveBeenCalledWith('contextKey')

      settingManager.set('expiry', '2026-12-31')

      expect(mockSettingsSet).toHaveBeenCalledWith('expiry', '2026-12-31')

      settingManager.unset('contextKey')

      expect(mockSettingsUnset).toHaveBeenCalledWith('contextKey')
    })

    it('should leave the login backoff key unprefixed', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: { get: (key: string) => unknown }
      }>(mockCreate, 0, 0)
      settingManager.get('loginBackoffUntil')

      expect(mockSettingsGet).toHaveBeenCalledWith('loginBackoffUntil')
    })

    it('should pass through string and null settings and coerce the rest to undefined', async () => {
      await app.onInit()

      const { settingManager } = getMockCallArg<{
        settingManager: {
          get: (key: string) => unknown
          set: (key: string, value: string) => void
        }
      }>(mockCreate, 0, 0)
      mockSettingsGet
        .mockReturnValueOnce('stored')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(42)

      expect(settingManager.get('contextKey')).toBe('stored')
      expect(settingManager.get('contextKey')).toBeNull()
      expect(settingManager.get('contextKey')).toBeUndefined()
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
            .mockReturnValue(false),
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
            .mockReturnValue(true),
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
          .mockReturnValue(false),
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
          .mockReturnValue(false),
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
          settings: mock<ProtectionUpdate>(),
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
          settings: mock<ProtectionUpdate>(),
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
          settings: mock<HolidayModeUpdate>(),
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
          settings: mock<HolidayModeUpdate>(),
          zoneId: '1',
          zoneType: 'buildings',
        }),
      ).rejects.toThrow('date: Invalid date')
    })
  })

  describe('holiday mode flow cards', () => {
    const zoneArg = { id: 'buildings_1' } as const

    describe('zone autocomplete', () => {
      it('should filter zones by query, suffixing leaves and carrying the value', async () => {
        mockFacadeManagerGetZones.mockReturnValue([
          {
            buildingName: 'Home',
            id: 1,
            level: 0,
            model: 'buildings',
            name: 'Home',
          },
          {
            buildingName: 'Home',
            id: 2,
            level: 1,
            model: 'devices',
            name: 'Living room unit',
          },
        ])
        await app.onInit()

        const autocomplete = getMockCallArg<(query: string) => unknown>(
          mockActionRegisterAutocomplete,
          0,
          1,
        )

        // The item carries only its `${model}_${id}` value and a
        // building-suffixed display name — the run listener parses the value.
        expect(autocomplete('liv')).toStrictEqual([
          { id: 'devices_2', name: 'Living room unit (Home)' },
        ])

        expect(autocomplete('')).toHaveLength(2)
      })

      it('should serve the condition card with the same autocomplete', async () => {
        mockFacadeManagerGetZones.mockReturnValue([
          {
            buildingName: 'Home',
            id: 1,
            level: 0,
            model: 'buildings',
            name: 'Home',
          },
        ])
        await app.onInit()

        const autocomplete = getMockCallArg<(query: string) => unknown>(
          mockConditionRegisterAutocomplete,
          0,
          1,
        )

        expect(autocomplete('home')).toStrictEqual([
          { id: 'buildings_1', name: 'Home' },
        ])
      })

      it('should mix Classic zones with Home buildings and devices, sorted', async () => {
        mockFacadeManagerGetZones.mockReturnValue([
          {
            buildingName: 'Maison',
            id: 1,
            level: 0,
            model: 'buildings',
            name: 'Maison',
          },
        ])
        mockHomeFacadeManagerGetZones.mockReturnValue([
          {
            buildingName: 'Chalet',
            id: 'chalet-1',
            level: 0,
            model: 'homeBuildings',
            name: 'Chalet',
          },
          {
            buildingName: 'Chalet',
            deviceType: 'ata',
            id: 'guid-9',
            level: 1,
            model: 'homeDevices',
            name: 'Salon',
          },
        ])
        await app.onInit()

        const autocomplete = getMockCallArg<(query: string) => unknown>(
          mockActionRegisterAutocomplete,
          0,
          1,
        )

        // One sorted list: the Classic building, the Home building (a batched
        // group) and its suffixed device — each keyed by its routing value.
        expect(autocomplete('')).toStrictEqual([
          { id: 'homeBuildings_chalet-1', name: 'Chalet' },
          { id: 'buildings_1', name: 'Maison' },
          { id: 'homeDevices_guid-9', name: 'Salon (Chalet)' },
        ])
      })
    })

    describe('action run listener', () => {
      it('should end at midnight, N days out, starting now', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await getActionRunListener()({ duration: 3, zone: zoneArg })

          // Start = now; end = the start of the day 3 days out (00:00), not
          // the trigger time.
          expect(
            getMockCallArg<HolidayModeUpdate>(mockUpdateHolidayMode, 0, 0),
          ).toStrictEqual({
            endDate: '2026-07-22T00:00:00',
            isEnabled: true,
            startDate: '2026-07-19T08:30:00',
          })
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it('should disable holiday mode for a zero duration', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await getActionRunListener()({ duration: 0, zone: zoneArg })

          // Disabled: the window bounds are stamped at now and ignored.
          expect(
            getMockCallArg<HolidayModeUpdate>(mockUpdateHolidayMode, 0, 0),
          ).toStrictEqual({
            endDate: '2026-07-19T08:30:00',
            isEnabled: false,
            startDate: '2026-07-19T08:30:00',
          })
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it('should batch a Home device window via the Home endpoint', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          await app.onInit()
          stubHomeDevice({})

          await getActionRunListener()({ duration: 3, zone: homeHolidayZone })

          // Start = now (matching the Classic path's omitted `from`), end =
          // midnight 3 days out; the single device is sent as a one-item set.
          expect(mockHomeFacadeManagerUpdateHolidayMode).toHaveBeenCalledWith(
            ['guid-1'],
            {
              endDate: '2026-07-22T00:00:00',
              isEnabled: true,
              startDate: '2026-07-19T08:30:00',
            },
          )
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it('should batch a Home building window across its devices', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          await app.onInit()
          stubBuilding({})

          await getActionRunListener()({
            duration: 3,
            zone: { id: 'homeBuildings_b1' },
          })

          // A whole Home building fans the one window out over every device.
          expect(mockHomeFacadeManagerUpdateHolidayMode).toHaveBeenCalledWith(
            ['d1', 'd2'],
            {
              endDate: '2026-07-22T00:00:00',
              isEnabled: true,
              startDate: '2026-07-19T08:30:00',
            },
          )
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      // Tokens dropped into the duration field arrive as numbers or
      // numeric strings and bypass the manifest min/max/step.
      it('should accept a numeric string duration from a token', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await getActionRunListener()({ duration: '3', zone: zoneArg })

          expect(
            getMockCallArg<HolidayModeUpdate>(mockUpdateHolidayMode, 0, 0)
              .endDate,
          ).toBe('2026-07-22T00:00:00')
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it.each([1.5, -1, 366, 'holidays', '', false, true, null])(
        'should reject the out-of-contract duration %j',
        async (duration) => {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await expect(
            getActionRunListener()({ duration, zone: zoneArg }),
          ).rejects.toThrow('errors.invalidDuration')

          expect(mockUpdateHolidayMode).not.toHaveBeenCalled()
        },
      )
    })

    describe('with-time action run listener', () => {
      it('should end at the chosen time, N days out, starting now', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await getWithTimeRunListener()({
            duration: 5,
            time: '10:00',
            zone: zoneArg,
          })

          // Start = now; end is that time 5 days out.
          expect(
            getMockCallArg<HolidayModeUpdate>(mockUpdateHolidayMode, 0, 0),
          ).toStrictEqual({
            endDate: '2026-07-24T10:00:00',
            isEnabled: true,
            startDate: '2026-07-19T08:30:00',
          })
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      // Zero days is not a disable here: it ends the same day at the time.
      it('should end today for a zero duration', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await getWithTimeRunListener()({
            duration: 0,
            time: '10:00',
            zone: zoneArg,
          })

          expect(
            getMockCallArg<HolidayModeUpdate>(mockUpdateHolidayMode, 0, 0),
          ).toStrictEqual({
            endDate: '2026-07-19T10:00:00',
            isEnabled: true,
            startDate: '2026-07-19T08:30:00',
          })
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it('should reject an end that is not after now', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await expect(
            getWithTimeRunListener()({
              duration: 0,
              time: '06:00',
              zone: zoneArg,
            }),
          ).rejects.toThrow('errors.invalidHolidayModeEnd')

          expect(mockUpdateHolidayMode).not.toHaveBeenCalled()
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it.each([1.5, -1, 366, 'holidays', '', false, true, null])(
        'should reject the out-of-contract duration %j',
        async (duration) => {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await expect(
            getWithTimeRunListener()({
              duration,
              time: '10:00',
              zone: zoneArg,
            }),
          ).rejects.toThrow('errors.invalidDuration')

          expect(mockUpdateHolidayMode).not.toHaveBeenCalled()
        },
      )

      it.each(['24:00', '10:60', '1000', 'noon', '', 15, null])(
        'should reject the invalid end time %j',
        async (time) => {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await expect(
            getWithTimeRunListener()({ duration: 5, time, zone: zoneArg }),
          ).rejects.toThrow('errors.invalidTime')

          expect(mockUpdateHolidayMode).not.toHaveBeenCalled()
        },
      )
    })

    describe('false action run listener', () => {
      it('should clear the holiday mode window', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          const mockUpdateHolidayMode = mockUpdateResult(null)
          await initWithHolidayModeFacade(app, {
            updateHolidayMode: mockUpdateHolidayMode,
          })

          await getFalseRunListener()({ zone: zoneArg })

          expect(
            getMockCallArg<HolidayModeUpdate>(mockUpdateHolidayMode, 0, 0),
          ).toStrictEqual({
            endDate: '2026-07-19T08:30:00',
            isEnabled: false,
            startDate: '2026-07-19T08:30:00',
          })
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })

      it('should disable holiday mode on a Home device', async () => {
        vi.spyOn(Temporal.Now, 'plainDateTimeISO').mockReturnValue(
          Temporal.PlainDateTime.from('2026-07-19T08:30:00'),
        )
        try {
          await app.onInit()
          stubHomeDevice({})

          await getFalseRunListener()({ zone: homeHolidayZone })

          expect(mockHomeFacadeManagerUpdateHolidayMode).toHaveBeenCalledWith(
            ['guid-1'],
            {
              endDate: '2026-07-19T08:30:00',
              isEnabled: false,
              startDate: '2026-07-19T08:30:00',
            },
          )
        } finally {
          vi.mocked(Temporal.Now.plainDateTimeISO).mockRestore()
        }
      })
    })

    describe('condition run listener', () => {
      it.each([true, false])(
        'should mirror the holiday mode state %s',
        async (isEnabled) => {
          await initWithHolidayModeFacade(app, {
            getHolidayMode: vi
              .fn<() => Promise<Result<HolidayModeState | null>>>()
              .mockResolvedValue(ok(mock<HolidayModeState>({ isEnabled }))),
          })

          const run = getMockCallArg<
            (args: { zone: typeof zoneArg }) => Promise<boolean>
          >(mockConditionRegisterRun, 0, 0)

          await expect(run({ zone: zoneArg })).resolves.toBe(isEnabled)
        },
      )

      it.each([
        { holidayMode: { isEnabled: true }, shouldBeOn: true },
        { holidayMode: { isEnabled: false }, shouldBeOn: false },
        // No holiday data on the facade reads as "off".
        { holidayMode: null, shouldBeOn: false },
      ])(
        'should mirror a Home device holiday state ($shouldBeOn)',
        async ({ holidayMode, shouldBeOn }) => {
          await app.onInit()
          stubHomeDevice({ holidayMode })

          const run = getMockCallArg<
            (args: { zone: TestHolidayZone }) => Promise<boolean>
          >(mockConditionRegisterRun, 0, 0)

          await expect(run({ zone: homeHolidayZone })).resolves.toBe(shouldBeOn)
        },
      )

      it.each([
        {
          holidayById: { d1: { isEnabled: true }, d2: { isEnabled: true } },
          shouldBeOn: true,
        },
        // Devices disagree: the building aggregate is "mixed", read as off.
        {
          holidayById: { d1: { isEnabled: true }, d2: { isEnabled: false } },
          shouldBeOn: false,
        },
      ])(
        'should mirror a Home building holiday state ($shouldBeOn)',
        async ({ holidayById, shouldBeOn }) => {
          await app.onInit()
          stubBuilding({}, holidayById)

          const run = getMockCallArg<
            (args: { zone: TestHolidayZone }) => Promise<boolean>
          >(mockConditionRegisterRun, 0, 0)

          await expect(run({ zone: { id: 'homeBuildings_b1' } })).resolves.toBe(
            shouldBeOn,
          )
        },
      )
    })
  })

  describe('home frost protection', () => {
    it('should read a Home device frost protection off the facade', async () => {
      await app.onInit()
      const frostProtection = mock<Home.FrostProtection>({ active: true })
      stubHomeDevice({ frostProtection })

      expect(app.getHomeFrostProtection('guid-1')).toBe(frostProtection)
    })

    it('should batch a frost protection update across the given devices', async () => {
      await app.onInit()

      await app.updateHomeFrostProtection(['guid-1', 'guid-2'], {
        isEnabled: true,
        max: 16,
        min: 4,
      })

      expect(mockHomeFacadeManagerUpdateFrostProtection).toHaveBeenCalledWith(
        ['guid-1', 'guid-2'],
        { isEnabled: true, max: 16, min: 4 },
      )
    })
  })

  describe('home overheat protection', () => {
    it('should read a Home ATA device overheat protection off the facade', async () => {
      await app.onInit()
      const overheatProtection = mock<ProtectionState>({ isEnabled: true })
      stubHomeDevice({ overheatProtection, type: Home.DeviceType.Ata })

      expect(app.getHomeOverheatProtection('guid-1')).toBe(overheatProtection)
    })

    it('should read null for an ATW facade, which never carries it', async () => {
      await app.onInit()
      stubHomeDevice({ frostProtection: null, type: Home.DeviceType.Atw })

      expect(app.getHomeOverheatProtection('guid-1')).toBeNull()
    })

    it('should batch an overheat protection update across the given devices', async () => {
      await app.onInit()

      await app.updateHomeOverheatProtection(['guid-1', 'guid-2'], {
        isEnabled: true,
        max: 37,
        min: 35,
      })

      expect(
        mockHomeFacadeManagerUpdateOverheatProtection,
      ).toHaveBeenCalledWith(['guid-1', 'guid-2'], {
        isEnabled: true,
        max: 37,
        min: 35,
      })
    })
  })

  describe('home building frost protection and holiday mode', () => {
    it('keeps shared frost values and nulls the disagreements', async () => {
      await app.onInit()
      stubBuilding({
        d1: { isEnabled: true, max: 12, min: 6 },
        d2: { isEnabled: true, max: 14, min: 6 },
      })

      expect(app.getHomeBuildingFrostProtection('b1')).toStrictEqual({
        isEnabled: true,
        max: null,
        min: 6,
      })
    })

    it('reads an all-unconfigured building as off, not mixed', async () => {
      await app.onInit()
      stubBuilding({})

      expect(app.getHomeBuildingFrostProtection('b1')).toStrictEqual({
        isEnabled: false,
        max: null,
        min: null,
      })
    })

    it('aggregates holiday mode across the building devices', async () => {
      await app.onInit()
      stubBuilding(
        {},
        {
          d1: { endDate: 'e', isEnabled: true, startDate: 's' },
          d2: { endDate: 'e', isEnabled: true, startDate: 'x' },
        },
      )

      expect(app.getHomeBuildingHolidayMode('b1')).toStrictEqual({
        endDate: 'e',
        isEnabled: true,
        startDate: null,
      })
    })

    it('reads an all-unconfigured holiday building as off', async () => {
      await app.onInit()
      stubBuilding({}, {})

      expect(app.getHomeBuildingHolidayMode('b1')).toStrictEqual({
        endDate: null,
        isEnabled: false,
        startDate: null,
      })
    })

    it('keeps shared overheat values and nulls the disagreements', async () => {
      await app.onInit()
      stubBuilding(
        {},
        {},
        {
          d1: { isEnabled: true, max: 37, min: 35 },
          d2: { isEnabled: true, max: 38, min: 35 },
        },
      )

      expect(app.getHomeBuildingOverheatProtection('b1')).toStrictEqual({
        isEnabled: true,
        max: null,
        min: 35,
      })
    })

    it('reads an all-unconfigured overheat building as off, not mixed', async () => {
      await app.onInit()
      stubBuilding({}, {}, {})

      expect(app.getHomeBuildingOverheatProtection('b1')).toStrictEqual({
        isEnabled: false,
        max: null,
        min: null,
      })
    })

    it('aggregates overheat over the ATA devices only', async () => {
      await app.onInit()
      stubBuilding({}, {}, { d1: { isEnabled: true, max: 37, min: 35 } })
      // Turn d2 into an ATW device: it must not drag the aggregate to
      // "mixed" — the feature is ATA-only.
      const devices = [
        {
          building: { id: 'b1' },
          id: 'd1',
          isAta: (): boolean => true,
          isAtw: (): boolean => false,
        },
        {
          building: { id: 'b1' },
          id: 'd2',
          isAta: (): boolean => false,
          isAtw: (): boolean => true,
        },
      ]
      mockHomeRegistry.getDevices.mockReturnValue(devices)
      mockHomeRegistry.getById.mockImplementation((id) =>
        devices.find((device) => device.id === id),
      )

      expect(app.getHomeBuildingOverheatProtection('b1')).toStrictEqual({
        isEnabled: true,
        max: 37,
        min: 35,
      })
    })

    it('batches a building overheat update across all its devices', async () => {
      await app.onInit()
      stubBuilding({})

      await app.updateHomeBuildingOverheatProtection('b1', {
        isEnabled: false,
        max: 37,
        min: 35,
      })

      expect(
        mockHomeFacadeManagerUpdateOverheatProtection,
      ).toHaveBeenCalledWith(['d1', 'd2'], {
        isEnabled: false,
        max: 37,
        min: 35,
      })
    })

    it('batches a building frost update across all its devices', async () => {
      await app.onInit()
      stubBuilding({})

      await app.updateHomeBuildingFrostProtection('b1', {
        isEnabled: true,
        max: 16,
        min: 4,
      })

      expect(mockHomeFacadeManagerUpdateFrostProtection).toHaveBeenCalledWith(
        ['d1', 'd2'],
        { isEnabled: true, max: 16, min: 4 },
      )
    })

    it('batches a building holiday update across all its devices', async () => {
      await app.onInit()
      stubBuilding({})

      await app.updateHomeBuildingHolidayMode('b1', {
        endDate: 'e',
        isEnabled: true,
        startDate: 's',
      })

      expect(mockHomeFacadeManagerUpdateHolidayMode).toHaveBeenCalledWith(
        ['d1', 'd2'],
        { endDate: 'e', isEnabled: true, startDate: 's' },
      )
    })

    it('serves the library picker list unfiltered when no type is given', async () => {
      const zones = [
        {
          buildingName: 'Alpha',
          id: 'b1',
          level: 0,
          model: 'homeBuildings',
          name: 'Alpha',
        },
        {
          buildingName: 'Alpha',
          deviceType: 'ata',
          id: 'd1',
          level: 1,
          model: 'homeDevices',
          name: 'Xray',
        },
      ]
      mockHomeFacadeManagerGetZones.mockReturnValue(zones)
      await app.onInit()

      expect(app.getHomeTargets()).toStrictEqual(zones)
      expect(mockHomeFacadeManagerGetZones).toHaveBeenCalledWith({
        type: undefined,
      })
    })
  })

  describe('getDriverSettings with login settings', () => {
    it('should extract login settings from pair config', async () => {
      const driversWithLogin: ManifestDriver[] = [
        {
          capabilities: [],
          class: 'thermostat',
          id: 'melcloud',
          name: { en: 'melcloud' },
          pair: Object.assign(
            [
              {
                id: 'login' as const,
                options: {
                  passwordLabel: { en: 'Password' },
                  passwordPlaceholder: 'Enter password',
                  usernameLabel: { en: 'Username' },
                  usernamePlaceholder: 'Enter username',
                },
              },
            ],
            {
              id: 'login' as const,
              options: {
                passwordLabel: { en: 'Password' },
                passwordPlaceholder: 'Enter password',
                usernameLabel: { en: 'Username' },
                usernamePlaceholder: 'Enter username',
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

  describe('changelog language fallback', () => {
    it('should still announce in English when the language is not in the changelog', async () => {
      mockGetLanguage.mockReturnValue('ja')
      mockSettingsGet.mockReturnValue('0.9.0')
      app = createApp()
      await app.onInit()

      expect(mockSetTimeout).toHaveBeenCalledTimes(1)

      const callback = getMockCallArg<() => Promise<void>>(mockSetTimeout, 0, 0)
      await callback()

      expect(mockCreateNotification).toHaveBeenCalledWith({
        excerpt: 'English changelog',
      })
    })

    it('should still announce the versions in between when the running version has no entry', async () => {
      mockSettingsGet.mockReturnValue('0.9.0')
      app = createApp()
      Object.defineProperty(app.homey, 'manifest', {
        configurable: true,
        value: { drivers: [], version: '9.9.9' },
      })
      await app.onInit()

      expect(mockSetTimeout).toHaveBeenCalledTimes(1)
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
    it('should serve matching classic zones, classic devices and home devices to the ata-group-setting widget', async () => {
      const { mockRegisterAta } = setupWidgetListeners()
      mockFacadeManagerGetZones.mockReturnValue([
        {
          buildingName: 'Building 1',
          id: 1,
          level: 0,
          model: 'buildings',
          name: 'Building 1',
        },
        {
          buildingName: 'Office',
          id: 2,
          level: 0,
          model: 'buildings',
          name: 'Office',
        },
        {
          buildingName: 'Building 1',
          id: 10,
          level: 1,
          model: 'devices',
          name: 'Building unit',
        },
      ])
      // Unsorted on purpose: home targets must come back alpha-sorted
      // (building, then its devices), appended after the classic ones.
      // The library sorts its picker list, so the stub is already ordered.
      stubHomeZones([
        { buildingName: 'Maison', id: 'home-3', name: 'Bedroom' },
        { buildingName: 'Maison', id: 'home-1', name: 'Building one' },
        { buildingName: 'Maison', id: 'home-2', name: 'Building two' },
      ])
      await app.onInit()

      const ataCallback = getMockCallArg<(query: string) => unknown[]>(
        mockRegisterAta,
        0,
        1,
      )
      const result = ataCallback('build')

      // Classic zones then Home building/devices; leaves suffixed with their
      // building, buildings kept bare; the query matches the suffixed names.
      expect(result).toStrictEqual([
        {
          buildingName: 'Building 1',
          id: 1,
          level: 0,
          model: 'buildings',
          name: 'Building 1',
        },
        {
          buildingName: 'Building 1',
          id: 10,
          level: 1,
          model: 'devices',
          name: 'Building unit (Building 1)',
        },
        {
          buildingName: 'Maison',
          deviceType: 'ata',
          id: 'home-1',
          level: 1,
          model: 'homeDevices',
          name: 'Building one (Maison)',
        },
        {
          buildingName: 'Maison',
          deviceType: 'ata',
          id: 'home-2',
          level: 1,
          model: 'homeDevices',
          name: 'Building two (Maison)',
        },
      ])
      expect(mockFacadeManagerGetZones).toHaveBeenCalledWith({
        type: Classic.DeviceType.Ata,
      })
    })

    it('should serve building-suffixed device zones to the charts widget', async () => {
      const { mockRegisterCharts } = setupWidgetListeners()
      mockFacadeManagerGetZones.mockReturnValue([
        {
          buildingName: 'Casa',
          id: 10,
          level: 1,
          model: 'devices',
          name: 'Device 1',
        },
        {
          buildingName: 'Casa',
          id: 11,
          level: 1,
          model: 'devices',
          name: 'Device 2',
        },
      ])
      stubHomeZones([
        { buildingName: 'Antwerpen', id: 'guid-1', name: 'Device 1' },
      ])
      await app.onInit()

      const chartsCallback = getMockCallArg<(query: string) => unknown[]>(
        mockRegisterCharts,
        0,
        1,
      )
      const result = chartsCallback('device 1')

      // One alphabetical list across vendors (the Home entry sorts
      // before the Classic one); the query matches the suffixed names.
      expect(result).toStrictEqual([
        {
          buildingName: 'Antwerpen',
          deviceType: 'ata',
          id: 'guid-1',
          level: 1,
          model: 'homeDevices',
          name: 'Device 1 (Antwerpen)',
        },
        { id: 10, level: 1, model: 'devices', name: 'Device 1 (Casa)' },
      ])
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
      await app.onInit()

      await getHomeSyncCallback()()

      expect(syncMock).not.toHaveBeenCalled()
    })

    it('should wire the same onSync callback on both Classic and Home APIs', async () => {
      await app.onInit()

      expect(getSyncCallback()).toBe(getHomeSyncCallback())
    })
  })

  describe('getDriverSettings with setting values', () => {
    it('should include values in driver settings when defined', async () => {
      const driversWithValues: ManifestDriver[] = [
        {
          capabilities: [],
          class: 'thermostat',
          id: 'melcloud',
          name: { en: 'melcloud' },
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
