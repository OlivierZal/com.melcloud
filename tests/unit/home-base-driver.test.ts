import type HomeyModule from 'homey'
import { type InteropModule, mock } from '@olivierzal/homey-kit/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Home from '@olivierzal/melcloud-api/home'

import { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import {
  testEmptyAccountPairing,
  testPairing,
  testRejectedPairingHint,
  testRepairing,
} from '../driver-descriptors.ts'
import { locales } from '../locales.ts'
import { createListDevicesSession } from '../pair-session.ts'
import HomeMELCloudDriverAta from '../../drivers/home-melcloud/driver.mts'
import { createInstance } from './create-test-instance.ts'

const {
  authenticateMock,
  getHomeDevicesByTypeMock,
  getHomeFacadeMock,
  isAccountEmptyMock,
  isAuthenticatedMock,
  isPairingMisdirectedMock,
  setHandlerMock,
  showViewMock,
} = await vi.hoisted(async () => {
  const { createHomeDriverMocks } = await import('../home-driver-mocks.ts')
  return createHomeDriverMocks()
})

vi.mock(import('homey'), async () => {
  const { mock: mockModule } = await import('@olivierzal/homey-kit/testing')
  class MockDriver {
    public homey = {
      __: vi.fn<(key: string) => string>((key) => key),
      app: {
        getHomeDevicesByType: getHomeDevicesByTypeMock,
        getHomeFacade: getHomeFacadeMock,
        homeApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
        isAccountEmpty: isAccountEmptyMock,
        isPairingMisdirected: isPairingMisdirectedMock,
      },
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

  testEmptyAccountPairing(() => driver, {
    api: 'home',
    isAccountEmptyMock,
    showViewMock,
  })

  testPairing(() => driver, {
    authenticateMock,
    isAuthenticatedMock,
    setHandlerMock,
    showViewMock,
  })

  testRejectedPairingHint(() => driver, {
    api: 'home',
    authenticateMock,
    isPairingMisdirectedMock,
    showViewMock,
  })

  // The hint sends the user to the OTHER dialect's drivers, whose names
  // carry a language-neutral prefix: every locale must spell that prefix
  // verbatim, and never the refused dialect's own.
  it.each(Object.entries(locales))(
    'keeps the %s rejected-pairing hints on the other dialect',
    (_locale, { pair }) => {
      const { classic, home } = pair.rejected

      expect(classic).toContain('MELCloud Classic')
      expect(classic).toContain('MELCloud Home')
      expect(classic).toContain('[Home]')
      expect(classic).not.toContain('[Classic]')
      expect(home).toContain('MELCloud Home')
      expect(home).toContain('MELCloud Classic')
      expect(home).toContain('[Classic]')
      expect(home).not.toContain('[Home]')
    },
  )

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
