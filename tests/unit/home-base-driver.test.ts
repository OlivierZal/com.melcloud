/* eslint-disable
    @typescript-eslint/consistent-type-imports,
*/
import type { HomeDevice } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HomeBaseMELCloudDriver } from '../../drivers/home-base-driver.mts'
import { mock } from '../helpers.ts'
import { createInstance } from './create-test-instance.ts'

const authenticateMock = vi.fn()
const isAuthenticatedMock = vi.fn()
const getHomeDevicesMock = vi.fn()
const showViewMock = vi.fn()
const setHandlerMock = vi.fn()

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', () => {
  class MockDriver {
    public homey = {
      app: {
        getHomeDevices: getHomeDevicesMock,
        homeApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
      },
    }

    public log = vi.fn()
  }

  return { default: { Driver: MockDriver } }
})

describe(HomeBaseMELCloudDriver, () => {
  let driver: HomeBaseMELCloudDriver

  beforeEach(() => {
    vi.clearAllMocks()
    driver = createInstance(HomeBaseMELCloudDriver)
  })

  describe('pairing', () => {
    it('should set handlers on the session', async () => {
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: setHandlerMock,
        showView: showViewMock,
      })
      await driver.onPair(session)

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
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'showView') {
                handler('loading')
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      expect(showViewMock).toHaveBeenCalledWith('list_devices')
    })

    it('should show login when not authenticated on loading view', async () => {
      isAuthenticatedMock.mockReturnValue(false)
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'showView') {
                handler('loading')
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      expect(showViewMock).toHaveBeenCalledWith('login')
    })

    it('should do nothing when showView is called with a non-loading view', async () => {
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'showView') {
                handler('other')
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      expect(showViewMock).not.toHaveBeenCalled()
    })

    it('should invoke authenticate via the login handler', async () => {
      authenticateMock.mockResolvedValue(true)

      let loginHandler: (data: unknown) => Promise<unknown> = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue()
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (data: unknown) => Promise<unknown>) => {
              if (event === 'login') {
                loginHandler = handler
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      const result = await loginHandler({
        password: 'pass',
        username: 'user',
      })

      expect(result).toBe(true)
      expect(authenticateMock).toHaveBeenCalledWith({
        password: 'pass',
        username: 'user',
      })
    })

    it('should discover devices on list_devices handler', async () => {
      const devices = [
        mock<HomeDevice>({
          givenDisplayName: 'Living Room',
          id: 'device-1',
        }),
        mock<HomeDevice>({
          givenDisplayName: 'Guest Room',
          id: 'device-2',
        }),
      ]
      getHomeDevicesMock.mockResolvedValue(devices)

      const listHandler = vi.fn()
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'list_devices') {
                listHandler.mockImplementation(handler)
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)
      const result = await listHandler()

      expect(result).toStrictEqual([
        {
          data: { id: 'device-1' },
          name: 'Living Room',
        },
        {
          data: { id: 'device-2' },
          name: 'Guest Room',
        },
      ])
    })

    it('should return empty array when getHomeDevices returns empty', async () => {
      getHomeDevicesMock.mockResolvedValue([])

      const listHandler = vi.fn()
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'list_devices') {
                listHandler.mockImplementation(handler)
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)
      const result = await listHandler()

      expect(result).toStrictEqual([])
    })
  })

  describe('repairing', () => {
    it('should set login handler on the session', async () => {
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: setHandlerMock,
      })
      await driver.onRepair(session)

      expect(setHandlerMock).toHaveBeenCalledWith('login', expect.any(Function))
    })

    it('should invoke authenticate via the repair login handler', async () => {
      authenticateMock.mockResolvedValue(true)

      let loginHandler: (data: unknown) => Promise<unknown> = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue()
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (data: unknown) => Promise<unknown>) => {
              if (event === 'login') {
                loginHandler = handler
              }
            },
          ),
      })
      await driver.onRepair(session)

      const result = await loginHandler({
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
})
