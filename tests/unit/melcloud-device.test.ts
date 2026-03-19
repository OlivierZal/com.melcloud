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
  type ListDeviceDataAta,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MELCloudDeviceAta from '../../drivers/melcloud/device.mts'

import { ThermostatModeAta } from '../../types/index.mts'
import { mock, testEnergyReportConfig } from '../helpers.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeviceAny = any

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('homey', () => {
  class MockDevice {
    public addCapability = vi.fn()

    public driver = {}

    public error = vi.fn()

    public getCapabilities = vi.fn().mockReturnValue([])

    public getCapabilityOptions = vi.fn()

    public getCapabilityValue = vi.fn()

    public getData = vi.fn().mockReturnValue({ id: 1 })

    public getSetting = vi.fn()

    public getSettings = vi.fn().mockReturnValue({})

    public hasCapability = vi.fn().mockReturnValue(true)

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

    public setCapabilityValue = vi.fn()

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

describe(MELCloudDeviceAta, () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let device: DeviceAny

  beforeEach(() => {
    device = new (MELCloudDeviceAta as unknown as new () => DeviceAny)()
  })

  describe('thermostatMode', () => {
    it('should be ThermostatModeAta with off support', () => {
      expect(device.thermostatMode).toBe(ThermostatModeAta)
      expect(device.thermostatMode).toHaveProperty('off')
    })
  })

  testEnergyReportConfig(() => device, 'energyReportRegular', {
    duration: { hours: 1 },
    interval: { hours: 1 },
    minus: { hours: 1 },
    mode: 'regular',
    values: { millisecond: 0, minute: 5, second: 0 },
  })

  testEnergyReportConfig(() => device, 'energyReportTotal', {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { hours: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  })

  describe('deviceToCapability', () => {
    it('should convert alarm_generic.silent from FanSpeed.silent to true', () => {
      const converter = device.deviceToCapability['alarm_generic.silent']

      expect(converter?.(FanSpeed.silent)).toBe(true)
    })

    it('should convert alarm_generic.silent from non-silent to false', () => {
      const converter = device.deviceToCapability['alarm_generic.silent']

      expect(converter?.(FanSpeed.auto)).toBe(false)
    })

    it('should convert fan_speed from silent to auto', () => {
      const converter = device.deviceToCapability.fan_speed

      expect(converter?.(FanSpeed.silent)).toBe(FanSpeed.auto)
    })

    it('should pass through fan_speed for non-silent values', () => {
      const converter = device.deviceToCapability.fan_speed

      expect(converter?.(FanSpeed.fast)).toBe(FanSpeed.fast)
    })

    it('should convert horizontal from enum value to key', () => {
      const converter = device.deviceToCapability.horizontal

      expect(converter?.(Horizontal.center)).toBe('center')
    })

    it('should convert vertical from enum value to key', () => {
      const converter = device.deviceToCapability.vertical

      expect(converter?.(Vertical.auto)).toBe('auto')
    })

    it('should convert thermostat_mode to key when Power is on', () => {
      const converter = device.deviceToCapability.thermostat_mode
      const data = mock<ListDeviceDataAta>({ Power: true })

      expect(converter?.(OperationMode.heat, data)).toBe('heat')
    })

    it('should return off for thermostat_mode when Power is off', () => {
      const converter = device.deviceToCapability.thermostat_mode
      const data = mock<ListDeviceDataAta>({ Power: false })

      expect(converter?.(OperationMode.heat, data)).toBe(ThermostatModeAta.off)
    })
  })

  describe('capabilityToDevice', () => {
    it('should convert horizontal key to enum value', () => {
      const converter = device.capabilityToDevice.horizontal

      expect(converter?.('center')).toBe(Horizontal.center)
    })

    it('should convert thermostat_mode key to enum value', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('heat')).toBe(OperationMode.heat)
    })

    it('should convert vertical key to enum value', () => {
      const converter = device.capabilityToDevice.vertical

      expect(converter?.('middle')).toBe(Vertical.middle)
    })
  })
})
