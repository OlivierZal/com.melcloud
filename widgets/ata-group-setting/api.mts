import type {
  BuildingZone,
  DeviceType,
  GroupState,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type { DriverCapabilitiesOptions } from '../../types/settings.mts'
import type {
  GetAtaOptions,
  GroupAtaStates,
  ZoneData,
} from '../../types/widgets.mts'
import { getClassicBuildings } from '../../lib/classic-facade-manager.mts'
import { toDeviceType } from '../../lib/to-device-type.mts'

const api = {
  getClassicAtaCapabilities({
    homey: { app },
  }: {
    homey: Homey
  }): [keyof GroupState, DriverCapabilitiesOptions][] {
    return app.getClassicAtaCapabilities()
  },
  async getClassicAtaState({
    homey: { app },
    params,
    query: { mode, status },
  }: {
    homey: Homey
    params: ZoneData
    query: GetAtaOptions
  }): Promise<GroupAtaStates | GroupState> {
    return mode === 'detailed' ?
        app.getClassicAtaDetailedStates({ ...params, status })
      : app.getClassicAtaState(params)
  },
  getClassicBuildings({
    query: { type },
  }: {
    query: { type?: `${DeviceType}` }
  }): BuildingZone[] {
    return getClassicBuildings({
      type: type ? toDeviceType(type) : undefined,
    })
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
  async updateClassicAtaState({
    body,
    homey: { app },
    params,
  }: {
    body: GroupState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.updateClassicAtaState({ state: body, ...params })
  },
}

export default api
