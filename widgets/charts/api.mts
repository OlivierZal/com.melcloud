import { getDevices } from '../../lib/get-zones.mts'

import type { ReportChartLineOptions } from '@olivierzal/melcloud-api'
import type { Homey } from 'homey/lib/Homey'

import type { BaseZone, DaysQuery } from '../../types/common.mts'

const api = {
  getDevices(): BaseZone[] {
    return getDevices()
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
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
