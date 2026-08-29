import type HomeyModule from 'homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Home from '@olivierzal/melcloud-api/home'

import { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import {
  testFlowListenerRegistration,
  testPairing,
  testRepairing,
} from '../driver-descriptors.ts'
import { type InteropModule, mock } from '../helpers.ts'
import { createListDevicesSession } from '../pair-session.ts'
import HomeMELCloudDriverAta from '../../drivers/home-melcloud/driver.mts'
import { createInstance } from './create-test-instance.ts'

const {
  authenticateMock,
  getHomeDevicesByTypeMock,
  getHomeFacadeMock,
  isAuthenticatedMock,
  setHandlerMock,
  showViewMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn<(data: unknown) => Promise<boolean>>(),
  getHomeDevicesByTypeMock:
    vi.fn<(type: Home.DeviceType) => readonly unknown[]>(),
  getHomeFacadeMock: vi.fn<(id: string, type: Home.DeviceType) => unknown>(),
  isAuthenticatedMock: vi.fn<() => boolean>(),
  setHandlerMock:
    vi.fn<(event: string, handler: (...args: unknown[]) => unknown) => void>(),
  showViewMock: vi.fn<(view: string) => Promise<void>>(),
}))

vi.mock(import('homey'), async () => {
  const { mock: mockModule } = await import('../helpers.ts')
  const { createFlowCardsStub } = await import('../flow-card-mocks.ts')
  class MockDriver {
    public homey = {
      app: {
        getHomeDevicesByType: getHomeDevicesByTypeMock,
        getHomeFacade: getHomeFacadeMock,
        homeApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
      },
      flow: createFlowCardsStub(),
    }

    public log = vi.fn<(...args: readonly unknown[]) => void>()

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

  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Driver: MockDriver },
  })
})

describe(BaseMELCloudDriver, () => {
  let driver: HomeMELCloudDriverAta

  beforeEach(() => {
    vi.clearAllMocks()
    driver = createInstance(HomeMELCloudDriverAta)
  })

  describe('required capabilities', () => {
    it('should include the opt-in measure_signal_strength in the raw list', () => {
      expect(driver.getRequiredCapabilities()).toContain(
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
        mock<Home.Device>({ id: 'device-1', name: 'Living Room' }),
        mock<Home.Device>({ id: 'device-2', name: 'Guest Room' }),
      ]
      getHomeDevicesByTypeMock.mockReturnValue(devices)
      getHomeFacadeMock.mockReturnValue({
        capabilities: { hasAutomaticFanSpeed: true, numberOfFanSpeeds: 5 },
      })

      const { listHandler, session } = createListDevicesSession(showViewMock)
      await driver.onPair(session)
      const result = await listHandler()

      const capabilities = [
        'onoff',
        'measure_temperature',
        'target_temperature',
        'thermostat_mode',
        'fan_speed',
        'vertical',
        'horizontal',
      ]
      const capabilitiesOptions = {
        fan_speed: { max: 5, min: 0, step: 1, units: '' },
      }

      expect(getHomeFacadeMock).toHaveBeenCalledWith(
        'device-1',
        Home.DeviceType.Ata,
      )
      expect(result).toStrictEqual([
        {
          capabilities,
          capabilitiesOptions,
          data: { id: 'device-1' },
          name: 'Living Room',
        },
        {
          capabilities,
          capabilitiesOptions,
          data: { id: 'device-2' },
          name: 'Guest Room',
        },
      ])
    })

    it('should return empty array when getHomeDevicesByType returns empty', async () => {
      getHomeDevicesByTypeMock.mockReturnValue([])

      const { listHandler, session } = createListDevicesSession(showViewMock)
      await driver.onPair(session)
      const result = await listHandler()

      expect(result).toStrictEqual([])
    })
  })

  testRepairing(() => driver, { authenticateMock, setHandlerMock })
})
