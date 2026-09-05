import type * as Home from '@olivierzal/melcloud-api/home'

import { KILO } from '../lib/constants.mts'
import { unwrapResult } from '../lib/unwrap-result.mts'
import type { EnergyReportConfig } from './base-report.mts'
import type { HomeMELCloudDevice } from './home-device.mts'
import {
  HomeEnergyReport,
  POWER_WINDOW,
  POWER_WINDOW_HOURS,
  sumSince,
  TELEMETRY_INTERVAL,
  toEnergyPoints,
} from './home-report.mts'

export class HomeEnergyReportAta extends HomeEnergyReport<
  typeof Home.DeviceType.Ata
> {
  public constructor(
    device: HomeMELCloudDevice<typeof Home.DeviceType.Ata>,
    config: EnergyReportConfig,
  ) {
    super(device, config, {
      fetchPoints: async (facade, { from, to }) =>
        toEnergyPoints(
          unwrapResult(
            await facade.getEnergySeries({
              from,
              interval: TELEMETRY_INTERVAL,
              to,
            }),
          ),
        ),
      // Coarse average: kWh over the trailing window divided by its
      // span reads kW, scaled to W — the wire's 100 Wh pulse quantum
      // makes anything finer noise.
      watts: (points, now) =>
        (sumSince(points, now.subtract(POWER_WINDOW)) / POWER_WINDOW_HOURS) *
        KILO,
    })
  }
}
