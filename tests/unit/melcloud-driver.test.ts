import { DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  classicEnergyCapabilityTagMappingAta,
  classicGetCapabilityTagMappingAta,
  classicListCapabilityTagMappingAta,
  classicSetCapabilityTagMappingAta,
} from '../../types/index.mts'
import { testDriverType, testTagMappings } from '../driver-descriptors.ts'
import ClassicMELCloudDriverAta from '../../drivers/melcloud/driver.mts'

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDriverClass } = await import('../helpers.ts')
  return { default: { Driver: createMockDriverClass() } }
})

describe(ClassicMELCloudDriverAta, () => {
  let driver: ClassicMELCloudDriverAta

  beforeEach(() => {
    driver = new ClassicMELCloudDriverAta()
  })

  testDriverType(() => driver, DeviceType.Ata)

  testTagMappings(() => driver, {
    energyCapabilityTagMapping: classicEnergyCapabilityTagMappingAta,
    getCapabilityTagMapping: classicGetCapabilityTagMappingAta,
    listCapabilityTagMapping: classicListCapabilityTagMappingAta,
    setCapabilityTagMapping: classicSetCapabilityTagMappingAta,
  })

  describe('required capabilities', () => {
    it('should return all operational capabilities except measure_signal_strength', () => {
      const capabilities = driver.getRequiredCapabilities()

      expect(capabilities).not.toContain('measure_signal_strength')
      expect(capabilities).toContain('onoff')
      expect(capabilities).toContain('measure_temperature')
    })

    it('should include all set, get, and list capability keys', () => {
      const capabilities = driver.getRequiredCapabilities()
      const allKeys = Object.keys({
        ...classicSetCapabilityTagMappingAta,
        ...classicGetCapabilityTagMappingAta,
        ...classicListCapabilityTagMappingAta,
      }).filter((key) => key !== 'measure_signal_strength')

      expect(capabilities).toStrictEqual(allKeys)
    })
  })
})
