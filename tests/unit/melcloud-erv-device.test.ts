import {
  type ListDeviceDataErv,
  VentilationMode,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThermostatModeErv } from '../../types/index.mts'
import {
  mock,
  testCapabilityToDeviceConverters,
  testEnergyReportConfig,
  testThermostatMode,
} from '../helpers.ts'
import MELCloudDeviceErv from '../../drivers/melcloud_erv/device.mts'
import { createInstance } from './create-test-instance.ts'

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
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

// eslint-disable-next-line vitest/prefer-import-in-mock -- Identity function return type T is not assignable to T & TimerClass
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
    device = createInstance(MELCloudDeviceErv)
  })

  testThermostatMode(() => device as object, ThermostatModeErv)

  testEnergyReportConfig(() => device as object, 'energyReportRegular', null)

  testEnergyReportConfig(() => device as object, 'energyReportTotal', null)

  describe('device-to-capability conversions', () => {
    it.each([
      [VentilationMode.auto, true, 'auto'],
      [VentilationMode.auto, false, ThermostatModeErv.off],
      [VentilationMode.recovery, true, 'recovery'],
      [VentilationMode.bypass, true, 'bypass'],
    ])(
      'thermostat_mode(%s, Power: %s) should return %s',
      (input, isPoweredOn, expected) => {
        const {
          deviceToCapability: { thermostat_mode: converter },
        } = device
        const data = mock<ListDeviceDataErv>({ Power: isPoweredOn })

        expect(converter?.(input, data)).toBe(expected)
      },
    )
  })

  testCapabilityToDeviceConverters(
    () => device as object,
    [
      ['thermostat_mode', 'auto', VentilationMode.auto],
      ['thermostat_mode', 'recovery', VentilationMode.recovery],
      ['thermostat_mode', 'bypass', VentilationMode.bypass],
    ],
  )
})
