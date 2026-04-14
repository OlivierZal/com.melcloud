import { type ClassicFacadeManager, DeviceType } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getClassicBuildings,
  getClassicZones,
  setClassicFacadeManager,
} from '../../lib/classic-facade-manager.mts'
import { mock } from '../helpers.ts'

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

describe('classic-facade-manager', () => {
  describe('when FacadeManager is not initialized', () => {
    it('should throw an error', async () => {
      vi.resetModules()
      const { getClassicBuildings: uninitializedGetBuildings } =
        await import('../../lib/classic-facade-manager.mts')

      expect(() => uninitializedGetBuildings()).toThrow(
        'FacadeManager has not been initialized',
      )
    })
  })

  describe('when FacadeManager is initialized', () => {
    beforeEach(() => {
      setClassicFacadeManager(
        mock<ClassicFacadeManager>({
          get: mockFacadeManager.get,
          getBuildings: mockFacadeManager.getBuildings,
          getZones: mockFacadeManager.getZones,
        }),
      )
      vi.clearAllMocks()
      mockFacadeManager.getBuildings.mockReturnValue(mockBuildings)
      mockFacadeManager.getZones.mockReturnValue(mockZones)
    })

    describe(getClassicBuildings, () => {
      it('should delegate to facadeManager.getBuildings', () => {
        const result = getClassicBuildings()

        expect(result).toBe(mockBuildings)
        expect(mockFacadeManager.getBuildings).toHaveBeenCalledWith({})
      })

      it('should pass type filter', () => {
        getClassicBuildings({ type: DeviceType.Ata })

        expect(mockFacadeManager.getBuildings).toHaveBeenCalledWith({
          type: DeviceType.Ata,
        })
      })
    })

    describe(getClassicZones, () => {
      it('should delegate to facadeManager.getZones', () => {
        const result = getClassicZones()

        expect(result).toBe(mockZones)
        expect(mockFacadeManager.getZones).toHaveBeenCalledWith({})
      })

      it('should pass type filter', () => {
        getClassicZones({ type: DeviceType.Atw })

        expect(mockFacadeManager.getZones).toHaveBeenCalledWith({
          type: DeviceType.Atw,
        })
      })
    })
  })
})
