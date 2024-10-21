import { getBuildings } from '../../lib/index.mjs'

import type { GroupAtaState } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey.js'

import type MELCloudApp from '../../app.mjs'
import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
  ZoneData,
} from '../../types/index.mjs'

const getApp = (homey: Homey): MELCloudApp => homey.app as MELCloudApp

const api = {
  getAtaCapabilities({
    homey,
  }: {
    homey: Homey
  }): [keyof GroupAtaState, DriverCapabilitiesOptions][] {
    return getApp(homey).getAtaCapabilities()
  },
  async getAtaValues<T extends keyof GroupAtaState>({
    homey,
    params,
    query,
  }: {
    homey: Homey
    params: ZoneData
    query?: GetAtaOptions
  }): Promise<GroupAtaState | Record<T, GroupAtaState[T][]>> {
    const { mode, status } = query ?? {}
    return mode === 'detailed' ?
        getApp(homey).getAtaValues(params, mode, status)
      : getApp(homey).getAtaValues(params)
  },
  getBuildings(): BuildingZone[] {
    return getBuildings()
  },
  async setAtaValues({
    body,
    homey,
    params,
  }: {
    body: GroupAtaState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return getApp(homey).setAtaValues(body, params)
  },
}

export default api
