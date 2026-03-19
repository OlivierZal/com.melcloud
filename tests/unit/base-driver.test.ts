/* eslint-disable
    @typescript-eslint/consistent-type-assertions,
    @typescript-eslint/consistent-type-imports,
    @typescript-eslint/naming-convention,
    @typescript-eslint/no-unsafe-assignment,
    @typescript-eslint/no-unsafe-type-assertion,
    @typescript-eslint/unbound-method,
    max-classes-per-file,
    no-void,
    vitest/prefer-called-with,
*/
import type { DeviceType, ListDeviceDataAta } from '@olivierzal/melcloud-api'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/index.mts'

import { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import { mock } from '../helpers.ts'

type TestDriverType = typeof DeviceType.Ata

const registerRunListenerMock = vi.fn()
const authenticateMock = vi.fn()
const showViewMock = vi.fn()
const setHandlerMock = vi.fn()

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('homey', () => {
  class MockDriver {
    public getDevices = vi.fn().mockReturnValue([])

    public homey = {
      app: {
        api: {
          authenticate: authenticateMock,
          registry: {
            getDevicesByType: vi.fn().mockReturnValue([]),
          },
        },
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

    public manifest = { capabilities: ['onoff', 'thermostat_mode'] }
  }

  return { default: { Driver: MockDriver } }
})

class TestDriver extends BaseMELCloudDriver<TestDriverType> {
  public readonly energyCapabilityTagMapping = mock<
    EnergyCapabilityTagMapping<TestDriverType>
  >({
    measure_power: ['Auto', 'Cooling'],
  })

  public readonly getCapabilitiesOptions = vi.fn().mockReturnValue({})

  public readonly getCapabilityTagMapping = mock<
    GetCapabilityTagMapping<TestDriverType>
  >({
    measure_temperature: 'RoomTemperature',
  })

  public readonly listCapabilityTagMapping = mock<
    ListCapabilityTagMapping<TestDriverType>
  >({})

  public readonly setCapabilityTagMapping = mock<
    SetCapabilityTagMapping<TestDriverType>
  >({
    onoff: 'Power',
    thermostat_mode: 'OperationMode',
  })

  public readonly type: TestDriverType = 0

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getRequiredCapabilities(_context: ListDeviceDataAta): string[] {
    return ['onoff', 'measure_temperature']
  }
}

describe(BaseMELCloudDriver, () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let driver: TestDriver

  beforeEach(() => {
    vi.clearAllMocks()

    driver = new (TestDriver as unknown as new () => TestDriver)()
  })

  describe('onInit', () => {
    it('should set produced and consumed tag mappings', async () => {
      await driver.onInit()

      expect(driver.consumedTagMapping).toBeDefined()
      expect(driver.producedTagMapping).toBeDefined()
    })

    it('should register run listeners for flow cards', async () => {
      await driver.onInit()

      expect(registerRunListenerMock).toHaveBeenCalled()
    })

    it('should register condition listeners for all capabilities', async () => {
      await driver.onInit()

      expect(driver.homey.flow.getConditionCard).toHaveBeenCalled()
    })

    it('should register action listeners for set capabilities', async () => {
      await driver.onInit()

      expect(driver.homey.flow.getActionCard).toHaveBeenCalled()
    })
  })

  describe('onPair', () => {
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

    it('should show list_devices when login succeeds on loading view', async () => {
      authenticateMock.mockResolvedValue(true)
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'showView') {
                void handler('loading')
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      expect(showViewMock).toHaveBeenCalledWith('list_devices')
    })

    it('should show login when login fails on loading view', async () => {
      authenticateMock.mockResolvedValue(false)
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'showView') {
                void handler('loading')
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      expect(showViewMock).toHaveBeenCalledWith('login')
    })

    it('should do nothing when showView is called with a non-loading view', async () => {
      showViewMock.mockClear()
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: vi
          .fn()
          .mockImplementation(
            (event: string, handler: (...args: unknown[]) => unknown) => {
              if (event === 'showView') {
                void handler('other_view')
              }
            },
          ),
        showView: showViewMock,
      })
      await driver.onPair(session)

      expect(showViewMock).not.toHaveBeenCalled()
    })

    it('should invoke login via the login handler', async () => {
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
      vi.spyOn(
        driver.homey.app.api.registry,
        'getDevicesByType',
      ).mockReturnValue([
        { data: { Power: true }, id: 1, name: 'Device 1' } as never,
      ])
      await driver.onPair(session)
      const devices = await listHandler()

      expect(devices).toStrictEqual([
        {
          capabilities: ['onoff', 'measure_temperature'],
          capabilitiesOptions: {},
          data: { id: 1 },
          name: 'Device 1',
        },
      ])
    })
  })

  describe('onRepair', () => {
    it('should set login handler on the session', async () => {
      const session = mock<import('homey/lib/PairSession')>({
        setHandler: setHandlerMock,
      })
      await driver.onRepair(session)

      expect(setHandlerMock).toHaveBeenCalledWith('login', expect.any(Function))
    })
  })

  describe('produced and consumed tag mappings', () => {
    it('should separate energy tags into produced and consumed', async () => {
      await driver.onInit()

      expect(driver.consumedTagMapping).toHaveProperty('measure_power')
      expect(driver.producedTagMapping).toHaveProperty('measure_power')
    })

    it('should group tags ending with Produced into produced mapping', async () => {
      const driverWithProduced = new (class extends TestDriver {
        public override readonly energyCapabilityTagMapping = {
          measure_power: ['TotalHeatingProduced', 'TotalCoolingConsumed'],
        } as unknown as EnergyCapabilityTagMapping<TestDriverType>
      })()
      await driverWithProduced.onInit()

      expect(driverWithProduced.producedTagMapping.measure_power).toStrictEqual(
        ['TotalHeatingProduced'],
      )
      expect(driverWithProduced.consumedTagMapping.measure_power).toStrictEqual(
        ['TotalCoolingConsumed'],
      )
    })
  })

  describe('#registerActionRunListener', () => {
    it('should invoke triggerCapabilityListener on the device with the correct args', async () => {
      const triggerMock = vi.fn<() => Promise<void>>().mockResolvedValue()
      const actionListeners: Record<
        string,
        (args: Record<string, unknown>) => Promise<void>
      > = {}
      // eslint-disable-next-line vitest/prefer-spy-on
      driver.homey.flow.getActionCard = vi
        .fn()
        .mockImplementation((cardName: string) => ({
          registerRunListener: (
            listener: (args: Record<string, unknown>) => Promise<void>,
          ): void => {
            actionListeners[cardName] = listener
          },
        }))
      await driver.onInit()

      await actionListeners['onoff_action']!({
        device: { triggerCapabilityListener: triggerMock },
        onoff: true,
      })

      expect(triggerMock).toHaveBeenCalledWith('onoff', true)
    })

    it('should silently catch when action card does not exist', async () => {
      // eslint-disable-next-line vitest/prefer-spy-on
      driver.homey.flow.getActionCard = vi.fn().mockImplementation(() => {
        throw new Error('Card not found')
      })

      await expect(driver.onInit()).resolves.toBeUndefined()
    })
  })

  describe('#registerConditionRunListener', () => {
    it('should return boolean capability value for boolean capabilities', async () => {
      const conditionListeners: Record<
        string,
        (args: Record<string, unknown>) => unknown
      > = {}
      // eslint-disable-next-line vitest/prefer-spy-on
      driver.homey.flow.getConditionCard = vi
        .fn()
        .mockImplementation((cardName: string) => ({
          registerRunListener: (
            listener: (args: Record<string, unknown>) => unknown,
          ): void => {
            conditionListeners[cardName] = listener
          },
        }))
      await driver.onInit()

      const result = conditionListeners['onoff_condition']!({
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
      // eslint-disable-next-line vitest/prefer-spy-on
      driver.homey.flow.getConditionCard = vi
        .fn()
        .mockImplementation((cardName: string) => ({
          registerRunListener: (
            listener: (args: Record<string, unknown>) => unknown,
          ): void => {
            conditionListeners[cardName] = listener
          },
        }))
      await driver.onInit()

      const resultTrue = conditionListeners['thermostat_mode_condition']!({
        device: { getCapabilityValue: vi.fn().mockReturnValue('heat') },
        thermostat_mode: 'heat',
      })

      const resultFalse = conditionListeners['thermostat_mode_condition']!({
        device: { getCapabilityValue: vi.fn().mockReturnValue('cool') },
        thermostat_mode: 'heat',
      })

      expect(resultTrue).toBe(true)
      expect(resultFalse).toBe(false)
    })

    it('should silently catch when condition card does not exist', async () => {
      // eslint-disable-next-line vitest/prefer-spy-on
      driver.homey.flow.getConditionCard = vi.fn().mockImplementation(() => {
        throw new Error('Card not found')
      })

      await expect(driver.onInit()).resolves.toBeUndefined()
    })
  })
})
