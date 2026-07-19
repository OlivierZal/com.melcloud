import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'
import type { Homey } from 'homey/lib/Homey'

import type { HomeDeviceZone } from '../../types/zone.mts'
import { toDeviceType, toHomeDeviceType } from '../../lib/to-device-type.mts'
import { toHour, toNonNegativeInt } from '../../lib/validation.mts'
import {
  type DaysQuery,
  type HourQuery,
  DAYS_MAX,
} from '../../types/widgets.mts'

const api = {
  getClassicDevices: ({
    homey: { app },
    query: { type },
  }: {
    homey: Homey
    query: { type?: `${Classic.DeviceType}` }
  }): Classic.Zone[] =>
    app.getClassicDeviceZones(
      type === undefined ? undefined : toDeviceType(type),
    ),
  getClassicEnergyReport: async ({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> =>
    app.getClassicEnergyReport({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    }),
  getClassicHourlyTemperatures: async ({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> =>
    app.getClassicHourlyTemperatures({
      deviceId,
      hour: hour === undefined ? undefined : toHour(hour, 'hour'),
    }),
  getClassicOperationModes: async ({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartPieOptions> =>
    app.getClassicOperationModes({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    }),
  getClassicSignal: async ({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> =>
    app.getClassicSignal({
      deviceId,
      hour: hour === undefined ? undefined : toHour(hour, 'hour'),
    }),
  getClassicTemperatures: async ({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> =>
    app.getClassicTemperatures({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    }),
  getHomeDevices: ({
    homey: { app },
    query: { type },
  }: {
    homey: Homey
    query: { type?: Home.DeviceType }
  }): HomeDeviceZone[] =>
    app.getHomeDeviceZones(
      type === undefined ? undefined : toHomeDeviceType(type),
    ),
  getHomeEnergyReport: async ({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> =>
    app.getHomeEnergyReport({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    }),
  getHomeHourlyTemperatures: async ({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> =>
    app.getHomeHourlyTemperatures({
      deviceId,
      hour: hour === undefined ? undefined : toHour(hour, 'hour'),
    }),
  getHomeOperationModes: async ({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartPieOptions> =>
    app.getHomeOperationModes({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    }),
  getHomeSignal: async ({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> =>
    app.getHomeSignal({
      deviceId,
      hour: hour === undefined ? undefined : toHour(hour, 'hour'),
    }),
  getHomeTemperatures: async ({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> =>
    app.getHomeTemperatures({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    }),
  getLanguage: ({ homey: { i18n } }: { homey: Homey }): string =>
    i18n.getLanguage(),
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
