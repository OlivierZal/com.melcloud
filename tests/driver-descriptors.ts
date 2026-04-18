import type PairSession from 'homey/lib/PairSession'
import { AuthenticationError } from '@olivierzal/melcloud-api'
import { describe, expect, it, vi } from 'vitest'

import { mock } from './helpers.ts'

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

export const testFlowListenerRegistration = (
  getDriver: () => object,
  setCapability: string,
  nonSetCapability: string,
): void => {
  interface FlowDriver {
    homey: {
      flow: {
        getActionCard: ReturnType<typeof vi.fn>
        getConditionCard: ReturnType<typeof vi.fn>
      }
    }
    onInit: () => Promise<void>
  }

  describe('flow listener registration', () => {
    it('should register condition listeners for manifest capabilities', async () => {
      const driver = getDriver() as FlowDriver
      await driver.onInit()

      expect(driver.homey.flow.getConditionCard).toHaveBeenCalledWith(
        `${setCapability}_condition`,
      )
      expect(driver.homey.flow.getConditionCard).toHaveBeenCalledWith(
        `${nonSetCapability}_condition`,
      )
    })

    it('should register action listeners only for set capabilities', async () => {
      const driver = getDriver() as FlowDriver
      await driver.onInit()

      expect(driver.homey.flow.getActionCard).toHaveBeenCalledWith(
        `${setCapability}_action`,
      )
      expect(driver.homey.flow.getActionCard).not.toHaveBeenCalledWith(
        `${nonSetCapability}_action`,
      )
    })
  })
}

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

    it('should return false when authenticate throws AuthenticationError', async () => {
      authenticateMock.mockRejectedValue(
        new AuthenticationError('invalid credentials'),
      )
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)
      const result = await reference.loginHandler({
        password: 'wrong',
        username: 'user',
      })

      expect(result).toBe(false)
    })

    it('should rethrow non-authentication errors from the login handler', async () => {
      const error = new Error('network down')
      authenticateMock.mockRejectedValue(error)
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)

      await expect(
        reference.loginHandler({ password: 'pass', username: 'user' }),
      ).rejects.toThrow(error)
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
