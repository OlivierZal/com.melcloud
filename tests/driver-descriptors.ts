import type PairSession from 'homey/lib/PairSession'
import { mock } from '@olivierzal/homey-kit/testing'
import {
  AuthenticationError,
  RegistrySyncError,
} from '@olivierzal/melcloud-api'
import { describe, expect, it, vi } from 'vitest'

import type { Api } from '../types/api.mts'
import { createListDevicesSession } from './pair-session.ts'

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

// An account listing no unit at all answers with where its units may
// be, which Homey shows in place of the empty list: both dialects, each
// naming its own account.
export const testEmptyAccountPairing = (
  getDriver: () => { onPair: (session: PairSession) => Promise<void> },
  {
    api,
    isAccountEmptyMock,
    showViewMock,
  }: {
    readonly api: Api
    readonly isAccountEmptyMock: ReturnType<typeof vi.fn>
    readonly showViewMock: ReturnType<
      typeof vi.fn<(view: string) => Promise<void>>
    >
  },
): void => {
  describe('emptied account pairing', () => {
    it('should explain the emptied account instead of listing nothing', async () => {
      isAccountEmptyMock.mockReturnValueOnce(true)
      const { listHandler, session } = createListDevicesSession(showViewMock)
      await getDriver().onPair(session)

      await expect(listHandler()).rejects.toThrow(`pair.accountEmpty.${api}`)
      expect(isAccountEmptyMock).toHaveBeenCalledWith(api)
    })
  })
}

// Refused credentials while the OTHER account is signed in and lists
// units: the wizard was most likely opened on the wrong dialect's
// driver, so the login handler throws the hint Homey shows in place of
// its generic failure, naming that account's devices. Both dialects,
// each consulting the other's listing.
export const testRejectedPairingHint = (
  getDriver: () => { onPair: (session: PairSession) => Promise<void> },
  {
    api,
    authenticateMock,
    hasListedUnitsMock,
    showViewMock,
  }: {
    readonly api: Api
    readonly authenticateMock: ReturnType<typeof vi.fn>
    readonly hasListedUnitsMock: ReturnType<typeof vi.fn>
    readonly showViewMock: ReturnType<
      typeof vi.fn<(view: string) => Promise<void>>
    >
  },
): void => {
  describe('rejected pairing hint', () => {
    it("should name the other account's devices when it lists units", async () => {
      authenticateMock.mockRejectedValue(
        new AuthenticationError('invalid credentials'),
      )
      hasListedUnitsMock.mockReturnValueOnce(true)
      const { reference, session } = createLoginSession(showViewMock)
      await getDriver().onPair(session)

      await expect(
        reference.loginHandler({ password: 'wrong', username: 'user' }),
      ).rejects.toThrow(`pair.rejected.${api}`)
      expect(hasListedUnitsMock).toHaveBeenCalledWith(
        api === 'home' ? 'classic' : 'home',
      )
    })
  })
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
