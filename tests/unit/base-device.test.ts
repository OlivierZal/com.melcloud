import type { ListDeviceDataAta } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicMELCloudDriver } from '../../drivers/classic-base-driver.mts'
import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/index.mts'
import { ClassicMELCloudDevice } from '../../drivers/classic-base-device.mts'
import {
  createCapabilityListenerCallbackGetter,
  testDeletion,
  testEnsureDeviceNull,
  testOnoffConverter,
  testPostUpdateSync,
  testSetValuesErrorHandling,
  testThermostatModeOff,
  testUninitialisation,
  testWarningManagement,
} from '../device-descriptors.ts'
import { mock } from '../helpers.ts'
import { type TestDeviceType, TestDevice } from './base-device-test-device.ts'

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
  getFacadeMock: vi.fn(),
  getSettingMock: vi.fn(),
  realtimeMock: vi.fn(),
  registerMultipleCapabilityListenerMock: vi.fn(),
  setValuesMock: vi.fn(),
  superAddCapabilityMock: vi.fn(),
  superRemoveCapabilityMock: vi.fn(),
  superSetWarningMock: vi.fn(),
  triggerCapabilityListenerMock: vi.fn(),
}))

const mockDeviceData = {
  FanSpeed: 3,
  Power: true,
  SetTemperature: 22,
}

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', () => {
  class MockDevice {
    public driver = {}

    public error = vi.fn()

    public getCapabilities = vi.fn().mockReturnValue([])

    public getCapabilityOptions = vi.fn()

    public getCapabilityValue = vi.fn()

    public getData = vi.fn().mockReturnValue({ id: 1 })

    public getSetting = getSettingMock

    public getSettings = vi.fn().mockReturnValue({})

    public hasCapability = vi.fn().mockReturnValue(true)

    public homey = {
      __: vi.fn().mockImplementation((key: string) => key),
      api: { realtime: realtimeMock },
      app: { getFacade: getFacadeMock },
      clearInterval: vi.fn(),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(),
      setTimeout: vi.fn(),
    }

    public log = vi.fn()

    public registerMultipleCapabilityListener =
      registerMultipleCapabilityListenerMock

    public setCapabilityOptions = vi.fn()

    public setCapabilityValue = vi.fn()

    public setSettings = vi.fn()

    public triggerCapabilityListener = triggerCapabilityListenerMock

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Prototype method required for super.addCapability() resolution in BaseMELCloudDevice
    public async addCapability(...args: unknown[]): Promise<void> {
      superAddCapabilityMock(...args)
      await Promise.resolve()
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Prototype method required for super.removeCapability() resolution in BaseMELCloudDevice
    public async removeCapability(...args: unknown[]): Promise<void> {
      superRemoveCapabilityMock(...args)
      await Promise.resolve()
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Prototype method required for super.setWarning() resolution in BaseMELCloudDevice
    public async setWarning(...args: unknown[]): Promise<void> {
      superSetWarningMock(...args)
      await Promise.resolve()
    }
  }

  return { default: { Device: MockDevice } }
})

const getCapabilityListenerCallback = createCapabilityListenerCallbackGetter(
  registerMultipleCapabilityListenerMock,
)

const mockDriver = mock<ClassicMELCloudDriver<TestDeviceType>>({
  energyCapabilityTagMapping: mock<EnergyCapabilityTagMapping<TestDeviceType>>(
    {},
  ),
  getCapabilitiesOptions: vi.fn().mockReturnValue({}),
  getCapabilityTagMapping: mock<GetCapabilityTagMapping<TestDeviceType>>({
    measure_temperature: 'RoomTemperature',
  }),
  getRequiredCapabilities: vi
    .fn()
    .mockReturnValue(['onoff', 'measure_temperature']),
  listCapabilityTagMapping: mock<ListCapabilityTagMapping<TestDeviceType>>({}),
  manifest: mock({
    capabilities: ['onoff', 'measure_temperature', 'fan_speed'],
    id: 'test',
  }),
  setCapabilityTagMapping: mock<SetCapabilityTagMapping<TestDeviceType>>({
    onoff: 'Power',
  }),
})

const mockFacade = (data: Record<string, unknown> = mockDeviceData): void => {
  getFacadeMock.mockReturnValue({
    data,
    getEnergy: vi.fn(),
    setValues: setValuesMock,
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

  testOnoffConverter(() => device as object, getSettingMock)

  testDeletion(() => device as object)

  testUninitialisation(() => device as object)

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

  testWarningManagement(() => device as object, superSetWarningMock)

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

    it('should set warning and return null on error', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      const result = await device.ensureDevice()

      expect(result).toBeNull()
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
      const data = mock<ListDeviceDataAta>({
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
        energyCapabilityTagMapping: mock<
          EnergyCapabilityTagMapping<TestDeviceType>
        >({
          measure_power: ['Auto', 'Cooling'],
        }),
        manifest: mock({
          capabilities: [
            'onoff',
            'measure_temperature',
            'fan_speed',
            'measure_power',
          ],
          id: 'test',
        }),
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
    it('should call setValues when capability values are set', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ Power: true })
    })

    it('should not call setValues when buildUpdateData returns empty object', async () => {
      const freshDevice = new TestDevice()
      const driverWithEmptySetMapping = Object.create(
        mockDriver,
      ) as typeof mockDriver
      Object.assign(driverWithEmptySetMapping, {
        setCapabilityTagMapping: mock<SetCapabilityTagMapping<TestDeviceType>>(
          {},
        ),
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

  testPostUpdateSync(() => device as object, getCapabilityListenerCallback)

  testSetValuesErrorHandling(
    () => device as object,
    getCapabilityListenerCallback,
    { setValuesMock, superSetWarningMock },
  )

  describe('capability value conversion', () => {
    it('should use deviceToCapability converter when present', async () => {
      const customDevice = new TestDevice()
      Object.defineProperty(customDevice, 'deviceToCapability', {
        value: {
          measure_temperature: (value: number): number => value * 2,
        },
      })
      setDriver(customDevice)
      mockFacade({ ...mockDeviceData, RoomTemperature: 10 })
      vi.spyOn(customDevice, 'hasCapability').mockReturnValue(true)
      await customDevice.ensureDevice()
      await customDevice.exposedSetCapabilityValues(
        mock<ListDeviceDataAta>({ Power: true, RoomTemperature: 10 }),
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
    it('should set capability options from driver', async () => {
      const getCapabilitiesOptionsMock = vi.fn().mockReturnValue({
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

  describe('energy report handling', () => {
    it('should create energy report for regular config', async () => {
      const { EnergyReport } = await import('../../drivers/base-report.mts')
      const {
        mock: {
          calls: { length: callCountBefore },
        },
      } = vi.mocked(EnergyReport)
      const deviceWithRegular = new TestDevice()
      Object.defineProperty(deviceWithRegular, 'energyReportRegular', {
        value: {
          duration: { hours: 1 },
          interval: { hours: 1 },
          minus: { hours: 1 },
          mode: 'regular' as const,
          values: { millisecond: 0, minute: 5, second: 0 },
        },
      })
      setDriver(deviceWithRegular)
      await deviceWithRegular.onInit()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        1,
      )
    })

    it('should create energy report for total config', async () => {
      const { EnergyReport } = await import('../../drivers/base-report.mts')
      const {
        mock: {
          calls: { length: callCountBefore },
        },
      } = vi.mocked(EnergyReport)
      const deviceWithTotal = new TestDevice()
      Object.defineProperty(deviceWithTotal, 'energyReportTotal', {
        value: {
          duration: { days: 1 },
          interval: { days: 1 },
          minus: { days: 1 },
          mode: 'total' as const,
          values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
        },
      })
      setDriver(deviceWithTotal)
      await deviceWithTotal.onInit()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        1,
      )
    })
  })

  describe('synchronization when device is unavailable', () => {
    it('should not throw when ensureDevice returns null', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
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
    it('should set warning when ensureDevice throws', async () => {
      const errorDevice = new TestDevice()
      setDriver(errorDevice)
      vi.spyOn(errorDevice, 'ensureDevice').mockRejectedValue(
        new Error('fetch failed'),
      )
      await errorDevice.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalledWith('errors.deviceNotFound')
      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })
  })
})
