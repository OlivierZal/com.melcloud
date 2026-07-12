import { NoChangesError } from '@olivierzal/melcloud-api'
import { describe, expect, it, vi } from 'vitest'

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

    it('should warn when the device reports a rejected update', async () => {
      setValuesMock.mockResolvedValue(false)
      await (getDevice() as { onInit: () => Promise<void> }).onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(superSetWarningMock).toHaveBeenCalledWith('errors.updateFailed')
    })
  })
}

export const testThermostatMode = (
  getDevice: () => object,
  expected: object | null,
): void => {
  describe('thermostat mode configuration', () => {
    it('should match expected thermostat mode', () => {
      expect((getDevice() as Record<string, unknown>).thermostatMode).toBe(
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

      // Order matters: the message shows the transient toast, the trailing
      // null clears the persistent bubble (intentional Homey idiom).
      expect(superSetWarningMock).toHaveBeenNthCalledWith(1, 'test error')
      expect(superSetWarningMock).toHaveBeenNthCalledWith(2, null)
      expect(superSetWarningMock).toHaveBeenCalledTimes(2)
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

export const testOnoffCoercion = (
  getDevice: () => { onInit: () => Promise<void> },
  getCapabilityListenerCallback: () => (
    values: Record<string, unknown>,
  ) => Promise<void>,
  mocks: {
    getSettingMock: ReturnType<typeof vi.fn>
    onTag: string
    setValuesMock: ReturnType<typeof vi.fn>
  },
): void => {
  const { getSettingMock, onTag, setValuesMock } = mocks

  describe('onoff coercion', () => {
    it('should coerce onoff to true when always_on is set', async () => {
      getSettingMock.mockReturnValue(true)
      await getDevice().onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: false })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ [onTag]: true }),
      )
    })

    it('should pass onoff through when always_on is not set', async () => {
      getSettingMock.mockReturnValue(false)
      await getDevice().onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: false })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ [onTag]: false }),
      )
    })

    it('should keep onoff true regardless of always_on', async () => {
      getSettingMock.mockReturnValue(false)
      await getDevice().onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ [onTag]: true }),
      )
    })
  })
}

interface PostUpdateSyncDevice {
  error: ReturnType<typeof vi.fn>
  homey: {
    clearTimeout: ReturnType<typeof vi.fn>
    setTimeout: ReturnType<typeof vi.fn>
  }
  setCapabilityValue: ReturnType<typeof vi.fn>
  onDeleted: () => void
  onInit: () => Promise<void>
  syncFromDevice: () => Promise<void>
}

export const testPostUpdateSync = (
  getDevice: () => object,
  getCapabilityListenerCallback: () => (
    values: Record<string, unknown>,
  ) => Promise<void>,
): void => {
  describe('post-update sync', () => {
    it('should sync capabilities after sendUpdate', async () => {
      const device = getDevice() as PostUpdateSyncDevice
      await device.onInit()
      device.setCapabilityValue.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })
      const syncCallback = getMockCallArg<() => Promise<void>>(
        device.homey.setTimeout,
        0,
        0,
      )
      await syncCallback()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
      )
    })

    it('should cancel the pending sync when sendUpdate runs again', async () => {
      const device = getDevice() as PostUpdateSyncDevice
      await device.onInit()
      device.homey.setTimeout.mockReturnValue('timer')
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })
      device.homey.clearTimeout.mockClear()
      await callback({ onoff: false })

      expect(device.homey.clearTimeout).toHaveBeenCalledWith('timer')
    })

    it('should cancel the pending sync on deletion', async () => {
      const device = getDevice() as PostUpdateSyncDevice
      await device.onInit()
      device.homey.setTimeout.mockReturnValue('timer')
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })
      device.homey.clearTimeout.mockClear()
      device.onDeleted()

      expect(device.homey.clearTimeout).toHaveBeenCalledWith('timer')
    })

    it('should log instead of rejecting when the delayed sync fails', async () => {
      const device = getDevice() as PostUpdateSyncDevice
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })
      const syncCallback = getMockCallArg<() => Promise<void>>(
        device.homey.setTimeout,
        0,
        0,
      )
      const failure = new Error('sync failed')
      vi.spyOn(
        device as unknown as { syncFromDevice: () => Promise<void> },
        'syncFromDevice',
      ).mockRejectedValue(failure)

      await expect(syncCallback()).resolves.toBeUndefined()
      expect(device.error).toHaveBeenCalledWith(
        'Post-update sync failed:',
        failure,
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
