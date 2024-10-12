import { getBuildings } from '../../lib'

import type { GroupAtaState } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey'

import type MELCloudApp from '../..'
import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaMode,
  ZoneData,
} from '../../types'

const getApp = (homey: Homey): MELCloudApp => homey.app as MELCloudApp

export = {
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
    query?: GetAtaMode
  }): Promise<GroupAtaState | Record<T, GroupAtaState[T][]>> {
    return query?.mode === 'detailed' ?
        getApp(homey).getAtaValues(params, query.mode)
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
