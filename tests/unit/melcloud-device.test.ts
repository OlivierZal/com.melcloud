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

vi.mock('homey', async () => {
  const { createMockDeviceClass: create } = await import('../helpers.ts')
  return { default: { Device: create() } }
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

vi.mock('../../drivers/base-report.mts', () => ({
  EnergyReport: vi.fn().mockImplementation(() => ({
    handle: vi.fn().mockResolvedValue(undefined),
    unschedule: vi.fn(),
  })),
}))

describe(MELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = new (MELCloudDeviceAta as unknown as new () => any)()
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
