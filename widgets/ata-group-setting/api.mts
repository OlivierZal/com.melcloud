import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import type { GroupAtaStates } from '../../types/classic-ata.mts'
import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import type { GetAtaOptions } from '../../types/widgets.mts'
import type { ZoneData } from '../../types/zone.mts'
import { getClassicBuildings } from '../../lib/classic-facade-manager.mts'
import { toDeviceType } from '../../lib/to-device-type.mts'

const api = {
  getClassicAtaCapabilities({
    homey: { app },
  }: {
    homey: Homey
  }): [keyof Classic.GroupState, DriverCapabilitiesOptions][] {
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
  }): Promise<Classic.GroupState | GroupAtaStates> {
    return mode === 'detailed' ?
        app.getClassicAtaDetailedStates({ ...params, status })
      : app.getClassicAtaState(params)
  },
  getClassicBuildings({
    query: { type },
  }: {
    query: { type?: `${Classic.DeviceType}` }
  }): Classic.BuildingZone[] {
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
    body: Classic.GroupState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    return app.updateClassicAtaState({ state: body, ...params })
  },
}

export default api
