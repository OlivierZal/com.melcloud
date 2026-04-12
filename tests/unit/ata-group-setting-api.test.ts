import type { GroupState } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GroupAtaStates,
  ZoneData,
} from '../../types/index.mts'
import { mock } from '../helpers.js'

const mockGetBuildings = vi.fn<() => BuildingZone[]>()

vi.mock(import('../../lib/index.mts'), async (importOriginal) => ({
  ...(await importOriginal()),
  getBuildings: mockGetBuildings,
}))

const { default: api } = await import('../../widgets/ata-group-setting/api.mts')

const mockApp = {
  getAtaCapabilities:
    vi.fn<() => [keyof GroupState, DriverCapabilitiesOptions][]>(),
  getAtaDetailedValues: vi.fn<() => Promise<GroupAtaStates>>(),
  getAtaState: vi.fn<() => Promise<GroupState>>(),
  setAtaState: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('ata-group-setting api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ata capability retrieval', () => {
    it('should delegate to app.getAtaCapabilities', () => {
      const capabilities =
        mock<[keyof GroupState, DriverCapabilitiesOptions][]>()
      mockApp.getAtaCapabilities.mockReturnValue(capabilities)

      const result = api.getAtaCapabilities({ homey })

      expect(result).toBe(capabilities)
      expect(mockApp.getAtaCapabilities).toHaveBeenCalledTimes(1)
    })
  })

  describe('ata value retrieval', () => {
    const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })

    it('should call getAtaDetailedValues when mode is detailed', async () => {
      const detailedValues = mock<GroupAtaStates>()
      mockApp.getAtaDetailedValues.mockResolvedValue(detailedValues)

      const result = await api.getAtaState({
        homey,
        params,
        query: { mode: 'detailed', status: 'on' },
      })

      expect(result).toBe(detailedValues)
      expect(mockApp.getAtaDetailedValues).toHaveBeenCalledWith({
        ...params,
        status: 'on',
      })
    })

    it('should call getAtaState when mode is not detailed', async () => {
      const values = mock<GroupState>()
      mockApp.getAtaState.mockResolvedValue(values)

      const result = await api.getAtaState({
        homey,
        params,
        query: { mode: undefined, status: undefined },
      })

      expect(result).toBe(values)
      expect(mockApp.getAtaState).toHaveBeenCalledWith(params)
    })
  })

  describe('building retrieval', () => {
    it('should delegate to getBuildings without type', () => {
      const buildings = mock<BuildingZone[]>()
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getBuildings({ query: { type: undefined } })

      expect(result).toBe(buildings)
      expect(mockGetBuildings).toHaveBeenCalledWith({ type: undefined })
    })

    it('should pass numeric type filter', () => {
      const buildings = mock<BuildingZone[]>()
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getBuildings({ query: { type: '0' } })

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
    it('should delegate to app.setAtaState', async () => {
      const body = mock<GroupState>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.setAtaState.mockResolvedValue()

      await api.setAtaState({ body, homey, params })

      expect(mockApp.setAtaState).toHaveBeenCalledWith({
        state: body,
        ...params,
      })
    })
  })
})
