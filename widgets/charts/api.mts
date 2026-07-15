import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import { getClassicZones } from '../../lib/classic-facade-manager.mts'
import { toDeviceType } from '../../lib/to-device-type.mts'
import { toHour, toNonNegativeInt } from '../../lib/validation.mts'
import {
  type DaysQuery,
  type HourQuery,
  DAYS_MAX,
} from '../../types/widgets.mts'

const api = {
  getClassicDevices: ({
    query: { type },
  }: {
    query: { type?: `${Classic.DeviceType}` }
  }): Classic.DeviceZone[] =>
    getClassicZones({
      type: type === undefined ? undefined : toDeviceType(type),
    }).filter((zone) => zone.model === 'devices'),
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
