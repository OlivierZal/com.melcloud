import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/capabilities.mts'
import { HotWaterMode } from '../../types/classic-atw.mts'
import {
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import { mock } from '../helpers.ts'
import ClassicMELCloudDeviceAtw from '../../drivers/melcloud_atw/device.mts'
import { createInstance } from './create-test-instance.ts'

type AtwType = typeof Classic.DeviceType.Atw

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
        overrides: {
          getCapabilityOptions: getCapabilityOptionsMock,
          hasCapability: hasCapabilityMock,
          setCapabilityValue: setCapabilityValueMock,
        },
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
    hotWater?: { operationalState: Classic.OperationModeStateHotWater }
    zone1?: { operationalState: Classic.OperationModeStateZone }
    zone2?: { operationalState: Classic.OperationModeStateZone }
  },
): void => {
  Object.defineProperty(target, 'facade', {
    configurable: true,
    value: {
      hotWater: overrides.hotWater ?? {
        operationalState: Classic.OperationModeStateHotWater.idle,
      },
      type: Classic.DeviceType.Atw,
      zone1: overrides.zone1 ?? {
        operationalState: Classic.OperationModeStateZone.idle,
      },
      ...('zone2' in overrides && { zone2: overrides.zone2 }),
    },
  })
}

const callSetCapabilityValues = async (target: any): Promise<void> =>
  (
    target as unknown as {
      setCapabilityValues: (data: Classic.ListDeviceDataAtw) => Promise<void>
    }
  ).setCapabilityValues(mock<Classic.ListDeviceDataAtw>({}))

describe(ClassicMELCloudDeviceAtw, () => {
  let device: any

  beforeEach(() => {
    vi.clearAllMocks()
    hasCapabilityMock.mockReturnValue(true)
    getCapabilityOptionsMock.mockReturnValue({ min: 10 })

    device = createInstance(ClassicMELCloudDeviceAtw)
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
      ['thermostat_mode', Classic.OperationModeZone.room, 'room'],
      ['thermostat_mode.zone2', Classic.OperationModeZone.flow, 'flow'],
      ['hot_water_mode', true, HotWaterMode.forced],
      ['hot_water_mode', false, HotWaterMode.auto],
      ['operational_state', Classic.OperationModeState.heating, 'heating'],
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
      ['thermostat_mode', 'room', Classic.OperationModeZone.room],
      ['thermostat_mode.zone2', 'flow', Classic.OperationModeZone.flow],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const {
        capabilityToDevice: { [key]: converter },
      } = device

      expect(converter?.(input)).toBe(expected)
    })
  })

  describe('operation mode state mapping', () => {
    it.each([
      ['hot_water', 'hotWater', Classic.OperationModeStateHotWater.dhw],
      ['hot_water', 'hotWater', Classic.OperationModeStateHotWater.prohibited],
      ['zone1', 'zone1', Classic.OperationModeStateZone.prohibited],
      ['zone1', 'zone1', Classic.OperationModeStateZone.idle],
      ['zone2', 'zone2', Classic.OperationModeStateZone.heating],
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
        zone2: { operationalState: Classic.OperationModeStateZone.idle },
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
