import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { GroupAtaStates } from '../../types/classic-ata.mts'
import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import type {
  DeviceOrZoneData,
  HomeBuildingZone,
  HomeDeviceZone,
  ZoneData,
} from '../../types/zone.mts'
import { mock } from '../helpers.js'

const mockGetBuildings = vi.fn<() => Classic.BuildingZone[]>()

vi.mock(
  import('../../lib/classic-facade-manager.mts'),
  async (importOriginal) => ({
    ...(await importOriginal()),
    getClassicBuildings: mockGetBuildings,
  }),
)

const { default: api } = await import('../../widgets/ata-group-setting/api.mts')

const mockApp = {
  error: vi.fn<(...args: readonly unknown[]) => void>(),
  getClassicAtaCapabilities:
    vi.fn<() => [keyof Classic.GroupState, DriverCapabilitiesOptions][]>(),
  getClassicAtaDetailedStates: vi.fn<() => GroupAtaStates>(),
  getClassicAtaState: vi.fn<() => Promise<Classic.GroupState>>(),
  getHomeAtaState: vi.fn<() => Promise<Classic.GroupState>>(),
  getHomeAtaTargets: vi.fn<() => (HomeBuildingZone | HomeDeviceZone)[]>(),
  getHomeBuildingAtaModes: vi.fn<() => number[]>(),
  getHomeBuildingAtaState: vi.fn<() => Promise<Classic.GroupState>>(),
  updateClassicAtaState: vi.fn<() => Promise<void>>(),
  updateHomeAtaState: vi.fn<() => Promise<void>>(),
  updateHomeBuildingAtaState: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('ata-group-setting api', () => {
  describe('webview boot logging', () => {
    it('should log the boot failure body via app.error', () => {
      api.logWebviewBoot({ body: { message: 'boom' }, homey })

      expect(mockApp.error).toHaveBeenCalledTimes(1)
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ata capability retrieval', () => {
    it('should delegate to app.getClassicAtaCapabilities', () => {
      const capabilities =
        mock<[keyof Classic.GroupState, DriverCapabilitiesOptions][]>()
      mockApp.getClassicAtaCapabilities.mockReturnValue(capabilities)

      const result = api.getClassicAtaCapabilities({ homey })

      expect(result).toBe(capabilities)
      expect(mockApp.getClassicAtaCapabilities).toHaveBeenCalledTimes(1)
    })
  })

  describe('ata value retrieval', () => {
    const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })

    it('should delegate detailed states to their dedicated endpoint', () => {
      const detailedValues = mock<GroupAtaStates>()
      mockApp.getClassicAtaDetailedStates.mockReturnValue(detailedValues)

      const result = api.getClassicAtaDetailedStates({
        homey,
        params,
        query: { status: 'on' },
      })

      expect(result).toBe(detailedValues)
      expect(mockApp.getClassicAtaDetailedStates).toHaveBeenCalledWith({
        ...params,
        status: 'on',
      })
    })

    it('should delegate group state to app.getClassicAtaState', async () => {
      const values = mock<Classic.GroupState>()
      mockApp.getClassicAtaState.mockResolvedValue(values)

      const result = await api.getClassicAtaState({ homey, params })

      expect(result).toBe(values)
      expect(mockApp.getClassicAtaState).toHaveBeenCalledWith(params)
    })

    it('should accept a single device as group state target', async () => {
      const deviceParams = mock<DeviceOrZoneData>({
        zoneId: '42',
        zoneType: 'devices',
      })
      const values = mock<Classic.GroupState>()
      mockApp.getClassicAtaState.mockResolvedValue(values)

      const result = await api.getClassicAtaState({
        homey,
        params: deviceParams,
      })

      expect(result).toBe(values)
      expect(mockApp.getClassicAtaState).toHaveBeenCalledWith(deviceParams)
    })

    it('should reject an invalid zone type on the group state path', async () => {
      await expect(
        api.getClassicAtaState({
          homey,
          params: { zoneId: '1', zoneType: 'constructor' as 'buildings' },
        }),
      ).rejects.toThrow(RangeError)
    })

    it('should reject an invalid zone type from the URL', () => {
      expect(() =>
        api.getClassicAtaDetailedStates({
          homey,
          params: { zoneId: '1', zoneType: 'constructor' as 'buildings' },
          query: {},
        }),
      ).toThrow(RangeError)
    })

    it('should keep detailed states zone-only', () => {
      expect(() =>
        api.getClassicAtaDetailedStates({
          homey,
          params: { zoneId: '42', zoneType: 'devices' as 'buildings' },
          query: {},
        }),
      ).toThrow(RangeError)
    })
  })

  describe('building retrieval', () => {
    it('should delegate to getClassicBuildings without type', () => {
      const buildings = mock<Classic.BuildingZone[]>()
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getClassicBuildings({ query: {} })

      expect(result).toBe(buildings)
      expect(mockGetBuildings).toHaveBeenCalledWith({ type: undefined })
    })

    it('should pass numeric type filter', () => {
      const buildings = mock<Classic.BuildingZone[]>()
      mockGetBuildings.mockReturnValue(buildings)

      const result = api.getClassicBuildings({ query: { type: '0' } })

      expect(result).toBe(buildings)
      expect(mockGetBuildings).toHaveBeenCalledWith({ type: 0 })
    })
  })

  describe('home target retrieval', () => {
    it('should delegate to app.getHomeAtaTargets', () => {
      const targets = mock<(HomeBuildingZone | HomeDeviceZone)[]>()
      mockApp.getHomeAtaTargets.mockReturnValue(targets)

      const result = api.getHomeAtaTargets({ homey })

      expect(result).toBe(targets)
      expect(mockApp.getHomeAtaTargets).toHaveBeenCalledTimes(1)
    })

    it('should delegate home state to app.getHomeAtaState', async () => {
      const values = mock<Classic.GroupState>()
      mockApp.getHomeAtaState.mockResolvedValue(values)

      const result = await api.getHomeAtaState({
        homey,
        params: { deviceId: 'home_1' },
      })

      expect(result).toBe(values)
      expect(mockApp.getHomeAtaState).toHaveBeenCalledWith('home_1')
    })

    it('should delegate building state to app.getHomeBuildingAtaState', async () => {
      const values = mock<Classic.GroupState>()
      mockApp.getHomeBuildingAtaState.mockResolvedValue(values)

      const result = await api.getHomeBuildingAtaState({
        homey,
        params: { buildingId: 'building_1' },
      })

      expect(result).toBe(values)
      expect(mockApp.getHomeBuildingAtaState).toHaveBeenCalledWith('building_1')
    })

    it('should delegate building modes to app.getHomeBuildingAtaModes', () => {
      mockApp.getHomeBuildingAtaModes.mockReturnValue([1, 3])

      const result = api.getHomeBuildingAtaModes({
        homey,
        params: { buildingId: 'building_1' },
      })

      expect(result).toStrictEqual([1, 3])
      expect(mockApp.getHomeBuildingAtaModes).toHaveBeenCalledWith('building_1')
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
      const body = mock<Classic.GroupState>()
      const params = mock<ZoneData>({ zoneId: '1', zoneType: 'buildings' })
      mockApp.updateClassicAtaState.mockResolvedValue()

      await api.updateClassicAtaState({ body, homey, params })

      expect(mockApp.updateClassicAtaState).toHaveBeenCalledWith({
        state: body,
        ...params,
      })
    })

    it('should accept a single device as update target', async () => {
      const body = mock<Classic.GroupState>()
      const params = mock<DeviceOrZoneData>({
        zoneId: '42',
        zoneType: 'devices',
      })
      mockApp.updateClassicAtaState.mockResolvedValue()

      await api.updateClassicAtaState({ body, homey, params })

      expect(mockApp.updateClassicAtaState).toHaveBeenCalledWith({
        state: body,
        ...params,
      })
    })

    it('should delegate home updates to app.updateHomeAtaState', async () => {
      const body = mock<Classic.GroupState>()
      mockApp.updateHomeAtaState.mockResolvedValue()

      await api.updateHomeAtaState({
        body,
        homey,
        params: { deviceId: 'home_1' },
      })

      expect(mockApp.updateHomeAtaState).toHaveBeenCalledWith({
        deviceId: 'home_1',
        state: body,
      })
    })

    it('should delegate building updates to app.updateHomeBuildingAtaState', async () => {
      const body = mock<Classic.GroupState>()
      mockApp.updateHomeBuildingAtaState.mockResolvedValue()

      await api.updateHomeBuildingAtaState({
        body,
        homey,
        params: { buildingId: 'building_1' },
      })

      expect(mockApp.updateHomeBuildingAtaState).toHaveBeenCalledWith({
        buildingId: 'building_1',
        state: body,
      })
    })
  })
})
