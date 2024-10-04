import { getBuildings } from '../../lib'

import type { GroupAtaState } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey'

import type MELCloudApp from '../..'
import type {
  BuildingZone,
  DriverCapabilitiesOptions,
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
  async getAtaValues({
    homey,
    params,
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<GroupAtaState> {
    return getApp(homey).getAtaValues(params)
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
