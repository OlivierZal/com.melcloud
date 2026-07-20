import type * as Classic from '@olivierzal/melcloud-api/classic'
import type HomeyModule from 'homey'
import { EntityNotFoundError } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import type * as BaseReportModule from '../../drivers/classic-report.mts'
import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/capabilities.mts'
import { ClassicMELCloudDevice } from '../../drivers/classic-device.mts'
import { NotFoundError } from '../../lib/errors.mts'
import {
  createCapabilityListenerCallbackGetter,
  testDeletion,
  testEnsureDeviceNull,
  testOnoffCoercion,
  testPostUpdateSync,
  testSetValuesErrorHandling,
  testThermostatModeOff,
  testUninitialisation,
  testWarningManagement,
} from '../device-descriptors.ts'
import { type InteropModule, mock, settleDetached } from '../helpers.ts'
import {
  type TestDeviceType,
  TestDevice,
} from './classic-device-test-device.ts'

const {
  getFacadeMock,
  getSettingMock,
  realtimeMock,
  registerMultipleCapabilityListenerMock,
  setValuesMock,
  superAddCapabilityMock,
  superRemoveCapabilityMock,
  superSetWarningMock,
  triggerCapabilityListenerMock,
} = vi.hoisted(() => ({
  getFacadeMock: vi.fn<(kind: string, id: number) => unknown>(),
  getSettingMock: vi.fn<(key: string) => unknown>(),
  realtimeMock: vi.fn<(event: string, data: unknown) => void>(),
  registerMultipleCapabilityListenerMock:
    vi.fn<
      (
        capabilities: readonly string[],
        listener: (values: Record<string, unknown>) => Promise<void>,
        delay?: number,
      ) => void
    >(),
  setValuesMock: vi.fn<(data: Record<string, unknown>) => Promise<unknown>>(),
  superAddCapabilityMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
  superRemoveCapabilityMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
  superSetWarningMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
  triggerCapabilityListenerMock:
    vi.fn<(capability: string, value: unknown) => Promise<void>>(),
}))

const mockDeviceData = {
  FanSpeed: 3,
  Power: true,
  SetTemperature: 22,
}

const { energyReportStartMock } = vi.hoisted(() => ({
  energyReportStartMock: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
}))

// Overrides the setup-level base-report mock so the shared `start` can be
// driven per test (e.g. a rejected restart). The implementation is a
// `new`-able function expression (arrows are not constructible): its
// returned object becomes the constructed report.
vi.mock(import('../../drivers/classic-report.mts'), async () => {
  const { mock: mockModule } = await import('../helpers.ts')
  const newEnergyReportMock = function newEnergyReportMock(): {
    start: () => Promise<void>
    unschedule: () => void
  } {
    return { start: energyReportStartMock, unschedule: vi.fn<() => void>() }
  }
  return mockModule<typeof BaseReportModule>({
    EnergyReport: vi.fn<typeof newEnergyReportMock>(newEnergyReportMock),
  })
})

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: {
      Device: createMockDeviceClass({
        overrides: {
          getSetting: getSettingMock,
          homey: {
            __: vi
              .fn<(key: string) => string>()
              .mockImplementation((key: string) => key),
            api: { realtime: realtimeMock },
            app: { getClassicFacade: getFacadeMock },
            clearInterval: vi.fn<(timer: NodeJS.Timeout | undefined) => void>(),
            clearTimeout: vi.fn<(timer: NodeJS.Timeout | null) => void>(),
            clock: { getTimezone: vi.fn<() => string>(() => 'Europe/Paris') },
            i18n: { getLanguage: vi.fn<() => string>(() => 'en') },
            setInterval:
              vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
            setTimeout:
              vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
          },
          registerMultipleCapabilityListener:
            registerMultipleCapabilityListenerMock,
          triggerCapabilityListener: triggerCapabilityListenerMock,
        },
        superMocks: {
          addCapability: superAddCapabilityMock,
          removeCapability: superRemoveCapabilityMock,
          setWarning: superSetWarningMock,
        },
      }),
    },
  })
})

const getCapabilityListenerCallback = createCapabilityListenerCallbackGetter(
  registerMultipleCapabilityListenerMock,
)

const mockDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
  getCapabilitiesOptions: vi
    .fn<() => Record<string, unknown>>()
    .mockReturnValue({}),
  getRequiredCapabilities: vi
    .fn<() => string[]>()
    .mockReturnValue(['onoff', 'measure_temperature']),
  manifest: mock({
    capabilities: ['onoff', 'measure_temperature', 'fan_speed'],
    id: 'test',
  }),
  tagMappings: {
    energy: mock<EnergyCapabilityTagMapping<TestDeviceType>>({}),
    get: mock<GetCapabilityTagMapping<TestDeviceType>>({
      measure_temperature: 'RoomTemperature',
    }),
    list: mock<ListCapabilityTagMapping<TestDeviceType>>({}),
    set: mock<SetCapabilityTagMapping<TestDeviceType>>({
      onoff: 'Power',
    }),
  },
})

const mockFacade = (data: Record<string, unknown> = mockDeviceData): void => {
  getFacadeMock.mockReturnValue({
    data,
    getEnergy: vi.fn<(query?: unknown) => Promise<unknown>>(),
    updateValues: setValuesMock,
  })
}

const setDriver = (
  target: TestDevice,
  driver: ClassicMELCloudDriver<TestDeviceType> = mockDriver,
): void => {
  Object.defineProperty(target, 'driver', {
    configurable: true,
    value: driver,
  })
}

describe(ClassicMELCloudDevice, () => {
  let device: TestDevice

  beforeEach(() => {
    vi.clearAllMocks()
    mockFacade()
    device = new TestDevice()
    setDriver(device)
  })

  describe('device identifier', () => {
    it('should return the device id from getData', () => {
      expect(device.id).toBe(1)
    })
  })

  describe('initialization', () => {
    it('should clear warning, register listeners, and ensure device', async () => {
      await device.onInit()

      expect(superSetWarningMock).toHaveBeenCalledWith(null)
      expect(registerMultipleCapabilityListenerMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Function),
        expect.any(Number),
      )
      expect(getFacadeMock).toHaveBeenCalledWith('devices', 1)
    })
  })

  testOnoffCoercion(() => device, getCapabilityListenerCallback, {
    getSettingMock,
    onTag: 'Power',
    setValuesMock,
  })

  testDeletion(() => device)

  testUninitialisation(() => device)

  describe('adding capabilities', () => {
    it('should add capability if not already present', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.addCapability('fan_speed')

      expect(superAddCapabilityMock).toHaveBeenCalledWith('fan_speed')
    })

    it('should not add capability if already present', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(true)
      await device.addCapability('fan_speed')

      expect(superAddCapabilityMock).not.toHaveBeenCalled()
    })
  })

  describe('removing capabilities', () => {
    it('should remove capability if present', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(true)
      await device.removeCapability('fan_speed')

      expect(superRemoveCapabilityMock).toHaveBeenCalledWith('fan_speed')
    })

    it('should not remove capability if not present', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.removeCapability('fan_speed')

      expect(superRemoveCapabilityMock).not.toHaveBeenCalled()
    })
  })

  testWarningManagement(() => device, superSetWarningMock)

  describe('mapping cleanup', () => {
    it('should filter mapping to only capabilities the device has', () => {
      vi.spyOn(device, 'hasCapability').mockImplementation(
        (cap: string) => cap === 'onoff',
      )
      const result = device.cleanMapping(
        mock<SetCapabilityTagMapping<TestDeviceType>>({
          fan_speed: 'SetFanSpeed',
          onoff: 'Power',
        }),
      )

      expect(result).toStrictEqual({ onoff: 'Power' })
    })
  })

  describe('device initialization', () => {
    it('should expose facade via protected getter after init', async () => {
      await device.ensureDevice()

      expect(device.exposedFacade).toBeDefined()
    })

    it('should get facade and return device', async () => {
      const result = await device.ensureDevice()

      expect(result).toBeDefined()
      expect(getFacadeMock).toHaveBeenCalledWith('devices', 1)
    })

    it('should return same device on subsequent calls', async () => {
      const first = await device.ensureDevice()
      const second = await device.ensureDevice()

      expect(first).toBe(second)
      expect(getFacadeMock).toHaveBeenCalledTimes(1)
    })

    it('should set warning and return null on expected lookup error', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new NotFoundError('Not found')
      })
      const result = await device.ensureDevice()

      expect(result).toBeNull()
      expect(superSetWarningMock).toHaveBeenCalledWith('Not found')
    })

    it('should log and return null without warning on unexpected error', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new TypeError('programming error')
      })
      const result = await device.ensureDevice()

      expect(result).toBeNull()
      expect(superSetWarningMock).not.toHaveBeenCalledWith('programming error')
      expect(
        (device as unknown as { error: ReturnType<typeof vi.fn> }).error,
      ).toHaveBeenCalledWith(
        'Unexpected error while ensuring device:',
        expect.any(TypeError),
      )
    })
  })

  describe('device synchronization', () => {
    it('should set capability values from device data', async () => {
      await device.ensureDevice()
      await device.syncFromDevice()

      expect(realtimeMock).toHaveBeenCalledWith('deviceupdate', null)
    })
  })

  describe('capability value emission', () => {
    it('should emit realtime event', async () => {
      const data = mock<Classic.ListDeviceDataAta>({
        Power: true,
        RoomTemperature: 21,
      })
      await device.ensureDevice()
      await device.exposedSetCapabilityValues(data)

      expect(realtimeMock).toHaveBeenCalledWith('deviceupdate', null)
    })
  })

  describe('settings changes', () => {
    it('should trigger onoff when always_on changes to true', async () => {
      await device.onSettings({
        changedKeys: ['always_on'],
        newSettings: { always_on: true },
      })

      expect(triggerCapabilityListenerMock).toHaveBeenCalledWith('onoff', true)
    })

    it('should ignore always_on when the device has no onoff capability', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.onSettings({
        changedKeys: ['always_on'],
        newSettings: { always_on: true },
      })

      expect(triggerCapabilityListenerMock).not.toHaveBeenCalled()
    })

    it('should handle optional capability changes (add)', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.onSettings({
        changedKeys: ['fan_speed'],
        newSettings: { fan_speed: true },
      })

      expect(superAddCapabilityMock).toHaveBeenCalledWith('fan_speed')
      expect(superSetWarningMock).toHaveBeenCalledWith('warnings.dashboard')
    })

    it('should handle optional capability changes (remove)', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(true)
      await device.onSettings({
        changedKeys: ['fan_speed'],
        newSettings: { fan_speed: false },
      })

      expect(superRemoveCapabilityMock).toHaveBeenCalledWith('fan_speed')
    })

    it('should sync from device when non-always_on non-energy setting changes', async () => {
      await device.ensureDevice()
      await device.onSettings({
        changedKeys: ['some_other_setting'],
        newSettings: { some_other_setting: 'value' },
      })

      expect(realtimeMock).toHaveBeenCalledWith('deviceupdate', null)
    })

    it('should not sync when only always_on changes but is false', async () => {
      realtimeMock.mockClear()
      await device.onSettings({
        changedKeys: ['always_on'],
        newSettings: { always_on: false },
      })

      expect(triggerCapabilityListenerMock).not.toHaveBeenCalled()
    })

    it('should handle energy capability changes', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      const driverWithEnergy = Object.create(mockDriver) as typeof mockDriver
      Object.assign(driverWithEnergy, {
        manifest: mock({
          capabilities: [
            'onoff',
            'measure_temperature',
            'fan_speed',
            'measure_power',
          ],
          id: 'test',
        }),
        tagMappings: {
          ...mockDriver.tagMappings,
          energy: mock<EnergyCapabilityTagMapping<TestDeviceType>>({
            measure_power: ['Auto', 'Cooling'],
          }),
        },
      })
      setDriver(device, driverWithEnergy)
      await device.onSettings({
        changedKeys: ['measure_power'],
        newSettings: { measure_power: true },
      })

      expect(superAddCapabilityMock).toHaveBeenCalledWith('measure_power')
    })
  })

  describe('capability change handling', () => {
    it('should call updateValues when capability values are set', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ Power: true })
    })

    it('should not call updateValues when buildUpdateData returns empty object', async () => {
      const freshDevice = new TestDevice()
      const driverWithEmptySetMapping = Object.create(
        mockDriver,
      ) as typeof mockDriver
      Object.assign(driverWithEmptySetMapping, {
        tagMappings: {
          ...mockDriver.tagMappings,
          set: mock<SetCapabilityTagMapping<TestDeviceType>>({}),
        },
      })
      setDriver(freshDevice, driverWithEmptySetMapping)
      await freshDevice.onInit()
      setValuesMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({})

      expect(setValuesMock).not.toHaveBeenCalled()
    })
  })

  testThermostatModeOff(
    () => {
      const testDevice = new TestDevice()
      setDriver(testDevice)
      return testDevice
    },
    getCapabilityListenerCallback,
    {
      expectedValues: { nonOff: { Power: true }, off: { Power: false } },
      setValuesMock,
    },
  )

  testEnsureDeviceNull(
    () => {
      const testDevice = new TestDevice()
      setDriver(testDevice)
      return testDevice
    },
    getCapabilityListenerCallback,
    { facadeMock: getFacadeMock, setValuesMock },
  )

  testPostUpdateSync(() => device, getCapabilityListenerCallback)

  testSetValuesErrorHandling(() => device, getCapabilityListenerCallback, {
    setValuesMock,
    superSetWarningMock,
  })

  describe('capability value conversion', () => {
    it('should use deviceToCapability converter when present', async () => {
      const customDevice = new TestDevice()
      Object.defineProperty(customDevice, 'deviceToCapability', {
        value: {
          measure_temperature: ({
            RoomTemperature: temperature,
          }: Readonly<Classic.ListDeviceDataAta>): number => temperature * 2,
        },
      })
      setDriver(customDevice)
      mockFacade({ ...mockDeviceData, RoomTemperature: 10 })
      vi.spyOn(customDevice, 'hasCapability').mockReturnValue(true)
      await customDevice.ensureDevice()
      await customDevice.exposedSetCapabilityValues(
        mock<Classic.ListDeviceDataAta>({ Power: true, RoomTemperature: 10 }),
      )

      expect(customDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        20,
      )
    })
  })

  describe('capability setup', () => {
    it('should add capabilities from required and enabled settings', async () => {
      vi.spyOn(device, 'getSettings').mockReturnValue({
        fan_speed: true,
      })
      vi.spyOn(device, 'getCapabilities').mockReturnValue([])
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.onInit()

      expect(superAddCapabilityMock).toHaveBeenCalledWith('fan_speed')
      expect(superAddCapabilityMock).toHaveBeenCalledWith('onoff')
      expect(superAddCapabilityMock).toHaveBeenCalledWith('measure_temperature')
    })

    it('should remove capabilities not in required set', async () => {
      vi.spyOn(device, 'getSettings').mockReturnValue({})
      vi.spyOn(device, 'getCapabilities').mockReturnValue([
        'onoff',
        'measure_temperature',
        'fan_speed',
      ])
      vi.spyOn(device, 'hasCapability').mockImplementation(
        (cap: string) => cap === 'fan_speed',
      )
      await device.onInit()

      expect(superRemoveCapabilityMock).toHaveBeenCalledWith('fan_speed')
    })
  })

  describe('capability options setup', () => {
    it('should skip capabilities options that are not objects', async () => {
      const driverWithBadOptions = Object.create(
        mockDriver,
      ) as typeof mockDriver
      Object.assign(driverWithBadOptions, {
        getCapabilitiesOptions: vi
          .fn<() => Record<string, unknown>>()
          .mockReturnValue({ measure_temperature: 'not-an-object' }),
      })
      setDriver(device, driverWithBadOptions)
      await device.onInit()

      expect(device.setCapabilityOptions).not.toHaveBeenCalled()
    })

    it('should set capability options from driver', async () => {
      const getCapabilitiesOptionsMock = vi
        .fn<() => Record<string, unknown>>()
        .mockReturnValue({
          measure_temperature: { units: '°C' },
        })
      const driverWithOptions = Object.create(mockDriver) as typeof mockDriver
      Object.assign(driverWithOptions, {
        getCapabilitiesOptions: getCapabilitiesOptionsMock,
      })
      setDriver(device, driverWithOptions)
      await device.onInit()

      expect(device.setCapabilityOptions).toHaveBeenCalledWith(
        'measure_temperature',
        { units: '°C' },
      )
    })
  })

  describe('capability seams', () => {
    it('should return no capabilities options before the facade is cached', () => {
      const freshDevice = new TestDevice()
      const seams = freshDevice as unknown as {
        getCapabilitiesOptions: () => Partial<Record<string, unknown>>
        getRequiredCapabilities: () => string[]
      }

      expect(seams.getCapabilitiesOptions()).toStrictEqual({})
      expect(seams.getRequiredCapabilities()).toStrictEqual([])
    })
  })

  describe('energy report handling', () => {
    it('should skip energy reports without a factory', async () => {
      const { EnergyReport } = await import('../../drivers/classic-report.mts')
      const { length: callCountBefore } = vi.mocked(EnergyReport).mock.calls
      const deviceWithoutFactory = new TestDevice()
      Object.defineProperties(deviceWithoutFactory, {
        createEnergyReport: { value: null },
        energyReportRegular: {
          value: {
            duration: { hours: 1 },
            mode: 'regular' as const,
            values: { millisecond: 0, minute: 5, second: 0 },
          },
        },
      })
      setDriver(deviceWithoutFactory)
      await deviceWithoutFactory.onInit()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        0,
      )
    })

    it('should create energy report for regular config', async () => {
      const { EnergyReport } = await import('../../drivers/classic-report.mts')
      const { length: callCountBefore } = vi.mocked(EnergyReport).mock.calls
      const deviceWithRegular = new TestDevice()
      Object.defineProperty(deviceWithRegular, 'energyReportRegular', {
        value: {
          duration: { hours: 1 },
          minus: { hours: 1 },
          mode: 'regular' as const,
          values: { millisecond: 0, minute: 5, second: 0 },
        },
      })
      setDriver(deviceWithRegular)
      await deviceWithRegular.onInit()
      await settleDetached()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        1,
      )
    })

    it('should create energy report for total config', async () => {
      const { EnergyReport } = await import('../../drivers/classic-report.mts')
      const { length: callCountBefore } = vi.mocked(EnergyReport).mock.calls
      const deviceWithTotal = new TestDevice()
      Object.defineProperty(deviceWithTotal, 'energyReportTotal', {
        value: {
          duration: { days: 1 },
          minus: { days: 1 },
          mode: 'total' as const,
          values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
        },
      })
      setDriver(deviceWithTotal)
      await deviceWithTotal.onInit()
      await settleDetached()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        1,
      )
    })

    it('should log when an energy report restart fails', async () => {
      const failure = new Error('report start failed')
      const deviceWithRegular = new TestDevice()
      Object.defineProperty(deviceWithRegular, 'energyReportRegular', {
        value: {
          duration: { hours: 1 },
          minus: { hours: 1 },
          mode: 'regular' as const,
          values: { millisecond: 0, minute: 5, second: 0 },
        },
      })
      const driverWithEnergy = Object.create(mockDriver) as typeof mockDriver
      Object.assign(driverWithEnergy, {
        manifest: mock({
          capabilities: ['onoff', 'measure_temperature', 'measure_power'],
          id: 'test',
        }),
        tagMappings: {
          ...mockDriver.tagMappings,
          energy: mock<EnergyCapabilityTagMapping<TestDeviceType>>({
            measure_power: ['Auto', 'Cooling'],
          }),
        },
      })
      setDriver(deviceWithRegular, driverWithEnergy)
      await deviceWithRegular.onInit()
      await settleDetached()
      energyReportStartMock.mockRejectedValueOnce(failure)
      await deviceWithRegular.onSettings({
        changedKeys: ['measure_power'],
        newSettings: { measure_power: true },
      })

      expect(deviceWithRegular.error).toHaveBeenCalledWith(
        'Energy report update failed:',
        failure,
      )
    })

    it('should become ready while the initial energy fetch is still pending', async () => {
      const { promise, resolve }: PromiseWithResolvers<void> =
        Promise.withResolvers()
      energyReportStartMock.mockReturnValueOnce(promise)
      const deviceWithRegular = new TestDevice()
      Object.defineProperty(deviceWithRegular, 'energyReportRegular', {
        value: {
          duration: { hours: 1 },
          minus: { hours: 1 },
          mode: 'regular' as const,
          values: { millisecond: 0, minute: 5, second: 0 },
        },
      })
      setDriver(deviceWithRegular)
      // Resolves although the initial fetch hangs: device readiness
      // must not depend on MELCloud latency (Early 2018 Homeys hit the
      // SDK ready_timeout exactly there).
      await deviceWithRegular.onInit()
      await settleDetached()

      expect(energyReportStartMock).toHaveBeenCalledTimes(1)

      resolve()
    })

    it('should log a detached scheduling failure without breaking init', async () => {
      energyReportStartMock.mockRejectedValueOnce(new Error('fetch down'))
      const deviceWithRegular = new TestDevice()
      Object.defineProperty(deviceWithRegular, 'energyReportRegular', {
        value: {
          duration: { hours: 1 },
          minus: { hours: 1 },
          mode: 'regular' as const,
          values: { millisecond: 0, minute: 5, second: 0 },
        },
      })
      setDriver(deviceWithRegular)
      await deviceWithRegular.onInit()
      // The detached chain settles within one macrotask turn.
      await settleDetached()

      expect(deviceWithRegular.error).toHaveBeenCalledWith(
        'Deferred device init failed:',
        expect.any(Error),
      )
    })
  })

  describe('synchronization when device is unavailable', () => {
    it('should not throw when ensureDevice returns null', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new NotFoundError('Not found')
      })
      await device.ensureDevice()
      await device.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalledWith('Not found')
      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })

    it('should not set capability values when fetchData returns null via ensureDevice', async () => {
      const freshDevice = new TestDevice()
      setDriver(freshDevice)
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      realtimeMock.mockClear()
      await freshDevice.syncFromDevice()

      expect(realtimeMock).not.toHaveBeenCalled()
    })

    it('should skip setCapabilityValues when syncFromDevice gets null from fetchData', async () => {
      const freshDevice = new TestDevice()
      setDriver(freshDevice)
      vi.spyOn(freshDevice, 'ensureDevice').mockResolvedValue(null)
      realtimeMock.mockClear()
      await freshDevice.syncFromDevice()

      expect(realtimeMock).not.toHaveBeenCalled()
    })
  })

  describe('timer methods', () => {
    it('should delegate setInterval to homey.setInterval with duration in ms', () => {
      const callback = vi.fn<() => Promise<void>>()
      device.setInterval(callback, { hours: 1 }, 'energy report')

      expect(device.homey.setInterval).toHaveBeenCalledWith(callback, 3_600_000)
    })

    it('should delegate setTimeout to homey.setTimeout with duration in ms', () => {
      const callback = vi.fn<() => Promise<void>>()
      device.setTimeout(callback, { minutes: 5 }, 'sync')

      expect(device.homey.setTimeout).toHaveBeenCalledWith(callback, 300_000)
    })
  })

  describe('init error handling', () => {
    it('should set warning when ensureDevice throws EntityNotFoundError', async () => {
      const errorDevice = new TestDevice()
      setDriver(errorDevice)
      vi.spyOn(errorDevice, 'ensureDevice').mockRejectedValue(
        new EntityNotFoundError('DeviceLocation', { entityId: 1 }),
      )
      await errorDevice.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalledWith('errors.deviceNotFound')
      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })

    it('should rethrow unexpected errors from ensureDevice', async () => {
      const errorDevice = new TestDevice()
      setDriver(errorDevice)
      const unexpected = new Error('unexpected failure')
      vi.spyOn(errorDevice, 'ensureDevice').mockRejectedValue(unexpected)

      await expect(errorDevice.syncFromDevice()).rejects.toThrow(unexpected)
    })
  })
})
