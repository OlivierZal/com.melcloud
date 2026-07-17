import type * as Home from '@olivierzal/melcloud-api/home'

import { unwrapResult } from '../lib/unwrap-result.mts'
import type { EnergyReportConfig } from './base-report.mts'
import type { HomeMELCloudDevice } from './home-device.mts'
import {
  HomeEnergyReport,
  POWER_WINDOW,
  POWER_WINDOW_HOURS,
  parsePoints,
  sumSince,
  TELEMETRY_INTERVAL,
  WATT_HOURS_PER_KILOWATT_HOUR,
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
        parsePoints(
          unwrapResult(
            await facade.getEnergy({ from, interval: TELEMETRY_INTERVAL, to }),
          ),
        ),
      // ATA telemetry is Wh pulses: scale sums down to kWh.
      kilowattHours: (wireSum) => wireSum / WATT_HOURS_PER_KILOWATT_HOUR,
      // Coarse average: Wh pulses over the trailing window divided by its
      // span — the 100 Wh quantum makes anything finer noise.
      watts: (points, now) =>
        sumSince(points, now.subtract(POWER_WINDOW)) / POWER_WINDOW_HOURS,
    })
  }
}
