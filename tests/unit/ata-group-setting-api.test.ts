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

vi.mock('../../lib/index.mts', () => ({
  getBuildings: mockGetBuildings,
}))

const { default: api } = await import('../../widgets/ata-group-setting/api.mts')

const mockApp = {
  getAtaCapabilities:
    vi.fn<() => [keyof GroupState, DriverCapabilitiesOptions][]>(),
  getAtaDetailedValues: vi.fn<() => Promise<GroupAtaStates>>(),
  getAtaValues: vi.fn<() => Promise<GroupState>>(),
  setAtaValues: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const homey = mock<Homey>({ app: mockApp, i18n: mockI18n } as never)

describe('ata-group-setting api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAtaCapabilities', () => {
    it('should delegate to app.getAtaCapabilities', () => {
      const capabilities =
        mock<[keyof GroupState, DriverCapabilitiesOptions][]>()
      mockApp.getAtaCapabilities.mockReturnValue(capabilities)

      const result = api.getAtaCapabilities({ homey })

      expect(result).toBe(capabilities)
      expect(mockApp.getAtaCapabilities).toHaveBeenCalledTimes(1)
    })
  })

  describe('getAtaValues', () => {
    const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })

    it('should call getAtaDetailedValues when mode is detailed', async () => {
      const detailedValues = mock<GroupAtaStates>()
      mockApp.getAtaDetailedValues.mockResolvedValue(detailedValues)

      const result = await api.getAtaValues({
        homey,
        params,
        query: { mode: 'detailed', status: 'on' },
      })

      expect(result).toBe(detailedValues)
      expect(mockApp.getAtaDetailedValues).toHaveBeenCalledWith(params, {
        status: 'on',
      })
    })

    it('should call getAtaValues when mode is not detailed', async () => {
      const values = mock<GroupState>()
      mockApp.getAtaValues.mockResolvedValue(values)

      const result = await api.getAtaValues({
        homey,
        params,
        query: { mode: undefined, status: undefined },
      })

      expect(result).toBe(values)
      expect(mockApp.getAtaValues).toHaveBeenCalledWith(params)
    })
  })

  describe('getBuildings', () => {
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

  describe('getLanguage', () => {
    it('should return the language from i18n', () => {
      mockI18n.getLanguage.mockReturnValue('en')

      const result = api.getLanguage({ homey })

      expect(result).toBe('en')
      expect(mockI18n.getLanguage).toHaveBeenCalledTimes(1)
    })
  })

  describe('setAtaValues', () => {
    it('should delegate to app.setAtaValues', async () => {
      const body = mock<GroupState>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.setAtaValues.mockResolvedValue()

      await api.setAtaValues({ body, homey, params })

      expect(mockApp.setAtaValues).toHaveBeenCalledWith(body, params)
    })
  })
})
