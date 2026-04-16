import type PairSession from 'homey/lib/PairSession'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EnergyCapabilityTagMapping } from '../../types/capabilities.mts'
import { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import {
  testFlowListenerRegistration,
  testPairing,
  testRepairing,
} from '../driver-descriptors.ts'
import { assertDefined, mock } from '../helpers.ts'
import {
  type TestDriver,
  type TestDriverType,
  createTestDriver,
} from './classic-driver-test-driver.ts'

const {
  authenticateMock,
  isAuthenticatedMock,
  registerRunListenerMock,
  setHandlerMock,
  showViewMock,
} = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  isAuthenticatedMock: vi.fn().mockReturnValue(false),
  registerRunListenerMock: vi.fn(),
  setHandlerMock: vi.fn(),
  showViewMock: vi.fn(),
}))

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', () => {
  class MockDriver {
    public getDevices = vi.fn().mockReturnValue([])

    public homey = {
      app: {
        classicApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
        getDevicesByType: vi.fn().mockReturnValue([]),
      },
      flow: {
        getActionCard: vi.fn().mockReturnValue({
          registerRunListener: registerRunListenerMock,
        }),
        getConditionCard: vi.fn().mockReturnValue({
          registerRunListener: registerRunListenerMock,
        }),
      },
    }

    public log = vi.fn()

    public manifest = {
      capabilities: ['onoff', 'thermostat_mode', 'measure_temperature'],
    }
  }

  return { default: { Driver: MockDriver } }
})

describe(ClassicMELCloudDriver, () => {
  let driver: TestDriver

  beforeEach(() => {
    vi.clearAllMocks()

    driver = createTestDriver()
  })

  describe('initialization', () => {
    it('should set produced and consumed tag mappings', async () => {
      await driver.onInit()

      expect(driver.consumedTagMapping).toBeDefined()
      expect(driver.producedTagMapping).toBeDefined()
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
      const listHandler = vi.fn()
      const session = mock<PairSession>({
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
      vi.spyOn(driver.homey.app, 'getDevicesByType').mockReturnValue([
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial mock data cannot satisfy the full ClassicDevice<T> generic type
        { data: { Power: true }, id: 1, name: 'Device 1' } as never,
      ])
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
  })

  testRepairing(() => driver, { authenticateMock, setHandlerMock })

  describe('produced and consumed tag mappings', () => {
    it('should separate energy tags into produced and consumed', async () => {
      await driver.onInit()

      expect(driver.consumedTagMapping).toHaveProperty('measure_power')
      expect(driver.producedTagMapping).toHaveProperty('measure_power')
    })

    it('should group tags ending with Produced into produced mapping', async () => {
      const driverWithProduced = createTestDriver()
      Object.defineProperty(driverWithProduced, 'energyCapabilityTagMapping', {
        value: mock<EnergyCapabilityTagMapping<TestDriverType>>({
          measure_power: ['TotalHeatingProduced', 'TotalCoolingConsumed'],
        }),
      })
      await driverWithProduced.onInit()

      expect(driverWithProduced.producedTagMapping.measure_power).toStrictEqual(
        ['TotalHeatingProduced'],
      )
      expect(driverWithProduced.consumedTagMapping.measure_power).toStrictEqual(
        ['TotalCoolingConsumed'],
      )
    })
  })

  describe('action run listener registration', () => {
    it('should invoke triggerCapabilityListener on the device with the correct args', async () => {
      const triggerMock = vi.fn<() => Promise<void>>().mockResolvedValue()
      const actionListeners: Record<
        string,
        (args: Record<string, unknown>) => Promise<void>
      > = {}
      vi.spyOn(driver.homey.flow, 'getActionCard').mockImplementation(
        (cardName: string) =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial mock: only registerRunListener is needed from FlowCardAction
          ({
            registerRunListener: (
              listener: (args: Record<string, unknown>) => Promise<void>,
            ): void => {
              actionListeners[cardName] = listener
            },
          }) as never,
      )
      await driver.onInit()

      const { onoff_action: listener } = actionListeners
      assertDefined(listener)
      await listener({
        device: { triggerCapabilityListener: triggerMock },
        onoff: true,
      })

      expect(triggerMock).toHaveBeenCalledWith('onoff', true)
    })

    it('should silently catch when action card does not exist', async () => {
      vi.spyOn(driver.homey.flow, 'getActionCard').mockImplementation(() => {
        throw new Error('Card not found')
      })

      await expect(driver.onInit()).resolves.toBeUndefined()
    })
  })

  describe('condition run listener registration', () => {
    it('should return boolean capability value for boolean capabilities', async () => {
      const conditionListeners: Record<
        string,
        (args: Record<string, unknown>) => unknown
      > = {}
      vi.spyOn(driver.homey.flow, 'getConditionCard').mockImplementation(
        (cardName: string) =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial mock: only registerRunListener is needed from FlowCardCondition
          ({
            registerRunListener: (
              listener: (args: Record<string, unknown>) => unknown,
            ): void => {
              conditionListeners[cardName] = listener
            },
          }) as never,
      )
      await driver.onInit()

      const { onoff_condition: onoffListener } = conditionListeners
      assertDefined(onoffListener)
      const result = onoffListener({
        device: { getCapabilityValue: vi.fn().mockReturnValue(true) },
        onoff: true,
      })

      expect(result).toBe(true)
    })

    it('should compare string/number capability values with arg', async () => {
      const conditionListeners: Record<
        string,
        (args: Record<string, unknown>) => unknown
      > = {}
      vi.spyOn(driver.homey.flow, 'getConditionCard').mockImplementation(
        (cardName: string) =>
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- partial mock: only registerRunListener is needed from FlowCardCondition
          ({
            registerRunListener: (
              listener: (args: Record<string, unknown>) => unknown,
            ): void => {
              conditionListeners[cardName] = listener
            },
          }) as never,
      )
      await driver.onInit()

      const { thermostat_mode_condition: thermostatListener } =
        conditionListeners
      assertDefined(thermostatListener)

      const resultTrue = thermostatListener({
        device: { getCapabilityValue: vi.fn().mockReturnValue('heat') },
        thermostat_mode: 'heat',
      })

      const resultFalse = thermostatListener({
        device: { getCapabilityValue: vi.fn().mockReturnValue('cool') },
        thermostat_mode: 'heat',
      })

      expect(resultTrue).toBe(true)
      expect(resultFalse).toBe(false)
    })

    it('should silently catch when condition card does not exist', async () => {
      vi.spyOn(driver.homey.flow, 'getConditionCard').mockImplementation(() => {
        throw new Error('Card not found')
      })

      await expect(driver.onInit()).resolves.toBeUndefined()
    })
  })
})
