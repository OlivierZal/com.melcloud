import type {
  DeviceType,
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import type { HourNumbers } from 'luxon'

import type { DaysQuery, DeviceZone, HourQuery } from '../../types/index.mts'

import { getZones } from '../../lib/index.mts'

const api = {
  getDevices({
    query: { type },
  }: {
    query: { type?: `${DeviceType}` }
  }): DeviceZone[] {
    return getZones({ type: type ? Number(type) : undefined }).filter(
      (zone) => zone.model === 'devices',
    )
  },
  async getHourlyTemperatures({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> {
    return app.getHourlyTemperatures(
      deviceId,
      hour === undefined ? undefined : (Number(hour) as HourNumbers),
    )
  },
  getLanguage({ homey: { i18n } }: { homey: Homey }): string {
    return i18n.getLanguage()
  },
  async getOperationModes({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartPieOptions> {
    return app.getOperationModes(deviceId, Number(days))
  },
  async getSignal({
    homey: { app },
    params: { deviceId },
    query: { hour },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> {
    return app.getSignal(
      deviceId,
      hour === undefined ? undefined : (Number(hour) as HourNumbers),
    )
  },
  async getTemperatures({
    homey: { app },
    params: { deviceId },
    query: { days },
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> {
    return app.getTemperatures(deviceId, Number(days))
  },
}

export default api
