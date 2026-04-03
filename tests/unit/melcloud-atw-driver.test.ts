import { type ListDeviceDataAtw, DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  energyCapabilityTagMappingAtw,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
} from '../../types/index.mts'
import { mock, testDriverType, testTagMappings } from '../helpers.ts'
import MELCloudDriverAtw from '../../drivers/melcloud_atw/driver.mts'

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDriverClass } = await import('../helpers.ts')
  return { default: { Driver: createMockDriverClass() } }
})

describe(MELCloudDriverAtw, () => {
  let driver: MELCloudDriverAtw

  beforeEach(() => {
    driver = new MELCloudDriverAtw()
  })

  testDriverType(() => driver, DeviceType.Atw)

  testTagMappings(() => driver, {
    energyCapabilityTagMapping: energyCapabilityTagMappingAtw,
    getCapabilityTagMapping: getCapabilityTagMappingAtw,
    listCapabilityTagMapping: listCapabilityTagMappingAtw,
    setCapabilityTagMapping: setCapabilityTagMappingAtw,
  })

  describe('required capabilities', () => {
    it('should return zone1 capabilities for basic device', () => {
      const data = mock<ListDeviceDataAtw>({
        CanCool: false,
        HasZone2: false,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('onoff')
      expect(capabilities).toContain('measure_temperature')
      expect(capabilities).toContain('thermostat_mode')
      expect(capabilities).not.toContain('target_temperature.flow_cool')
      expect(capabilities).not.toContain('thermostat_mode.zone2')
    })

    it('should include cool capabilities when CanCool is true', () => {
      const data = mock<ListDeviceDataAtw>({
        CanCool: true,
        HasZone2: false,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('target_temperature.flow_cool')
    })

    it('should include zone2 capabilities when HasZone2 is true', () => {
      const data = mock<ListDeviceDataAtw>({
        CanCool: false,
        HasZone2: true,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('thermostat_mode.zone2')
      expect(capabilities).toContain('measure_temperature.zone2')
      expect(capabilities).toContain('operational_state.zone2')
      expect(capabilities).not.toContain('target_temperature.flow_cool_zone2')
    })

    it('should include zone2 cool capabilities when both CanCool and HasZone2 are true', () => {
      const data = mock<ListDeviceDataAtw>({
        CanCool: true,
        HasZone2: true,
      })
      const capabilities = driver.getRequiredCapabilities(data)

      expect(capabilities).toContain('target_temperature.flow_cool_zone2')
      expect(capabilities).toContain('target_temperature.flow_cool')
      expect(capabilities).toContain('thermostat_mode.zone2')
    })
  })
})
