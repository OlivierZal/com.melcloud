import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import type { GroupAtaStates } from '../../types/classic-ata.mts'
import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import type { GetAtaOptions } from '../../types/widgets.mts'
import type {
  DeviceOrZoneData,
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
  getHomeAtaDevices: ({ homey: { app } }: { homey: Homey }): HomeDeviceZone[] =>
    app.getHomeAtaDeviceZones(),
  getHomeAtaState: ({
    homey: { app },
    params: { deviceId },
  }: {
    homey: Homey
    params: { deviceId: string }
  }): Classic.GroupState => app.getHomeAtaState(deviceId),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
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
}

export default api
