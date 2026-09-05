import type * as Home from '@olivierzal/melcloud-api/home'
import { Temporal } from 'temporal-polyfill'

import { KILO } from '../lib/constants.mts'
import { unwrapResult } from '../lib/unwrap-result.mts'
import type { EnergyReportConfig } from './base-report.mts'
import type { HomeMELCloudDevice } from './home-device.mts'
import {
  type EnergyPoint,
  HomeEnergyReport,
  MINUTES_PER_HOUR,
  POWER_FRESHNESS,
  TELEMETRY_INTERVAL,
  toEnergyPoints,
} from './home-report.mts'

// Near-live reading: the latest minute bucket within the freshness horizon
// (kWh per minute → W); a sparse window means an idle unit.
const latestBucketWatts = (
  points: readonly EnergyPoint[],
  now: Temporal.Instant,
): number => {
  const boundary = now.subtract(POWER_FRESHNESS)
  let latest: EnergyPoint | null = null
  for (const point of points) {
    if (
      Temporal.Instant.compare(point.instant, boundary) >= 0 &&
      (latest === null ||
        Temporal.Instant.compare(point.instant, latest.instant) > 0)
    ) {
      latest = point
    }
  }
  return latest === null ? 0 : latest.value * MINUTES_PER_HOUR * KILO
}

export class HomeEnergyReportAtw extends HomeEnergyReport<
  typeof Home.DeviceType.Atw
> {
  public constructor(
    device: HomeMELCloudDevice<typeof Home.DeviceType.Atw>,
    config: EnergyReportConfig,
  ) {
    super(device, config, {
      watts: latestBucketWatts,
      fetchPoints: async (facade, { from, measure, to }) =>
        toEnergyPoints(
          unwrapResult(
            await facade.getEnergySeries({
              from,
              interval: TELEMETRY_INTERVAL,
              measure,
              to,
            }),
          ),
        ),
    })
  }
}
