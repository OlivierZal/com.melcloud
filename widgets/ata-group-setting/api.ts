import { getBuildings } from '../../lib'

import type { GroupAtaState } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey'

import type MELCloudApp from '../..'
import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
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
