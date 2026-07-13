import type HomeyModule from 'homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import { ThermostatModeErv } from '../../types/erv.mts'
import {
  testCapabilityToDeviceConverters,
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import { type InteropModule, mock } from '../helpers.ts'
import ClassicMELCloudDeviceErv from '../../drivers/melcloud_erv/device.mts'
import { createInstance } from './create-test-instance.ts'

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Device: createMockDeviceClass() },
  })
})

describe(ClassicMELCloudDeviceErv, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(ClassicMELCloudDeviceErv)
  })

  testThermostatMode(() => device as object, ThermostatModeErv)

  testEnergyReportConfig(() => device as object, 'energyReportRegular', null)

  testEnergyReportConfig(() => device as object, 'energyReportTotal', null)

  describe('device-to-capability conversions', () => {
    it.each([
      [Classic.VentilationMode.auto, true, 'auto'],
      [Classic.VentilationMode.auto, false, ThermostatModeErv.off],
      [Classic.VentilationMode.recovery, true, 'recovery'],
      [Classic.VentilationMode.bypass, true, 'bypass'],
    ])(
      'thermostat_mode(%s, Power: %s) should return %s',
      (input, isPoweredOn, expected) => {
        const {
          deviceToCapability: { thermostat_mode: converter },
        } = device
        const data = mock<Classic.ListDeviceDataErv>({
          Power: isPoweredOn,
          VentilationMode: input,
        })

        expect(converter?.(data)).toBe(expected)
      },
    )
  })

  testCapabilityToDeviceConverters(
    () => device as object,
    [
      ['thermostat_mode', 'auto', Classic.VentilationMode.auto],
      ['thermostat_mode', 'recovery', Classic.VentilationMode.recovery],
      ['thermostat_mode', 'bypass', Classic.VentilationMode.bypass],
    ],
  )
})
