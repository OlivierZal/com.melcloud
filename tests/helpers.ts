import type PairSession from 'homey/lib/PairSession'
import { describe, expect, it, vi } from 'vitest'

// eslint-disable-next-line func-style -- TS requires function declaration for asserts predicates
export function assertDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined()
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- T is intentionally used only in the return type to enable callers to specify the expected mock argument type
export const getMockCallArg = <T>(
  mockFunction: { mock: { calls: unknown[][] } },
  callIndex: number,
  argIndex: number,
): T => {
  const arg = mockFunction.mock.calls.at(callIndex)?.at(argIndex)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime guard: arg is unknown (not T | undefined) so TypeScript sees assertDefined as unnecessary, but the runtime check is needed
  assertDefined(arg)
  return arg as T
}

export const mock = <T>(overrides: Partial<Record<keyof T, unknown>> = {}): T =>
  overrides as T

export const createEnergyReportMock = (): {
  EnergyReport: ReturnType<typeof vi.fn>
} => ({
  EnergyReport: vi.fn().mockImplementation(() => ({
    handle: vi.fn<() => Promise<void>>().mockResolvedValue(),
    unschedule: vi.fn(),
  })),
})

export { createMockDeviceClass } from './mock-device-class.ts'
export { createMockDriverClass } from './mock-driver-class.ts'

export const testDriverType = (
  getDriver: () => { type: unknown },
  expectedType: unknown,
): void => {
  describe('type', () => {
    it(`should be ${JSON.stringify(expectedType)}`, () => {
      expect(getDriver().type).toBe(expectedType)
    })
  })
}

export const testTagMappings = (
  getDriver: () => object,
  mappings: Record<string, unknown>,
): void => {
  describe('tag mappings', () => {
    it.each(Object.entries(mappings))(
      'should use the correct %s',
      (name, expected) => {
        expect((getDriver() as Record<string, unknown>)[name]).toBe(expected)
      },
    )
  })
}

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

  describe('setValues error handling', () => {
    it('should handle setValues error with warning', async () => {
      setValuesMock.mockRejectedValue(new Error('API error'))
      await (getDevice() as { onInit: () => Promise<void> }).onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(superSetWarningMock).toHaveBeenCalledWith('API error')
    })

    it('should ignore "No data to set" error', async () => {
      setValuesMock.mockRejectedValue(new Error('No data to set'))
      await (getDevice() as { onInit: () => Promise<void> }).onInit()
      superSetWarningMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(superSetWarningMock).not.toHaveBeenCalledWith('No data to set')
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

export const testFetchDeviceNull = (
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

  describe('fetchDevice returns null', () => {
    it('should not call setValues when fetchDevice returns null', async () => {
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

const createShowViewSession = (
  showViewMock: ReturnType<typeof vi.fn>,
  viewName: string,
): PairSession =>
  mock<PairSession>({
    setHandler: vi
      .fn()
      .mockImplementation(
        (event: string, handler: (...args: unknown[]) => unknown) => {
          if (event === 'showView') {
            handler(viewName)
          }
        },
      ),
    showView: showViewMock,
  })

const createLoginSession = (
  showViewMock: ReturnType<typeof vi.fn>,
): {
  reference: { loginHandler: (data: unknown) => Promise<unknown> }
  session: PairSession
} => {
  const reference: { loginHandler: (data: unknown) => Promise<unknown> } = {
    loginHandler: vi.fn<() => Promise<void>>().mockResolvedValue(),
  }
  const session = mock<PairSession>({
    setHandler: vi
      .fn()
      .mockImplementation(
        (event: string, handler: (data: unknown) => Promise<unknown>) => {
          if (event === 'login') {
            reference.loginHandler = handler
          }
        },
      ),
    showView: showViewMock,
  })
  return { reference, session }
}

export const testPairing = (
  getDriver: () => {
    onPair: (session: PairSession) => Promise<void>
  },
  mocks: {
    authenticateMock: ReturnType<typeof vi.fn>
    isAuthenticatedMock: ReturnType<typeof vi.fn>
    setHandlerMock: ReturnType<typeof vi.fn>
    showViewMock: ReturnType<typeof vi.fn>
  },
): void => {
  const {
    authenticateMock,
    isAuthenticatedMock,
    setHandlerMock,
    showViewMock,
  } = mocks

  describe('pairing', () => {
    it('should set handlers on the session', async () => {
      const session = mock<PairSession>({
        setHandler: setHandlerMock,
        showView: showViewMock,
      })
      await getDriver().onPair(session)

      expect(setHandlerMock).toHaveBeenCalledWith(
        'showView',
        expect.any(Function),
      )
      expect(setHandlerMock).toHaveBeenCalledWith('login', expect.any(Function))
      expect(setHandlerMock).toHaveBeenCalledWith(
        'list_devices',
        expect.any(Function),
      )
    })

    it('should show list_devices when authenticated on loading view', async () => {
      isAuthenticatedMock.mockReturnValue(true)
      const session = createShowViewSession(showViewMock, 'loading')
      await getDriver().onPair(session)

      expect(showViewMock).toHaveBeenCalledWith('list_devices')
    })

    it('should show login when not authenticated on loading view', async () => {
      isAuthenticatedMock.mockReturnValue(false)
      const session = createShowViewSession(showViewMock, 'loading')
      await getDriver().onPair(session)

      expect(showViewMock).toHaveBeenCalledWith('login')
    })

    it('should do nothing when showView is called with a non-loading view', async () => {
      const session = createShowViewSession(showViewMock, 'other')
      await getDriver().onPair(session)

      expect(showViewMock).not.toHaveBeenCalled()
    })

    it('should invoke authenticate via the login handler', async () => {
      authenticateMock.mockResolvedValue(true)
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)
      const result = await reference.loginHandler({
        password: 'pass',
        username: 'user',
      })

      expect(result).toBe(true)
      expect(authenticateMock).toHaveBeenCalledWith({
        password: 'pass',
        username: 'user',
      })
    })
  })
}

export const testRepairing = (
  getDriver: () => {
    onRepair: (session: PairSession) => Promise<void>
  },
  mocks: {
    authenticateMock: ReturnType<typeof vi.fn>
    setHandlerMock: ReturnType<typeof vi.fn>
  },
): void => {
  const { authenticateMock, setHandlerMock } = mocks

  describe('repairing', () => {
    it('should set login handler on the session', async () => {
      const session = mock<PairSession>({
        setHandler: setHandlerMock,
      })
      await getDriver().onRepair(session)

      expect(setHandlerMock).toHaveBeenCalledWith('login', expect.any(Function))
    })

    it('should invoke authenticate via the repair login handler', async () => {
      authenticateMock.mockResolvedValue(true)
      const { reference, session } = createLoginSession(vi.fn())
      await getDriver().onRepair(session)
      const result = await reference.loginHandler({
        password: 'pass',
        username: 'user',
      })

      expect(result).toBe(true)
      expect(authenticateMock).toHaveBeenCalledWith({
        password: 'pass',
        username: 'user',
      })
    })
  })
}
