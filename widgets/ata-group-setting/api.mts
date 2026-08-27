import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'
import * as Home from '@olivierzal/melcloud-api/home'

import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import { getClassicBuildings } from '../../lib/classic-facade-manager.mts'
import { toDeviceType } from '../../lib/to-device-type.mts'
import { getWebviewHashes } from '../../lib/webview-hashes.mts'

const api = {
  getClassicAtaCapabilities: ({
    homey: { app },
  }: {
    homey: Homey
  }): [keyof Classic.GroupState, DriverCapabilitiesOptions][] =>
    app.getClassicAtaCapabilities(),
  getClassicBuildings: ({
    query: { type },
  }: {
    query: { type?: `${Classic.DeviceType}` }
  }): Classic.BuildingZone[] =>
    getClassicBuildings({
      type: type === undefined ? undefined : toDeviceType(type),
    }),
  getHomeAtaTargets: ({
    homey: { app },
  }: {
    homey: Homey
  }): (HomeBuildingZone | HomeDeviceZone)[] =>
    app.getHomeTargets(Home.DeviceType.Ata),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
  getTargetAtaModes: ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Classic.OperationMode[] => app.getTargetAtaModes(targetId),
  getTargetAtaState: async ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Promise<Classic.GroupState> => app.getTargetAtaState(targetId),
  getWebviewHashes: async (): Promise<Partial<Record<string, string>>> =>
    getWebviewHashes(),
  logWebviewBoot: ({
    body,
    homey: { app },
  }: {
    body: unknown
    homey: Homey
  }): void => {
    app.error('Widget boot failed:', JSON.stringify(body))
  },
  updateTargetAtaState: async ({
    body,
    homey: { app },
    params: { targetId },
  }: {
    body: Classic.GroupState
    homey: Homey
    params: { targetId: string }
  }): Promise<void> => app.updateTargetAtaState(targetId, body),
}

export default api
