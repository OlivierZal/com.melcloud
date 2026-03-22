import {
  type DeviceType,
  type ListDeviceDataAtw,
  OperationModeState,
  OperationModeStateHotWater,
  OperationModeStateZone,
  OperationModeZone,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BaseMELCloudDriver } from '../../drivers/base-driver.mts'

import MELCloudDeviceAtw from '../../drivers/melcloud_atw/device.mts'

import {
  type EnergyCapabilityTagMapping,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type SetCapabilityTagMapping,
  HotWaterMode,
} from '../../types/index.mts'
import { mock, testEnergyReportConfig } from '../helpers.ts'

type AtwType = typeof DeviceType.Atw

const K_MULTIPLIER = 1000

const { getCapabilityOptionsMock, hasCapabilityMock, setCapabilityValueMock } =
  vi.hoisted(() => ({
    getCapabilityOptionsMock: vi.fn().mockReturnValue({ min: 10 }),
    hasCapabilityMock: vi.fn().mockReturnValue(true),
    setCapabilityValueMock: vi.fn(),
  }))

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

vi.mock('../../decorators/add-to-logs.mts', () => ({
  addToLogs:
    () =>
    <T>(target: T): T =>
      target,
}))

vi.mock('../../mixins/with-timers.mts', () => ({
  withTimers: <T>(base: T): T => base,
}))

vi.mock('../../drivers/base-report.mts', async () => {
  const { createEnergyReportMock } = await import('../helpers.ts')
  return createEnergyReportMock()
})

const mockDriver = mock<BaseMELCloudDriver<AtwType>>({
  energyCapabilityTagMapping: mock<EnergyCapabilityTagMapping<AtwType>>({}),
  getCapabilitiesOptions: vi.fn().mockReturnValue({}),
  getCapabilityTagMapping: mock<GetCapabilityTagMapping<AtwType>>({}),
  getRequiredCapabilities: vi.fn().mockReturnValue([]),
  listCapabilityTagMapping: mock<ListCapabilityTagMapping<AtwType>>({}),
  manifest: mock({ capabilities: [], id: 'melcloud_atw' }),
  setCapabilityTagMapping: mock<SetCapabilityTagMapping<AtwType>>({}),
})

describe(MELCloudDeviceAtw, () => {
  let device: any

  beforeEach(() => {
    vi.clearAllMocks()
    hasCapabilityMock.mockReturnValue(true)
    getCapabilityOptionsMock.mockReturnValue({ min: 10 })

    device = new (MELCloudDeviceAtw as unknown as new () => any)()
    Object.defineProperty(device, 'driver', {
      configurable: true,
      value: mockDriver,
    })
  })

  describe('thermostatMode', () => {
    it('should be null (no off support)', () => {
      expect(device.thermostatMode).toBeNull()
    })
  })

  testEnergyReportConfig(() => device, 'energyReportRegular', {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'regular',
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  })

  testEnergyReportConfig(() => device, 'energyReportTotal', {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  })

  describe('deviceToCapability', () => {
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
      const converter = device.deviceToCapability[key]

      expect(converter?.(input)).toBe(expected)
    })

    it('should convert legionella from ISO date to locale string', () => {
      const converter = device.deviceToCapability.legionella

      const result = converter?.('2026-03-18T10:00:00')

      expect(result).toBeDefined()
      expect(result).toBeTypeOf('string')
    })
  })

  describe('capabilityToDevice', () => {
    it.each([
      ['hot_water_mode', 'forced', true],
      ['hot_water_mode', 'auto', false],
      ['thermostat_mode', 'room', OperationModeZone.room],
      ['thermostat_mode.zone2', 'flow', OperationModeZone.flow],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const converter = device.capabilityToDevice[key]

      expect(converter?.(input)).toBe(expected)
    })
  })

  describe('setCapabilityValues (operation mode states)', () => {
    const mockFacade = (overrides: {
      hotWater?: { operationalState: OperationModeStateHotWater }
      zone1?: { operationalState: OperationModeStateZone }
      zone2?: { operationalState: OperationModeStateZone }
    }): void => {
      Object.defineProperty(device, 'facade', {
        configurable: true,
        value: {
          hotWater: overrides.hotWater ?? {
            operationalState: OperationModeStateHotWater.idle,
          },
          zone1: overrides.zone1 ?? {
            operationalState: OperationModeStateZone.idle,
          },
          ...('zone2' in overrides && { zone2: overrides.zone2 }),
        },
      })
    }

    const callSetCapabilityValues = async (): Promise<void> =>
      (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(mock<ListDeviceDataAtw>({}))

    it('should set hot water operation state to dhw when facade reports dhw', async () => {
      mockFacade({
        hotWater: { operationalState: OperationModeStateHotWater.dhw },
      })
      await callSetCapabilityValues()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.hot_water',
        OperationModeStateHotWater.dhw,
      )
    })

    it('should set hot water operation state to prohibited when facade reports prohibited', async () => {
      mockFacade({
        hotWater: { operationalState: OperationModeStateHotWater.prohibited },
      })
      await callSetCapabilityValues()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.hot_water',
        OperationModeStateHotWater.prohibited,
      )
    })

    it('should set zone1 operation state from facade', async () => {
      mockFacade({
        zone1: { operationalState: OperationModeStateZone.prohibited },
      })
      await callSetCapabilityValues()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.zone1',
        OperationModeStateZone.prohibited,
      )
    })

    it('should set zone operation state to idle from facade', async () => {
      mockFacade({
        zone1: { operationalState: OperationModeStateZone.idle },
      })
      await callSetCapabilityValues()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.zone1',
        OperationModeStateZone.idle,
      )
    })

    it('should set zone2 operation state when capability is present and facade has zone2', async () => {
      mockFacade({
        zone2: { operationalState: OperationModeStateZone.heating },
      })
      await callSetCapabilityValues()

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.zone2',
        OperationModeStateZone.heating,
      )
    })

    it('should skip zone2 operation state when capability is not present', async () => {
      hasCapabilityMock.mockImplementation(
        (cap: string) => cap !== 'operational_state.zone2',
      )
      mockFacade({
        zone2: { operationalState: OperationModeStateZone.idle },
      })
      await callSetCapabilityValues()

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
      await callSetCapabilityValues()

      const opStateCalls = setCapabilityValueMock.mock.calls.filter(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].startsWith('operational_state.'),
      )

      expect(opStateCalls).toHaveLength(0)
    })
  })
})
