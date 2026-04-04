import type { DeviceType, GroupState } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
  GroupAtaStates,
  ZoneData,
} from '../../types/index.mts'
import { getBuildings, toDeviceType } from '../../lib/index.mts'

const api = {
  getAtaCapabilities({
    homey: { app },
  }: {
    homey: Homey
  }): [keyof GroupState, DriverCapabilitiesOptions][] {
    return app.getAtaCapabilities()
  },
  async getAtaState({
    homey: { app },
    params,
    query: { mode, status },
  }: {
    homey: Homey
    params: ZoneData
    query: GetAtaOptions
  }): Promise<GroupAtaStates | GroupState> {
    return mode === 'detailed' ?
        app.getAtaDetailedValues(params, { status })
      : app.getAtaState(params)
  },
  getBuildings({
    query: { type },
  }: {
    query: { type?: `${DeviceType}` }
  }): BuildingZone[] {
    return getBuildings({
      type: type ? toDeviceType(type) : undefined,
    })
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
  async setAtaState({
    body,
    homey: { app },
    params,
  }: {
    body: GroupState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.setAtaState(body, params)
  },
}

export default api
