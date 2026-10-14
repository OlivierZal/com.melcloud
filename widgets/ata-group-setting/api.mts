import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

import type { DriverCapabilitiesOptions } from '../../types/driver-settings.mts'
import { getWebviewHashes } from '../../lib/webview-hashes.mts'

const api = {
  getClassicAtaCapabilities: ({
    homey: { app },
  }: {
    homey: Homey
  }): [keyof Classic.GroupState, DriverCapabilitiesOptions][] =>
    app.getClassicAtaCapabilities(),
  // The widget drives ATA groups, so the only buildings it can ask for
  // are the ATA ones; the route takes no query.
  getClassicBuildings: ({
    homey: { app },
  }: {
    homey: Homey
  }): Classic.BuildingZone[] => app.getClassicBuildings(Classic.DeviceType.Ata),
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
