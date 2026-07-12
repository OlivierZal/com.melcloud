import type HomeyModule from 'homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type { InteropModule } from '../helpers.ts'
import {
  energyCapabilityTagMapping,
  getCapabilityTagMapping,
  listCapabilityTagMapping,
  setCapabilityTagMapping,
} from '../../types/classic-ata.mts'
import { testDriverType, testTagMappings } from '../driver-descriptors.ts'
import ClassicMELCloudDriverAta from '../../drivers/melcloud/driver.mts'

vi.mock(import('homey'), async () => {
  const { createMockDriverClass, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Driver: createMockDriverClass() },
  })
})

describe(ClassicMELCloudDriverAta, () => {
  let driver: ClassicMELCloudDriverAta

  beforeEach(() => {
    driver = new ClassicMELCloudDriverAta()
  })

  testDriverType(() => driver, Classic.DeviceType.Ata)

  testTagMappings(() => driver, {
    energyCapabilityTagMapping,
    getCapabilityTagMapping,
    listCapabilityTagMapping,
    setCapabilityTagMapping,
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
        ...setCapabilityTagMapping,
        ...getCapabilityTagMapping,
        ...listCapabilityTagMapping,
      }).filter((key) => key !== 'measure_signal_strength')

      expect(capabilities).toStrictEqual(allKeys)
    })
  })
})
