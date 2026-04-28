import type * as Home from '@olivierzal/melcloud-api/home'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseMELCloudDevice } from '../../drivers/base-device.mts'
import {
  createCapabilityListenerCallbackGetter,
  testEnsureDeviceNull,
  testPostUpdateSync,
  testSetValuesErrorHandling,
  testThermostatModeOff,
} from '../device-descriptors.ts'
import {
  type TestHomeDevice,
  createTestHomeDevice,
} from './home-base-device-test-device.ts'

const {
  getHomeFacadeMock,
  getSettingMock,
  realtimeMock,
  registerMultipleCapabilityListenerMock,
  setValuesMock,
  superSetWarningMock,
} = vi.hoisted(() => ({
  getHomeFacadeMock: vi.fn<(id: string) => unknown>(),
  getSettingMock: vi.fn<(key: string) => unknown>(),
  realtimeMock: vi.fn<(event: string, data: unknown) => void>(),
  registerMultipleCapabilityListenerMock:
    vi.fn<
      (
        capabilities: string[],
        listener: (values: Record<string, unknown>) => Promise<void>,
        debounce: number,
      ) => void
    >(),
  setValuesMock: vi.fn<(values: Record<string, unknown>) => Promise<boolean>>(),
  superSetWarningMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
}))

let isFacadePoweredOn = true

const createMockFacade = (): Home.DeviceAtaFacade =>
  ({
    capabilities: {
      hasAutomaticFanSpeed: true,
      numberOfFanSpeeds: 5,
    },
    updateValues: setValuesMock,
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
  }) as unknown as Home.DeviceAtaFacade

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDeviceClass } = await import('../helpers.ts')
  return {
    default: {
      Device: createMockDeviceClass({
        overrides: {
          driver: {
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
            getRequiredCapabilities(this: {
              manifest: { capabilities: string[] }
            }): string[] {
              return this.manifest.capabilities
            },
          },
          getData: vi
            .fn<() => { id: string }>()
            .mockReturnValue({ id: 'device-1' }),
          getSetting: getSettingMock,
          homey: {
            api: { realtime: realtimeMock },
            app: { getHomeFacade: getHomeFacadeMock },
            clearInterval: vi.fn<(timer: NodeJS.Timeout | undefined) => void>(),
            clearTimeout: vi.fn<(timer: NodeJS.Timeout | null) => void>(),
            setInterval:
              vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
            setTimeout:
              vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
          },
          registerMultipleCapabilityListener:
            registerMultipleCapabilityListenerMock,
        },
        superMocks: { setWarning: superSetWarningMock },
      }),
    },
  }
})

const getCapabilityListenerCallback = createCapabilityListenerCallbackGetter(
  registerMultipleCapabilityListenerMock,
)

describe(BaseMELCloudDevice, () => {
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
  })

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
          measure_temperature: (facade: Home.DeviceAtaFacade): number =>
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
    it('should call updateValues when capability values are set', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ power: true })
    })

    it('should use capabilityToDevice converter when present', async () => {
      const customDevice = createTestHomeDevice()
      Object.defineProperty(customDevice, 'capabilityToDevice', {
        value: {
          fan_speed: (): Home.AtaValues[keyof Home.AtaValues] => 'Auto',
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

    it('should not modify thermostat_mode when thermostat does not support off', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'off' })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ operationMode: 'off' }),
      )
    })

    it('should not call updateValues when no homeValues keys remain', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.onInit()
      setValuesMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({})

      expect(setValuesMock).not.toHaveBeenCalled()
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

  testPostUpdateSync(() => device, getCapabilityListenerCallback)

  testThermostatModeOff(createTestHomeDevice, getCapabilityListenerCallback, {
    expectedValues: {
      nonOff: { operationMode: 'heat', power: true },
      off: { power: false },
    },
    setValuesMock,
  })

  testEnsureDeviceNull(createTestHomeDevice, getCapabilityListenerCallback, {
    facadeMock: getHomeFacadeMock,
    setValuesMock,
  })

  testSetValuesErrorHandling(() => device, getCapabilityListenerCallback, {
    setValuesMock,
    superSetWarningMock,
  })

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
