import {
  type ListDeviceDataAta,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThermostatModeAta } from '../../types/index.mts'
import { mock, testEnergyReportConfig } from '../helpers.ts'
import MELCloudDeviceAta from '../../drivers/melcloud/device.mts'

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

vi.mock('../../drivers/base-report.mts', async () => {
  const { createEnergyReportMock } = await import('../helpers.ts')
  return createEnergyReportMock()
})

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
    it.each([
      ['alarm_generic.silent', FanSpeed.silent, true],
      ['alarm_generic.silent', FanSpeed.auto, false],
      ['fan_speed', FanSpeed.silent, FanSpeed.auto],
      ['fan_speed', FanSpeed.fast, FanSpeed.fast],
      ['horizontal', Horizontal.center, 'center'],
      ['vertical', Vertical.auto, 'auto'],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const converter = device.deviceToCapability[key]

      expect(converter?.(input)).toBe(expected)
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
    it.each([
      ['horizontal', 'center', Horizontal.center],
      ['thermostat_mode', 'heat', OperationMode.heat],
      ['vertical', 'middle', Vertical.middle],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const converter = device.capabilityToDevice[key]

      expect(converter?.(input)).toBe(expected)
    })
  })
})
