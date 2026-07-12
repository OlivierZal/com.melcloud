import type HomeyModule from 'homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import {
  energyCapabilityTagMapping,
  getCapabilityTagMapping,
  listCapabilityTagMapping,
  setCapabilityTagMapping,
} from '../../types/classic-erv.mts'
import { testDriverType, testTagMappings } from '../driver-descriptors.ts'
import { type InteropModule, mock } from '../helpers.ts'
import ClassicMELCloudDriverErv from '../../drivers/melcloud_erv/driver.mts'

vi.mock(import('homey'), async () => {
  const { createMockDriverClass, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: {
      Driver: createMockDriverClass({
        manifest: {
          capabilities: [
            'onoff',
            'thermostat_mode',
            'fan_speed',
            'measure_temperature',
            'measure_temperature.outdoor',
            'measure_co2',
            'measure_pm25',
            'measure_signal_strength',
          ],
        },
      }),
    },
  })
})

describe(ClassicMELCloudDriverErv, () => {
  let driver: ClassicMELCloudDriverErv

  beforeEach(() => {
    driver = new ClassicMELCloudDriverErv()
  })

  testDriverType(() => driver, Classic.DeviceType.Erv)

  testTagMappings(() => driver, {
    energyCapabilityTagMapping,
    getCapabilityTagMapping,
    listCapabilityTagMapping,
    setCapabilityTagMapping,
  })

  describe('tag mappings', () => {
    it('should have empty energy capability tag mapping', () => {
      expect(driver.energyCapabilityTagMapping).toStrictEqual({})
    })
  })

  describe('required capabilities', () => {
    it('should include base capabilities without measure sensors', () => {
      const data = mock<Classic.ListDeviceDataErv>({
        HasCO2Sensor: false,
        HasPM25Sensor: false,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('onoff')
      expect(capabilities).toContain('thermostat_mode')
      expect(capabilities).not.toContain('measure_co2')
      expect(capabilities).not.toContain('measure_pm25')
      expect(capabilities).not.toContain('measure_signal_strength')
    })

    it('should include measure_co2 when HasCO2Sensor is true', () => {
      const data = mock<Classic.ListDeviceDataErv>({
        HasCO2Sensor: true,
        HasPM25Sensor: false,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('measure_co2')
    })

    it('should include measure_pm25 when HasPM25Sensor is true', () => {
      const data = mock<Classic.ListDeviceDataErv>({
        HasCO2Sensor: false,
        HasPM25Sensor: true,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('measure_pm25')
    })

    it('should include both sensors when both are available', () => {
      const data = mock<Classic.ListDeviceDataErv>({
        HasCO2Sensor: true,
        HasPM25Sensor: true,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('measure_co2')
      expect(capabilities).toContain('measure_pm25')
    })

    it('should exclude measure sensors when called without data', () => {
      const capabilities = driver.getRequiredCapabilities()

      expect(capabilities).not.toContain('measure_co2')
      expect(capabilities).not.toContain('measure_pm25')
    })
  })
})
