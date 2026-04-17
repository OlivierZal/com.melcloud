import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type { Homey } from 'homey/lib/Homey'

import type { DaysQuery, HourQuery } from '../../types/widgets.mts'
import { getClassicZones } from '../../lib/classic-facade-manager.mts'
import { toDeviceType } from '../../lib/to-device-type.mts'
import { toHourNumbers, toNonNegativeInt } from '../../lib/validation.mts'

const DAYS_MAX = 366

const api = {
  getClassicDevices({
    query: { type },
  }: {
    query: { type?: `${Classic.DeviceType}` }
  }): Classic.DeviceZone[] {
    return getClassicZones({
      type: type ? toDeviceType(type) : undefined,
    }).filter((zone) => zone.model === 'devices')
  },
  async getClassicHourlyTemperatures({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> {
    return app.getClassicHourlyTemperatures({
      deviceId,
      hour: hour === undefined ? undefined : toHourNumbers(hour, 'hour'),
    })
  },
  async getClassicOperationModes({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartPieOptions> {
    return app.getClassicOperationModes({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    })
  },
  async getClassicSignal({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> {
    return app.getClassicSignal({
      deviceId,
      hour: hour === undefined ? undefined : toHourNumbers(hour, 'hour'),
    })
  },
  async getClassicTemperatures({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> {
    return app.getClassicTemperatures({
      days: toNonNegativeInt(days, { field: 'days', max: DAYS_MAX }),
      deviceId,
    })
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
}

export default api
