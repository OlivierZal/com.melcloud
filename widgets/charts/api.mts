import type {
  DeviceType,
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import type { HourNumbers } from 'luxon'

import type { DaysQuery, DeviceZone, HourQuery } from '../../types/index.mts'
import { getClassicZones, toDeviceType } from '../../lib/index.mts'

const api = {
  getClassicDevices({
    query: { type },
  }: {
    query: { type?: `${DeviceType}` }
  }): DeviceZone[] {
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing Number to HourNumbers (0-23)
      hour: hour === undefined ? undefined : (Number(hour) as HourNumbers),
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
    return app.getClassicOperationModes({ days: Number(days), deviceId })
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing Number to HourNumbers (0-23)
      hour: hour === undefined ? undefined : (Number(hour) as HourNumbers),
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
    return app.getClassicTemperatures({ days: Number(days), deviceId })
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
}

export default api
