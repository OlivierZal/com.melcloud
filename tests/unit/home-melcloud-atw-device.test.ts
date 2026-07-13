import type * as Home from '@olivierzal/melcloud-api/home'
import type HomeyModule from 'homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InteropModule } from '../helpers.ts'
import { NotFoundError } from '../../lib/errors.mts'
import { homeTagMappingsAtw } from '../../types/home-atw.mts'
import {
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import HomeMELCloudDeviceAtw from '../../drivers/home-melcloud_atw/device.mts'
import { createInstance } from './create-test-instance.ts'

const requiredCapabilities = vi.hoisted(() => [
  'hot_water_mode',
  'measure_temperature',
  'measure_temperature.tank_water',
  'measure_temperature.zone2',
  'onoff',
  'operational_state',
  'operational_state.hot_water',
  'target_temperature',
  'target_temperature.tank_water',
  'target_temperature.zone2',
  'thermostat_mode',
  'thermostat_mode.zone2',
])

const {
  getHomeFacadeMock,
  hasCapabilityMock,
  setCapabilityValueMock,
  superSetWarningMock,
} = vi.hoisted(() => ({
  getHomeFacadeMock: vi.fn<(id: string, type: Home.DeviceType) => unknown>(),
  hasCapabilityMock: vi
    .fn<(capability: string) => boolean>()
    .mockReturnValue(true),
  setCapabilityValueMock:
    vi.fn<(capability: string, value: unknown) => Promise<void>>(),
  superSetWarningMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
}))

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass, mock: mockModule } =
    await import('../helpers.ts')
  const { homeTagMappingsAtw: tagMappings } =
    await import('../../types/home-atw.mts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: {
      Device: createMockDeviceClass({
        overrides: {
          driver: {
            manifest: { capabilities: requiredCapabilities },
            tagMappings,
            type: 'airToWater',
            getCapabilitiesOptions: (): Record<string, unknown> => ({}),
            getRequiredCapabilities: (): string[] => requiredCapabilities,
          },
          getData: vi
            .fn<() => { id: string }>()
            .mockReturnValue({ id: 'atw-1' }),
          hasCapability: hasCapabilityMock,
          homey: {
            api: { realtime: vi.fn<(event: string, data: unknown) => void>() },
            app: { getHomeFacade: getHomeFacadeMock },
            clearTimeout: vi.fn<(timer: NodeJS.Timeout | null) => void>(),
            setTimeout:
              vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
          },
          setCapabilityValue: setCapabilityValueMock,
        },
        superMocks: { setWarning: superSetWarningMock },
      }),
    },
  })
})

const mockFacade = (
  overrides: Partial<Record<keyof Home.DeviceAtwFacade, unknown>> = {},
): Home.DeviceAtwFacade =>
  ({
    capabilities: {
      hasHotWater: true,
      hasZone2: true,
      maxSetTankTemperature: 60,
      maxSetTemperature: 30,
      minSetTankTemperature: 40,
      minSetTemperature: 10,
    },
    forcedHotWaterMode: false,
    hasCoolingMode: true,
    hotWaterOperationalState: 'dhw',
    isOwner: true,
    operationalState: 'dhw',
    operationModeZone1: 'room',
    operationModeZone2: 'curve',
    power: true,
    roomTemperatureZone1: 21,
    roomTemperatureZone2: 19,
    rssi: -42,
    setTankWaterTemperature: 50,
    setTemperatureZone1: 22,
    setTemperatureZone2: 20,
    tankWaterTemperature: 48,
    updateValues: vi.fn<() => Promise<void>>().mockResolvedValue(),
    ...overrides,
  }) as unknown as Home.DeviceAtwFacade

describe(HomeMELCloudDeviceAtw, () => {
  let device: any

  beforeEach(() => {
    vi.clearAllMocks()
    hasCapabilityMock.mockReturnValue(true)
    getHomeFacadeMock.mockReturnValue(mockFacade())
    device = createInstance(HomeMELCloudDeviceAtw)
  })

  describe('device identifier', () => {
    it('should return the device id from getData', () => {
      expect(device.id).toBe('atw-1')
    })
  })

  testThermostatMode(() => device as object, null)

  testEnergyReportConfig(() => device as object, 'energyReportRegular', null)

  testEnergyReportConfig(() => device as object, 'energyReportTotal', null)

  describe('device synchronization', () => {
    it('should set every capability value from the facade', async () => {
      await device.syncFromDevice()

      expect(getHomeFacadeMock).toHaveBeenCalledWith('atw-1', 'airToWater')
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_temperature',
        21,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_temperature.tank_water',
        48,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_temperature.zone2',
        19,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'measure_signal_strength',
        -42,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith('onoff', true)
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'hot_water_mode',
        'auto',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state',
        'dhw',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.hot_water',
        'dhw',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'target_temperature',
        22,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'target_temperature.tank_water',
        50,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'target_temperature.zone2',
        20,
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'thermostat_mode',
        'room',
      )
      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'thermostat_mode.zone2',
        'curve',
      )
    })

    it('should warn without setting values when the facade is unavailable', async () => {
      getHomeFacadeMock.mockImplementation(() => {
        throw new NotFoundError('Device not found')
      })
      await device.syncFromDevice()

      expect(setCapabilityValueMock).not.toHaveBeenCalled()
      expect(superSetWarningMock).toHaveBeenCalledWith('Device not found')
    })

    it('should skip capabilities the device does not have', async () => {
      hasCapabilityMock.mockReturnValue(false)
      await device.syncFromDevice()

      expect(setCapabilityValueMock).not.toHaveBeenCalled()
    })
  })

  describe('device-to-capability conversions', () => {
    it('should clear the zone2 values on a single-zone unit', () => {
      const { deviceToCapability } = device
      const facade = mockFacade({
        operationModeZone2: null,
        roomTemperatureZone2: null,
        setTemperatureZone2: null,
      })

      expect(
        deviceToCapability['measure_temperature.zone2']?.(facade),
      ).toBeNull()
      expect(
        deviceToCapability['target_temperature.zone2']?.(facade),
      ).toBeNull()
      expect(deviceToCapability['thermostat_mode.zone2']?.(facade)).toBeNull()
    })

    it('should report forced hot water as the forced mode', () => {
      const {
        deviceToCapability: { hot_water_mode: converter },
      } = device

      expect(converter?.(mockFacade({ forcedHotWaterMode: true }))).toBe(
        'forced',
      )
    })

    it('should pass the derived hot-water state through', () => {
      const {
        deviceToCapability: { 'operational_state.hot_water': converter },
      } = device

      expect(
        converter?.(mockFacade({ hotWaterOperationalState: 'prohibited' })),
      ).toBe('prohibited')
    })
  })

  describe('capability-to-device conversions', () => {
    it.each([
      ['forced', true],
      ['auto', false],
    ])('should convert hot_water_mode %s to %s', (mode, isForced) => {
      const {
        capabilityToDevice: { hot_water_mode: converter },
      } = device

      expect(converter?.(mode)).toBe(isForced)
    })
  })

  describe('capability change handling', () => {
    it('should map capability writes to Home ATW values', async () => {
      const facade = mockFacade()
      getHomeFacadeMock.mockReturnValue(facade)
      await device.onInit()
      const [[, callback]] =
        device.registerMultipleCapabilityListener.mock.calls
      await callback({
        'target_temperature.tank_water': 55,
        thermostat_mode: 'curve',
      })

      expect(facade.updateValues).toHaveBeenCalledWith({
        operationModeZone1: 'curve',
        setTankWaterTemperature: 55,
      })
    })

    it('should register the listener for every settable capability', async () => {
      await device.onInit()

      expect(device.registerMultipleCapabilityListener).toHaveBeenCalledWith(
        Object.keys(homeTagMappingsAtw.set),
        expect.any(Function),
        expect.any(Number),
      )
    })
  })
})
