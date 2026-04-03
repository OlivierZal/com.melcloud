/* eslint-disable @typescript-eslint/unbound-method */
import type {
  HomeAtaValues,
  HomeDeviceAtaFacade,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HomeBaseMELCloudDevice } from '../../drivers/home-base-device.mts'
import {
  createCapabilityListenerCallbackGetter,
  getMockCallArg,
  testDeletion,
  testSetValuesErrorHandling,
  testUninitialisation,
  testWarningManagement,
} from '../helpers.ts'
import {
  type TestHomeDevice,
  createTestHomeDevice,
} from './home-base-device-test-device.ts'

const realtimeMock = vi.fn()
const superSetWarningMock = vi.fn()
const registerMultipleCapabilityListenerMock = vi.fn()
const setValuesMock = vi.fn()
const getSettingMock = vi.fn()
const getHomeFacadeMock = vi.fn()

let isFacadePoweredOn = true

const createMockFacade = (): HomeDeviceAtaFacade =>
  ({
    setValues: setValuesMock,
    get operationMode(): string {
      return 'Heat'
    },
    get power(): boolean {
      return isFacadePoweredOn
    },
    get roomTemperature(): number {
      return 21
    },
    get setTemperature(): number {
      return 22
    },
  }) as unknown as HomeDeviceAtaFacade

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', () => {
  class MockDevice {
    public driver = {
      energyCapabilityTagMapping: {},
      getCapabilityTagMapping: {},
      listCapabilityTagMapping: {},
      manifest: {
        capabilities: [
          'measure_temperature',
          'onoff',
          'target_temperature',
          'thermostat_mode',
        ],
      },
      setCapabilityTagMapping: {
        fan_speed: 'setFanSpeed',
        horizontal: 'vaneHorizontalDirection',
        onoff: 'power',
        target_temperature: 'setTemperature',
        thermostat_mode: 'operationMode',
        vertical: 'vaneVerticalDirection',
      },
      getCapabilitiesOptions: (): Record<string, unknown> => ({}),
      getRequiredCapabilities: (): string[] =>
        this.driver.manifest.capabilities,
    }

    public error = vi.fn()

    public getCapabilities = vi.fn().mockReturnValue([])

    public getCapabilityOptions = vi.fn()

    public getCapabilityValue = vi.fn()

    public getData = vi.fn().mockReturnValue({ id: 'device-1' })

    public getSetting = getSettingMock

    public getSettings = vi.fn().mockReturnValue({})

    public hasCapability = vi.fn().mockReturnValue(true)

    public homey = {
      api: { realtime: realtimeMock },
      app: {
        getHomeFacade: getHomeFacadeMock,
      },
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

    public triggerCapabilityListener = vi.fn()

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Prototype method required for super.setWarning() resolution in SharedBaseMELCloudDevice
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

describe(HomeBaseMELCloudDevice, () => {
  let device: TestHomeDevice

  beforeEach(() => {
    vi.clearAllMocks()
    isFacadePoweredOn = true
    getHomeFacadeMock.mockReturnValue(createMockFacade())
    setValuesMock.mockResolvedValue(true)
    device = createTestHomeDevice()
  })

  describe('device identifier', () => {
    it('should return the device id from getData', () => {
      expect(device.id).toBe('device-1')
    })
  })

  describe('initialization', () => {
    it('should clear warning, register listeners, and sync from device', async () => {
      await device.onInit()

      expect(superSetWarningMock).toHaveBeenCalledWith(null)
      expect(registerMultipleCapabilityListenerMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        expect.any(Number),
      )
    })

    it('should remove capabilities not in required list during init', async () => {
      vi.spyOn(device, 'getCapabilities').mockReturnValue([
        'measure_temperature',
        'onoff',
        'obsolete_capability',
      ])
      const spy = vi.spyOn(device, 'removeCapability')
      await device.onInit()

      expect(spy).toHaveBeenCalledWith('obsolete_capability')
    })

    it('should set default onoff converter in capabilityToDevice', async () => {
      getSettingMock.mockReturnValue(false)
      await device.onInit()

      expect(device.capabilityToDevice).toHaveProperty('onoff')
    })

    it('should respect always_on setting for onoff converter', async () => {
      getSettingMock.mockReturnValue(true)
      await device.onInit()

      const {
        capabilityToDevice: { onoff: converter },
      } = device

      expect(converter?.(false as never)).toBe(true)
    })

    it('should return true for onoff when value is true regardless of always_on', async () => {
      getSettingMock.mockReturnValue(false)
      await device.onInit()

      const {
        capabilityToDevice: { onoff: converter },
      } = device

      expect(converter?.(true as never)).toBe(true)
    })
  })

  testDeletion(() => device as object)

  testUninitialisation(() => device as object)

  testWarningManagement(() => device as object, superSetWarningMock)

  describe('device synchronization', () => {
    it('should set capability values from facade', async () => {
      await device.syncFromDevice()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21,
      )
      expect(device.setCapabilityValue).toHaveBeenCalledWith('onoff', true)
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'target_temperature',
        22,
      )
    })

    it('should set thermostat_mode to operationMode when power is on', async () => {
      await device.syncFromDevice()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'thermostat_mode',
        'Heat',
      )
    })

    it('should set thermostat_mode to off when power is off', async () => {
      isFacadePoweredOn = false
      getHomeFacadeMock.mockReturnValue(createMockFacade())
      await device.syncFromDevice()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'thermostat_mode',
        'off',
      )
    })

    it('should not set capability values when getHomeFacade throws', async () => {
      getHomeFacadeMock.mockImplementation(() => {
        throw new Error('Device not found')
      })
      await device.syncFromDevice()

      expect(device.setCapabilityValue).not.toHaveBeenCalled()
    })

    it('should set warning and return null when getHomeFacade throws', async () => {
      getHomeFacadeMock.mockImplementation(() => {
        throw new Error('API error')
      })
      await device.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalledWith('API error')
    })

    it('should skip capabilities the device does not have', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.syncFromDevice()

      expect(device.setCapabilityValue).not.toHaveBeenCalled()
    })

    it('should use deviceToCapability converter when present', async () => {
      const customDevice = createTestHomeDevice()
      Object.defineProperty(customDevice, 'deviceToCapability', {
        value: {
          measure_temperature: (facade: HomeDeviceAtaFacade): number =>
            facade.roomTemperature * 2,
        },
      })
      await customDevice.syncFromDevice()

      expect(customDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        42,
      )
    })
  })

  describe('capability change handling', () => {
    it('should call setValues when capability values are set', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ power: true })
    })

    it('should use capabilityToDevice converter when present', async () => {
      const customDevice = createTestHomeDevice()
      Object.defineProperty(customDevice, 'capabilityToDevice', {
        value: {
          fan_speed: (): HomeAtaValues[keyof HomeAtaValues] => 'Auto',
        },
        writable: true,
      })
      await customDevice.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ fan_speed: 3 })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ setFanSpeed: 'Auto' }),
      )
    })

    it('should handle thermostat_mode off when thermostat supports off', async () => {
      const deviceWithThermostat = createTestHomeDevice()
      Object.defineProperty(deviceWithThermostat, 'thermostatMode', {
        value: { off: 'off' },
      })
      await deviceWithThermostat.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'off' })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ power: false }),
      )
    })

    it('should set onoff to true when thermostat_mode is not off', async () => {
      const deviceWithThermostat = createTestHomeDevice()
      Object.defineProperty(deviceWithThermostat, 'thermostatMode', {
        value: { off: 'off' },
      })
      await deviceWithThermostat.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'heat' })

      expect(setValuesMock).toHaveBeenCalledWith({
        operationMode: 'heat',
        power: true,
      })
    })

    it('should not modify thermostat_mode when thermostat does not support off', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'off' })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ operationMode: 'off' }),
      )
    })

    it('should not call setValues when fetchDevice returns null', async () => {
      getHomeFacadeMock.mockImplementation(() => {
        throw new Error('not found')
      })
      const freshDevice = createTestHomeDevice()
      await freshDevice.onInit()
      setValuesMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).not.toHaveBeenCalled()
    })

    it('should not call setValues when no homeValues keys remain', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.onInit()
      setValuesMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({})

      expect(setValuesMock).not.toHaveBeenCalled()
    })

    it('should sync capabilities after sendUpdate', async () => {
      await device.onInit()
      const setCapabilityValueMock = vi.spyOn(device, 'setCapabilityValue')
      setCapabilityValueMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })
      await getMockCallArg<() => Promise<void>>(
        device.homey.setTimeout as unknown as {
          mock: { calls: unknown[][] }
        },
        0,
        0,
      )()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_temperature',
        21,
      )
    })

    it('should use cached facade when available', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      getHomeFacadeMock.mockClear()
      await callback({ onoff: true })

      expect(getHomeFacadeMock).not.toHaveBeenCalled()
    })

    it('should fetch facade when not cached', async () => {
      getHomeFacadeMock.mockImplementationOnce(() => {
        throw new Error('not found')
      })
      const freshDevice = createTestHomeDevice()
      await freshDevice.onInit()
      getHomeFacadeMock.mockReturnValue(createMockFacade())
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ power: true })
    })
  })

  testSetValuesErrorHandling(
    () => device as object,
    getCapabilityListenerCallback,
    { setValuesMock, superSetWarningMock },
  )

  describe('facade access', () => {
    it('should expose facade via protected getter after sync', async () => {
      await device.syncFromDevice()

      expect(device.exposedFacade).toBeDefined()
    })

    it('should be undefined before sync', () => {
      expect(device.exposedFacade).toBeUndefined()
    })
  })
})
