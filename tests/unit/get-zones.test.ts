import { DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getBuildings,
  getZones,
  setFacadeManager,
} from '../../lib/get-zones.mts'

const mockBuildings = [
  {
    areas: [],
    devices: [{ id: 1, level: 1, model: 'devices' as const, name: 'Device 1' }],
    floors: [],
    id: 10,
    level: 0,
    model: 'buildings' as const,
    name: 'Building 1',
  },
]

const mockZones = [
  { id: 10, level: 0, model: 'buildings' as const, name: 'Building 1' },
  { id: 1, level: 1, model: 'devices' as const, name: 'Device 1' },
]

const mockFacadeManager = {
  get: vi.fn().mockReturnValue(null),
  getBuildings: vi.fn().mockReturnValue(mockBuildings),
  getZones: vi.fn().mockReturnValue(mockZones),
}

describe('get-zones', () => {
  describe('when FacadeManager is not initialized', () => {
    it('should throw an error', async () => {
      vi.resetModules()
      const { getBuildings: uninitializedGetBuildings } =
        await import('../../lib/get-zones.mts')

      expect(() => uninitializedGetBuildings()).toThrow(
        'FacadeManager has not been initialized',
      )
    })
  })

  describe('when FacadeManager is initialized', () => {
    beforeEach(() => {
      setFacadeManager(mockFacadeManager as never)
      vi.clearAllMocks()
      mockFacadeManager.getBuildings.mockReturnValue(mockBuildings)
      mockFacadeManager.getZones.mockReturnValue(mockZones)
    })

    describe(getBuildings, () => {
      it('should delegate to facadeManager.getBuildings', () => {
        const result = getBuildings()

        expect(result).toBe(mockBuildings)
        expect(mockFacadeManager.getBuildings).toHaveBeenCalledWith({})
      })

      it('should pass type filter', () => {
        getBuildings({ type: DeviceType.Ata })

        expect(mockFacadeManager.getBuildings).toHaveBeenCalledWith({
          type: DeviceType.Ata,
        })
      })
    })

    describe(getZones, () => {
      it('should delegate to facadeManager.getZones', () => {
        const result = getZones()

        expect(result).toBe(mockZones)
        expect(mockFacadeManager.getZones).toHaveBeenCalledWith({})
      })

      it('should pass type filter', () => {
        getZones({ type: DeviceType.Atw })

        expect(mockFacadeManager.getZones).toHaveBeenCalledWith({
          type: DeviceType.Atw,
        })
      })
    })
  })
})
