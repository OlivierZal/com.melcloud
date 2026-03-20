import {
  type ListDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MELCloudDeviceErv from '../../drivers/melcloud_erv/device.mts'

import { ThermostatModeErv } from '../../types/index.mts'
import { mock, testEnergyReportConfig } from '../helpers.ts'

vi.mock('homey', async () => {
  const { createMockDeviceClass } = await import('../helpers.ts')
  return { default: { Device: createMockDeviceClass() } }
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

describe(MELCloudDeviceErv, () => {
  let device: any

  beforeEach(() => {
    device = new (MELCloudDeviceErv as unknown as new () => any)()
  })

  describe('thermostatMode', () => {
    it('should be ThermostatModeErv with off support', () => {
      expect(device.thermostatMode).toBe(ThermostatModeErv)
      expect(device.thermostatMode).toHaveProperty('off')
    })
  })

  testEnergyReportConfig(() => device, 'energyReportRegular', null)

  testEnergyReportConfig(() => device, 'energyReportTotal', null)

  describe('deviceToCapability', () => {
    it('should convert thermostat_mode to key when Power is on', () => {
      const converter = device.deviceToCapability.thermostat_mode
      const data = mock<ListDeviceDataErv>({ Power: true })

      expect(converter?.(VentilationMode.auto, data)).toBe('auto')
    })

    it('should return off for thermostat_mode when Power is off', () => {
      const converter = device.deviceToCapability.thermostat_mode
      const data = mock<ListDeviceDataErv>({ Power: false })

      expect(converter?.(VentilationMode.auto, data)).toBe(
        ThermostatModeErv.off,
      )
    })

    it('should convert recovery mode correctly', () => {
      const converter = device.deviceToCapability.thermostat_mode
      const data = mock<ListDeviceDataErv>({ Power: true })

      expect(converter?.(VentilationMode.recovery, data)).toBe('recovery')
    })

    it('should convert bypass mode correctly', () => {
      const converter = device.deviceToCapability.thermostat_mode
      const data = mock<ListDeviceDataErv>({ Power: true })

      expect(converter?.(VentilationMode.bypass, data)).toBe('bypass')
    })
  })

  describe('capabilityToDevice', () => {
    it('should convert thermostat_mode key to enum value', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('auto')).toBe(VentilationMode.auto)
    })

    it('should convert recovery key to enum value', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('recovery')).toBe(VentilationMode.recovery)
    })

    it('should convert bypass key to enum value', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('bypass')).toBe(VentilationMode.bypass)
    })
  })
})
