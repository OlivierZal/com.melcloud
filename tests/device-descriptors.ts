import { NoChangesError } from '@olivierzal/melcloud-api'
import { type vi, describe, expect, it } from 'vitest'

import { getMockCallArg } from './helpers.ts'

const getConverter = (
  device: object,
  mapping: string,
  key: string,
): ((...args: unknown[]) => unknown) | undefined =>
  (
    device as Record<
      string,
      Record<string, ((...args: unknown[]) => unknown) | undefined>
    >
  )[mapping]?.[key]

export const testCapabilityToDeviceConverters = (
  getDevice: () => object,
  cases: [string, unknown, unknown][],
): void => {
  describe('capability-to-device conversions', () => {
    it.each(cases)('%s(%s) should return %s', (key, input, expected) => {
      expect(
        getConverter(getDevice(), 'capabilityToDevice', key)?.(input),
      ).toBe(expected)
    })
  })
}

export const testDeviceToCapabilityConverters = (
  getDevice: () => object,
  cases: [string, unknown, unknown][],
): void => {
  describe('device-to-capability conversions', () => {
    it.each(cases)('%s(%s) should return %s', (key, input, expected) => {
      expect(
        getConverter(getDevice(), 'deviceToCapability', key)?.(input),
      ).toBe(expected)
    })
  })
}

export const testDeletion = (getDevice: () => object): void => {
  describe('deletion', () => {
    it('should not throw when called', () => {
      expect(() => {
        ;(getDevice() as { onDeleted: () => void }).onDeleted()
      }).not.toThrow()
    })
  })
}

export const testEnergyReportConfig = (
  getDevice: () => object,
  property: string,
  expected: object | null,
): void => {
  describe(property, () => {
    it('should match expected config', () => {
      expect((getDevice() as Record<string, unknown>)[property]).toStrictEqual(
        expected,
      )
    })
  })
}

export const testSetValuesErrorHandling = (
  getDevice: () => object,
  getCapabilityListenerCallback: () => (
    values: Record<string, unknown>,
  ) => Promise<void>,
  mocks: {
    setValuesMock: ReturnType<typeof vi.fn>
    superSetWarningMock: ReturnType<typeof vi.fn>
  },
): void => {
  const { setValuesMock, superSetWarningMock } = mocks

  describe('updateValues error handling', () => {
    it('should handle updateValues error with warning', async () => {
      setValuesMock.mockRejectedValue(new Error('API error'))
      await (getDevice() as { onInit: () => Promise<void> }).onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(superSetWarningMock).toHaveBeenCalledWith('API error')
    })

    it('should ignore NoChangesError', async () => {
      setValuesMock.mockRejectedValue(new NoChangesError(1))
      await (getDevice() as { onInit: () => Promise<void> }).onInit()
      superSetWarningMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(superSetWarningMock).not.toHaveBeenCalled()
    })

    it('should set warning for non-Error thrown values', async () => {
      setValuesMock.mockRejectedValue('string error')
      await (getDevice() as { onInit: () => Promise<void> }).onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(superSetWarningMock).toHaveBeenCalledWith('string error')
    })
  })
}

export const testThermostatMode = (
  getDevice: () => object,
  expected: object | null,
): void => {
  describe('thermostat mode configuration', () => {
    it('should match expected thermostat mode', () => {
      expect((getDevice() as Record<string, unknown>)['thermostatMode']).toBe(
        expected,
      )
    })
  })
}

export const testUninitialisation = (getDevice: () => object): void => {
  describe('uninitialization', () => {
    it('should call onDeleted and return a resolved promise', async () => {
      await expect(
        (getDevice() as { onUninit: () => Promise<void> }).onUninit(),
      ).resolves.toBeUndefined()
    })
  })
}

export const testWarningManagement = (
  getDevice: () => object,
  superSetWarningMock: ReturnType<typeof vi.fn>,
): void => {
  describe('warning management', () => {
    it('should call super.setWarning with error message then null when error is an Error', async () => {
      await (
        getDevice() as { setWarning: (error: unknown) => Promise<void> }
      ).setWarning(new Error('test error'))

      expect(superSetWarningMock).toHaveBeenCalledWith('test error')
      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })

    it('should call super.setWarning with null when null is provided', async () => {
      await (
        getDevice() as { setWarning: (error: unknown) => Promise<void> }
      ).setWarning(null)

      expect(superSetWarningMock).toHaveBeenCalledWith(null)
    })

    it('should convert string errors directly', async () => {
      await (
        getDevice() as { setWarning: (error: unknown) => Promise<void> }
      ).setWarning('string error')

      expect(superSetWarningMock).toHaveBeenCalledWith('string error')
    })

    it('should JSON-stringify non-Error non-string values', async () => {
      await (
        getDevice() as { setWarning: (error: unknown) => Promise<void> }
      ).setWarning({ code: 42 })

      expect(superSetWarningMock).toHaveBeenCalledWith('{"code":42}')
    })
  })
}

export const testThermostatModeOff = (
  createDevice: () => {
    onInit: () => Promise<void>
  },
  getCapabilityListenerCallback: () => (
    values: Record<string, unknown>,
  ) => Promise<void>,
  mocks: {
    expectedValues: {
      nonOff: Record<string, unknown>
      off: Record<string, unknown>
    }
    setValuesMock: ReturnType<typeof vi.fn>
  },
): void => {
  const { expectedValues, setValuesMock } = mocks

  describe('thermostat mode off handling', () => {
    it('should handle thermostat_mode off when thermostat supports off', async () => {
      const device = createDevice()
      Object.defineProperty(device, 'thermostatMode', {
        value: { off: 'off' },
      })
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'off' })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining(expectedValues.off),
      )
    })

    it('should set onoff to true when thermostat_mode is not off', async () => {
      const device = createDevice()
      Object.defineProperty(device, 'thermostatMode', {
        value: { off: 'off' },
      })
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'heat' })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining(expectedValues.nonOff),
      )
    })
  })
}

export const testEnsureDeviceNull = (
  createDevice: () => {
    onInit: () => Promise<void>
  },
  getCapabilityListenerCallback: () => (
    values: Record<string, unknown>,
  ) => Promise<void>,
  mocks: {
    facadeMock: ReturnType<typeof vi.fn>
    setValuesMock: ReturnType<typeof vi.fn>
  },
): void => {
  const { facadeMock, setValuesMock } = mocks

  describe('ensureDevice returns null', () => {
    it('should not call updateValues when ensureDevice returns null', async () => {
      facadeMock.mockImplementation(() => {
        throw new Error('Not found')
      })
      const device = createDevice()
      await device.onInit()
      setValuesMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).not.toHaveBeenCalled()
    })
  })
}

export const testOnoffConverter = (
  getDevice: () => object,
  getSettingMock: ReturnType<typeof vi.fn>,
): void => {
  describe('onoff converter', () => {
    it('should set default onoff converter in capabilityToDevice', async () => {
      getSettingMock.mockReturnValue(false)
      await (getDevice() as { onInit: () => Promise<void> }).onInit()

      expect(getDevice()).toHaveProperty('capabilityToDevice.onoff')
    })

    it('should respect always_on setting for onoff converter', async () => {
      getSettingMock.mockReturnValue(true)
      await (getDevice() as { onInit: () => Promise<void> }).onInit()

      const {
        capabilityToDevice: { onoff: converter },
      } = getDevice() as {
        capabilityToDevice: { onoff?: (value: never) => boolean }
      }

      expect(converter?.(false as never)).toBe(true)
    })

    it('should return true for onoff when value is true regardless of always_on', async () => {
      getSettingMock.mockReturnValue(false)
      await (getDevice() as { onInit: () => Promise<void> }).onInit()

      const {
        capabilityToDevice: { onoff: converter },
      } = getDevice() as {
        capabilityToDevice: { onoff?: (value: never) => boolean }
      }

      expect(converter?.(true as never)).toBe(true)
    })
  })
}

export const testPostUpdateSync = (
  getDevice: () => object,
  getCapabilityListenerCallback: () => (
    values: Record<string, unknown>,
  ) => Promise<void>,
): void => {
  describe('post-update sync', () => {
    it('should sync capabilities after sendUpdate', async () => {
      const device = getDevice() as {
        homey: { setTimeout: ReturnType<typeof vi.fn> }
        setCapabilityValue: ReturnType<typeof vi.fn>
        onInit: () => Promise<void>
      }
      await device.onInit()
      device.setCapabilityValue.mockClear()
      device.homey.setTimeout.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })
      const syncCallback = getMockCallArg<() => Promise<void>>(
        device.homey.setTimeout as unknown as {
          mock: { calls: unknown[][] }
        },
        0,
        0,
      )
      await syncCallback()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
      )
    })
  })
}

export const createCapabilityListenerCallbackGetter =
  (registerMock: {
    mock: { calls: unknown[][] }
  }): (() => (values: Record<string, unknown>) => Promise<void>) =>
  () =>
    getMockCallArg<(values: Record<string, unknown>) => Promise<void>>(
      registerMock,
      0,
      1,
    )
