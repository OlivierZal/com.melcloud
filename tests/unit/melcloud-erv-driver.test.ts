import { type ListDeviceDataErv, DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MELCloudDriverErv from '../../drivers/melcloud_erv/driver.mts'

import {
  energyCapabilityTagMappingErv,
  getCapabilityTagMappingErv,
  listCapabilityTagMappingErv,
  setCapabilityTagMappingErv,
} from '../../types/index.mts'
import { mock, testDriverType, testTagMappings } from '../helpers.ts'

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('homey', () => {
  class MockDriver {
    public getDevices = vi.fn().mockReturnValue([])

    public homey = {
      app: {
        api: {
          authenticate: vi.fn(),
          registry: { getDevicesByType: vi.fn().mockReturnValue([]) },
        },
      },
      flow: {
        getActionCard: vi.fn().mockReturnValue({
          registerRunListener: vi.fn(),
        }),
        getConditionCard: vi.fn().mockReturnValue({
          registerRunListener: vi.fn(),
        }),
      },
    }

    public log = vi.fn()

    public manifest = {
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
    }
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  return { default: { Driver: MockDriver } }
})

describe(MELCloudDriverErv, () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let driver: MELCloudDriverErv

  beforeEach(() => {
    driver = new MELCloudDriverErv()
  })

  testDriverType(() => driver, DeviceType.Erv)

  testTagMappings(() => driver, {
    energyCapabilityTagMapping: energyCapabilityTagMappingErv,
    getCapabilityTagMapping: getCapabilityTagMappingErv,
    listCapabilityTagMapping: listCapabilityTagMappingErv,
    setCapabilityTagMapping: setCapabilityTagMappingErv,
  })

  describe('tag mappings', () => {
    it('should have empty energy capability tag mapping', () => {
      expect(driver.energyCapabilityTagMapping).toStrictEqual({})
    })
  })

  describe('getRequiredCapabilities', () => {
    it('should include base capabilities without measure sensors', () => {
      const data = mock<ListDeviceDataErv>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasCO2Sensor: false,
        // eslint-disable-next-line @typescript-eslint/naming-convention
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
      const data = mock<ListDeviceDataErv>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasCO2Sensor: true,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasPM25Sensor: false,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('measure_co2')
    })

    it('should include measure_pm25 when HasPM25Sensor is true', () => {
      const data = mock<ListDeviceDataErv>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasCO2Sensor: false,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasPM25Sensor: true,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('measure_pm25')
    })

    it('should include both sensors when both are available', () => {
      const data = mock<ListDeviceDataErv>({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasCO2Sensor: true,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        HasPM25Sensor: true,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('measure_co2')
      expect(capabilities).toContain('measure_pm25')
    })
  })
})
