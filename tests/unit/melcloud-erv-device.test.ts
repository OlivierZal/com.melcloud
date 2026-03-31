import {
  type ListDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThermostatModeErv } from '../../types/index.mts'
import { mock, testEnergyReportConfig } from '../helpers.ts'
import MELCloudDeviceErv from '../../drivers/melcloud_erv/device.mts'

vi.mock('homey', async () => {
  const { createMockDeviceClass } = await import('../helpers.ts')
  return { default: { Device: createMockDeviceClass() } }
})

const { identityDecorator } = vi.hoisted(() => ({
  identityDecorator: <T>(target: T): T => target,
}))

vi.mock(import('../../decorators/add-to-logs.mts'), () => ({
  addToLogs: (): typeof identityDecorator => identityDecorator,
}))

vi.mock('../../mixins/with-timers.mts', () => ({
  withTimers: <T>(base: T): T => base,
}))

vi.mock(import('../../drivers/base-report.mts'), async () => {
  const { createEnergyReportMock } = await import('../helpers.ts')
  return createEnergyReportMock()
})

describe(MELCloudDeviceErv, () => {
  let device: any

  beforeEach(() => {
    device = new (MELCloudDeviceErv as unknown as new () => any)()
  })

  describe('thermostat mode configuration', () => {
    it('should be ThermostatModeErv with off support', () => {
      expect(device.thermostatMode).toBe(ThermostatModeErv)
      expect(device.thermostatMode).toHaveProperty('off')
    })
  })

  testEnergyReportConfig(() => device, 'energyReportRegular', null)

  testEnergyReportConfig(() => device, 'energyReportTotal', null)

  describe('device-to-capability conversions', () => {
    it.each([
      [VentilationMode.auto, true, 'auto'],
      [VentilationMode.auto, false, ThermostatModeErv.off],
      [VentilationMode.recovery, true, 'recovery'],
      [VentilationMode.bypass, true, 'bypass'],
    ])(
      'thermostat_mode(%s, Power: %s) should return %s',
      (input, isPoweredOn, expected) => {
        const converter = device.deviceToCapability.thermostat_mode
        const data = mock<ListDeviceDataErv>({ Power: isPoweredOn })

        expect(converter?.(input, data)).toBe(expected)
      },
    )
  })

  describe('capability-to-device conversions', () => {
    it.each([
      ['auto', VentilationMode.auto],
      ['recovery', VentilationMode.recovery],
      ['bypass', VentilationMode.bypass],
    ])('thermostat_mode(%s) should return %s', (input, expected) => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.(input)).toBe(expected)
    })
  })
})
