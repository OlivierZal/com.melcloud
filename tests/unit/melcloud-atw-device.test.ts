/* eslint-disable
    @typescript-eslint/naming-convention,
    @typescript-eslint/no-unsafe-assignment,
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-member-access,
    @typescript-eslint/no-unsafe-return,
    @typescript-eslint/no-unsafe-type-assertion,
    @typescript-eslint/prefer-destructuring,
    unicorn/consistent-function-scoping,
*/
import {
  type DeviceType,
  type ListDeviceDataAtw,
  OperationModeState,
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
  HotWaterOperationState,
  ZoneOperationState,
} from '../../types/index.mts'
import { mock, testEnergyReportConfig } from '../helpers.ts'

type AtwType = typeof DeviceType.Atw

const K_MULTIPLIER = 1000

const setCapabilityValueMock = vi.fn()
const hasCapabilityMock = vi.fn().mockReturnValue(true)
const getCapabilityOptionsMock = vi.fn().mockReturnValue({ min: 10 })

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('homey', () => {
  class MockDevice {
    public addCapability = vi.fn()

    public driver = {}

    public error = vi.fn()

    public getCapabilities = vi.fn().mockReturnValue([])

    public getCapabilityOptions = getCapabilityOptionsMock

    public getCapabilityValue = vi.fn()

    public getData = vi.fn().mockReturnValue({ id: 1 })

    public getSetting = vi.fn()

    public getSettings = vi.fn().mockReturnValue({})

    public hasCapability = hasCapabilityMock

    public homey = {
      __: vi.fn(),
      api: { realtime: vi.fn() },
      app: { getFacade: vi.fn() },
      clearInterval: vi.fn(),
      clearTimeout: vi.fn(),
      setInterval: vi.fn(),
      setTimeout: vi.fn(),
    }

    public log = vi.fn()

    public registerMultipleCapabilityListener = vi.fn()

    public setCapabilityOptions = vi.fn()

    public setCapabilityValue = setCapabilityValueMock

    public setSettings = vi.fn()

    public triggerCapabilityListener = vi.fn()

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public async removeCapability(): Promise<void> {
      await Promise.resolve()
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    public async setWarning(): Promise<void> {
      await Promise.resolve()
    }
  }

  return { default: { Device: MockDevice } }
})

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('../../decorators/add-to-logs.mts', () => ({
  addToLogs:
    () =>
    <T>(target: T): T =>
      target,
}))

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('../../mixins/with-timers.mts', () => ({
  withTimers: <T>(base: T): T => base,
}))

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('../../drivers/base-report.mts', () => ({
  EnergyReport: vi.fn().mockImplementation(() => ({
    // eslint-disable-next-line unicorn/no-useless-undefined
    handle: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn(),
  })),
}))

const mockDriver = mock<BaseMELCloudDriver<AtwType>>({
  energyCapabilityTagMapping: mock<EnergyCapabilityTagMapping<AtwType>>({}),
  getCapabilitiesOptions: vi.fn().mockReturnValue({}),
  getCapabilityTagMapping: mock<GetCapabilityTagMapping<AtwType>>({}),
  getRequiredCapabilities: vi.fn().mockReturnValue([]),
  listCapabilityTagMapping: mock<ListCapabilityTagMapping<AtwType>>({}),
  manifest: mock({ capabilities: [], id: 'melcloud_atw' }),
  setCapabilityTagMapping: mock<SetCapabilityTagMapping<AtwType>>({}),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeviceAny = any

describe(MELCloudDeviceAtw, () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let device: DeviceAny

  beforeEach(() => {
    vi.clearAllMocks()
    hasCapabilityMock.mockReturnValue(true)
    getCapabilityOptionsMock.mockReturnValue({ min: 10 })

    device = new (MELCloudDeviceAtw as unknown as new () => DeviceAny)()
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
    it('should convert alarm_generic.defrost using Boolean', () => {
      const converter = device.deviceToCapability['alarm_generic.defrost']

      expect(converter?.(1)).toBe(true)
      expect(converter?.(0)).toBe(false)
    })

    it('should convert measure_power by multiplying by 1000', () => {
      const converter = device.deviceToCapability.measure_power

      expect(converter?.(2.5)).toBe(2.5 * K_MULTIPLIER)
    })

    it('should convert measure_power.produced by multiplying by 1000', () => {
      const converter = device.deviceToCapability['measure_power.produced']

      expect(converter?.(1.5)).toBe(1.5 * K_MULTIPLIER)
    })

    it('should convert thermostat_mode from enum value to key', () => {
      const converter = device.deviceToCapability.thermostat_mode

      expect(converter?.(OperationModeZone.room)).toBe('room')
    })

    it('should convert thermostat_mode.zone2 from enum value to key', () => {
      const converter = device.deviceToCapability['thermostat_mode.zone2']

      expect(converter?.(OperationModeZone.flow)).toBe('flow')
    })

    it('should convert hot_water_mode true to forced', () => {
      const converter = device.deviceToCapability.hot_water_mode

      expect(converter?.(true)).toBe(HotWaterMode.forced)
    })

    it('should convert hot_water_mode false to auto', () => {
      const converter = device.deviceToCapability.hot_water_mode

      expect(converter?.(false)).toBe(HotWaterMode.auto)
    })

    it('should convert operational_state from enum value to key', () => {
      const converter = device.deviceToCapability.operational_state

      expect(converter?.(OperationModeState.heating)).toBe('heating')
    })

    it('should use min option when target_temperature.flow_heat is 0', () => {
      const converter =
        device.deviceToCapability['target_temperature.flow_heat']

      expect(converter?.(0)).toBe(10)
    })

    it('should pass through non-zero target_temperature.flow_heat', () => {
      const converter =
        device.deviceToCapability['target_temperature.flow_heat']

      expect(converter?.(35)).toBe(35)
    })

    it('should convert legionella from ISO date to locale string', () => {
      const converter = device.deviceToCapability.legionella

      const result = converter?.('2026-03-18T10:00:00')

      expect(result).toBeDefined()
      expect(result).toBeTypeOf('string')
    })
  })

  describe('capabilityToDevice', () => {
    it('should convert hot_water_mode forced to true', () => {
      const converter = device.capabilityToDevice.hot_water_mode

      expect(converter?.('forced')).toBe(true)
    })

    it('should convert hot_water_mode auto to false', () => {
      const converter = device.capabilityToDevice.hot_water_mode

      expect(converter?.('auto')).toBe(false)
    })

    it('should convert thermostat_mode key to enum value', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('room')).toBe(OperationModeZone.room)
    })

    it('should convert thermostat_mode.zone2 key to enum value', () => {
      const converter = device.capabilityToDevice['thermostat_mode.zone2']

      expect(converter?.('flow')).toBe(OperationModeZone.flow)
    })
  })

  describe('setCapabilityValues (operation mode states)', () => {
    it('should set hot water operation state to dhw when ForcedHotWaterMode is true', async () => {
      const data = mock<ListDeviceDataAtw>({
        ForcedHotWaterMode: true,
        OperationMode: OperationModeState.heating,
        ProhibitHotWater: false,
      })
      await (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(data)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.hot_water',
        HotWaterOperationState.dhw,
      )
    })

    it('should set hot water operation state to prohibited when ProhibitHotWater is true', async () => {
      const data = mock<ListDeviceDataAtw>({
        ForcedHotWaterMode: false,
        OperationMode: OperationModeState.heating,
        ProhibitHotWater: true,
      })
      await (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(data)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.hot_water',
        HotWaterOperationState.prohibited,
      )
    })

    it('should set zone1 operation state to prohibited when in heat mode and heating is prohibited', async () => {
      const data = mock<ListDeviceDataAtw>({
        ForcedHotWaterMode: false,
        IdleZone1: false,
        OperationMode: OperationModeState.heating,
        ProhibitHeatingZone1: true,
        ProhibitHotWater: false,
        Zone1InCoolMode: false,
        Zone1InHeatMode: true,
      })
      await (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(data)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.zone1',
        ZoneOperationState.prohibited,
      )
    })

    it('should set zone1 operation state to prohibited when in cool mode and cooling is prohibited', async () => {
      const data = mock<ListDeviceDataAtw>({
        ForcedHotWaterMode: false,
        IdleZone1: false,
        OperationMode: OperationModeState.heating,
        ProhibitCoolingZone1: true,
        ProhibitHeatingZone1: false,
        ProhibitHotWater: false,
        Zone1InCoolMode: true,
        Zone1InHeatMode: false,
      })
      await (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(data)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.zone1',
        ZoneOperationState.prohibited,
      )
    })

    it('should set zone operation state to idle when zone is idle', async () => {
      const data = mock<ListDeviceDataAtw>({
        ForcedHotWaterMode: false,
        IdleZone1: true,
        OperationMode: OperationModeState.heating,
        ProhibitHeatingZone1: false,
        ProhibitHotWater: false,
        Zone1InCoolMode: false,
        Zone1InHeatMode: true,
      })
      await (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(data)

      expect(setCapabilityValueMock).toHaveBeenCalledWith(
        'operational_state.zone1',
        ZoneOperationState.idle,
      )
    })

    it('should skip zone2 operation state when capability is not present', async () => {
      hasCapabilityMock.mockImplementation(
        (cap: string) => cap !== 'operational_state.zone2',
      )
      const data = mock<ListDeviceDataAtw>({
        ForcedHotWaterMode: false,
        OperationMode: OperationModeState.idle,
        ProhibitHotWater: false,
      })
      await (
        device as unknown as {
          setCapabilityValues: (data: ListDeviceDataAtw) => Promise<void>
        }
      ).setCapabilityValues(data)

      const zone2Calls = setCapabilityValueMock.mock.calls.filter(
        (call: unknown[]) => call[0] === 'operational_state.zone2',
      )

      expect(zone2Calls).toHaveLength(0)
    })
  })
})
