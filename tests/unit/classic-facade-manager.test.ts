import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

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
    name: 'ClassicBuilding 1',
  },
]

const mockZones = [
  { id: 10, level: 0, model: 'buildings' as const, name: 'ClassicBuilding 1' },
  { id: 1, level: 1, model: 'devices' as const, name: 'Device 1' },
]

const mockFacadeManager = {
  get: vi.fn().mockReturnValue(null),
  getBuildings: vi.fn().mockReturnValue(mockBuildings),
  getZones: vi.fn().mockReturnValue(mockZones),
}

describe('classic-facade-manager', () => {
  describe('when Classic.FacadeManager is not initialized', () => {
    it('should throw an error', async () => {
      vi.resetModules()
      const { getClassicBuildings: uninitializedGetBuildings } =
        await import('../../lib/classic-facade-manager.mts')

      expect(() => uninitializedGetBuildings()).toThrow(
        'Classic.FacadeManager has not been initialized',
      )
    })
  })

  describe('when Classic.FacadeManager is initialized', () => {
    beforeEach(() => {
      setClassicFacadeManager(
        mock<Classic.FacadeManager>({
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
        getClassicBuildings({ type: Classic.DeviceType.Ata })

        expect(mockFacadeManager.getBuildings).toHaveBeenCalledWith({
          type: Classic.DeviceType.Ata,
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
        getClassicZones({ type: Classic.DeviceType.Atw })

        expect(mockFacadeManager.getZones).toHaveBeenCalledWith({
          type: Classic.DeviceType.Atw,
        })
      })
    })
  })
})
