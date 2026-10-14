import type HomeyModule from 'homey'
import { type InteropModule, mock } from '@olivierzal/homey-kit/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import { EnergyReport } from '../../drivers/classic-report.mts'
import { ThermostatModeAta } from '../../types/ata.mts'
import {
  testCapabilityToDeviceConverters,
  testEnergyReportConfigs,
  testThermostatMode,
} from '../device-descriptors.ts'
import ClassicMELCloudDeviceAta from '../../drivers/melcloud/device.mts'
import { createInstance } from './create-test-instance.ts'

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass: create } = await import('../helpers.ts')
  const { mock: mockModule } = await import('@olivierzal/homey-kit/testing')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Device: create() },
  })
})

describe(ClassicMELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(ClassicMELCloudDeviceAta)
  })

  testThermostatMode(() => device as object, ThermostatModeAta)

  testEnergyReportConfigs(() => device as object, {
    regular: {
      duration: { hours: 1 },
      minus: { hours: 1 },
      mode: 'regular',
      values: { millisecond: 0, minute: 5, second: 0 },
    },
    total: {
      duration: { days: 1 },
      minus: { hours: 1 },
      mode: 'total',
      values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
    },
  })

  // `EnergyReport` is the setup-level mock: the factory is judged by the
  // constructor call it makes, with this device as the report's owner.
  describe('energyReports.create', () => {
    it('should build a Classic energy report for this device', () => {
      const config = {
        duration: { hours: 1 },
        minus: { hours: 1 },
        mode: 'regular' as const,
        values: { millisecond: 0, minute: 5, second: 0 },
      }
      device.energyReports.create(config)

      expect(EnergyReport).toHaveBeenCalledWith(device as object, config)
    })
  })

  describe('device-to-capability conversions', () => {
    it.each([
      ['alarm_generic.silent', { FanSpeed: Classic.FanSpeed.silent }, true],
      ['alarm_generic.silent', { FanSpeed: Classic.FanSpeed.auto }, false],
      [
        'fan_speed',
        { FanSpeed: Classic.FanSpeed.silent },
        Classic.FanSpeed.auto,
      ],
      ['fan_speed', { FanSpeed: Classic.FanSpeed.fast }, Classic.FanSpeed.fast],
      [
        'horizontal',
        { VaneHorizontalDirection: Classic.Horizontal.center },
        'center',
      ],
      ['vertical', { VaneVerticalDirection: Classic.Vertical.auto }, 'auto'],
    ])('%s(%o) should return %s', (key, input, expected) => {
      const { deviceToCapability } = device
      const converter = deviceToCapability[key]

      expect(converter?.(mock<Classic.ListDeviceDataAta>(input))).toBe(expected)
    })

    it('should convert thermostat_mode to key when Power is on', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device
      const data = mock<Classic.ListDeviceDataAta>({
        OperationMode: Classic.OperationMode.heat,
        Power: true,
      })

      expect(converter?.(data)).toBe('heat')
    })

    it('should return off for thermostat_mode when Power is off', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device
      const data = mock<Classic.ListDeviceDataAta>({
        OperationMode: Classic.OperationMode.heat,
        Power: false,
      })

      expect(converter?.(data)).toBe(ThermostatModeAta.off)
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
