import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type { FlatDeviceZone } from '../../types/zone.mts'
import { toNonNegativeInt } from '../../lib/validation.mts'
import { getWebviewHashes } from '../../lib/webview-hashes.mts'
import { type DaysQuery, DAYS_MAX } from '../../types/widgets.mts'

const api = {
  getDevices: ({ homey: { app } }: { homey: Homey }): FlatDeviceZone[] =>
    app.getDeviceZones(),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
  getTargetEnergyReport: async ({
    homey: { app },
    params: { targetId },
    query: { days },
  }: {
    homey: Homey
    params: { targetId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> =>
    app.getTargetEnergyReport({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      targetId,
    }),
  getTargetHourlyTemperatures: async ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Promise<ReportChartLineOptions> =>
    app.getTargetHourlyTemperatures(targetId),
  getTargetOperationModes: async ({
    homey: { app },
    params: { targetId },
    query: { days },
  }: {
    homey: Homey
    params: { targetId: string }
    query: DaysQuery
  }): Promise<ReportChartPieOptions> =>
    app.getTargetOperationModes({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      targetId,
    }),
  getTargetSignal: async ({
    homey: { app },
    params: { targetId },
  }: {
    homey: Homey
    params: { targetId: string }
  }): Promise<ReportChartLineOptions> => app.getTargetSignal(targetId),
  getTargetTemperatures: async ({
    homey: { app },
    params: { targetId },
    query: { days },
  }: {
    homey: Homey
    params: { targetId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> =>
    app.getTargetTemperatures({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      targetId,
    }),
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
}

export default api
