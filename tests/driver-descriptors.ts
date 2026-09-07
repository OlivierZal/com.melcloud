import type PairSession from 'homey/lib/PairSession'
import { mock } from '@olivierzal/homey-kit/testing'
import {
  AuthenticationError,
  RegistrySyncError,
} from '@olivierzal/melcloud-api'
import { describe, expect, it, vi } from 'vitest'

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
      'should use the correct %s mapping',
      (name, expected) => {
        expect(
          (getDriver() as { tagMappings: Record<string, unknown> }).tagMappings[
            name
          ],
        ).toBe(expected)
      },
    )
  })
}

// The card ids the app manifest declares decide what gets wired: the
// caller names one capability per shape its manifest stub carries.
export const testFlowListenerRegistration = (
  getDriver: () => object,
  capabilities: {
    // Condition card declared; not set-mapped, so no action card either.
    readonly readOnly: string
    // Condition and action cards both declared, and set-mapped.
    readonly settable: string
    // Set-mapped with a declared condition card but no action card.
    readonly settableWithoutAction: string
    // In the driver manifest, with no card of either kind.
    readonly undeclared: string
  },
): void => {
  const { readOnly, settable, settableWithoutAction, undeclared } = capabilities

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
    it.each([settable, settableWithoutAction, readOnly])(
      'should register the declared condition card for %s',
      async (capability) => {
        const driver = getDriver() as FlowDriver
        await driver.onInit()

        expect(driver.homey.flow.getConditionCard).toHaveBeenCalledWith(
          `${capability}_condition`,
        )
      },
    )

    it('should register the declared action card of a set capability', async () => {
      const driver = getDriver() as FlowDriver
      await driver.onInit()

      expect(driver.homey.flow.getActionCard).toHaveBeenCalledWith(
        `${settable}_action`,
      )
      expect(driver.homey.flow.getActionCard).not.toHaveBeenCalledWith(
        `${readOnly}_action`,
      )
    })

    it('should never look up a card the manifest does not declare', async () => {
      const driver = getDriver() as FlowDriver
      await driver.onInit()

      expect(driver.homey.flow.getConditionCard).not.toHaveBeenCalledWith(
        `${undeclared}_condition`,
      )
      expect(driver.homey.flow.getActionCard).not.toHaveBeenCalledWith(
        `${undeclared}_action`,
      )
      expect(driver.homey.flow.getActionCard).not.toHaveBeenCalledWith(
        `${settableWithoutAction}_action`,
      )
    })

    // A declared card the runtime cannot hand out is a contract break:
    // the throw surfaces from onInit instead of being swallowed.
    it('should surface a declared card the runtime cannot hand out', async () => {
      const driver = getDriver() as FlowDriver
      const failure = new Error('Card not found')
      driver.homey.flow.getConditionCard.mockImplementationOnce(() => {
        throw failure
      })

      await expect(driver.onInit()).rejects.toBe(failure)
    })

    // The action path has no catch of its own either: re-adding one
    // around the action registration alone would keep coverage green
    // without this pin.
    it('should surface a declared action card the runtime cannot hand out', async () => {
      const driver = getDriver() as FlowDriver
      const failure = new Error('Action card not found')
      driver.homey.flow.getActionCard.mockImplementationOnce(() => {
        throw failure
      })

      await expect(driver.onInit()).rejects.toBe(failure)
    })
  })
}

const createShowViewSession = (
  showViewMock: ReturnType<typeof vi.fn>,
  viewName: string,
): PairSession =>
  mock<PairSession>({
    setHandler: vi
      .fn<(event: string, handler: (...args: unknown[]) => unknown) => void>()
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
      .fn<
        (event: string, handler: (data: unknown) => Promise<unknown>) => void
      >()
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
  getDriver: () => { onPair: (session: PairSession) => Promise<void> },
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

    // The library enforces a registry sync AFTER the server accepted
    // the credentials and wraps that failure as `RegistrySyncError`.
    // Pairing follows the TYPE, not the session — an account that IS
    // signed in reaches its device list.
    it('should pair through a registry sync failure on an accepted sign-in', async () => {
      authenticateMock.mockRejectedValue(
        new RegistrySyncError(
          'Signed in, but the registry could not be verified',
          { cause: new Error('registry sync down') },
        ),
      )
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)

      await expect(
        reference.loginHandler({ password: 'pass', username: 'user' }),
      ).resolves.toBe(true)
    })

    // The retired heuristic's confirmed false positive: a transport
    // failure during the sign-in round-trip over a PRE-EXISTING live
    // session read "signed in, stale list" while the new credentials
    // were never accepted. It is a LOGIN FAILURE, and the session is
    // never consulted.
    it('should fail the login on a transport failure over a pre-existing live session', async () => {
      const error = new Error('transport down')
      authenticateMock.mockRejectedValue(error)
      isAuthenticatedMock.mockReturnValue(true)
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)

      await expect(
        reference.loginHandler({ password: 'pass', username: 'user' }),
      ).rejects.toThrow(error)
      expect(isAuthenticatedMock).not.toHaveBeenCalled()
    })

    it('should never pair through a credential rejection', async () => {
      authenticateMock.mockRejectedValue(
        new AuthenticationError('invalid credentials'),
      )
      isAuthenticatedMock.mockReturnValue(true)
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)

      await expect(
        reference.loginHandler({ password: 'wrong', username: 'user' }),
      ).resolves.toBe(false)
    })
  })
}

export const testRepairing = (
  getDriver: () => { onRepair: (session: PairSession) => Promise<void> },
  mocks: {
    authenticateMock: ReturnType<typeof vi.fn>
    setHandlerMock: ReturnType<typeof vi.fn>
  },
): void => {
  const { authenticateMock, setHandlerMock } = mocks

  describe('repairing', () => {
    it('should set login handler on the session', async () => {
      const session = mock<PairSession>({ setHandler: setHandlerMock })
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
