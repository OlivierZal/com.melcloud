import type { BuildingZone, GroupState } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DriverCapabilitiesOptions } from '../../types/settings.mts'
import type { GroupAtaStates, ZoneData } from '../../types/widgets.mts'
import { mock } from '../helpers.js'

const mockGetBuildings = vi.fn<() => BuildingZone[]>()

vi.mock(
  import('../../lib/classic-facade-manager.mts'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    getClassicBuildings: mockGetBuildings,
  }),
)

const { default: api } = await import('../../widgets/ata-group-setting/api.mts')

const mockApp = {
  getClassicAtaCapabilities:
    vi.fn<() => [keyof GroupState, DriverCapabilitiesOptions][]>(),
  getClassicAtaDetailedStates: vi.fn<() => Promise<GroupAtaStates>>(),
  getClassicAtaState: vi.fn<() => Promise<GroupState>>(),
  updateClassicAtaState: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('ata-group-setting api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ata capability retrieval', () => {
    it('should delegate to app.getClassicAtaCapabilities', () => {
      const capabilities =
        mock<[keyof GroupState, DriverCapabilitiesOptions][]>()
      mockApp.getClassicAtaCapabilities.mockReturnValue(capabilities)

      const result = api.getClassicAtaCapabilities({ homey })

      expect(result).toBe(capabilities)
      expect(mockApp.getClassicAtaCapabilities).toHaveBeenCalledTimes(1)
    })
  })

  describe('ata value retrieval', () => {
    const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })

    it('should call getClassicAtaDetailedStates when mode is detailed', async () => {
      const detailedValues = mock<GroupAtaStates>()
      mockApp.getClassicAtaDetailedStates.mockResolvedValue(detailedValues)

      const result = await api.getClassicAtaState({
        homey,
        params,
        query: { mode: 'detailed', status: 'on' },
      })

      expect(result).toBe(detailedValues)
      expect(mockApp.getClassicAtaDetailedStates).toHaveBeenCalledWith({
        ...params,
        status: 'on',
      })
    })

    it('should call getClassicAtaState when mode is not detailed', async () => {
      const values = mock<GroupState>()
      mockApp.getClassicAtaState.mockResolvedValue(values)

      const result = await api.getClassicAtaState({
        homey,
        params,
        query: { mode: undefined, status: undefined },
      })

      expect(result).toBe(values)
      expect(mockApp.getClassicAtaState).toHaveBeenCalledWith(params)
    })
  })

  describe('building retrieval', () => {
    it('should delegate to getClassicBuildings without type', () => {
      const buildings = mock<BuildingZone[]>()
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getClassicBuildings({ query: { type: undefined } })

      expect(result).toBe(buildings)
      expect(mockGetBuildings).toHaveBeenCalledWith({ type: undefined })
    })

    it('should pass numeric type filter', () => {
      const buildings = mock<BuildingZone[]>()
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getClassicBuildings({ query: { type: '0' } })

      expect(result).toBe(buildings)
      expect(mockGetBuildings).toHaveBeenCalledWith({ type: 0 })
    })
  })

  describe('language retrieval', () => {
    it('should return the language from i18n', () => {
      mockI18n.getLanguage.mockReturnValue('en')

      const result = api.getLanguage({ homey })

      expect(result).toBe('en')
      expect(mockI18n.getLanguage).toHaveBeenCalledTimes(1)
    })
  })

  describe('ata value update', () => {
    it('should delegate to app.updateClassicAtaState', async () => {
      const body = mock<GroupState>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.updateClassicAtaState.mockResolvedValue()

      await api.updateClassicAtaState({ body, homey, params })

      expect(mockApp.updateClassicAtaState).toHaveBeenCalledWith({
        state: body,
        ...params,
      })
    })
  })
})
