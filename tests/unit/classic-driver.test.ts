import type * as Classic from '@olivierzal/melcloud-api/classic'
import type HomeyModule from 'homey'
import type FlowCardAction from 'homey/lib/FlowCardAction'
import type FlowCardCondition from 'homey/lib/FlowCardCondition'
import type PairSession from 'homey/lib/PairSession'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EnergyCapabilityTagMapping } from '../../types/capabilities.mts'
import { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import {
  testFlowListenerRegistration,
  testPairing,
  testRepairing,
} from '../driver-descriptors.ts'
import { type InteropModule, assertDefined, mock } from '../helpers.ts'
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
  authenticateMock: vi.fn<(data: unknown) => Promise<boolean>>(),
  isAuthenticatedMock: vi.fn<() => boolean>().mockReturnValue(false),
  registerRunListenerMock:
    vi.fn<(listener: (args: Record<string, unknown>) => unknown) => void>(),
  setHandlerMock:
    vi.fn<(event: string, handler: (...args: unknown[]) => unknown) => void>(),
  showViewMock: vi.fn<(view: string) => Promise<void>>(),
}))

vi.mock(import('homey'), async () => {
  const { mock: mockModule } = await import('../helpers.ts')
  class MockDriver {
    public getDevices = vi.fn<() => readonly unknown[]>().mockReturnValue([])

    public homey = {
      app: {
        classicApi: {
          authenticate: authenticateMock,
          isAuthenticated: isAuthenticatedMock,
        },
        getDevicesByType: vi
          .fn<(type: number) => readonly unknown[]>()
          .mockReturnValue([]),
      },
      flow: {
        getActionCard: vi
          .fn<
            (id: string) => {
              registerRunListener: typeof registerRunListenerMock
            }
          >()
          .mockReturnValue({
            registerRunListener: registerRunListenerMock,
          }),
        getConditionCard: vi
          .fn<
            (id: string) => {
              registerRunListener: typeof registerRunListenerMock
            }
          >()
          .mockReturnValue({
            registerRunListener: registerRunListenerMock,
          }),
      },
    }

    public log = vi.fn<(...args: readonly unknown[]) => void>()

    public manifest = {
      capabilities: [
        'onoff',
        'thermostat_mode',
        'thermostat_mode.zone2',
        'measure_temperature',
      ],
    }
  }

  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Driver: MockDriver },
  })
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
      const listHandler = vi.fn<(...args: unknown[]) => unknown>()
      const session = mock<PairSession>({
        setHandler: vi
          .fn<
            (event: string, handler: (...args: unknown[]) => unknown) => void
          >()
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
        mock<Classic.Device<TestDriverType>>({
          data: { Power: true },
          id: 1,
          name: 'Device 1',
        }),
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
      Object.defineProperty(driverWithProduced, 'tagMappings', {
        value: {
          ...driverWithProduced.tagMappings,
          energy: mock<EnergyCapabilityTagMapping<TestDriverType>>({
            measure_power: ['TotalHeatingProduced', 'TotalCoolingConsumed'],
          }),
        },
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
          mock<FlowCardAction>({
            registerRunListener: (
              listener: (args: Record<string, unknown>) => Promise<void>,
            ): void => {
              actionListeners[cardName] = listener
            },
          }),
      )
      await driver.onInit()

      const { onoff_action: registeredListener } = actionListeners
      assertDefined(registeredListener)
      await registeredListener({
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
          mock<FlowCardCondition>({
            registerRunListener: (
              listener: (args: Record<string, unknown>) => unknown,
            ): void => {
              conditionListeners[cardName] = listener
            },
          }),
      )
      await driver.onInit()

      const { onoff_condition: onoffListener } = conditionListeners
      assertDefined(onoffListener)
      const result = onoffListener({
        device: {
          getCapabilityValue: vi
            .fn<(capability: string) => unknown>()
            .mockReturnValue(true),
        },
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
          mock<FlowCardCondition>({
            registerRunListener: (
              listener: (args: Record<string, unknown>) => unknown,
            ): void => {
              conditionListeners[cardName] = listener
            },
          }),
      )
      await driver.onInit()

      const { thermostat_mode_condition: thermostatListener } =
        conditionListeners
      assertDefined(thermostatListener)

      const resultTrue = thermostatListener({
        device: {
          getCapabilityValue: vi
            .fn<(capability: string) => unknown>()
            .mockReturnValue('heat'),
        },
        thermostat_mode: 'heat',
      })

      const resultFalse = thermostatListener({
        device: {
          getCapabilityValue: vi
            .fn<(capability: string) => unknown>()
            .mockReturnValue('cool'),
        },
        thermostat_mode: 'heat',
      })

      expect(resultTrue).toBe(true)
      expect(resultFalse).toBe(false)

      const zoneListener = conditionListeners['thermostat_mode.zone2_condition']
      assertDefined(zoneListener)

      // The dotted variant's card compares against the base arg name.
      expect(
        zoneListener({
          device: {
            getCapabilityValue: vi
              .fn<(capability: string) => unknown>()
              .mockReturnValue('heat'),
          },
          thermostat_mode: 'heat',
        }),
      ).toBe(true)
    })

    it('should silently catch when condition card does not exist', async () => {
      vi.spyOn(driver.homey.flow, 'getConditionCard').mockImplementation(() => {
        throw new Error('Card not found')
      })

      await expect(driver.onInit()).resolves.toBeUndefined()
    })
  })
})
