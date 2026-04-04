import { DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types/index.mts'
import { testDriverType, testTagMappings } from '../helpers.ts'
import MELCloudDriverAta from '../../drivers/melcloud/driver.mts'

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDriverClass } = await import('../helpers.ts')
  const {
    energyCapabilityTagMappingAta: energy,
    getCapabilityTagMappingAta: get,
    listCapabilityTagMappingAta: list,
    setCapabilityTagMappingAta: set,
  } = await import('../../types/index.mts')
  return {
    default: {
      Driver: createMockDriverClass({
        manifest: {
          capabilities: Object.keys({ ...set, ...get, ...list, ...energy }),
        },
      }),
    },
  }
})

describe(MELCloudDriverAta, () => {
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

  describe('required capabilities', () => {
    it('should return all operational capabilities except measure_signal_strength', () => {
      const capabilities = driver.getRequiredCapabilities()

      expect(capabilities).not.toContain('measure_signal_strength')
      expect(capabilities).toContain('onoff')
      expect(capabilities).toContain('measure_temperature')
    })

    it('should include all manifest capabilities except measure_signal_strength', () => {
      const capabilities = driver.getRequiredCapabilities()
      const allKeys = Object.keys({
        ...setCapabilityTagMappingAta,
        ...getCapabilityTagMappingAta,
        ...listCapabilityTagMappingAta,
        ...energyCapabilityTagMappingAta,
      }).filter((key) => key !== 'measure_signal_strength')

      expect(capabilities).toStrictEqual(allKeys)
    })
  })
})
