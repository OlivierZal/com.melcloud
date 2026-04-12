/* eslint-disable
    @typescript-eslint/consistent-type-imports,
*/
import type { HomeDevice } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import {
  testFlowListenerRegistration,
  testPairing,
  testRepairing,
} from '../driver-descriptors.ts'
import { mock } from '../helpers.ts'
import HomeMELCloudDriverAta from '../../drivers/home-melcloud/driver.mts'
import { createInstance } from './create-test-instance.ts'

const {
  authenticateMock,
  getHomeDevicesByTypeMock,
  isAuthenticatedMock,
  setHandlerMock,
  showViewMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  getHomeDevicesByTypeMock: vi.fn(),
  isAuthenticatedMock: vi.fn(),
  setHandlerMock: vi.fn(),
  showViewMock: vi.fn(),
}))

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', () => {
  class MockDriver {
    public homey = {
      app: {
        getHomeDevicesByType: getHomeDevicesByTypeMock,
        homeApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
      },
      flow: {
        getActionCard: vi.fn().mockReturnValue({
          registerRunListener: vi.fn(),
        }),
        getConditionCard: vi.fn().mockReturnValue({
          registerRunListener: vi.fn(),
        }),
      },
    }

    public log = vi.fn()

    public manifest = {
      capabilities: [
        'onoff',
        'measure_temperature',
        'target_temperature',
        'thermostat_mode',
        'fan_speed',
        'vertical',
        'horizontal',
        'measure_signal_strength',
      ],
    }
  }

  return { default: { Driver: MockDriver } }
})

describe(BaseMELCloudDriver, () => {
  let driver: BaseMELCloudDriver

  beforeEach(() => {
    vi.clearAllMocks()
    driver = createInstance(HomeMELCloudDriverAta)
  })

  describe('required capabilities', () => {
    it('should exclude measure_signal_strength from required capabilities', () => {
      expect(driver.getRequiredCapabilities()).not.toContain(
        'measure_signal_strength',
      )
    })

    it('should include all other manifest capabilities', () => {
      expect(driver.getRequiredCapabilities()).toContain('onoff')
      expect(driver.getRequiredCapabilities()).toContain('fan_speed')
    })
  })

  testFlowListenerRegistration(() => driver, 'onoff', 'measure_temperature')

  testPairing(() => driver, {
    authenticateMock,
    isAuthenticatedMock,
    setHandlerMock,
    showViewMock,
  })

  describe('device discovery', () => {
    it('should discover devices on list_devices handler', async () => {
      const devices = [
        mock<HomeDevice>({
          id: 'device-1',
          name: 'Living Room',
        }),
        mock<HomeDevice>({
          id: 'device-2',
          name: 'Guest Room',
        }),
      ]
      getHomeDevicesByTypeMock.mockReturnValue(devices)

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

    it('should return empty array when getHomeDevicesByType returns empty', async () => {
      getHomeDevicesByTypeMock.mockReturnValue([])

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

  testRepairing(() => driver, { authenticateMock, setHandlerMock })
})
