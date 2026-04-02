import {
  type ListDeviceDataAta,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThermostatModeAta } from '../../types/index.mts'
import {
  mock,
  testCapabilityToDeviceConverters,
  testEnergyReportConfig,
  testThermostatMode,
} from '../helpers.ts'
import MELCloudDeviceAta from '../../drivers/melcloud/device.mts'
import { createInstance } from './create-test-instance.ts'

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDeviceClass: create } = await import('../helpers.ts')
  return { default: { Device: create() } }
})

const { identityDecorator } = vi.hoisted(() => ({
  identityDecorator: <T>(target: T): T => target,
}))

vi.mock(import('../../decorators/add-to-logs.mts'), () => ({
  addToLogs: (): typeof identityDecorator => identityDecorator,
}))

// eslint-disable-next-line vitest/prefer-import-in-mock -- Identity function return type T is not assignable to T & TimerClass
vi.mock('../../mixins/with-timers.mts', () => ({
  withTimers: <T>(base: T): T => base,
}))

vi.mock(import('../../drivers/base-report.mts'), async () => {
  const { createEnergyReportMock } = await import('../helpers.ts')
  return createEnergyReportMock()
})

describe(MELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(MELCloudDeviceAta)
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
      ['alarm_generic.silent', FanSpeed.silent, true],
      ['alarm_generic.silent', FanSpeed.auto, false],
      ['fan_speed', FanSpeed.silent, FanSpeed.auto],
      ['fan_speed', FanSpeed.fast, FanSpeed.fast],
      ['horizontal', Horizontal.center, 'center'],
      ['vertical', Vertical.auto, 'auto'],
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
      const data = mock<ListDeviceDataAta>({ Power: true })

      expect(converter?.(OperationMode.heat, data)).toBe('heat')
    })

    it('should return off for thermostat_mode when Power is off', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device
      const data = mock<ListDeviceDataAta>({ Power: false })

      expect(converter?.(OperationMode.heat, data)).toBe(ThermostatModeAta.off)
    })
  })

  testCapabilityToDeviceConverters(
    () => device as object,
    [
      ['horizontal', 'center', Horizontal.center],
      ['thermostat_mode', 'heat', OperationMode.heat],
      ['vertical', 'middle', Vertical.middle],
    ],
  )
})
