import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Home from '@olivierzal/melcloud-api/home'

import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import { mock } from '../helpers.ts'

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
  getHomeTargets: vi.fn<() => (HomeBuildingZone | HomeDeviceZone)[]>(),
  getTargetAtaModes: vi.fn<() => Classic.OperationMode[]>(),
  getTargetAtaState: vi.fn<() => Promise<Classic.GroupState>>(),
  updateTargetAtaState: vi.fn<() => Promise<void>>(),
}

const mockI18n = { getLanguage: vi.fn<() => string>() }

const homey = mock<Homey>({ app: mockApp, i18n: mockI18n })

describe('ata-group-setting api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('webview boot logging', () => {
    it('should log the boot failure body via app.error', () => {
      api.logWebviewBoot({ body: { message: 'boom' }, homey })

      expect(mockApp.error).toHaveBeenCalledTimes(1)
    })
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
    it.each([
      'buildings_1',
      'devices_42',
      'homeBuildings_b_1',
      'homeDevices_guid-1',
    ])(
      'should delegate the %s state with the raw targetId',
      async (targetId) => {
        const values = mock<Classic.GroupState>()
        mockApp.getTargetAtaState.mockResolvedValue(values)

        const result = await api.getTargetAtaState({
          homey,
          params: { targetId },
        })

        expect(result).toBe(values)
        expect(mockApp.getTargetAtaState).toHaveBeenCalledWith(targetId)
      },
    )

    it('should delegate member modes with the raw targetId', () => {
      mockApp.getTargetAtaModes.mockReturnValue([1, 3])

      const result = api.getTargetAtaModes({
        homey,
        params: { targetId: 'homeBuildings_b_1' },
      })

      expect(result).toStrictEqual([1, 3])
      expect(mockApp.getTargetAtaModes).toHaveBeenCalledWith(
        'homeBuildings_b_1',
      )
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

    it('should throw on invalid device type', () => {
      expect(() =>
        api.getClassicBuildings({ query: { type: '99' as '0' } }),
      ).toThrow(RangeError)
      expect(mockGetBuildings).not.toHaveBeenCalled()
    })
  })

  describe('home target retrieval', () => {
    it('should delegate to app.getHomeTargets for the ATA type', () => {
      const targets = mock<(HomeBuildingZone | HomeDeviceZone)[]>()
      mockApp.getHomeTargets.mockReturnValue(targets)

      const result = api.getHomeAtaTargets({ homey })

      expect(result).toBe(targets)
      expect(mockApp.getHomeTargets).toHaveBeenCalledWith(Home.DeviceType.Ata)
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
    it.each([
      'buildings_1',
      'devices_42',
      'homeBuildings_b_1',
      'homeDevices_guid-1',
    ])(
      'should delegate the %s update with targetId and body',
      async (targetId) => {
        const body = mock<Classic.GroupState>()
        mockApp.updateTargetAtaState.mockResolvedValue()

        await api.updateTargetAtaState({ body, homey, params: { targetId } })

        expect(mockApp.updateTargetAtaState).toHaveBeenCalledWith(
          targetId,
          body,
        )
      },
    )
  })

  describe('webview hashes', () => {
    it('should serve the packaged manifest map', async () => {
      // A dev suite run packages no manifest: the empty map is the
      // documented fresh-by-default answer.
      await expect(api.getWebviewHashes()).resolves.toStrictEqual({})
    })
  })
})
