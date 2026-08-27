import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type { FlatDeviceZone } from '../../types/zone.mts'
import { toHour, toNonNegativeInt } from '../../lib/validation.mts'
import { getWebviewHashes } from '../../lib/webview-hashes.mts'
import {
  type DaysQuery,
  type HourQuery,
  DAYS_MAX,
} from '../../types/widgets.mts'

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
    query: { hour },
  }: {
    homey: Homey
    params: { targetId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> =>
    app.getTargetHourlyTemperatures({
      hour: hour === undefined ? undefined : toHour(hour, 'hour'),
      targetId,
    }),
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
    query: { hour },
  }: {
    homey: Homey
    params: { targetId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> =>
    app.getTargetSignal({
      hour: hour === undefined ? undefined : toHour(hour, 'hour'),
      targetId,
    }),
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
