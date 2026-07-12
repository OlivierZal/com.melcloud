import type * as Home from '@olivierzal/melcloud-api/home'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../lib/errors.mts'
import { homeSetCapabilityTagMappingAtw } from '../../types/home-atw.mts'
import {
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import HomeMELCloudDeviceAtw from '../../drivers/home-melcloud_atw/device.mts'
import { createInstance } from './create-test-instance.ts'

const requiredCapabilities = vi.hoisted(() => [
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

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDeviceClass } = await import('../helpers.ts')
  const { homeSetCapabilityTagMappingAtw: setCapabilityTagMapping } =
    await import('../../types/home-atw.mts')
  return {
    default: {
      Device: createMockDeviceClass({
        overrides: {
          driver: {
            energyCapabilityTagMapping: {},
            getCapabilityTagMapping: {},
            listCapabilityTagMapping: {},
            manifest: { capabilities: requiredCapabilities },
            setCapabilityTagMapping,
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
  }
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
    hasCoolingMode: true,
    hotWaterOperationalState: 'dhw',
    isOwner: true,
    operationMode: 'HotWater',
    operationModeZone1: 'HeatRoomTemperature',
    operationModeZone2: 'HeatCurve',
    power: true,
    roomTemperatureZone1: 21,
    roomTemperatureZone2: 19,
    rssi: -42,
    setTankWaterTemperature: 50,
    setTemperatureZone1: 22,
    setTemperatureZone2: 20,
    tankWaterTemperature: 48,
    updateValues: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
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
      expect(deviceToCapability['thermostat_mode.zone2']?.(facade)).toBe('room')
    })

    it.each([
      ['CoolFlowTemperature', 'flow_cool'],
      ['CoolRoomTemperature', 'room_cool'],
      ['CoolThermostat', 'room_cool'],
      ['HeatCurve', 'curve'],
      ['HeatFlowTemperature', 'flow'],
      ['HeatRoomTemperature', 'room'],
      ['HeatThermostat', 'room'],
    ])('should convert zone mode %s to %s', (mode, expected) => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device

      expect(converter?.(mockFacade({ operationModeZone1: mode }))).toBe(
        expected,
      )
    })

    it('should fall back to room for a firmware-specific zone mode', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device

      expect(
        converter?.(mockFacade({ operationModeZone1: 'SomeNewFtcMode' })),
      ).toBe('room')
    })

    it.each([
      ['Cooling', 'cooling'],
      ['Defrost', 'defrost'],
      ['Heating', 'heating'],
      ['HotWater', 'dhw'],
      ['Idle', 'idle'],
      ['Legionella', 'legionella'],
      ['Stop', 'idle'],
    ])('should convert operation mode %s to %s', (mode, expected) => {
      const {
        deviceToCapability: { operational_state: converter },
      } = device

      expect(converter?.(mockFacade({ operationMode: mode }))).toBe(expected)
    })

    it('should pass the derived hot-water state through', () => {
      const {
        deviceToCapability: { 'operational_state.hot_water': converter },
      } = device

      expect(
        converter?.(mockFacade({ hotWaterOperationalState: 'prohibited' })),
      ).toBe('prohibited')
    })

    it('should clear and log an unmapped FTC operation mode', () => {
      const {
        deviceToCapability: { operational_state: converter },
      } = device

      expect(
        converter?.(mockFacade({ operationMode: 'SomeNewFtcMode' })),
      ).toBeNull()
      expect(device.log).toHaveBeenCalledWith(
        'Unmapped FTC operation mode:',
        'SomeNewFtcMode',
      )
    })

    it('should clear a blank FTC operation mode without logging', () => {
      const {
        deviceToCapability: { operational_state: converter },
      } = device

      expect(converter?.(mockFacade({ operationMode: '' }))).toBeNull()
      expect(device.log).not.toHaveBeenCalledWith(
        'Unmapped FTC operation mode:',
        '',
      )
    })
  })

  describe('capability-to-device conversions', () => {
    it.each([
      ['room', 'HeatRoomTemperature'],
      ['flow', 'HeatFlowTemperature'],
      ['curve', 'HeatCurve'],
      ['room_cool', 'CoolRoomTemperature'],
      ['flow_cool', 'CoolFlowTemperature'],
    ])('should convert zone mode %s to %s', (mode, expected) => {
      const { capabilityToDevice } = device

      expect(capabilityToDevice.thermostat_mode?.(mode)).toBe(expected)
      expect(capabilityToDevice['thermostat_mode.zone2']?.(mode)).toBe(expected)
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
        operationModeZone1: 'HeatCurve',
        setTankWaterTemperature: 55,
      })
    })

    it('should register the listener for every settable capability', async () => {
      await device.onInit()

      expect(device.registerMultipleCapabilityListener).toHaveBeenCalledWith(
        Object.keys(homeSetCapabilityTagMappingAtw),
        expect.any(Function),
        expect.any(Number),
      )
    })
  })
})
