import type HomeyModule from 'homey'
import { Temporal } from 'temporal-polyfill'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/classic-capabilities.mts'
import { HotWaterMode } from '../../types/atw.mts'
import {
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import { type InteropModule, mock } from '../helpers.ts'
import ClassicMELCloudDeviceAtw from '../../drivers/melcloud_atw/device.mts'
import { createInstance } from './create-test-instance.ts'

type AtwType = typeof Classic.DeviceType.Atw

const K_MULTIPLIER = 1000

const { getCapabilityOptionsMock, hasCapabilityMock, setCapabilityValueMock } =
  vi.hoisted(() => ({
    getCapabilityOptionsMock: vi
      .fn<(capability: string) => Record<string, unknown>>()
      .mockReturnValue({ min: 10 }),
    hasCapabilityMock: vi
      .fn<(capability: string) => boolean>()
      .mockReturnValue(true),
    setCapabilityValueMock:
      vi.fn<(capability: string, value: unknown) => Promise<void>>(),
  }))

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: {
      Device: createMockDeviceClass({
        overrides: {
          getCapabilityOptions: getCapabilityOptionsMock,
          hasCapability: hasCapabilityMock,
          setCapabilityValue: setCapabilityValueMock,
        },
      }),
    },
  })
})

const mockDriver = mock<ClassicMELCloudDriver<AtwType>>({
  getCapabilitiesOptions: vi
    .fn<(data?: unknown) => Record<string, unknown>>()
    .mockReturnValue({}),
  getRequiredCapabilities: vi.fn<() => string[]>().mockReturnValue([]),
  manifest: mock({ capabilities: [], id: 'melcloud_atw' }),
  tagMappings: {
    energy: mock<EnergyCapabilityTagMapping<AtwType>>({}),
    get: mock<GetCapabilityTagMapping<AtwType>>({}),
    list: mock<ListCapabilityTagMapping<AtwType>>({}),
    set: mock<SetCapabilityTagMapping<AtwType>>({}),
  },
})

const mockAtwFacade = (
  target: any,
  overrides: {
    hotWater?: {
      operationalState: Classic.OperationModeStateHotWater
      lastLegionellaActivationEpochMs?: number | null
    }
    operationalState?: string | null
    zone1?: { operationalState: Classic.OperationModeStateZone }
    zone2?: { operationalState: Classic.OperationModeStateZone }
  },
): void => {
  Object.defineProperty(target, 'facade', {
    configurable: true,
    value: {
      hotWater: {
        lastLegionellaActivationEpochMs: null,
        operationalState: Classic.OperationModeStateHotWater.idle,
        ...overrides.hotWater,
      },
      // The 55.2.0 contract: the library derives the top-level state,
      // `null` on out-of-vocabulary wire numbers.
      operationalState: overrides.operationalState ?? null,
      type: Classic.DeviceType.Atw,
      zone1: overrides.zone1 ?? {
        operationalState: Classic.OperationModeStateZone.idle,
      },
      // The 51.0.0 contract: zone2 is a nullable read, never absent.
      zone2: overrides.zone2 ?? null,
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
    minus: { days: 1 },
    mode: 'regular',
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  })

  testEnergyReportConfig(() => device as object, 'energyReportTotal', {
    duration: { days: 1 },
    minus: { days: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  })

  describe('device-to-capability conversions', () => {
    it.each([
      ['alarm_generic.defrost', { DefrostMode: 1 }, true],
      ['alarm_generic.defrost', { DefrostMode: 0 }, false],
      ['measure_power', { CurrentEnergyConsumed: 2.5 }, 2.5 * K_MULTIPLIER],
      [
        'measure_power.produced',
        { CurrentEnergyProduced: 1.5 },
        1.5 * K_MULTIPLIER,
      ],
      [
        'thermostat_mode',
        { OperationModeZone1: Classic.OperationModeZone.room },
        'room',
      ],
      [
        'thermostat_mode.zone2',
        { OperationModeZone2: Classic.OperationModeZone.flow },
        'flow',
      ],
      ['hot_water_mode', { ForcedHotWaterMode: true }, HotWaterMode.forced],
      ['hot_water_mode', { ForcedHotWaterMode: false }, HotWaterMode.auto],
      ['target_temperature.flow_heat', { SetHeatFlowTemperatureZone1: 0 }, 10],
      ['target_temperature.flow_heat', { SetHeatFlowTemperatureZone1: 35 }, 35],
    ])('%s(%o) should return %s', (key, input, expected) => {
      const { deviceToCapability } = device
      const converter = deviceToCapability[key]

      expect(converter?.(mock<Classic.ListDeviceDataAtw>(input))).toBe(expected)
    })
  })

  describe('capability-to-device conversions', () => {
    it.each([
      ['hot_water_mode', 'forced', true],
      ['hot_water_mode', 'auto', false],
      ['thermostat_mode', 'room', Classic.OperationModeZone.room],
      ['thermostat_mode.zone2', 'flow', Classic.OperationModeZone.flow],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const { capabilityToDevice } = device
      const converter = capabilityToDevice[key]

      expect(converter?.(input)).toBe(expected)
    })
  })

  describe('facade state mapping', () => {
    // One row per code path: the hot-water, zone1 and zone2 reads each
    // pass their facade state through unmapped.
    it.each([
      ['hot_water', 'hotWater', Classic.OperationModeStateHotWater.dhw],
      ['zone1', 'zone1', Classic.OperationModeStateZone.prohibited],
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

    // The library's derived top-level state passes through unmapped:
    // the app-side wire-number table died with melcloud-api 55.2.0.
    it('should set operational_state from the facade', async () => {
      mockAtwFacade(device, { operationalState: 'heating' })
      await callSetCapabilityValues(device)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state',
        'heating',
      )
    })

    // Out-of-vocabulary wire numbers read `null` library-side; passing
    // it through clears the Homey value — the sync must never crash on
    // new FTC vocabulary.
    it('should clear operational_state when the facade reads null', async () => {
      mockAtwFacade(device, { operationalState: null })
      await callSetCapabilityValues(device)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state',
        null,
      )
    })

    it('should localize the legionella date from the facade instant', async () => {
      mockAtwFacade(device, {
        hotWater: {
          lastLegionellaActivationEpochMs: Temporal.Instant.from(
            '2026-03-18T10:00:00Z',
          ).epochMilliseconds,
          operationalState: Classic.OperationModeStateHotWater.idle,
        },
      })
      await callSetCapabilityValues(device)

      const legionellaCall = setCapabilityValueMock.mock.calls.find(
        (call: unknown[]) => call[0] === 'legionella',
      )

      expect(legionellaCall?.[1]).toBeTypeOf('string')
      expect(legionellaCall?.[1]).toContain('18')
      expect(legionellaCall?.[1]).not.toBe('—')
    })

    // The library reads the "never ran" sentinel and unparseable wire
    // stamps as `null`; the app shows the language-neutral marker
    // instead of formatting a bogus year-1 date.
    it('should show the em dash when no legionella cycle was recorded', async () => {
      mockAtwFacade(device, {})
      await callSetCapabilityValues(device)

      expect(setCapabilityValueMock).toHaveBeenCalledWith('legionella', '—')
    })

    it('should skip legionella when the capability is not present', async () => {
      hasCapabilityMock.mockImplementation(
        (cap: string) => cap !== 'legionella',
      )
      mockAtwFacade(device, {})
      await callSetCapabilityValues(device)

      const legionellaCalls = setCapabilityValueMock.mock.calls.filter(
        (call: unknown[]) => call[0] === 'legionella',
      )

      expect(legionellaCalls).toHaveLength(0)
    })

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

    it('should skip the facade states when facade is unavailable', async () => {
      Object.defineProperty(device, 'facade', {
        configurable: true,
        value: undefined,
      })
      await callSetCapabilityValues(device)

      const facadeStateCalls = setCapabilityValueMock.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          (call[0].startsWith('operational_state') || call[0] === 'legionella'),
      )

      expect(facadeStateCalls).toHaveLength(0)
    })
  })
})
