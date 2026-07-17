import type HomeyModule from 'homey'
import type PairSession from 'homey/lib/PairSession'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Home from '@olivierzal/melcloud-api/home'

import {
  type HomeAtwDeviceProfile,
  homeTagMappingsAtw,
} from '../../types/home-atw.mts'
import {
  testDriverType,
  testPairing,
  testTagMappings,
} from '../driver-descriptors.ts'
import { type InteropModule, mock } from '../helpers.ts'
import HomeMELCloudDriverAtw from '../../drivers/home-melcloud_atw/driver.mts'
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
  const { createMockDriverClass, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: {
      Driver: createMockDriverClass({
        homey: {
          app: {
            getHomeDevicesByType: getHomeDevicesByTypeMock,
            getHomeFacade: getHomeFacadeMock,
            homeApi: {
              authenticate: authenticateMock,
              isAuthenticated: isAuthenticatedMock,
            },
          },
        },
      }),
    },
  })
})

const createProfile = ({
  hasCoolingMode = false,
  hasEstimatedEnergyConsumption = false,
  hasEstimatedEnergyProduction = false,
  hasHotWater = true,
  hasMeasuredEnergyConsumption = false,
  hasMeasuredEnergyProduction = false,
  hasZone2 = false,
} = {}): HomeAtwDeviceProfile => ({
  capabilities: mock<Home.AtwDeviceCapabilities>({
    hasEstimatedEnergyConsumption,
    hasEstimatedEnergyProduction,
    hasHotWater,
    hasMeasuredEnergyConsumption,
    hasMeasuredEnergyProduction,
    hasZone2,
  }),
  hasCoolingMode,
})

const registerListHandler = async (driver: {
  onPair: (session: PairSession) => Promise<void>
}): Promise<(...args: unknown[]) => unknown> => {
  const listHandler = vi.fn<(...args: unknown[]) => unknown>()
  const session = mock<PairSession>({
    setHandler: vi
      .fn<(event: string, handler: (...args: unknown[]) => unknown) => void>()
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
  return listHandler
}

describe(HomeMELCloudDriverAtw, () => {
  let driver: HomeMELCloudDriverAtw

  beforeEach(() => {
    vi.clearAllMocks()
    driver = createInstance(HomeMELCloudDriverAtw)
  })

  testDriverType(() => driver, Home.DeviceType.Atw)

  testTagMappings(() => driver, homeTagMappingsAtw)

  describe('required capabilities', () => {
    it('should return every capability for a full-featured owned device', () => {
      const capabilities = driver.getRequiredCapabilities(
        createProfile({
          hasEstimatedEnergyConsumption: true,
          hasEstimatedEnergyProduction: true,
          hasZone2: true,
        }),
      )

      expect(capabilities).toStrictEqual([
        'measure_temperature',
        'operational_state',
        'operational_state.zone1',
        'measure_power',
        'measure_power.produced',
        'onoff',
        'thermostat_mode',
        'target_temperature',
        'measure_temperature.tank_water',
        'operational_state.hot_water',
        'hot_water_mode',
        'target_temperature.tank_water',
        'measure_temperature.zone2',
        'operational_state.zone2',
        'thermostat_mode.zone2',
        'target_temperature.zone2',
      ])
    })

    it('should exclude the tank capabilities without hot water', () => {
      const capabilities = driver.getRequiredCapabilities(
        createProfile({ hasHotWater: false }),
      )

      expect(capabilities).toStrictEqual([
        'measure_temperature',
        'operational_state',
        'operational_state.zone1',
        'onoff',
        'thermostat_mode',
        'target_temperature',
      ])
    })

    it('should default to the measures and zone1 controls when no profile is given', () => {
      expect(driver.getRequiredCapabilities()).toStrictEqual([
        'measure_temperature',
        'operational_state',
        'operational_state.zone1',
        'onoff',
        'thermostat_mode',
        'target_temperature',
      ])
    })

    it('should never include measure_signal_strength', () => {
      expect(
        driver.getRequiredCapabilities(createProfile({ hasZone2: true })),
      ).not.toContain('measure_signal_strength')
    })

    it('should require consumed power alone from a consumption source', () => {
      const capabilities = driver.getRequiredCapabilities(
        createProfile({ hasMeasuredEnergyConsumption: true }),
      )

      expect(capabilities).toContain('measure_power')
      expect(capabilities).not.toContain('measure_power.produced')
    })

    it('should require produced power alone from a production source', () => {
      const capabilities = driver.getRequiredCapabilities(
        createProfile({ hasEstimatedEnergyProduction: true }),
      )

      expect(capabilities).toContain('measure_power.produced')
      expect(capabilities).not.toContain('measure_power')
    })

    it('should require no power without any energy source', () => {
      const capabilities = driver.getRequiredCapabilities(createProfile())

      expect(capabilities).not.toContain('measure_power')
      expect(capabilities).not.toContain('measure_power.produced')
    })
  })

  testPairing(() => driver, {
    authenticateMock,
    isAuthenticatedMock,
    setHandlerMock,
    showViewMock,
  })

  describe('device discovery', () => {
    it('should build device details from the facade', async () => {
      getHomeDevicesByTypeMock.mockReturnValue([
        mock<Home.Device>({ id: 'atw-1', name: 'Heat Pump' }),
      ])
      getHomeFacadeMock.mockReturnValue(
        createProfile({ hasCoolingMode: true, hasZone2: true }),
      )
      const listHandler = await registerListHandler(driver)

      const [details] = (await listHandler()) as [
        {
          capabilities: string[]
          capabilitiesOptions: Record<string, unknown>
          data: { id: string }
          name: string
        },
      ]

      expect(getHomeFacadeMock).toHaveBeenCalledWith(
        'atw-1',
        Home.DeviceType.Atw,
      )
      expect(details.data).toStrictEqual({ id: 'atw-1' })
      expect(details.name).toBe('Heat Pump')
      expect(details.capabilities).toContain('target_temperature.tank_water')
      expect(details.capabilities).toContain('thermostat_mode.zone2')
      expect(Object.keys(details.capabilitiesOptions)).toStrictEqual([
        'thermostat_mode',
        'thermostat_mode.zone2',
      ])
    })

    it('should return empty array when no ATW device is registered', async () => {
      getHomeDevicesByTypeMock.mockReturnValue([])
      const listHandler = await registerListHandler(driver)

      await expect(listHandler()).resolves.toStrictEqual([])
    })
  })
})
