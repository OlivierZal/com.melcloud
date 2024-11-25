import { getBuildings } from '../../lib/get-buildings.mts'

import type { GroupState } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
  GroupAtaStates,
  ZoneData,
} from '../../types/common.mts'

const api = {
  getAtaCapabilities({
    homey,
  }: {
    homey: Homey
  }): [keyof GroupState, DriverCapabilitiesOptions][] {
    return homey.app.getAtaCapabilities()
  },
  async getAtaValues({
    homey,
    params,
    query,
  }: {
    homey: Homey
    params: ZoneData
    query?: GetAtaOptions
  }): Promise<GroupAtaStates | GroupState> {
    const { mode, status } = query ?? {}
    return mode === 'detailed' ?
        homey.app.getAtaDetailedValues(params, status)
      : homey.app.getAtaValues(params)
  },
  getBuildings(): BuildingZone[] {
    return getBuildings()
  },
  async setAtaValues({
    body,
    homey,
    params,
  }: {
    body: GroupState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return homey.app.setAtaValues(body, params)
  },
}

export default api
