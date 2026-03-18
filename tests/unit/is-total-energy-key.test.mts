import { describe, expect, it } from 'vitest'

import { isTotalEnergyKey } from '../../lib/is-total-energy-key.mts'

describe(isTotalEnergyKey, () => {
  it('should return false for measure_power keys', () => {
    expect(isTotalEnergyKey('measure_power')).toBe(false)
    expect(isTotalEnergyKey('measure_power.auto')).toBe(false)
    expect(isTotalEnergyKey('measure_power.cooling')).toBe(false)
  })

  it('should return false for daily keys', () => {
    expect(isTotalEnergyKey('meter_power.daily')).toBe(false)
    expect(isTotalEnergyKey('meter_power.daily_auto')).toBe(false)
    expect(isTotalEnergyKey('meter_power.cop_daily')).toBe(false)
  })

  it('should return true for total energy keys', () => {
    expect(isTotalEnergyKey('meter_power')).toBe(true)
    expect(isTotalEnergyKey('meter_power.auto')).toBe(true)
    expect(isTotalEnergyKey('meter_power.cooling')).toBe(true)
    expect(isTotalEnergyKey('meter_power.cop')).toBe(true)
  })
})
