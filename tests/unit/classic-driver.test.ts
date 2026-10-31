import type * as Classic from '@olivierzal/melcloud-api/classic'
import type HomeyModule from 'homey'
import { type InteropModule, mock } from '@olivierzal/homey-kit/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import {
  testEmptyAccountPairing,
  testPairing,
  testRejectedPairingHint,
  testRepairing,
} from '../driver-descriptors.ts'
import { createListDevicesSession } from '../pair-session.ts'
import {
  type TestDriver,
  type TestDriverType,
  createTestDriver,
} from './classic-driver-test-driver.ts'

const {
  authenticateMock,
  isAccountEmptyMock,
  isAuthenticatedMock,
  isPairingMisdirectedMock,
  setHandlerMock,
  showViewMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn<(data: unknown) => Promise<boolean>>(),
  isAccountEmptyMock: vi.fn<(api: string) => boolean>(() => false),
  isAuthenticatedMock: vi.fn<() => boolean>().mockReturnValue(false),
  isPairingMisdirectedMock: vi.fn<(api: string) => boolean>(() => false),
  setHandlerMock:
    vi.fn<(event: string, handler: (...args: unknown[]) => unknown) => void>(),
  showViewMock: vi.fn<(view: string) => Promise<void>>(),
}))

vi.mock(import('homey'), async () => {
  const { mock: mockModule } = await import('@olivierzal/homey-kit/testing')
  class MockDriver {
    public getDevices = vi.fn<() => readonly unknown[]>().mockReturnValue([])

    public homey = {
      __: vi.fn<(key: string) => string>((key) => key),
      app: {
        classicApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
        getDevicesByType: vi
          .fn<(type: number) => readonly unknown[]>()
          .mockReturnValue([]),
        isAccountEmpty: isAccountEmptyMock,
        isPairingMisdirected: isPairingMisdirectedMock,
      },
    }

    public log = vi.fn<(...args: readonly unknown[]) => void>()
  }

  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Driver: MockDriver },
  })
})

describe(ClassicMELCloudDriver, () => {
  let driver: TestDriver

  beforeEach(() => {
    driver = createTestDriver()
  })

  const stubDiscoverableDevice = (): void => {
    vi.spyOn(driver.homey.app, 'getDevicesByType').mockReturnValue([
      mock<Classic.Device<TestDriverType>>({
        data: { Power: true },
        id: 1,
        name: 'Device 1',
      }),
    ])
  }

  testEmptyAccountPairing(() => driver, {
    api: 'classic',
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
    api: 'classic',
    authenticateMock,
    isPairingMisdirectedMock,
    showViewMock,
  })

  describe('device discovery', () => {
    it('should discover devices on list_devices handler', async () => {
      const { listHandler, session } = createListDevicesSession(showViewMock)
      stubDiscoverableDevice()
      await driver.onPair(session)
      const devices = await listHandler()

      expect(devices).toStrictEqual([
        {
          capabilities: ['onoff', 'thermostat_mode'],
          capabilitiesOptions: {},
          data: { id: 1 },
          name: 'Device 1',
        },
      ])
    })

    // The opt-in rule at the pairing-details call site: the raw required
    // list carries measure_signal_strength, the listed device must not.
    it('should exclude the opt-in measure_signal_strength from pairing details', async () => {
      const { listHandler, session } = createListDevicesSession(showViewMock)
      stubDiscoverableDevice()
      vi.spyOn(driver, 'getRequiredCapabilities').mockReturnValue([
        'onoff',
        'measure_signal_strength',
      ])
      await driver.onPair(session)
      const devices = await listHandler()

      expect(devices).toStrictEqual([
        {
          capabilities: ['onoff'],
          capabilitiesOptions: {},
          data: { id: 1 },
          name: 'Device 1',
        },
      ])
    })
  })

  testRepairing(() => driver, { authenticateMock, setHandlerMock })
})
