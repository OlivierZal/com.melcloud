import {
  type ListDeviceDataAtw,
  DeviceType,
  OperationModeState,
  OperationModeStateHotWater,
  OperationModeStateZone,
  OperationModeZone,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicMELCloudDriver } from '../../drivers/classic-base-driver.mts'
import {
  type EnergyCapabilityTagMapping,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type SetCapabilityTagMapping,
  HotWaterMode,
} from '../../types/index.mts'
import { testEnergyReportConfig, testThermostatMode } from '../device-descriptors.ts'
import { mock } from '../helpers.ts'
import MELCloudDeviceAtw from '../../drivers/melcloud_atw/device.mts'
import { createInstance } from './create-test-instance.ts'

type AtwType = typeof DeviceType.Atw

const K_MULTIPLIER = 1000

const { getCapabilityOptionsMock, hasCapabilityMock, setCapabilityValueMock } =
  vi.hoisted(() => ({
    getCapabilityOptionsMock: vi.fn().mockReturnValue({ min: 10 }),
    hasCapabilityMock: vi.fn().mockReturnValue(true),
    setCapabilityValueMock: vi.fn(),
  }))

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDeviceClass } = await import('../helpers.ts')
  return {
    default: {
      Device: createMockDeviceClass({
        getCapabilityOptions: getCapabilityOptionsMock,
        hasCapability: hasCapabilityMock,
        setCapabilityValue: setCapabilityValueMock,
      }),
    },
  }
})

const mockDriver = mock<ClassicMELCloudDriver<AtwType>>({
  energyCapabilityTagMapping: mock<EnergyCapabilityTagMapping<AtwType>>({}),
  getCapabilitiesOptions: vi.fn().mockReturnValue({}),
  getCapabilityTagMapping: mock<GetCapabilityTagMapping<AtwType>>({}),
  getRequiredCapabilities: vi.fn().mockReturnValue([]),
  listCapabilityTagMapping: mock<ListCapabilityTagMapping<AtwType>>({}),
  manifest: mock({ capabilities: [], id: 'melcloud_atw' }),
  setCapabilityTagMapping: mock<SetCapabilityTagMapping<AtwType>>({}),
})

const mockAtwFacade = (
  target: any,
  overrides: {
    hotWater?: { operationalState: OperationModeStateHotWater }
    zone1?: { operationalState: OperationModeStateZone }
    zone2?: { operationalState: OperationModeStateZone }
  },
): void => {
  Object.defineProperty(target, 'facade', {
    configurable: true,
    value: {
      hotWater: overrides.hotWater ?? {
        operationalState: OperationModeStateHotWater.idle,
      },
      type: DeviceType.Atw,
      zone1: overrides.zone1 ?? {
        operationalState: OperationModeStateZone.idle,
      },
      ...('zone2' in overrides && { zone2: overrides.zone2 }),
    },
  })
}

const callSetCapabilityValues = async (target: any): Promise<void> =>
  (
    target as unknown as {
      setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
    }
  ).setCapabilityValues(mock<ListDeviceDataAtw>({}))

describe(MELCloudDeviceAtw, () => {
  let device: any

  beforeEach(() => {
    vi.clearAllMocks()
    hasCapabilityMock.mockReturnValue(true)
    getCapabilityOptionsMock.mockReturnValue({ min: 10 })

    device = createInstance(MELCloudDeviceAtw)
    Object.defineProperty(device, 'driver', {
      configurable: true,
      value: mockDriver,
    })
  })

  testThermostatMode(() => device as object, null)

  testEnergyReportConfig(() => device as object, 'energyReportRegular', {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'regular',
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  })

  testEnergyReportConfig(() => device as object, 'energyReportTotal', {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  })

  describe('device-to-capability conversions', () => {
    it.each([
      ['alarm_generic.defrost', 1, true],
      ['alarm_generic.defrost', 0, false],
      ['measure_power', 2.5, 2.5 * K_MULTIPLIER],
      ['measure_power.produced', 1.5, 1.5 * K_MULTIPLIER],
      ['thermostat_mode', OperationModeZone.room, 'room'],
      ['thermostat_mode.zone2', OperationModeZone.flow, 'flow'],
      ['hot_water_mode', true, HotWaterMode.forced],
      ['hot_water_mode', false, HotWaterMode.auto],
      ['operational_state', OperationModeState.heating, 'heating'],
      ['target_temperature.flow_heat', 0, 10],
      ['target_temperature.flow_heat', 35, 35],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const {
        deviceToCapability: { [key]: converter },
      } = device

      expect(converter?.(input)).toBe(expected)
    })

    it('should convert legionella from ISO date to locale string', () => {
      const {
        deviceToCapability: { legionella: converter },
      } = device

      const result = converter?.('2026-03-18T10:00:00')

      expect(result).toBeDefined()
      expect(result).toBeTypeOf('string')
    })
  })

  describe('capability-to-device conversions', () => {
    it.each([
      ['hot_water_mode', 'forced', true],
      ['hot_water_mode', 'auto', false],
      ['thermostat_mode', 'room', OperationModeZone.room],
      ['thermostat_mode.zone2', 'flow', OperationModeZone.flow],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const {
        capabilityToDevice: { [key]: converter },
      } = device

      expect(converter?.(input)).toBe(expected)
    })
  })

  describe('operation mode state mapping', () => {
    it.each([
      ['hot_water', 'hotWater', OperationModeStateHotWater.dhw],
      ['hot_water', 'hotWater', OperationModeStateHotWater.prohibited],
      ['zone1', 'zone1', OperationModeStateZone.prohibited],
      ['zone1', 'zone1', OperationModeStateZone.idle],
      ['zone2', 'zone2', OperationModeStateZone.heating],
    ] as const)(
      'should set operational_state.%s from facade %s state %s',
      async (capability, zone, state) => {
        mockAtwFacade(device, { [zone]: { operationalState: state } })
        await callSetCapabilityValues(device)

        expect(setCapabilityValueMock).toHaveBeenCalledWith(
          `operational_state.${capability}`,
          state,
        )
      },
    )

    it('should skip zone2 operation state when capability is not present', async () => {
      hasCapabilityMock.mockImplementation(
        (cap: string) => cap !== 'operational_state.zone2',
      )
      mockAtwFacade(device, {
        zone2: { operationalState: OperationModeStateZone.idle },
      })
      await callSetCapabilityValues(device)

      const zone2Calls = setCapabilityValueMock.mock.calls.filter(
        (call: unknown[]) => call[0] === 'operational_state.zone2',
      )

      expect(zone2Calls).toHaveLength(0)
    })

    it('should skip operation mode states when facade is unavailable', async () => {
      Object.defineProperty(device, 'facade', {
        configurable: true,
        value: undefined,
      })
      await callSetCapabilityValues(device)

      const opStateCalls = setCapabilityValueMock.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].startsWith('operational_state.'),
      )

      expect(opStateCalls).toHaveLength(0)
    })
  })
})
