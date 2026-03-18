/* eslint-disable
    @typescript-eslint/init-declarations,
    @typescript-eslint/naming-convention,
*/
import { DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MELCloudDriverAta from '../../drivers/melcloud/driver.mts'

import {
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types/index.mts'

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

    public manifest = { capabilities: [] }
  }

  return { default: { Driver: MockDriver } }
})

describe(MELCloudDriverAta, () => {
  let driver: MELCloudDriverAta

  beforeEach(() => {
    driver = new MELCloudDriverAta()
  })

  describe('type', () => {
    it('should be DeviceType.Ata', () => {
      expect(driver.type).toBe(DeviceType.Ata)
    })
  })

  describe('tag mappings', () => {
    it('should use the correct energy capability tag mapping', () => {
      expect(driver.energyCapabilityTagMapping).toBe(
        energyCapabilityTagMappingAta,
      )
    })

    it('should use the correct get capability tag mapping', () => {
      expect(driver.getCapabilityTagMapping).toBe(getCapabilityTagMappingAta)
    })

    it('should use the correct list capability tag mapping', () => {
      expect(driver.listCapabilityTagMapping).toBe(listCapabilityTagMappingAta)
    })

    it('should use the correct set capability tag mapping', () => {
      expect(driver.setCapabilityTagMapping).toBe(setCapabilityTagMappingAta)
    })
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
