import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import { ThermostatModeAta } from '../../types/ata.mts'
import {
  testCapabilityToDeviceConverters,
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import { mock } from '../helpers.ts'
import ClassicMELCloudDeviceAta from '../../drivers/melcloud/device.mts'
import { createInstance } from './create-test-instance.ts'

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDeviceClass: create } = await import('../helpers.ts')
  return { default: { Device: create() } }
})

describe(ClassicMELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(ClassicMELCloudDeviceAta)
  })

  testThermostatMode(() => device as object, ThermostatModeAta)

  testEnergyReportConfig(() => device as object, 'energyReportRegular', {
    duration: { hours: 1 },
    interval: { hours: 1 },
    minus: { hours: 1 },
    mode: 'regular',
    values: { millisecond: 0, minute: 5, second: 0 },
  })

  testEnergyReportConfig(() => device as object, 'energyReportTotal', {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { hours: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  })

  describe('device-to-capability conversions', () => {
    it.each([
      ['alarm_generic.silent', Classic.FanSpeed.silent, true],
      ['alarm_generic.silent', Classic.FanSpeed.auto, false],
      ['fan_speed', Classic.FanSpeed.silent, Classic.FanSpeed.auto],
      ['fan_speed', Classic.FanSpeed.fast, Classic.FanSpeed.fast],
      ['horizontal', Classic.Horizontal.center, 'center'],
      ['vertical', Classic.Vertical.auto, 'auto'],
    ])('%s(%s) should return %s', (key, input, expected) => {
      const {
        deviceToCapability: { [key]: converter },
      } = device

      expect(converter?.(input)).toBe(expected)
    })

    it('should convert thermostat_mode to key when Power is on', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device
      const data = mock<Classic.ListDeviceDataAta>({ Power: true })

      expect(converter?.(Classic.OperationMode.heat, data)).toBe('heat')
    })

    it('should return off for thermostat_mode when Power is off', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device
      const data = mock<Classic.ListDeviceDataAta>({ Power: false })

      expect(converter?.(Classic.OperationMode.heat, data)).toBe(
        ThermostatModeAta.off,
      )
    })
  })

  testCapabilityToDeviceConverters(
    () => device as object,
    [
      ['horizontal', 'center', Classic.Horizontal.center],
      ['thermostat_mode', 'heat', Classic.OperationMode.heat],
      ['vertical', 'middle', Classic.Vertical.middle],
    ],
  )
})
