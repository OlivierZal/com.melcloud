/**
 * Total energy keys exclude measure_power.* (instantaneous hourly power) and
 * *daily* (daily subtotals). What remains are cumulative total counters and COP values.
 */
export const isTotalEnergyKey = (key: string): boolean =>
  !key.startsWith('measure_power') && !key.includes('daily')
