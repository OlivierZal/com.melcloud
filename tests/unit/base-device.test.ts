import type { DeviceType, ListDeviceDataAta } from '@olivierzal/melcloud-api'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import type { EnergyReportConfig } from '../../drivers/base-report.mts'
import type {
  ConvertFromDevice,
  ConvertToDevice,
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  OperationalCapabilities,
  SetCapabilities,
  SetCapabilityTagMapping,
} from '../../types/index.mts'

import { BaseMELCloudDevice } from '../../drivers/base-device.mts'
import { mock } from '../helpers.ts'

const setValuesMock = vi.fn()
const realtimeMock = vi.fn()
const superSetWarningMock = vi.fn()
const superAddCapabilityMock = vi.fn()
const superRemoveCapabilityMock = vi.fn()
const registerMultipleCapabilityListenerMock = vi.fn()
const triggerCapabilityListenerMock = vi.fn()
const getFacadeMock = vi.fn()
const getSettingMock = vi.fn()

const mockDeviceData = {
  FanSpeed: 3,
  Power: true,
  SetTemperature: 22,
}

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

    public async addCapability(...args: unknown[]): Promise<void> {
      superAddCapabilityMock(...args)
      await Promise.resolve()
    }

    public async removeCapability(...args: unknown[]): Promise<void> {
      superRemoveCapabilityMock(...args)
      await Promise.resolve()
    }

    public async setWarning(...args: unknown[]): Promise<void> {
      superSetWarningMock(...args)
      await Promise.resolve()
    }
  }

  return { default: { Device: MockDevice } }
})

vi.mock('../../decorators/add-to-logs.mts', () => ({
  addToLogs:
    () =>
    <T>(target: T): T =>
      target,
}))

vi.mock('../../mixins/with-timers.mts', () => ({
  withTimers: <T>(base: T): T => base,
}))

vi.mock('../../drivers/base-report.mts', () => ({
  EnergyReport: vi.fn().mockImplementation(() => ({
    handle: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn(),
  })),
}))

type TestDeviceType = typeof DeviceType.Ata

class TestDevice extends BaseMELCloudDevice<TestDeviceType> {
  public readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<TestDeviceType>,
      ConvertFromDevice<TestDeviceType>
    >
  > = {}

  public readonly energyReportRegular: EnergyReportConfig | null = null

  public readonly energyReportTotal: EnergyReportConfig | null = null

  public readonly thermostatMode: object | null = null

  public capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<TestDeviceType>,
      ConvertToDevice<TestDeviceType>
    >
  > = {}

  public async exposedSetCapabilityValues(
    data: ListDeviceDataAta,
  ): Promise<void> {
    await this.setCapabilityValues(data)
  }
}

const mockDriver = mock<BaseMELCloudDriver<TestDeviceType>>({
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

describe(BaseMELCloudDevice, () => {
  let device: TestDevice

  beforeEach(() => {
    vi.clearAllMocks()
    getFacadeMock.mockReturnValue({
      data: mockDeviceData,
      getEnergy: vi.fn(),
      setValues: setValuesMock,
    })
    device = new TestDevice()
    Object.defineProperty(device, 'driver', {
      configurable: true,
      value: mockDriver,
    })
  })

  describe('id', () => {
    it('should return the device id from getData', () => {
      expect(device.id).toBe(1)
    })
  })

  describe('onInit', () => {
    it('should clear warning, register listeners, and fetch device', async () => {
      await device.onInit()

      expect(superSetWarningMock).toHaveBeenCalledWith(null)
      expect(registerMultipleCapabilityListenerMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Function),
        expect.any(Number),
      )
      expect(getFacadeMock).toHaveBeenCalledWith('devices', 1)
    })

    it('should set default onoff converter in capabilityToDevice', async () => {
      getSettingMock.mockReturnValue(false)
      await device.onInit()

      expect(device.capabilityToDevice).toHaveProperty('onoff')
    })

    it('should respect always_on setting for onoff converter', async () => {
      getSettingMock.mockReturnValue(true)
      await device.onInit()

      const { onoff: converter } = device.capabilityToDevice

      expect(converter?.(false)).toBe(true)
    })

    it('should return true for onoff when value is true regardless of always_on', async () => {
      getSettingMock.mockReturnValue(false)
      await device.onInit()

      const { onoff: converter } = device.capabilityToDevice

      expect(converter?.(true)).toBe(true)
    })
  })

  describe('onDeleted', () => {
    it('should not throw when called', () => {
      expect(() => {
        device.onDeleted()
      }).not.toThrow()
    })
  })

  describe('onUninit', () => {
    it('should call onDeleted and return a resolved promise', async () => {
      const result = device.onUninit()

      await expect(result).resolves.toBeUndefined()
    })
  })

  describe('addCapability', () => {
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

  describe('removeCapability', () => {
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

  describe('setWarning', () => {
    it('should call super.setWarning with error message then null when error is an Error', async () => {
      await device.setWarning(new Error('test error'))

      expect(superSetWarningMock).toHaveBeenCalledWith('test error')
      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })

    it('should call super.setWarning with null when null is provided', async () => {
      await device.setWarning(null)

      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })

    it('should convert non-Error values to string', async () => {
      await device.setWarning('string error')

      expect(superSetWarningMock).toHaveBeenCalledWith('string error')
    })
  })

  describe('cleanMapping', () => {
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

  describe('fetchDevice', () => {
    it('should get facade and return device', async () => {
      const result = await device.fetchDevice()

      expect(result).toBeDefined()
      expect(getFacadeMock).toHaveBeenCalledWith('devices', 1)
    })

    it('should return same device on subsequent calls', async () => {
      const first = await device.fetchDevice()
      const second = await device.fetchDevice()

      expect(first).toBe(second)
      expect(getFacadeMock).toHaveBeenCalledTimes(1)
    })

    it('should set warning and return null on error', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      const result = await device.fetchDevice()

      expect(result).toBeNull()
    })
  })

  describe('syncFromDevice', () => {
    it('should set capability values from provided data', async () => {
      const data = mock<ListDeviceDataAta>({
        Power: true,
        RoomTemperature: 21,
      })
      await device.fetchDevice()
      await device.syncFromDevice(data)

      expect(realtimeMock).toHaveBeenCalledWith('deviceupdate', null)
    })

    it('should fetch data when none is provided', async () => {
      await device.fetchDevice()
      await device.syncFromDevice()

      expect(realtimeMock).toHaveBeenCalledWith('deviceupdate', null)
    })
  })

  describe('setCapabilityValues', () => {
    it('should emit realtime event', async () => {
      const data = mock<ListDeviceDataAta>({
        Power: true,
        RoomTemperature: 21,
      })
      await device.fetchDevice()
      await device.exposedSetCapabilityValues(data)

      expect(realtimeMock).toHaveBeenCalledWith('deviceupdate', null)
    })
  })

  describe('onSettings', () => {
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
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.fetchDevice()
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
      Object.defineProperty(device, 'driver', {
        configurable: true,
        value: driverWithEnergy,
      })
      await device.onSettings({
        changedKeys: ['measure_power'],
        newSettings: { measure_power: true },
      })

      expect(superAddCapabilityMock).toHaveBeenCalledWith('measure_power')
    })
  })

  describe('capability listener callback', () => {
    it('should call setValues when capability values are set', async () => {
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalled()
    })

    it('should handle thermostat_mode off when thermostat supports off', async () => {
      const deviceWithThermostat = new (class extends TestDevice {
        public override readonly thermostatMode = { off: 0 }
      })()
      Object.defineProperty(deviceWithThermostat, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await deviceWithThermostat.onInit()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ thermostat_mode: 'off' })

      expect(setValuesMock).toHaveBeenCalled()
    })

    it('should set onoff to true when thermostat_mode is not off', async () => {
      const deviceWithThermostat = new (class extends TestDevice {
        public override readonly thermostatMode = { off: 0 }
      })()
      Object.defineProperty(deviceWithThermostat, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await deviceWithThermostat.onInit()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ thermostat_mode: 'heat' })

      expect(setValuesMock).toHaveBeenCalled()
    })

    it('should handle setValues error with warning', async () => {
      setValuesMock.mockRejectedValue(new Error('API error'))
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ onoff: true })

      expect(superSetWarningMock).toHaveBeenCalledWith('API error')
    })

    it('should ignore "No data to set" error', async () => {
      setValuesMock.mockRejectedValue(new Error('No data to set'))
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()
      superSetWarningMock.mockClear()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ onoff: true })

      expect(superSetWarningMock).not.toHaveBeenCalledWith('No data to set')
    })

    it('should not call setValues when fetchDevice returns null', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      const freshDevice = new TestDevice()
      Object.defineProperty(freshDevice, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      await freshDevice.onInit()
      setValuesMock.mockClear()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ onoff: true })

      expect(setValuesMock).not.toHaveBeenCalled()
    })

    it('should not call setValues when buildUpdateData returns empty object', async () => {
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      const freshDevice = new TestDevice()
      const driverWithEmptySetMapping = Object.create(
        mockDriver,
      ) as typeof mockDriver
      Object.assign(driverWithEmptySetMapping, {
        setCapabilityTagMapping: mock<SetCapabilityTagMapping<TestDeviceType>>(
          {},
        ),
      })
      Object.defineProperty(freshDevice, 'driver', {
        configurable: true,
        value: driverWithEmptySetMapping,
      })
      await freshDevice.onInit()
      setValuesMock.mockClear()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({})

      expect(setValuesMock).not.toHaveBeenCalled()
    })

    it('should set warning for non-Error thrown values', async () => {
      setValuesMock.mockRejectedValue('string error')
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()
      const callback = registerMultipleCapabilityListenerMock.mock
        .calls[0]![1] as (values: Record<string, unknown>) => Promise<void>
      await callback({ onoff: true })

      expect(superSetWarningMock).toHaveBeenCalledWith('string error')
    })
  })

  describe('setCapabilityValues with converters', () => {
    it('should use deviceToCapability converter when present', async () => {
      const customDevice = new (class extends TestDevice {
        public override readonly deviceToCapability = {
          measure_temperature: (value: number): number => value * 2,
        }
      })()
      Object.defineProperty(customDevice, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      getFacadeMock.mockReturnValue({
        data: { ...mockDeviceData, RoomTemperature: 10 },
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      vi.spyOn(customDevice, 'hasCapability').mockReturnValue(true)
      await customDevice.fetchDevice()
      await customDevice.exposedSetCapabilityValues(
        mock<ListDeviceDataAta>({ Power: true, RoomTemperature: 10 }),
      )

      expect(customDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        20,
      )
    })
  })

  describe('#setCapabilities', () => {
    it('should add capabilities from required and enabled settings', async () => {
      vi.spyOn(device, 'getSettings').mockReturnValue({
        fan_speed: true,
      })
      vi.spyOn(device, 'getCapabilities').mockReturnValue([])
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()

      expect(superAddCapabilityMock).toHaveBeenCalled()
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
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()

      expect(superRemoveCapabilityMock).toHaveBeenCalledWith('fan_speed')
    })
  })

  describe('#setCapabilityOptions', () => {
    it('should set capability options from driver', async () => {
      const getCapabilitiesOptionsMock = vi.fn().mockReturnValue({
        measure_temperature: { units: '°C' },
      })
      const driverWithOptions = Object.create(mockDriver) as typeof mockDriver
      Object.assign(driverWithOptions, {
        getCapabilitiesOptions: getCapabilitiesOptionsMock,
      })
      Object.defineProperty(device, 'driver', {
        configurable: true,
        value: driverWithOptions,
      })
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await device.onInit()

      expect(device.setCapabilityOptions).toHaveBeenCalledWith(
        'measure_temperature',
        { units: '°C' },
      )
    })
  })

  describe('#handleEnergyReports', () => {
    it('should create energy report for regular config', async () => {
      const { EnergyReport } = await import('../../drivers/base-report.mts')
      const callCountBefore = vi.mocked(EnergyReport).mock.calls.length
      const deviceWithRegular = new (class extends TestDevice {
        public override readonly energyReportRegular = {
          duration: { hours: 1 },
          interval: { hours: 1 },
          minus: { hours: 1 },
          mode: 'regular' as const,
          values: { millisecond: 0, minute: 5, second: 0 },
        }
      })()
      Object.defineProperty(deviceWithRegular, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await deviceWithRegular.onInit()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        1,
      )
    })

    it('should create energy report for total config', async () => {
      const { EnergyReport } = await import('../../drivers/base-report.mts')
      const callCountBefore = vi.mocked(EnergyReport).mock.calls.length
      const deviceWithTotal = new (class extends TestDevice {
        public override readonly energyReportTotal = {
          duration: { days: 1 },
          interval: { days: 1 },
          minus: { days: 1 },
          mode: 'total' as const,
          values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
        }
      })()
      Object.defineProperty(deviceWithTotal, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      getFacadeMock.mockReturnValue({
        data: mockDeviceData,
        getEnergy: vi.fn(),
        setValues: setValuesMock,
      })
      await deviceWithTotal.onInit()

      expect(vi.mocked(EnergyReport).mock.calls.length - callCountBefore).toBe(
        1,
      )
    })
  })

  describe('syncFromDevice when device is null', () => {
    it('should not throw when fetchDevice returns null', async () => {
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      await device.fetchDevice()
      await device.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalled()
    })

    it('should not set capability values when fetchData returns null via fetchDevice', async () => {
      const freshDevice = new TestDevice()
      Object.defineProperty(freshDevice, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      getFacadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      realtimeMock.mockClear()
      await freshDevice.syncFromDevice()

      expect(realtimeMock).not.toHaveBeenCalled()
    })

    it('should skip setCapabilityValues when syncFromDevice gets null from fetchData', async () => {
      const freshDevice = new TestDevice()
      Object.defineProperty(freshDevice, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      vi.spyOn(freshDevice, 'fetchDevice').mockResolvedValue(null)
      realtimeMock.mockClear()
      await freshDevice.syncFromDevice()

      expect(realtimeMock).not.toHaveBeenCalled()
    })
  })

  describe('#fetchData error path', () => {
    it('should set warning when fetchDevice throws', async () => {
      const errorDevice = new TestDevice()
      Object.defineProperty(errorDevice, 'driver', {
        configurable: true,
        value: mockDriver,
      })
      vi.spyOn(errorDevice, 'fetchDevice').mockRejectedValue(
        new Error('fetch failed'),
      )
      await errorDevice.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalled()
    })
  })
})
