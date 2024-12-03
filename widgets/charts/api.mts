import { getZones } from '../../lib/get-zones.mts'

import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'
import type { HourNumbers } from 'luxon'

import type { DaysQuery, DeviceZone, HourQuery } from '../../types/common.mts'

const api = {
  getDevices(): DeviceZone[] {
    return getZones().filter(
      (zone): zone is DeviceZone => zone.model === 'devices',
    )
  },
  async getHourlyTemperatures({
    homey,
    params,
    query,
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> {
    const { hour } = query
    return homey.app.getHourlyTemperatures(
      params.deviceId,
      hour === undefined ? undefined : (Number(hour) as HourNumbers),
    )
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
  },
  async getOperationModes({
    homey,
    params,
    query,
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartPieOptions> {
    return homey.app.getOperationModes(params.deviceId, Number(query.days))
  },
  async getSignal({
    homey,
    params,
    query,
  }: {
    homey: Homey
    params: { deviceId: string }
    query: HourQuery
  }): Promise<ReportChartLineOptions> {
    const { hour } = query
    return homey.app.getSignal(
      params.deviceId,
      hour === undefined ? undefined : (Number(hour) as HourNumbers),
    )
  },
  async getTemperatures({
    homey,
    params,
    query,
  }: {
    homey: Homey
    params: { deviceId: string }
    query: DaysQuery
  }): Promise<ReportChartLineOptions> {
    return homey.app.getTemperatures(params.deviceId, Number(query.days))
  },
}

export default api
