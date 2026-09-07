import type HomeyModule from 'homey'
import { type InteropModule, mock } from '@olivierzal/homey-kit/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Home from '@olivierzal/melcloud-api/home'

import { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import {
  testFlowListenerRegistration,
  testPairing,
  testRepairing,
} from '../driver-descriptors.ts'
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
} = await vi.hoisted(async () => {
  const { createHomeDriverMocks } = await import('../home-driver-mocks.ts')
  return createHomeDriverMocks()
})

// The app manifest declares fewer cards than the driver has
// capabilities: registration must follow the declared set, never the
// capability walk. `fan_speed` is set-mapped without an action card;
// `measure_signal_strength` (the opt-in) has no card at all.
const MANIFEST_FLOW = {
  actions: [{ id: 'onoff_action' }],
  conditions: [
    { id: 'fan_speed_condition' },
    { id: 'measure_temperature_condition' },
    { id: 'onoff_condition' },
  ],
}

vi.mock(import('homey'), async () => {
  const { mock: mockModule } = await import('@olivierzal/homey-kit/testing')
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
      manifest: { flow: MANIFEST_FLOW },
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

  testFlowListenerRegistration(() => driver, {
    readOnly: 'measure_temperature',
    settable: 'onoff',
    settableWithoutAction: 'fan_speed',
    undeclared: 'measure_signal_strength',
  })

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
