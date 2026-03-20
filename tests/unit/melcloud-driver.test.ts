import { DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MELCloudDriverAta from '../../drivers/melcloud/driver.mts'

import {
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types/index.mts'
import { testDriverType, testTagMappings } from '../helpers.ts'

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('homey', async () => {
  const { createMockDriverClass } = await import('../helpers.ts')
  return { default: { Driver: createMockDriverClass() } }
})

describe(MELCloudDriverAta, () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations
  let driver: MELCloudDriverAta

  beforeEach(() => {
    driver = new MELCloudDriverAta()
  })

  testDriverType(() => driver, DeviceType.Ata)

  testTagMappings(() => driver, {
    energyCapabilityTagMapping: energyCapabilityTagMappingAta,
    getCapabilityTagMapping: getCapabilityTagMappingAta,
    listCapabilityTagMapping: listCapabilityTagMappingAta,
    setCapabilityTagMapping: setCapabilityTagMappingAta,
  })

  describe('getRequiredCapabilities', () => {
    it('should return all operational capabilities except measure_signal_strength', () => {
      const capabilities = driver.getRequiredCapabilities()

      expect(capabilities).not.toContain('measure_signal_strength')
      expect(capabilities).toContain('onoff')
      expect(capabilities).toContain('measure_temperature')
    })

    it('should include all set, get, and list capability keys', () => {
      const capabilities = driver.getRequiredCapabilities()
      const allKeys = Object.keys({
        ...setCapabilityTagMappingAta,
        ...getCapabilityTagMappingAta,
        ...listCapabilityTagMappingAta,
      }).filter((key) => key !== 'measure_signal_strength')

      expect(capabilities).toStrictEqual(allKeys)
    })
  })
})
