/**
 * Total energy keys exclude keys starting with `measure_power`
 * (instantaneous hourly power) and keys containing `daily` (daily subtotals).
 * What remains are cumulative total counters and COP values.
 * @param key - Capability id to classify against the total-energy criteria.
 * @returns Whether the capability is a cumulative total counter or COP value.
 */
export const isTotalEnergyKey = (key: string): boolean =>
  !key.startsWith('measure_power') && !key.includes('daily')
