import type HomeyModule from 'homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import { NotFoundError } from '../../lib/errors.mts'
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

// onInit walks the capability-listener registration (a minimal driver
// with empty tag mappings satisfies it) and the facade lookup — which
// must honour the production contract: absent device throws NotFound,
// never returns undefined (an undefined facade would re-init forever).
const prepareInit = (target: object): void => {
  Object.defineProperty(target, 'driver', {
    configurable: true,
    value: mock<object>({
      tagMappings: { energy: {}, get: {}, list: {}, set: {} },
    }),
  })
  const { homey } = target as {
    homey: { app: { getClassicFacade: ReturnType<typeof vi.fn> } }
  }
  homey.app.getClassicFacade.mockImplementation(() => {
    throw new NotFoundError('not paired yet')
  })
}

describe(ClassicMELCloudDeviceErv, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(ClassicMELCloudDeviceErv)
  })

  describe('device class migration', () => {
    it('should reclassify a template-era heatpump as airtreatment once', async () => {
      prepareInit(device as object)
      device.getClass.mockReturnValue('heatpump')
      await device.onInit()

      expect(device.setClass).toHaveBeenCalledWith('airtreatment')
    })

    it('should leave an already-reclassified device untouched', async () => {
      prepareInit(device as object)
      device.getClass.mockReturnValue('airtreatment')
      await device.onInit()

      expect(device.setClass).not.toHaveBeenCalled()
    })
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
