import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import * as Home from '@olivierzal/melcloud-api/home'

import type { GroupAtaStates } from '../../types/classic-ata.mts'
import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import type { GetAtaOptions } from '../../types/widgets.mts'
import type {
  DeviceOrZoneData,
  HomeBuildingZone,
  HomeDeviceZone,
  ZoneData,
} from '../../types/zone.mts'
import { getClassicBuildings } from '../../lib/classic-facade-manager.mts'
import { toDeviceType } from '../../lib/to-device-type.mts'
import { toDeviceOrZoneData, toZoneData } from '../../lib/validation.mts'

const api = {
  getClassicAtaCapabilities: ({
    homey: { app },
  }: {
    homey: Homey
  }): [keyof Classic.GroupState, DriverCapabilitiesOptions][] =>
    app.getClassicAtaCapabilities(),
  getClassicAtaDetailedStates: ({
    homey: { app },
    params,
    query: { status },
  }: {
    homey: Homey
    params: ZoneData
    query: GetAtaOptions
  }): GroupAtaStates =>
    app.getClassicAtaDetailedStates({ ...toZoneData(params), status }),
  getClassicAtaState: async ({
    homey: { app },
    params,
  }: {
    homey: Homey
    params: DeviceOrZoneData
  }): Promise<Classic.GroupState> =>
    app.getClassicAtaState(toDeviceOrZoneData(params)),
  getClassicBuildings: ({
    query: { type },
  }: {
    query: { type?: `${Classic.DeviceType}` }
  }): Classic.BuildingZone[] =>
    getClassicBuildings({
      type: type === undefined ? undefined : toDeviceType(type),
    }),
  getHomeAtaState: async ({
    homey: { app },
    params: { deviceId },
  }: {
    homey: Homey
    params: { deviceId: string }
  }): Promise<Classic.GroupState> => app.getHomeAtaState(deviceId),
  getHomeAtaTargets: ({
    homey: { app },
  }: {
    homey: Homey
  }): (HomeBuildingZone | HomeDeviceZone)[] =>
    app.getHomeTargets(Home.DeviceType.Ata),
  getHomeBuildingAtaModes: ({
    homey: { app },
    params: { buildingId },
  }: {
    homey: Homey
    params: { buildingId: string }
  }): number[] => app.getHomeBuildingAtaModes(buildingId),
  getHomeBuildingAtaState: async ({
    homey: { app },
    params: { buildingId },
  }: {
    homey: Homey
    params: { buildingId: string }
  }): Promise<Classic.GroupState> => app.getHomeBuildingAtaState(buildingId),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
  logWebviewBoot: ({
    body,
    homey: { app },
  }: {
    body: unknown
    homey: Homey
  }): void => {
    app.error('Widget boot failed:', JSON.stringify(body))
  },
  updateClassicAtaState: async ({
    body,
    homey: { app },
    params,
  }: {
    body: Classic.GroupState
    homey: Homey
    params: DeviceOrZoneData
  }): Promise<void> =>
    app.updateClassicAtaState({ state: body, ...toDeviceOrZoneData(params) }),
  updateHomeAtaState: async ({
    body,
    homey: { app },
    params: { deviceId },
  }: {
    body: Classic.GroupState
    homey: Homey
    params: { deviceId: string }
  }): Promise<void> => app.updateHomeAtaState({ deviceId, state: body }),
  updateHomeBuildingAtaState: async ({
    body,
    homey: { app },
    params: { buildingId },
  }: {
    body: Classic.GroupState
    homey: Homey
    params: { buildingId: string }
  }): Promise<void> =>
    app.updateHomeBuildingAtaState({ buildingId, state: body }),
}

export default api
