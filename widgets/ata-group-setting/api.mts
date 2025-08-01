import type { DeviceType, GroupState } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
  GroupAtaStates,
  ZoneData,
} from '../../types/index.mts'

import { getBuildings } from '../../lib/get-zones.mts'

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
    query: GetAtaOptions
  }): Promise<GroupAtaStates | GroupState> {
    const { mode, status } = query
    return mode === 'detailed' ?
        homey.app.getAtaDetailedValues(params, { status })
      : homey.app.getAtaValues(params)
  },
  getBuildings({
    query,
  }: {
    query: { type?: `${DeviceType}` }
  }): BuildingZone[] {
    const { type } = query
    return getBuildings({ type: type ? Number(type) : undefined })
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
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
